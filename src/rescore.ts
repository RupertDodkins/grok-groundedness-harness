import fs from "node:fs";
import path from "node:path";
import { summarizeAll } from "./report/summary.js";
import { scoreCandidateRun } from "./score/eval-result.js";

type Args = {
  inputPath: string;
  outPath: string;
};

function parseArgs(argv: string[]): Args {
  const inputIndex = argv.indexOf("--input");
  const outIndex = argv.indexOf("--out");
  return {
    inputPath: inputIndex >= 0 ? argv[inputIndex + 1] : "reports/live-full.json",
    outPath: outIndex >= 0 ? argv[outIndex + 1] : "reports/live-full.json",
  };
}

const args = parseArgs(process.argv.slice(2));
const data = JSON.parse(fs.readFileSync(args.inputPath, "utf8"));
const evalById = new Map(data.evals.map((evalItem: any) => [evalItem.id, evalItem]));
const results = data.runs.map((run: any) => {
  const evalItem = evalById.get(run.evalId);
  if (!evalItem) throw new Error(`No eval found for run ${run.evalId}`);
  return scoreCandidateRun(evalItem as any, run);
});
const summaries = summarizeAll(results);

fs.mkdirSync(path.dirname(args.outPath), { recursive: true });
fs.writeFileSync(args.outPath, JSON.stringify({
  ...data,
  rescoredAt: new Date().toISOString(),
  results,
  summaries,
}, null, 2));
console.log(`Rescored ${results.length} runs to ${args.outPath}`);
