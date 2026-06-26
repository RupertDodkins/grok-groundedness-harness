# Sample Run Summary

## Run Shape

- 21 source-packet eval cases.
- 3 prompt variants: `baseline`, `strict-citations`, and `abstention-first`.
- 63 xAI Responses API calls in a full run.
- `--no-web-search` mode, so each answer is judged against labeled source packets rather than external browsing.

## Current Finding

The stricter variants improve groundedness and reduce unsupported high-confidence claims compared with the baseline.

The remaining open problem is calibration:

- The model can still report high confidence for answers that are only partially supported or incorrectly routed.
- Adding a prompt-level confidence contract did not reliably fix calibration.
- The next useful iteration is a post-hoc calibration layer that reports both raw model confidence and calibrated confidence.

## Interpretation

The gate is intentionally strict. A failing gate is useful when it identifies the next reliability bottleneck rather than hiding it behind permissive thresholds.

This report should be read as a small measurement loop, not as a broad claim about Grok quality.
