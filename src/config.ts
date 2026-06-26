import "dotenv/config";

export type RuntimeConfig = {
  apiKey: string;
  baseUrl: string;
  model: string;
};

export function loadConfig(): RuntimeConfig {
  const apiKey = process.env.XAI_API_KEY ?? process.env.X_API_KEY;
  if (!apiKey) {
    throw new Error("Missing XAI_API_KEY or X_API_KEY. Add it to .env before running live API calls.");
  }

  return {
    apiKey,
    baseUrl: process.env.XAI_BASE_URL ?? "https://api.x.ai/v1",
    model: process.env.XAI_MODEL ?? "grok-4.3",
  };
}
