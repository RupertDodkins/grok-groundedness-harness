# Grok Groundedness Harness

A small TypeScript eval harness for measuring whether Grok-style chat answers stay tethered to their evidence.

## What It Measures

The harness runs labeled prompts through one or more prompt/config variants, asks the model for structured answers with atomic claims, then scores:

- claim groundedness against cited source packets;
- abstention and ask-for-context behavior;
- human-review routing;
- unsupported high-confidence claims;
- confidence calibration;
- latency and request cost;
- regression-gate pass/fail.

The default eval set is intentionally small and inspectable. It is designed to make reliability failures visible and make prompt/config tradeoffs easier to compare.

## What You Can Use It For

- Compare prompt variants on the same labeled eval set.
- Inspect supported, partially supported, and unsupported claims.
- Measure abstention and human-review routing behavior.
- Track confidence calibration, latency, and request cost.
- Generate an HTML report for quick review.
- Fail a regression gate when a variant drops below configured reliability thresholds.

## Current Status

Implemented:

- 21 labeled JSONL eval cases.
- Three prompt variants: `baseline`, `strict-citations`, and `abstention-first`.
- Offline fixture runner.
- Live xAI Responses API runner.
- Structured-output parser.
- Source-packet verifier.
- Calibration and summary metrics.
- HTML report generator.
- Regression gate.

Current finding from local live runs: stricter variants improve groundedness and reduce unsupported high-confidence claims, while calibration remains the main open problem. See [docs/SAMPLE_RUN_SUMMARY.md](docs/SAMPLE_RUN_SUMMARY.md).

## Quickstart

```bash
npm install
npm run verify
npm run eval:fixture
npm run report:fixture
```

Open `reports/latest.html` after running the fixture report command.

Generated report files are ignored by git. They are reproducible run outputs, not source files.

## Live xAI Runs

Create a local env file:

```bash
cp .env.example .env
```

Set either `XAI_API_KEY` or `X_API_KEY` in `.env`.

Useful commands:

```bash
npm run smoke:xai
npm run eval -- --live --limit 1 --variants strict-citations --out reports/live-smoke.json
npm run eval -- --live --no-web-search --concurrency 3 --out reports/live-full.json
npm run report -- --input reports/live-full.json --out reports/live-full.html
```

The live runner supports:

- `--variants baseline,strict-citations,abstention-first`
- `--limit N`
- `--concurrency N`
- `--no-web-search`

## Command Map

```bash
npm run verify          # typecheck + tests
npm run typecheck       # TypeScript compile check
npm test                # unit tests
npm run eval:fixture    # offline fixture eval
npm run report:fixture  # HTML report from fixture output
npm run gate -- --input reports/latest.json
npm run clean           # remove generated report outputs
```

`npm run gate` exits non-zero when summaries fail configured thresholds. The default thresholds are intentionally strict.

## Repo Map

- [docs/TECHNICAL_SPEC.md](docs/TECHNICAL_SPEC.md) - architecture, scoring, schemas, and report shape.
- [docs/EVAL_DESIGN.md](docs/EVAL_DESIGN.md) - eval categories and labeling rules.
- [docs/SAMPLE_RUN_SUMMARY.md](docs/SAMPLE_RUN_SUMMARY.md) - neutral summary of current live-run findings.
- [evals/seed.jsonl](evals/seed.jsonl) - hand-labeled seed evals.
- [examples/structured-output-schema.json](examples/structured-output-schema.json) - target structured-output schema.
- `src/` - runner, xAI client, scorer, summaries, report generator, and gate.
- `reports/` - generated outputs, ignored by git except `.gitkeep`.

## How To Interpret Results

The default eval set is a compact source-packet test, so treat results as directional reliability signals. Source-packet labels are human-authored, public API behavior can vary across surfaces, and the scorer is intentionally transparent so individual examples can be inspected.

## License

MIT. See [LICENSE](LICENSE).
