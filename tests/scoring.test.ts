import { describe, expect, it } from "vitest";
import { isDecisionCorrect } from "../src/score/abstention.js";
import { expectedCalibrationError } from "../src/score/calibration.js";
import { scoreCandidateRun } from "../src/score/eval-result.js";
import { gateVariantSummary } from "../src/gate.js";
import type { EvalItem, EvalResult, VariantSummary } from "../src/types.js";

const evalItem: EvalItem = {
  id: "test-1",
  category: "answerable_public",
  prompt: "What launched?",
  expectedBehavior: "answer",
  sourcePacket: [{ id: "s1", title: "Source", text: "Grok Skills support documents." }],
  goldClaims: [
    { claim: "Grok Skills support documents.", support: "supported", sourceIds: ["s1"] },
    { claim: "Grok Skills are xAI's top priority.", support: "unsupported", sourceIds: ["s1"] },
  ],
};

describe("abstention scoring", () => {
  it("requires human review for needs_review behavior", () => {
    expect(isDecisionCorrect("needs_review", "answer", true)).toBe(true);
    expect(isDecisionCorrect("needs_review", "answer", false)).toBe(false);
  });

  it("accepts abstention for stale context requests that ask for context", () => {
    expect(isDecisionCorrect("ask_for_context", "abstain", false)).toBe(true);
  });
});

describe("candidate scoring", () => {
  it("passes supported cited claims", () => {
    const result = scoreCandidateRun(evalItem, {
      evalId: evalItem.id,
      variantId: "strict-citations",
      latencyMs: 100,
      candidate: {
        decision: "answer",
        answer: "Grok Skills support documents.",
        claims: [{
          id: "c1",
          text: "Grok Skills support documents.",
          confidence: 0.8,
          citationIds: ["s1"],
          supportLevel: "direct",
        }],
        overallConfidence: 0.8,
        needsHumanReview: false,
      },
    });
    expect(result.groundednessScore).toBe(1);
    expect(result.unsupportedHighConfidenceClaims).toBe(0);
    expect(result.gate).toBe("pass");
  });

  it("flags unsupported high-confidence overclaims", () => {
    const result = scoreCandidateRun(evalItem, {
      evalId: evalItem.id,
      variantId: "baseline",
      latencyMs: 100,
      candidate: {
        decision: "answer",
        answer: "Grok Skills are xAI's top priority.",
        claims: [{
          id: "c1",
          text: "Grok Skills are xAI's top priority.",
          confidence: 0.9,
          citationIds: ["s1"],
          supportLevel: "partial",
        }],
        overallConfidence: 0.9,
        needsHumanReview: false,
      },
    });
    expect(result.unsupportedHighConfidenceClaims).toBe(1);
    expect(result.gate).not.toBe("pass");
  });
});

describe("calibration", () => {
  it("computes non-zero ECE for overconfident incorrect results", () => {
    const results: EvalResult[] = [
      {
        evalId: "a",
        variantId: "baseline",
        decisionCorrect: false,
        groundednessScore: 0,
        abstentionCorrect: false,
        unsupportedHighConfidenceClaims: 1,
        expectedCalibrationBucket: "0.8-1.0",
        latencyMs: 1,
        needsReview: false,
        gate: "fail",
        claimVerdicts: [],
        overallConfidence: 0.9,
      },
    ];
    expect(expectedCalibrationError(results)).toBeCloseTo(0.9);
  });
});

describe("gate", () => {
  it("fails weak summaries", () => {
    const summary: VariantSummary = {
      variantId: "baseline",
      evalCount: 10,
      groundedness: 0.5,
      abstentionAccuracy: 0.5,
      unsupportedHighConfidenceRate: 0.2,
      reviewRate: 0.2,
      avgLatencyMs: 100,
      expectedCalibrationError: 0.2,
      gate: "warn",
    };
    expect(gateVariantSummary(summary)).toBe("fail");
  });
});
