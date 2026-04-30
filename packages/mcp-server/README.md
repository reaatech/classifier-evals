# @reaatech/classifier-evals-mcp-server

[![npm version](https://img.shields.io/npm/v/@reaatech/classifier-evals-mcp-server.svg)](https://www.npmjs.com/package/@reaatech/classifier-evals-mcp-server)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://github.com/reaatech/classifier-evals/blob/main/LICENSE)
[![CI](https://img.shields.io/github/actions/workflow/status/reaatech/classifier-evals/ci.yml?branch=main&label=CI)](https://github.com/reaatech/classifier-evals/actions/workflows/ci.yml)

> **Status:** Pre-1.0 — APIs may change in minor versions. Pin to a specific version in production.

MCP (Model Context Protocol) server exposing classifier evaluation tools via stdio transport. Integrates with MCP-compatible clients (Claude Desktop, agent-mesh, and other MCP hosts) to run evaluations, check gates, compare models, run LLM-as-judge, and generate reports.

## Installation

```bash
npm install @reaatech/classifier-evals-mcp-server @modelcontextprotocol/sdk
# or
pnpm add @reaatech/classifier-evals-mcp-server @modelcontextprotocol/sdk
```

## Feature Overview

- **5 MCP tools** — `run_eval`, `check_gates`, `compare_models`, `llm_judge`, `generate_report`
- **Stdio transport** — standard MCP server over stdin/stdout, compatible with all MCP clients
- **Full evaluation pipeline** — dataset loading, metrics calculation, and result construction in a single call
- **YAML and JSON configs** — load gate configs and eval results from file paths
- **Structured logging** — Pino-based logging of all tool invocations and results
- **Error handling** — typed MCP errors with descriptive messages

## Quick Start

### As an MCP Server

```bash
# Start the MCP server (uses stdio transport)
npx @reaatech/classifier-evals-mcp-server
```

### As a Library

```typescript
import { startMCPServer } from "@reaatech/classifier-evals-mcp-server";

// Start the MCP server programmatically
await startMCPServer();
```

## MCP Tools

### `run_eval`

Execute a full evaluation pipeline on a dataset.

```json
{
  "name": "run_eval",
  "arguments": {
    "dataset_path": "datasets/test-set.csv",
    "predictions": [],
    "metrics": ["accuracy", "f1", "confusion_matrix"],
    "output_format": "json"
  }
}
```

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `dataset_path` | `string` | Yes | Path to the dataset file (CSV, JSON, JSONL) |
| `predictions` | `object[]` | No | Array of prediction objects with `text`, `label`, `predicted_label`, `confidence` |
| `metrics` | `string[]` | No | Metrics to calculate |
| `output_format` | `"json" \| "html"` | No | Output format |

If `predictions` is provided, those samples are used directly. Otherwise, the dataset is loaded from `dataset_path` and its samples are used.

### `check_gates`

Evaluate regression gates against evaluation results for CI.

```json
{
  "name": "check_gates",
  "arguments": {
    "eval_results": "results/latest.json",
    "gate_config": "gates.yaml",
    "baseline_results": "results/baseline.json"
  }
}
```

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `eval_results` | `string \| EvalRun` | Yes | Path to evaluation results JSON or inline EvalRun object |
| `gate_config` | `string \| RegressionGate[]` | Yes | Path to gate YAML config or inline gate definitions |
| `baseline_results` | `string` | No | Path to baseline results for comparison gates |

Returns a pass/fail summary with individual gate results.

### `compare_models`

Compare two model evaluation results with statistical significance.

```json
{
  "name": "compare_models",
  "arguments": {
    "baseline_results": "results/model-v1.json",
    "candidate_results": "results/model-v2.json"
  }
}
```

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `baseline_results` | `string` | Yes | Path to baseline model results |
| `candidate_results` | `string` | Yes | Path to candidate model results |

Returns accuracy difference, p-value, significance flag, effect size, and per-class F1 comparison.

### `llm_judge`

Run LLM-as-judge on samples with cost tracking and consensus voting.

```json
{
  "name": "llm_judge",
  "arguments": {
    "samples": [
      { "text": "Reset my password", "label": "password_reset", "predicted_label": "password_reset" }
    ],
    "judge_model": "claude-opus",
    "consensus_count": 3,
    "budget_limit": 10.00
  }
}
```

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `samples` | `object[]` | Yes | Array of samples to judge |
| `judge_model` | `string` | Yes | LLM model to use for judging |
| `consensus_count` | `number` | No | Number of judges for consensus (default: 1) |
| `budget_limit` | `number` | No | Maximum budget in USD |

### `generate_report`

Generate a JSON or HTML report from evaluation results.

```json
{
  "name": "generate_report",
  "arguments": {
    "eval_results": "results/latest.json",
    "format": "html"
  }
}
```

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `eval_results` | `string` | Yes | Path to evaluation results JSON |
| `format` | `"json" \| "html"` | No | Report format (default: json) |

## Configuration

### MCP Client Integration

Add to your MCP client configuration (e.g., Claude Desktop):

```json
{
  "mcpServers": {
    "classifier-evals": {
      "command": "npx",
      "args": ["@reaatech/classifier-evals-mcp-server"]
    }
  }
}
```

Or using the executable directly:

```json
{
  "mcpServers": {
    "classifier-evals": {
      "command": "node",
      "args": ["./node_modules/@reaatech/classifier-evals-mcp-server/dist/index.js"]
    }
  }
}
```

## Usage Patterns

### Integration with agent-mesh

Register classifier-evals as an agent in agent-mesh:

```yaml
agent_id: classifier-evals
display_name: Classifier Evaluation
endpoint: "${CLASSIFIER_EVALS_ENDPOINT:-http://localhost:8083}"
type: mcp
is_default: false
confidence_threshold: 0.9
```

### Headless Evaluation Pipeline

```typescript
import { startMCPServer } from "@reaatech/classifier-evals-mcp-server";

// The server handles tool dispatch automatically
// Clients connect via stdio and call:
//   run_eval → dataset loading → metrics → eval run
//   check_gates → gate evaluation → pass/fail
//   compare_models → statistical comparison
//   llm_judge → judge engine → consensus → results
//   generate_report → JSON/HTML export

await startMCPServer();
```

## Related Packages

- [`@reaatech/classifier-evals`](https://www.npmjs.com/package/@reaatech/classifier-evals) — Core types, schemas, logging
- [`@reaatech/classifier-evals-dataset`](https://www.npmjs.com/package/@reaatech/classifier-evals-dataset) — Dataset loading and validation
- [`@reaatech/classifier-evals-metrics`](https://www.npmjs.com/package/@reaatech/classifier-evals-metrics) — Confusion matrix and metrics
- [`@reaatech/classifier-evals-judge`](https://www.npmjs.com/package/@reaatech/classifier-evals-judge) — LLM-as-judge with cost tracking
- [`@reaatech/classifier-evals-gates`](https://www.npmjs.com/package/@reaatech/classifier-evals-gates) — Regression quality gates
- [`@reaatech/classifier-evals-exporters`](https://www.npmjs.com/package/@reaatech/classifier-evals-exporters) — JSON, HTML, Phoenix, Langfuse exporters
- [`@reaatech/classifier-evals-cli`](https://www.npmjs.com/package/@reaatech/classifier-evals-cli) — CLI alternative to MCP tools

## License

[MIT](https://github.com/reaatech/classifier-evals/blob/main/LICENSE)
