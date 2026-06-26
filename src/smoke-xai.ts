import { loadConfig } from "./config.js";
import { createGroundedAnswer } from "./clients/xai.js";

const config = loadConfig();

const result = await createGroundedAnswer(config, {
  useWebSearch: true,
  variantInstruction: "Be strict about evidence. If you cannot cite public evidence, abstain.",
  prompt: "Using public evidence, state one thing xAI says Grok Skills are for. Keep it short.",
});

console.log(JSON.stringify({
  model: config.model,
  decision: result.candidate.decision,
  claimCount: result.candidate.claims.length,
  citationCount: result.citations.length,
  latencyMs: result.latencyMs,
  costUsd: result.costUsd,
  hasUsage: result.raw.usage !== undefined,
  hasCitations: result.citations.length > 0,
}, null, 2));
