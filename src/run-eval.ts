import fs from "node:fs";
import path from "node:path";
import { createGroundedAnswer } from "./clients/xai.js";
import { loadConfig } from "./config.js";
import { loadEvalJsonl } from "./evals/load.js";
import { mockRunsForEvals } from "./fixtures/mockRuns.js";
import { buildEvaluationPrompt, parseVariants, variantInstruction } from "./prompts/variants.js";
import { scoreCandidateRun } from "./score/eval-result.js";
import { summarizeAll } from "./report/summary.js";
import type { CandidateRun, EvalItem, VariantId } from "./types.js";

type Args = {
  evalsPath: string;
  outPath: string;
  live: boolean;
  variants?: string;
  limit?: number;
  useWebSearch: boolean;
  concurrency: number;
};

function parseArgs(argv: string[]): Args {
  const evalsIndex = argv.indexOf("--evals");
  const outIndex = argv.indexOf("--out");
  const variantsIndex = argv.indexOf("--variants");
  const limitIndex = argv.indexOf("--limit");
  const concurrencyIndex = argv.indexOf("--concurrency");
  return {
    evalsPath: evalsIndex >= 0 ? argv[evalsIndex + 1] : "evals/seed.jsonl",
    outPath: outIndex >= 0 ? argv[outIndex + 1] : "reports/latest.json",
    live: argv.includes("--live"),
    variants: variantsIndex >= 0 ? argv[variantsIndex + 1] : undefined,
    limit: limitIndex >= 0 ? Number(argv[limitIndex + 1]) : undefined,
    useWebSearch: !argv.includes("--no-web-search"),
    concurrency: concurrencyIndex >= 0 ? Number(argv[concurrencyIndex + 1]) : 1,
  };
}

async function liveRunsForEvals(
  evals: EvalItem[],
  variants: VariantId[],
  useWebSearch: boolean,
  concurrency: number,
): Promise<CandidateRun[]> {
  const config = loadConfig();
  const tasks = evals.flatMap((evalItem) => variants.map((variantId) => ({ evalItem, variantId })));
  const runs = new Array<CandidateRun>(tasks.length);
  let nextIndex = 0;

  async function worker(): Promise<void> {
    while (nextIndex < tasks.length) {
      const taskIndex = nextIndex;
      nextIndex += 1;
      const { evalItem, variantId } = tasks[taskIndex];
      console.log(`Running ${evalItem.id} / ${variantId}`);
      const result = await createGroundedAnswer(config, {
        prompt: buildEvaluationPrompt(evalItem),
        variantInstruction: variantInstruction(variantId),
        useWebSearch,
      });
      runs[taskIndex] = {
        evalId: evalItem.id,
        variantId,
        candidate: result.candidate,
        latencyMs: result.latencyMs,
        costUsd: result.costUsd,
        citations: result.citations,
        rawResponseId: result.raw.id,
      };
    }
  }

  const workerCount = Math.max(1, Math.min(concurrency, tasks.length));
  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  return runs;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const allEvals = loadEvalJsonl(args.evalsPath);
  const evals = args.limit === undefined ? allEvals : allEvals.slice(0, args.limit);
  const evalById = new Map(evals.map((evalItem) => [evalItem.id, evalItem]));
  const variants = parseVariants(args.variants);
  const runs = args.live
    ? await liveRunsForEvals(evals, variants, args.useWebSearch, args.concurrency)
    : mockRunsForEvals(evals).filter((run) => variants.includes(run.variantId));
  const results = runs.map((run) => {
    const evalItem = evalById.get(run.evalId);
    if (!evalItem) throw new Error(`No eval found for run ${run.evalId}`);
    return scoreCandidateRun(evalItem, run);
  });
  const summaries = summarizeAll(results);

  fs.mkdirSync(path.dirname(args.outPath), { recursive: true });
  fs.writeFileSync(args.outPath, JSON.stringify({
    mode: args.live ? "live-xai" : "fixture",
    generatedAt: new Date().toISOString(),
    evals,
    runs,
    results,
    summaries,
  }, null, 2));
  console.log(`Wrote ${results.length} scored runs to ${args.outPath}`);
}

await main();
