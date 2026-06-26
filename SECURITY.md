# Security

## API Keys

Live runs require an xAI API key. Keep keys in a local `.env` file and never commit them.

The repository ignores:

- `.env`
- `.env.*`
- generated reports under `reports/*.json`, `reports/*.html`, and `reports/*.csv`

Only `.env.example` is intended to be committed.

## Generated Outputs

Generated reports may contain model outputs, prompts, source packets, response IDs, costs, and latency data. Treat generated files as local outputs unless they have been reviewed and intentionally published.

## Reporting Issues

If you find a secret-handling issue or a path where generated outputs can leak private data, open an issue with reproduction steps and avoid posting live API keys or private model outputs.
