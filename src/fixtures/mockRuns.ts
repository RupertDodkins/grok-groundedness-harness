import type { CandidateRun, EvalItem, VariantId } from "../types.js";

const variants: VariantId[] = ["baseline", "strict-citations", "abstention-first"];

function candidateFor(evalItem: EvalItem, variantId: VariantId): CandidateRun {
  const strict = variantId === "strict-citations";
  const abstention = variantId === "abstention-first";

  if (evalItem.expectedBehavior === "abstain") {
    const shouldAbstain = abstention || strict;
    return {
      evalId: evalItem.id,
      variantId,
      latencyMs: strict ? 1200 : 700,
      costUsd: strict ? 0.006 : 0.003,
      candidate: {
        decision: shouldAbstain ? "abstain" : "answer",
        answer: shouldAbstain
          ? "Public evidence is insufficient to answer that."
          : "The internal rationale is likely product prioritization.",
        claims: shouldAbstain
          ? []
          : [{
              id: "claim-1",
              text: evalItem.goldClaims?.find((claim) => claim.support === "unsupported")?.claim
                ?? "Unsupported internal claim.",
              confidence: 0.86,
              citationIds: [],
              supportLevel: "none",
            }],
        overallConfidence: shouldAbstain ? 0.62 : 0.86,
        needsHumanReview: !shouldAbstain,
      },
    };
  }

  if (evalItem.expectedBehavior === "ask_for_context") {
    const asks = abstention;
    return {
      evalId: evalItem.id,
      variantId,
      latencyMs: strict ? 1300 : 650,
      costUsd: strict ? 0.006 : 0.003,
      candidate: {
        decision: asks ? "ask_for_context" : "answer",
        answer: asks
          ? "I need a current source before answering."
          : "Yes, Grok 4.3 is the latest model.",
        claims: asks
          ? []
          : [{
              id: "claim-1",
              text: "Grok 4.3 is the latest Grok model today.",
              confidence: 0.78,
              citationIds: [],
              supportLevel: "unknown",
            }],
        overallConfidence: asks ? 0.55 : 0.78,
        needsHumanReview: !asks,
      },
    };
  }

  const supportedClaim = evalItem.goldClaims?.find((claim) => claim.support === "supported");
  const unsupportedClaim = evalItem.goldClaims?.find((claim) => claim.support === "unsupported");
  const sourceId = supportedClaim?.sourceIds?.[0];
  const includeOverclaim = variantId === "baseline" && unsupportedClaim !== undefined;

  return {
    evalId: evalItem.id,
    variantId,
    latencyMs: strict ? 1500 : abstention ? 1100 : 800,
    costUsd: strict ? 0.008 : abstention ? 0.006 : 0.004,
    candidate: {
      decision: "answer",
      answer: includeOverclaim
        ? `${supportedClaim?.claim ?? "Supported answer."} ${unsupportedClaim.claim}`
        : supportedClaim?.claim ?? "Source-grounded answer.",
      claims: [
        ...(supportedClaim ? [{
          id: "claim-1",
          text: supportedClaim.claim,
          confidence: strict ? 0.82 : 0.76,
          citationIds: sourceId ? [sourceId] : [],
          supportLevel: sourceId ? "direct" as const : "unknown" as const,
        }] : []),
        ...(includeOverclaim ? [{
          id: "claim-2",
          text: unsupportedClaim?.claim ?? "Unsupported overclaim.",
          confidence: 0.84,
          citationIds: sourceId ? [sourceId] : [],
          supportLevel: "partial" as const,
        }] : []),
      ],
      overallConfidence: strict ? 0.8 : 0.76,
      needsHumanReview: evalItem.expectedBehavior === "needs_review" || includeOverclaim,
    },
  };
}

export function mockRunsForEvals(evals: EvalItem[]): CandidateRun[] {
  return evals.flatMap((evalItem) => variants.map((variant) => candidateFor(evalItem, variant)));
}
