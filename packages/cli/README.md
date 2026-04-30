# @reaatech/classifier-evals-cli

[![npm version](https://img.shields.io/npm/v/@reaatech/classifier-evals-cli.svg)](https://www.npmjs.com/package/@reaatech/classifier-evals-cli)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://github.com/reaatech/classifier-evals/blob/main/LICENSE)
[![CI](https://img.shields.io/github/actions/workflow/status/reaatech/classifier-evals/ci.yml?branch=main&label=CI)](https://github.com/reaatech/classifier-evals/actions/workflows/ci.yml)

> **Status:** Pre-1.0 — APIs may change in minor versions. Pin to a specific version in production.

CLI tool for classifier evaluation. Run evaluations, compare models, check regression gates, run LLM-as-judge, and export results — all from the command line. Built on [Commander.js](https://github.com/tj/commander.js) and the full `@reaatech/classifier-evals-*` ecosystem.

## Installation

```bash
npm install -g @reaatech/classifier-evals-cli
# or
pnpm add @reaatech/classifier-evals-cli
```

## Quick Start

```bash
# Run a full evaluation
classifier-evals eval --dataset test-set.csv --format json --output results.json

# Compare two models
classifier-evals compare --baseline results/v1.json --candidate results/v2.json

# Check regression gates
classifier-evals gates --results results/latest.json --gates gates.yaml

# Run LLM-as-judge
classifier-evals judge --dataset test-set.csv --model claude-opus --budget 10.00

# Export a report
classifier-evals export --results results/latest.json --format html --output report.html
```

## Commands

### `eval`

Run a full classifier evaluation against a dataset.

```bash
classifier-evals eval --dataset test-set.csv [options]
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `--dataset` | `string` | (required) | Path to dataset file (CSV, JSON, JSONL) |
| `--format` | `"json" \| "html"` | `"json"` | Output format |
| `--output` | `string` | — | Output file path (writes to stdout if omitted) |
| `--name` | `string` | — | Dataset display name (defaults to filename) |

Loads the dataset, computes the confusion matrix and all 14 classification metrics, builds an `EvalRun`, and exports the results.

### `compare`

Compare two model evaluation results with statistical significance.

```bash
classifier-evals compare --baseline results/v1.json --candidate results/v2.json
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `--baseline` | `string` | (required) | Path to baseline evaluation results JSON |
| `--candidate` | `string` | (required) | Path to candidate evaluation results JSON |
| `--output` | `string` | — | Output file path (writes to stdout if omitted) |

Computes accuracy difference, McNemar's test p-value, Cohen's d effect size, and per-class F1 comparison.

### `gates`

Evaluate regression gates against evaluation results.

```bash
classifier-evals gates --results results/latest.json --gates gates.yaml [options]
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `--results` | `string` | (required) | Path to evaluation results JSON |
| `--gates` | `string` | (required) | Path to gate configuration YAML |
| `--baseline` | `string` | — | Path to baseline results for comparison gates |
| `--output` | `string` | — | Output file path |
| `--format` | `"text" \| "junit"` | `"text"` | Output format (text or JUnit XML) |

Exits with code 1 if any gate fails, 0 if all pass. Suitable for CI pipelines.

### `judge`

Run LLM-as-judge on samples with cost tracking.

```bash
classifier-evals judge --dataset test-set.csv --model claude-opus [options]
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `--dataset` | `string` | (required) | Path to dataset file |
| `--model` | `string` | (required) | LLM model for judging |
| `--consensus` | `number` | `1` | Number of judges for consensus voting |
| `--budget` | `number` | `50.00` | Maximum budget in USD |
| `--template` | `string` | `"classification-eval"` | Prompt template name |
| `--output` | `string` | — | Output file path |

Evaluates each sample, applies consensus voting if `--consensus > 1`, tracks costs in real-time, and exports the judged results.

### `export`

Generate a report from evaluation results.

```bash
classifier-evals export --results results/latest.json --format html --output report.html
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `--results` | `string` | (required) | Path to evaluation results JSON |
| `--format` | `"json" \| "html"` | `"json"` | Report format |
| `--output` | `string` | — | Output file path |
| `--phoenix` | `string` | — | Phoenix endpoint URL |
| `--langfuse` | — | — | Export to Langfuse (uses env vars for auth) |

Supports HTML reports with inline SVGs, JSON output, Phoenix traces, and Langfuse ingestion.

## CI Integration

### GitHub Actions

```yaml
name: Classifier Evaluation
on:
  pull_request:
    branches: [main]

jobs:
  evaluate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: 'pnpm'
      - run: pnpm install --frozen-lockfile
      - run: pnpm build

      - name: Run evaluation
        run: |
          mkdir -p results
          classifier-evals eval \
            --dataset datasets/examples/sample.csv \
            --format json \
            --output results/latest.json

      - name: Check gates
        run: |
          classifier-evals gates \
            --results results/latest.json \
            --gates datasets/examples/gates.yaml

      - name: Upload results
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: eval-results
          path: results/
          retention-days: 30
```

### Exit Codes

| Code | Meaning |
|------|---------|
| `0` | Success — all gates passed, or comparison completed |
| `1` | Gate failure — one or more regression gates did not pass |
| `2` | Error — invalid arguments, missing files, or runtime error |

## Usage Patterns

### Full Pipeline

```bash
# 1. Evaluate
classifier-evals eval --dataset production.csv --format json --output prod.json

# 2. Check gates
classifier-evals gates --results prod.json --gates production-gates.yaml

# 3. Generate HTML report
classifier-evals export --results prod.json --format html --output report.html

# 4. Compare against previous release
classifier-evals compare --baseline prod-v1.json --candidate prod.json
```

### LLM-as-Judge Pipeline

```bash
# Judge misclassifications with multiple models
classifier-evals judge \
  --dataset errors.csv \
  --model claude-opus \
  --consensus 3 \
  --budget 25.00 \
  --output judged-results.json
```

## Related Packages

- [`@reaatech/classifier-evals`](https://www.npmjs.com/package/@reaatech/classifier-evals) — Core types and schemas
- [`@reaatech/classifier-evals-dataset`](https://www.npmjs.com/package/@reaatech/classifier-evals-dataset) — Dataset loading
- [`@reaatech/classifier-evals-metrics`](https://www.npmjs.com/package/@reaatech/classifier-evals-metrics) — Confusion matrix and metrics
- [`@reaatech/classifier-evals-judge`](https://www.npmjs.com/package/@reaatech/classifier-evals-judge) — LLM-as-judge
- [`@reaatech/classifier-evals-gates`](https://www.npmjs.com/package/@reaatech/classifier-evals-gates) — Regression gates
- [`@reaatech/classifier-evals-exporters`](https://www.npmjs.com/package/@reaatech/classifier-evals-exporters) — JSON, HTML, Phoenix, Langfuse exporters
- [`@reaatech/classifier-evals-mcp-server`](https://www.npmjs.com/package/@reaatech/classifier-evals-mcp-server) — MCP server alternative

## License

[MIT](https://github.com/reaatech/classifier-evals/blob/main/LICENSE)
