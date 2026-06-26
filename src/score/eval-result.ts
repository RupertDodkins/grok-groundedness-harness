import type { CandidateRun, EvalItem, EvalResult } from "../types.js";
import { isDecisionCorrect, scoreAbstention } from "./abstention.js";
import { confidenceBucket } from "./calibration.js";
import { scoreGroundedness } from "./groundedness.js";

export function scoreCandidateRun(evalItem: EvalItem, run: CandidateRun): EvalResult {
  const groundedness = scoreGroundedness(evalItem, run.candidate);
  const decisionCorrect = isDecisionCorrect(
    evalItem.expectedBehavior,
    run.candidate.decision,
    run.candidate.needsHumanReview,
  );
  const abstentionCorrect = scoreAbstention(
    evalItem.expectedBehavior,
    run.candidate.decision,
    run.candidate.needsHumanReview,
  );

  const gate = decisionCorrect
    && groundedness.groundednessScore >= 0.8
    && groundedness.unsupportedHighConfidenceClaims === 0
    ? "pass"
    : groundedness.groundednessScore >= 0.5
      ? "warn"
      : "fail";

  return {
    evalId: evalItem.id,
    variantId: run.variantId,
    decisionCorrect,
    groundednessScore: groundedness.groundednessScore,
    abstentionCorrect,
    unsupportedHighConfidenceClaims: groundedness.unsupportedHighConfidenceClaims,
    expectedCalibrationBucket: confidenceBucket(run.candidate.overallConfidence),
    latencyMs: run.latencyMs,
    costUsd: run.costUsd,
    needsReview: run.candidate.needsHumanReview,
    gate,
    claimVerdicts: groundedness.verdicts,
    overallConfidence: run.candidate.overallConfidence,
  };
}
