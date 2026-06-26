import type { CandidateAnswer } from "../types.js";
import type { RuntimeConfig } from "../config.js";

type XaiResponseOutputContent = {
  type: string;
  text?: string;
  annotations?: unknown[];
};

type XaiResponseOutputItem = {
  type: string;
  content?: XaiResponseOutputContent[];
};

export type XaiResponsesApiResult = {
  id?: string;
  output?: XaiResponseOutputItem[];
  citations?: string[];
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
    total_tokens?: number;
    cost_in_usd_ticks?: number;
  };
  error?: unknown;
};

export type GroundedAnswerRequest = {
  prompt: string;
  variantInstruction: string;
  useWebSearch: boolean;
};

export type GroundedAnswerResult = {
  candidate: CandidateAnswer;
  raw: XaiResponsesApiResult;
  citations: string[];
  latencyMs: number;
  costUsd?: number;
};

const groundedAnswerSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "decision",
    "answer",
    "claims",
    "overallConfidence",
    "needsHumanReview",
    "reviewReason",
  ],
  properties: {
    decision: {
      type: "string",
      enum: ["answer", "abstain", "ask_for_context"],
    },
    answer: {
      type: "string",
    },
    claims: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "text", "confidence", "citationIds", "supportLevel"],
        properties: {
          id: { type: "string" },
          text: { type: "string" },
          confidence: { type: "number", minimum: 0, maximum: 1 },
          citationIds: {
            type: "array",
            items: { type: "string" },
          },
          supportLevel: {
            type: "string",
            enum: ["direct", "partial", "none", "unknown"],
          },
        },
      },
    },
    overallConfidence: { type: "number", minimum: 0, maximum: 1 },
    needsHumanReview: { type: "boolean" },
    reviewReason: { type: "string" },
  },
};

function extractOutputText(response: XaiResponsesApiResult): string {
  for (const item of response.output ?? []) {
    if (item.type !== "message") continue;
    for (const content of item.content ?? []) {
      if (content.type === "output_text" && content.text) return content.text;
    }
  }
  throw new Error("xAI response did not contain message output_text content.");
}

function ticksToUsd(ticks?: number): number | undefined {
  return typeof ticks === "number" ? ticks / 1e10 : undefined;
}

export async function createGroundedAnswer(
  config: RuntimeConfig,
  request: GroundedAnswerRequest,
): Promise<GroundedAnswerResult> {
  const startedAt = Date.now();
  const body = {
    model: config.model,
    input: [
      {
        role: "system",
        content: [
          "You are producing a structured answer for a groundedness evaluation harness.",
          "Extract atomic claims. For each claim, include citation IDs or source identifiers when available.",
          "If public evidence is insufficient, choose abstain or ask_for_context rather than inventing.",
          request.variantInstruction,
        ].join(" "),
      },
      {
        role: "user",
        content: request.prompt,
      },
    ],
    tools: request.useWebSearch ? [{ type: "web_search" }] : [],
    text: {
      format: {
        type: "json_schema",
        name: "grounded_answer",
        schema: groundedAnswerSchema,
        strict: true,
      },
    },
  };

  const response = await fetch(`${config.baseUrl}/responses`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const raw = await response.json() as XaiResponsesApiResult;
  if (!response.ok) {
    throw new Error(`xAI API request failed with ${response.status}: ${JSON.stringify(raw.error ?? raw)}`);
  }

  const text = extractOutputText(raw);
  const candidate = JSON.parse(text) as CandidateAnswer;
  return {
    candidate,
    raw,
    citations: raw.citations ?? [],
    latencyMs: Date.now() - startedAt,
    costUsd: ticksToUsd(raw.usage?.cost_in_usd_ticks),
  };
}
