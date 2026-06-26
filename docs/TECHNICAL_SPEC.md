# Technical Spec

## Design Summary

This harness evaluates whether Grok answers are grounded in their own retrieved evidence.

It is self-referential by design:

- Grok produces an answer and cites evidence.
- The harness checks whether the answer's atomic claims are supported by that evidence.
- The harness scores confidence calibration and abstention behavior.

It does not ask Claude, OpenAI, Gemini, or another provider to decide whether Grok is correct.

## Core Pipeline

```text
eval prompt
  -> candidate Grok config
  -> structured answer + claims + citations + confidence
  -> verifier over returned evidence / source packet
  -> metrics
  -> variant comparison
  -> regression gate
  -> report
```

## Eval Item Schema

Each eval item should be JSONL.

```ts
type EvalItem = {
  id: string;
  category:
    | "answerable_public"
    | "citation_overclaim"
    | "stale_context"
    | "unsupported_internal"
    | "connector_workflow"
    | "abstention_required";
  prompt: string;
  expectedBehavior: "answer" | "abstain" | "ask_for_context" | "needs_review";
  sourcePacket?: SourceSnippet[];
  goldClaims?: GoldClaim[];
  notes?: string;
};

type SourceSnippet = {
  id: string;
  title: string;
  url?: string;
  publishedAt?: string;
  text: string;
};

type GoldClaim = {
  claim: string;
  support: "supported" | "unsupported" | "uncertain";
  sourceIds?: string[];
};
```

## Candidate Output Schema

The model should be asked to return structured JSON.

```ts
type CandidateAnswer = {
  decision: "answer" | "abstain" | "ask_for_context";
  answer: string;
  claims: CandidateClaim[];
  overallConfidence: number;
  needsHumanReview: boolean;
  reviewReason?: string;
};

type CandidateClaim = {
  id: string;
  text: string;
  confidence: number;
  citationIds: string[];
  supportLevel: "direct" | "partial" | "none" | "unknown";
};
```

## Verifier Output Schema

```ts
type ClaimVerdict = {
  claimId: string;
  verdict: "supported" | "partially_supported" | "unsupported" | "not_enough_evidence";
  reason: string;
  supportingSourceIds: string[];
  overclaim: boolean;
};

type EvalResult = {
  evalId: string;
  variantId: string;
  decisionCorrect: boolean;
  groundednessScore: number;
  abstentionCorrect: boolean;
  unsupportedHighConfidenceClaims: number;
  expectedCalibrationBucket: string;
  latencyMs: number;
  costUsd?: number;
  needsReview: boolean;
  gate: "pass" | "warn" | "fail";
  claimVerdicts: ClaimVerdict[];
};
```

## Groundedness Scoring

Claim-level scoring:

- `supported`: cited evidence directly supports the claim.
- `partially_supported`: cited evidence supports a weaker version of the claim.
- `unsupported`: cited evidence does not support the claim.
- `not_enough_evidence`: the claim may be true, but the returned evidence is insufficient.

Per-answer groundedness:

```text
groundedness = supported_claims / total_non_abstained_claims
```

Overclaim penalty:

```text
unsupported_high_confidence = count(claim.confidence >= 0.75 and verdict not supported)
```

## Abstention Scoring

Eval labels define expected behavior:

- `answer`: model should answer with evidence.
- `abstain`: model should refuse to invent unsupported facts.
- `ask_for_context`: model should request missing context.
- `needs_review`: model may draft but must route to human review.

Metrics:

- abstention accuracy;
- false abstention rate;
- false proceed rate;
- unsupported internal-answer rate.

The most important failure:

> High-confidence proceed on a prompt labeled `unsupported_internal` or `abstention_required`.

## Calibration

Bucket predictions by confidence:

- 0.0-0.2
- 0.2-0.4
- 0.4-0.6
- 0.6-0.8
- 0.8-1.0

Empirical correctness can be defined as:

```text
correct = decisionCorrect and groundednessScore >= threshold and unsupportedHighConfidenceClaims == 0
```

Expected calibration error:

```text
ECE = sum_over_buckets(bucket_size / total) * abs(avg_confidence - empirical_accuracy)
```

## Variants

Initial variants:

### `baseline`

Normal answer with minimal reliability instructions.

### `strict-citations`

Require atomic claims and citation IDs per claim.

### `abstention-first`

Emphasize asking for context or abstaining when evidence is missing.

### `fast-control`

Lower-context or search-disabled control if supported and useful.

## Regression Gate

Default thresholds:

```json
{
  "minGroundedness": 0.80,
  "minAbstentionAccuracy": 0.75,
  "maxUnsupportedHighConfidenceRate": 0.05,
  "maxExpectedCalibrationError": 0.12
}
```

A variant fails if it violates any hard threshold.

## Report Shape

The report should be intentionally plain:

1. What was tested.
2. Which variants ran.
3. Metric table.
4. Calibration chart.
5. Abstention confusion matrix.
6. Failure examples.
7. Regression gate result.
8. Methodology notes.

## Methodology Notes

- Small eval sets are directional reliability probes.
- Source-packet labels are human-authored and inspectable.
- LLM-generated claim extraction can introduce errors; inspect samples.
- Public API behavior can vary across surfaces.

## Methodology Claim

The strongest defensible claim is:

> This harness measures whether a Grok-style chat answer is tethered to its own evidence, when it should abstain, and whether prompt/config changes improve reliability while tracking latency and cost.
