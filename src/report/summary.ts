import type { EvalResult, VariantId, VariantSummary } from "../types.js";
import { expectedCalibrationError } from "../score/calibration.js";
import { gateVariantSummary } from "../gate.js";

function avg(values: number[]): number {
  return values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function summarizeVariant(variantId: VariantId, results: EvalResult[]): VariantSummary {
  const variantResults = results.filter((result) => result.variantId === variantId);
  const evalCount = variantResults.length;
  const totalClaims = variantResults.reduce(
    (sum, result) => sum + result.claimVerdicts.length,
    0,
  );
  const unsupportedHighConfidenceClaims = variantResults.reduce(
    (sum, result) => sum + result.unsupportedHighConfidenceClaims,
    0,
  );
  const costs = variantResults
    .map((result) => result.costUsd)
    .filter((cost): cost is number => typeof cost === "number");

  const summary: VariantSummary = {
    variantId,
    evalCount,
    groundedness: avg(variantResults.map((result) => result.groundednessScore)),
    abstentionAccuracy: avg(variantResults.map((result) => result.abstentionCorrect ? 1 : 0)),
    unsupportedHighConfidenceRate: totalClaims === 0
      ? 0
      : unsupportedHighConfidenceClaims / totalClaims,
    reviewRate: avg(variantResults.map((result) => result.needsReview ? 1 : 0)),
    avgLatencyMs: avg(variantResults.map((result) => result.latencyMs)),
    avgCostUsd: costs.length === 0 ? undefined : avg(costs),
    expectedCalibrationError: expectedCalibrationError(variantResults),
    gate: "warn",
  };

  summary.gate = gateVariantSummary(summary);
  return summary;
}

export function summarizeAll(results: EvalResult[]): VariantSummary[] {
  const variantIds = Array.from(new Set(results.map((result) => result.variantId)));
  return variantIds.map((variantId) => summarizeVariant(variantId, results));
}
