# Contributing

This project is intentionally small. Contributions should improve measurement quality without expanding the repo into a product clone or dashboard.

## Good Changes

- Clearer eval labels.
- Better source-packet support scoring.
- More inspectable failure examples.
- Calibration improvements.
- Tests for scorer edge cases.
- Documentation that makes assumptions easier to audit.

## Avoid

- Competitor-model judging.
- Product-roadmap recommendations.
- grok.com UI mimicry.
- Authentication, tenancy, databases, or deployment infrastructure.
- Large generated reports committed by default.

## Before Opening A PR

```bash
npm run verify
npm run eval:fixture
npm run report:fixture
npm run clean
```

Commit source, evals, tests, and docs. Do not commit `.env`, API keys, `node_modules`, or generated report files.
