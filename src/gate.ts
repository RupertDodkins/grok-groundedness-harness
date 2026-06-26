import fs from "node:fs";
import { fileURLToPath } from "node:url";
import type { GateThresholds, VariantSummary } from "./types.js";

export const defaultThresholds: GateThresholds = {
  minGroundedness: 0.8,
  minAbstentionAccuracy: 0.75,
  maxUnsupportedHighConfidenceRate: 0.05,
  maxExpectedCalibrationError: 0.12,
};

export function gateVariantSummary(
  summary: VariantSummary,
  thresholds: GateThresholds = defaultThresholds,
): "pass" | "fail" {
  if (summary.groundedness < thresholds.minGroundedness) return "fail";
  if (summary.abstentionAccuracy < thresholds.minAbstentionAccuracy) return "fail";
  if (summary.unsupportedHighConfidenceRate > thresholds.maxUnsupportedHighConfidenceRate) return "fail";
  if (summary.expectedCalibrationError > thresholds.maxExpectedCalibrationError) return "fail";
  return "pass";
}

function parseInputPath(argv: string[]): string {
  const inputIndex = argv.indexOf("--input");
  return inputIndex >= 0 ? argv[inputIndex + 1] : "reports/latest.json";
}

function isCliEntrypoint(): boolean {
  return process.argv[1] === fileURLToPath(import.meta.url);
}

if (isCliEntrypoint()) {
  const inputPath = parseInputPath(process.argv.slice(2));
  const data = JSON.parse(fs.readFileSync(inputPath, "utf8")) as { summaries?: VariantSummary[] };
  const summaries = data.summaries ?? [];
  const failing = summaries.filter((summary) => gateVariantSummary(summary) === "fail");

  if (failing.length > 0) {
    for (const summary of failing) {
      console.error([
        `${summary.variantId} failed gate`,
        `groundedness=${summary.groundedness.toFixed(3)}`,
        `abstention=${summary.abstentionAccuracy.toFixed(3)}`,
        `unsupportedHighConfidence=${summary.unsupportedHighConfidenceRate.toFixed(3)}`,
        `ece=${summary.expectedCalibrationError.toFixed(3)}`,
      ].join(" "));
    }
    process.exit(1);
  }

  console.log(`All ${summaries.length} variant summaries passed gate.`);
}
