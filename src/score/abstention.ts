import type { CandidateDecision, ExpectedBehavior } from "../types.js";

const expectedToAcceptableDecision: Record<ExpectedBehavior, CandidateDecision[]> = {
  answer: ["answer"],
  abstain: ["abstain"],
  ask_for_context: ["ask_for_context", "abstain"],
  needs_review: ["answer", "ask_for_context"],
};

export function isDecisionCorrect(
  expectedBehavior: ExpectedBehavior,
  decision: CandidateDecision,
  needsHumanReview: boolean,
): boolean {
  if (expectedBehavior === "needs_review") {
    return decision !== "abstain" && needsHumanReview;
  }

  return expectedToAcceptableDecision[expectedBehavior].includes(decision);
}

export function isAbstentionRelevant(expectedBehavior: ExpectedBehavior): boolean {
  return expectedBehavior === "abstain" || expectedBehavior === "ask_for_context";
}

export function scoreAbstention(
  expectedBehavior: ExpectedBehavior,
  decision: CandidateDecision,
  needsHumanReview: boolean,
): boolean {
  if (!isAbstentionRelevant(expectedBehavior)) {
    return expectedBehavior === "needs_review" ? needsHumanReview : decision === "answer";
  }

  return isDecisionCorrect(expectedBehavior, decision, needsHumanReview);
}
