import fs from "node:fs";
import path from "node:path";
import { calibrationBuckets } from "./score/calibration.js";

type Args = {
  inputPath: string;
  outPath: string;
};

type ReportData = {
  mode?: string;
  generatedAt?: string;
  evals: any[];
  runs?: any[];
  results: any[];
  summaries: any[];
};

function parseArgs(argv: string[]): Args {
  const inputIndex = argv.indexOf("--input");
  const outIndex = argv.indexOf("--out");
  return {
    inputPath: inputIndex >= 0 ? argv[inputIndex + 1] : "reports/latest.json",
    outPath: outIndex >= 0 ? argv[outIndex + 1] : "reports/latest.html",
  };
}

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function pct(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function money(value?: number): string {
  return value === undefined ? "n/a" : `$${value.toFixed(4)}`;
}

function avg(values: number[]): number {
  return values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length;
}

function gateClass(gate: string): string {
  return gate === "pass" ? "pass" : "fail";
}

function runKey(evalId: string, variantId: string): string {
  return `${evalId}::${variantId}`;
}

function buildCategoryRows(data: ReportData): string {
  const evalById = new Map(data.evals.map((item) => [item.id, item]));
  const categories = Array.from(new Set(data.evals.map((item) => item.category)));
  const variants = data.summaries.map((summary) => summary.variantId);

  return categories.flatMap((category) => variants.map((variantId) => {
    const categoryResults = data.results.filter((result) => {
      const evalItem = evalById.get(result.evalId);
      return evalItem?.category === category && result.variantId === variantId;
    });

    return `
      <tr>
        <td>${escapeHtml(category)}</td>
        <td>${escapeHtml(variantId)}</td>
        <td>${categoryResults.length}</td>
        <td>${pct(avg(categoryResults.map((result) => result.groundednessScore)))}</td>
        <td>${pct(avg(categoryResults.map((result) => result.abstentionCorrect ? 1 : 0)))}</td>
        <td>${categoryResults.reduce((sum, result) => sum + result.unsupportedHighConfidenceClaims, 0)}</td>
      </tr>
    `;
  })).join("");
}

function buildDecisionRows(data: ReportData): string {
  const evalById = new Map(data.evals.map((item) => [item.id, item]));
  const runByKey = new Map((data.runs ?? []).map((run) => [runKey(run.evalId, run.variantId), run]));

  return data.results.map((result) => {
    const evalItem = evalById.get(result.evalId);
    const run = runByKey.get(runKey(result.evalId, result.variantId));
    const decision = run?.candidate?.decision ?? "fixture";
    const review = run?.candidate?.needsHumanReview ? "yes" : "no";
    return `
      <tr>
        <td>${escapeHtml(result.variantId)}</td>
        <td>${escapeHtml(evalItem?.expectedBehavior)}</td>
        <td>${escapeHtml(decision)}</td>
        <td>${review}</td>
        <td>${result.decisionCorrect ? "yes" : "no"}</td>
        <td>${escapeHtml(result.evalId)}</td>
      </tr>
    `;
  }).join("");
}

function buildCalibration(data: ReportData): string {
  return data.summaries.map((summary) => {
    const variantResults = data.results.filter((result) => result.variantId === summary.variantId);
    const rows = calibrationBuckets(variantResults).map((bucket) => {
      const accuracyWidth = Math.round(bucket.empiricalAccuracy * 100);
      const confidenceWidth = Math.round(bucket.avgConfidence * 100);
      return `
        <tr>
          <td>${bucket.label}</td>
          <td>${bucket.count}</td>
          <td>
            <div class="bar"><span style="width:${confidenceWidth}%"></span></div>
            ${pct(bucket.avgConfidence)}
          </td>
          <td>
            <div class="bar accuracy"><span style="width:${accuracyWidth}%"></span></div>
            ${pct(bucket.empiricalAccuracy)}
          </td>
        </tr>
      `;
    }).join("");

    return `
      <section>
        <h3>${escapeHtml(summary.variantId)}</h3>
        <table>
          <thead><tr><th>Confidence</th><th>Count</th><th>Avg confidence</th><th>Empirical accuracy</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </section>
    `;
  }).join("");
}

function buildFailures(data: ReportData): string {
  const evalById = new Map(data.evals.map((item) => [item.id, item]));
  const runByKey = new Map((data.runs ?? []).map((run) => [runKey(run.evalId, run.variantId), run]));
  const failures = data.results
    .filter((result) => result.gate !== "pass" || !result.decisionCorrect || result.unsupportedHighConfidenceClaims > 0)
    .sort((left, right) => (
      right.unsupportedHighConfidenceClaims - left.unsupportedHighConfidenceClaims
      || left.groundednessScore - right.groundednessScore
    ))
    .slice(0, 8);

  if (failures.length === 0) return "<p>No representative failures in this run.</p>";

  return failures.map((result) => {
    const evalItem = evalById.get(result.evalId);
    const run = runByKey.get(runKey(result.evalId, result.variantId));
    const verdicts = result.claimVerdicts.slice(0, 4).map((verdict: any) => `
      <li><strong>${escapeHtml(verdict.verdict)}</strong>: ${escapeHtml(verdict.reason)} <span class="muted">(${escapeHtml(verdict.claimId)})</span></li>
    `).join("");

    return `
      <article class="failure">
        <div class="failure-head">
          <strong>${escapeHtml(result.variantId)} / ${escapeHtml(result.evalId)}</strong>
          <span class="pill ${gateClass(result.gate)}">${escapeHtml(result.gate)}</span>
        </div>
        <p>${escapeHtml(evalItem?.prompt)}</p>
        ${run?.candidate?.answer ? `<p class="answer">${escapeHtml(run.candidate.answer)}</p>` : ""}
        <dl>
          <dt>Groundedness</dt><dd>${pct(result.groundednessScore)}</dd>
          <dt>Unsupported high-confidence claims</dt><dd>${result.unsupportedHighConfidenceClaims}</dd>
          <dt>Expected behavior</dt><dd>${escapeHtml(evalItem?.expectedBehavior)}</dd>
        </dl>
        <ul>${verdicts || "<li>No claim verdicts. Failure is decision/review routing.</li>"}</ul>
      </article>
    `;
  }).join("");
}

const args = parseArgs(process.argv.slice(2));
const data = JSON.parse(fs.readFileSync(args.inputPath, "utf8")) as ReportData;
const isLive = data.mode === "live-xai";
const totalCost = data.results
  .map((result) => result.costUsd)
  .filter((cost): cost is number => typeof cost === "number")
  .reduce((sum, cost) => sum + cost, 0);
const passingVariants = data.summaries.filter((summary) => summary.gate === "pass").length;

const rows = data.summaries.map((summary) => `
  <tr>
    <td><strong>${escapeHtml(summary.variantId)}</strong></td>
    <td>${summary.evalCount}</td>
    <td>${pct(summary.groundedness)}</td>
    <td>${pct(summary.abstentionAccuracy)}</td>
    <td>${pct(summary.unsupportedHighConfidenceRate)}</td>
    <td>${pct(summary.reviewRate)}</td>
    <td>${summary.avgLatencyMs.toFixed(0)}ms</td>
    <td>${money(summary.avgCostUsd)}</td>
    <td>${summary.expectedCalibrationError.toFixed(3)}</td>
    <td><span class="pill ${gateClass(summary.gate)}">${escapeHtml(summary.gate)}</span></td>
  </tr>
`).join("");

const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Grok Groundedness Harness Report</title>
  <style>
    :root { color-scheme: light; --ink: #18202f; --muted: #667085; --line: #d8dee7; --soft: #f5f7fa; --blue: #245bdb; --green: #168449; --red: #bf3434; }
    * { box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; margin: 0; color: var(--ink); line-height: 1.45; background: #ffffff; }
    main { max-width: 1180px; margin: 0 auto; padding: 32px 24px 56px; }
    h1 { margin: 0 0 8px; font-size: 30px; letter-spacing: 0; }
    h2 { margin: 30px 0 10px; font-size: 18px; letter-spacing: 0; }
    h3 { margin: 20px 0 8px; font-size: 15px; letter-spacing: 0; }
    p { margin: 8px 0; }
    table { border-collapse: collapse; width: 100%; margin-top: 10px; table-layout: auto; }
    th, td { border-bottom: 1px solid var(--line); padding: 10px; text-align: left; vertical-align: top; }
    th { background: var(--soft); color: var(--muted); font-size: 12px; text-transform: uppercase; font-weight: 700; }
    .note { background: #eff6ff; border-left: 4px solid var(--blue); padding: 12px; border-radius: 6px; }
    .grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; margin: 18px 0; }
    .metric { border: 1px solid var(--line); border-radius: 8px; padding: 12px; background: #fff; }
    .metric span { display: block; color: var(--muted); font-size: 12px; text-transform: uppercase; font-weight: 700; }
    .metric strong { display: block; margin-top: 6px; font-size: 22px; }
    .pill { display: inline-block; min-width: 44px; border-radius: 999px; padding: 2px 8px; font-size: 12px; font-weight: 700; text-align: center; }
    .pill.pass { color: #075e34; background: #daf5e7; }
    .pill.fail { color: #8d1f1f; background: #ffe1e1; }
    .bar { display: inline-block; width: 90px; height: 8px; margin-right: 8px; background: #e9edf3; border-radius: 999px; overflow: hidden; vertical-align: middle; }
    .bar span { display: block; height: 100%; background: var(--blue); }
    .bar.accuracy span { background: var(--green); }
    .failure { border: 1px solid var(--line); border-radius: 8px; padding: 14px; margin: 12px 0; }
    .failure-head { display: flex; justify-content: space-between; gap: 12px; align-items: center; }
    .answer { color: #344054; background: #fafbfc; border-left: 3px solid var(--line); padding: 8px 10px; }
    dl { display: grid; grid-template-columns: max-content 1fr; gap: 4px 12px; margin: 10px 0; }
    dt { color: var(--muted); }
    dd { margin: 0; }
    .muted { color: var(--muted); }
    @media (max-width: 780px) {
      main { padding: 24px 14px 40px; }
      .grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      table { display: block; overflow-x: auto; white-space: nowrap; }
    }
  </style>
</head>
<body>
  <main>
    <h1>Grok Groundedness Harness Report</h1>
    <p class="note">${isLive
      ? `Live xAI API report generated from ${data.results.length} scored runs${data.generatedAt ? ` at ${escapeHtml(data.generatedAt)}` : ""}.`
      : "Offline fixture report. This demonstrates the measurement pipeline shape; it is not a real Grok API run yet."}</p>

    <section class="grid" aria-label="Run summary">
      <div class="metric"><span>Eval cases</span><strong>${data.evals.length}</strong></div>
      <div class="metric"><span>Scored runs</span><strong>${data.results.length}</strong></div>
      <div class="metric"><span>Passing variants</span><strong>${passingVariants}/${data.summaries.length}</strong></div>
      <div class="metric"><span>Total cost</span><strong>${totalCost > 0 ? money(totalCost) : "n/a"}</strong></div>
    </section>

    <h2>Variant Summary</h2>
    <table>
      <thead>
        <tr>
          <th>Variant</th>
          <th>Runs</th>
          <th>Groundedness</th>
          <th>Abstention</th>
          <th>Unsupported high-conf</th>
          <th>Review rate</th>
          <th>Latency</th>
          <th>Cost</th>
          <th>ECE</th>
          <th>Gate</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>

    <h2>Category Breakdown</h2>
    <table>
      <thead><tr><th>Category</th><th>Variant</th><th>Runs</th><th>Groundedness</th><th>Abstention/review</th><th>Unsupported high-conf claims</th></tr></thead>
      <tbody>${buildCategoryRows(data)}</tbody>
    </table>

    <h2>Calibration</h2>
    ${buildCalibration(data)}

    <h2>Decision Matrix</h2>
    <table>
      <thead><tr><th>Variant</th><th>Expected</th><th>Decision</th><th>Needs review</th><th>Correct</th><th>Eval</th></tr></thead>
      <tbody>${buildDecisionRows(data)}</tbody>
    </table>

    <h2>Representative Failures</h2>
    ${buildFailures(data)}

    <h2>Caveats</h2>
    <ul>
      <li>Self-referential evidence grounding, not competitor-model adjudication.</li>
      <li>Small eval sets are directional and meant to catch prompt/config regressions, not make broad product claims.</li>
      <li>Source packets are intentionally narrow, so unsupported business, roadmap, security, and private-metric claims should abstain or route to review.</li>
    </ul>
  </main>
</body>
</html>`;

fs.mkdirSync(path.dirname(args.outPath), { recursive: true });
fs.writeFileSync(args.outPath, html);
console.log(`Wrote report to ${args.outPath}`);
