import type { EvalItem, VariantId } from "../types.js";

export const VARIANTS: VariantId[] = ["baseline", "strict-citations", "abstention-first"];

const confidenceContract = [
  "Confidence fields are calibration estimates, not tone.",
  "Use 0.95-1.0 only when the answer is directly supported, complete, current, and correctly routed.",
  "Use 0.70-0.90 for mostly supported answers with minor uncertainty.",
  "Use 0.40-0.70 when sources are stale, context is missing, or human review is needed.",
  "Use below 0.40 when abstaining because the requested fact is private or unavailable.",
].join(" ");

export function parseVariants(value?: string): VariantId[] {
  if (!value) return VARIANTS;
  const requested = value.split(",").map((item) => item.trim()).filter(Boolean);
  const invalid = requested.filter((item) => !VARIANTS.includes(item as VariantId));
  if (invalid.length > 0) {
    throw new Error(`Unknown variant(s): ${invalid.join(", ")}. Expected one of: ${VARIANTS.join(", ")}.`);
  }
  return requested as VariantId[];
}

export function variantInstruction(variantId: VariantId): string {
  switch (variantId) {
    case "baseline":
      return [
        "Answer naturally and concisely.",
        "Extract the important factual claims you made.",
        "Mark needsHumanReview true when evidence is weak or missing.",
        confidenceContract,
      ].join(" ");
    case "strict-citations":
      return [
        "Only answer factual questions when each important claim can be tied to a citation or provided source ID.",
        "Prefer fewer, better-supported claims over comprehensive coverage.",
        "If a claim is not directly supported, abstain or ask for context.",
        confidenceContract,
      ].join(" ");
    case "abstention-first":
      return [
        "Be conservative.",
        "If the prompt asks for private internal rationale, stale facts, unavailable sources, or missing workflow context, choose abstain or ask_for_context.",
        "Use needsHumanReview true whenever a human should inspect the answer before user delivery.",
        confidenceContract,
      ].join(" ");
  }
}

export function buildEvaluationPrompt(evalItem: EvalItem): string {
  const sourcePacket = evalItem.sourcePacket?.map((source) => [
    `Source ID: ${source.id}`,
    `Title: ${source.title}`,
    source.url ? `URL: ${source.url}` : undefined,
    source.publishedAt ? `Published: ${source.publishedAt}` : undefined,
    `Text: ${source.text}`,
  ].filter(Boolean).join("\n")).join("\n\n");

  return [
    `Current date: ${new Date().toISOString().slice(0, 10)}.`,
    "Task: answer the user's prompt as a product assistant being evaluated for groundedness.",
    "Return only the requested structured output.",
    "When using a provided source packet, cite its Source ID in claim.citationIds.",
    "When using web search, cite source identifiers or URLs in claim.citationIds when available.",
    "Do not cite a source that does not support the exact claim.",
    sourcePacket ? `Provided source packet:\n${sourcePacket}` : "No source packet is provided. Do not invent private or unavailable facts.",
    `User prompt:\n${evalItem.prompt}`,
  ].join("\n\n");
}
