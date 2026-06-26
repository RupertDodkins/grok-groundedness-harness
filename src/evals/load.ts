import fs from "node:fs";
import { z } from "zod";
import type { EvalItem } from "../types.js";

const sourceSnippetSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  url: z.string().url().optional(),
  publishedAt: z.string().optional(),
  text: z.string().min(1),
});

const goldClaimSchema = z.object({
  claim: z.string().min(1),
  support: z.enum(["supported", "unsupported", "uncertain"]),
  sourceIds: z.array(z.string()).optional(),
});

const evalItemSchema = z.object({
  id: z.string().min(1),
  category: z.enum([
    "answerable_public",
    "citation_overclaim",
    "stale_context",
    "unsupported_internal",
    "connector_workflow",
    "abstention_required",
  ]),
  prompt: z.string().min(1),
  expectedBehavior: z.enum(["answer", "abstain", "ask_for_context", "needs_review"]),
  sourcePacket: z.array(sourceSnippetSchema).optional(),
  goldClaims: z.array(goldClaimSchema).optional(),
  notes: z.string().optional(),
});

export function loadEvalJsonl(path: string): EvalItem[] {
  const content = fs.readFileSync(path, "utf8").trim();
  if (!content) return [];

  return content.split("\n").map((line, index) => {
    try {
      return evalItemSchema.parse(JSON.parse(line)) as EvalItem;
    } catch (error) {
      throw new Error(`Invalid eval JSONL at ${path}:${index + 1}: ${String(error)}`);
    }
  });
}
