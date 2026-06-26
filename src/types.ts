export type EvalCategory =
  | "answerable_public"
  | "citation_overclaim"
  | "stale_context"
  | "unsupported_internal"
  | "connector_workflow"
  | "abstention_required";

export type ExpectedBehavior =
  | "answer"
  | "abstain"
  | "ask_for_context"
  | "needs_review";

export type SourceSnippet = {
  id: string;
  title: string;
  url?: string;
  publishedAt?: string;
  text: string;
};

export type GoldClaim = {
  claim: string;
  support: "supported" | "unsupported" | "uncertain";
  sourceIds?: string[];
};

export type EvalItem = {
  id: string;
  category: EvalCategory;
  prompt: string;
  expectedBehavior: ExpectedBehavior;
  sourcePacket?: SourceSnippet[];
  goldClaims?: GoldClaim[];
  notes?: string;
};

export type CandidateDecision = "answer" | "abstain" | "ask_for_context";

export type CandidateClaim = {
  id: string;
  text: string;
  confidence: number;
  citationIds: string[];
  supportLevel: "direct" | "partial" | "none" | "unknown";
};

export type CandidateAnswer = {
  decision: CandidateDecision;
  answer: string;
  claims: CandidateClaim[];
  overallConfidence: number;
  needsHumanReview: boolean;
  reviewReason?: string;
};

export type VariantId = "baseline" | "strict-citations" | "abstention-first";

export type CandidateRun = {
  evalId: string;
  variantId: VariantId;
  candidate: CandidateAnswer;
  latencyMs: number;
  costUsd?: number;
  citations?: string[];
  rawResponseId?: string;
};

export type ClaimVerdict =
  | "supported"
  | "partially_supported"
  | "unsupported"
  | "not_enough_evidence";

export type ClaimVerdictResult = {
  claimId: string;
  verdict: ClaimVerdict;
  reason: string;
  supportingSourceIds: string[];
  overclaim: boolean;
  confidence: number;
};

export type EvalResult = {
  evalId: string;
  variantId: VariantId;
  decisionCorrect: boolean;
  groundednessScore: number;
  abstentionCorrect: boolean;
  unsupportedHighConfidenceClaims: number;
  expectedCalibrationBucket: string;
  latencyMs: number;
  costUsd?: number;
  needsReview: boolean;
  gate: "pass" | "warn" | "fail";
  claimVerdicts: ClaimVerdictResult[];
  overallConfidence: number;
};

export type VariantSummary = {
  variantId: VariantId;
  evalCount: number;
  groundedness: number;
  abstentionAccuracy: number;
  unsupportedHighConfidenceRate: number;
  reviewRate: number;
  avgLatencyMs: number;
  avgCostUsd?: number;
  expectedCalibrationError: number;
  gate: "pass" | "warn" | "fail";
};

export type GateThresholds = {
  minGroundedness: number;
  minAbstentionAccuracy: number;
  maxUnsupportedHighConfidenceRate: number;
  maxExpectedCalibrationError: number;
};
