import type {
  CandidateAnswer,
  CandidateClaim,
  ClaimVerdictResult,
  EvalItem,
  GoldClaim,
} from "../types.js";

function normalize(text: string): string[] {
  const stopwords = new Set([
    "the",
    "and",
    "are",
    "for",
    "that",
    "this",
    "with",
    "using",
    "into",
    "from",
    "about",
    "they",
    "their",
    "should",
  ]);
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 2 && !stopwords.has(token));
}

function overlapScore(a: string, b: string): number {
  const left = new Set(normalize(a));
  const right = new Set(normalize(b));
  if (left.size === 0 || right.size === 0) return 0;
  let overlap = 0;
  for (const token of left) {
    if (right.has(token)) overlap += 1;
  }
  return overlap / Math.max(left.size, right.size);
}

function bestGoldMatch(
  claim: CandidateClaim,
  goldClaims: GoldClaim[] = [],
  support?: GoldClaim["support"],
): { claim: GoldClaim; score: number } | undefined {
  let best: { claim: GoldClaim; score: number } | undefined;
  for (const goldClaim of goldClaims) {
    if (support && goldClaim.support !== support) continue;
    const score = overlapScore(claim.text, goldClaim.claim);
    if (!best || score > best.score) best = { claim: goldClaim, score };
  }
  return best;
}

function hasExpectedCitation(claim: CandidateClaim, goldClaim: GoldClaim): boolean {
  if (!goldClaim.sourceIds || goldClaim.sourceIds.length === 0) {
    return claim.citationIds.length > 0;
  }

  return claim.citationIds.some((sourceId) => goldClaim.sourceIds?.includes(sourceId));
}

function sourceSupport(evalItem: EvalItem, claim: CandidateClaim): ClaimVerdictResult | undefined {
  const citedSources = evalItem.sourcePacket?.filter((source) => claim.citationIds.includes(source.id)) ?? [];
  let best: { sourceId: string; score: number } | undefined;

  for (const source of citedSources) {
    const score = Math.max(
      overlapScore(claim.text, source.text),
      overlapScore(claim.text, `${source.title} ${source.text}`),
    );
    if (!best || score > best.score) best = { sourceId: source.id, score };
  }

  if (!best) return undefined;

  if (best.score >= 0.28) {
    return {
      claimId: claim.id,
      verdict: "supported",
      reason: "Claim is supported by the cited source packet.",
      supportingSourceIds: [best.sourceId],
      overclaim: false,
      confidence: claim.confidence,
    };
  }

  return {
    claimId: claim.id,
    verdict: "partially_supported",
    reason: "Claim cites a source packet, but the text support is weak.",
    supportingSourceIds: [best.sourceId],
    overclaim: false,
    confidence: claim.confidence,
  };
}

export function verdictForClaim(evalItem: EvalItem, claim: CandidateClaim): ClaimVerdictResult {
  const unsupportedGold = bestGoldMatch(claim, evalItem.goldClaims, "unsupported");
  if (unsupportedGold && unsupportedGold.score >= 0.62) {
    return {
      claimId: claim.id,
      verdict: "unsupported",
      reason: "Matched a gold claim labeled unsupported.",
      supportingSourceIds: unsupportedGold.claim.sourceIds ?? [],
      overclaim: true,
      confidence: claim.confidence,
    };
  }

  const supportedGold = bestGoldMatch(claim, evalItem.goldClaims, "supported");
  if (supportedGold && supportedGold.score >= 0.32) {
    if (!hasExpectedCitation(claim, supportedGold.claim)) {
      return {
        claimId: claim.id,
        verdict: "partially_supported",
        reason: "Matched a supported gold claim, but did not cite the expected source.",
        supportingSourceIds: supportedGold.claim.sourceIds ?? [],
        overclaim: false,
        confidence: claim.confidence,
      };
    }

    return {
      claimId: claim.id,
      verdict: "supported",
      reason: "Claim matches supported gold claim and cites expected evidence.",
      supportingSourceIds: supportedGold.claim.sourceIds ?? claim.citationIds,
      overclaim: false,
      confidence: claim.confidence,
    };
  }

  const uncertainGold = bestGoldMatch(claim, evalItem.goldClaims, "uncertain");
  if (uncertainGold && uncertainGold.score >= 0.45) {
    return {
      claimId: claim.id,
      verdict: "not_enough_evidence",
      reason: "Matched a gold claim labeled uncertain.",
      supportingSourceIds: uncertainGold.claim.sourceIds ?? [],
      overclaim: false,
      confidence: claim.confidence,
    };
  }

  const sourceVerdict = sourceSupport(evalItem, claim);
  if (sourceVerdict) return sourceVerdict;

  return {
    claimId: claim.id,
    verdict: claim.citationIds.length > 0 ? "not_enough_evidence" : "unsupported",
    reason: claim.citationIds.length > 0
      ? "No matching gold claim or sufficient source-packet support for the cited assertion."
      : "Claim has no citation and no matching gold support packet.",
    supportingSourceIds: [],
    overclaim: true,
    confidence: claim.confidence,
  };
}

export function scoreGroundedness(evalItem: EvalItem, candidate: CandidateAnswer): {
  groundednessScore: number;
  verdicts: ClaimVerdictResult[];
  unsupportedHighConfidenceClaims: number;
} {
  if (candidate.decision === "abstain" || candidate.decision === "ask_for_context") {
    return {
      groundednessScore: 1,
      verdicts: [],
      unsupportedHighConfidenceClaims: 0,
    };
  }

  const verdicts = candidate.claims.map((claim) => verdictForClaim(evalItem, claim));
  if (verdicts.length === 0) {
    return {
      groundednessScore: 0,
      verdicts,
      unsupportedHighConfidenceClaims: 0,
    };
  }

  const supported = verdicts.filter((verdict) => verdict.verdict === "supported").length;
  const unsupportedHighConfidenceClaims = verdicts.filter(
    (verdict) => verdict.confidence >= 0.75
      && (verdict.verdict === "unsupported" || verdict.verdict === "not_enough_evidence"),
  ).length;

  return {
    groundednessScore: supported / verdicts.length,
    verdicts,
    unsupportedHighConfidenceClaims,
  };
}
