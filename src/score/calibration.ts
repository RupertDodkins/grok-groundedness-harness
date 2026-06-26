import type { EvalResult } from "../types.js";

export type CalibrationBucket = {
  label: string;
  min: number;
  max: number;
  count: number;
  avgConfidence: number;
  empiricalAccuracy: number;
};

const bucketSpecs = [
  { label: "0.0-0.2", min: 0, max: 0.2 },
  { label: "0.2-0.4", min: 0.2, max: 0.4 },
  { label: "0.4-0.6", min: 0.4, max: 0.6 },
  { label: "0.6-0.8", min: 0.6, max: 0.8 },
  { label: "0.8-1.0", min: 0.8, max: 1.000001 },
];

export function confidenceBucket(confidence: number): string {
  const bucket = bucketSpecs.find((spec) => confidence >= spec.min && confidence < spec.max);
  return bucket?.label ?? "unknown";
}

export function isEmpiricallyCorrect(result: EvalResult): boolean {
  return (
    result.decisionCorrect
    && result.groundednessScore >= 0.8
    && result.unsupportedHighConfidenceClaims === 0
  );
}

export function calibrationBuckets(results: EvalResult[]): CalibrationBucket[] {
  return bucketSpecs.map((spec) => {
    const bucketResults = results.filter(
      (result) => result.overallConfidence >= spec.min && result.overallConfidence < spec.max,
    );
    const count = bucketResults.length;
    const avgConfidence = count === 0
      ? 0
      : bucketResults.reduce((sum, result) => sum + result.overallConfidence, 0) / count;
    const empiricalAccuracy = count === 0
      ? 0
      : bucketResults.filter(isEmpiricallyCorrect).length / count;

    return {
      ...spec,
      count,
      avgConfidence,
      empiricalAccuracy,
    };
  });
}

export function expectedCalibrationError(results: EvalResult[]): number {
  if (results.length === 0) return 0;

  return calibrationBuckets(results).reduce((sum, bucket) => {
    if (bucket.count === 0) return sum;
    return sum + (bucket.count / results.length) * Math.abs(
      bucket.avgConfidence - bucket.empiricalAccuracy,
    );
  }, 0);
}
