# classifier-evals

[![CI](https://github.com/reaatech/classifier-evals/actions/workflows/ci.yml/badge.svg)](https://github.com/reaatech/classifier-evals/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue)](https://www.typescriptlang.org/)

> Production-ready TypeScript evaluation suite for intent classification systems. Provides confusion matrices, LLM-as-judge with cost tracking, regression quality gates, MCP server integration, and Phoenix/Langfuse observability exporters.

This monorepo provides a complete offline evaluation harness for testing, debugging, and monitoring classifier models in CI pipelines and production workflows.

## Features

- **Canonical types & validation** — Zod schemas for all evaluation concepts: classification results, confusion matrices, metrics, judge responses, gates, and export targets
- **Multi-format dataset loader** — CSV (RFC 4180), JSON, and JSONL support with validation, train/test splitting, stratification, K-fold cross-validation, and label management
- **Comprehensive metrics** — 14 classification metrics including macro/micro/weighted precision/recall/F1, Matthews Correlation Coefficient, and Cohen's Kappa
- **LLM-as-judge** — multi-provider judge engine (Anthropic + OpenAI) with real-time cost tracking, consensus voting, custom prompt templates, and result aggregation
- **Regression gates** — threshold, baseline-comparison, and distribution gates with GitHub Actions, JUnit, and PR-comment output formats for CI/CD integration
- **Exporters** — JSON, HTML (SVG-based interactive reports), Arize Phoenix (OTel traces), and Langfuse (observability traces)
- **MCP server** — expose evaluation tools (`run_eval`, `check_gates`, `compare_models`, `llm_judge`, `generate_report`) via the Model Context Protocol
- **CLI** — Commander.js-based CLI with `eval`, `compare`, `gates`, `judge`, and `export` subcommands
- **Observability** — Pino structured logging with PII redaction, OpenTelemetry tracing (pre-built spans), and Prometheus-compatible metrics

## Installation

### Using the packages

Packages are published under the `@reaatech` scope and can be installed individually:

```bash
# Core types and schemas
pnpm add @reaatech/classifier-evals

# Dataset loading and validation
pnpm add @reaatech/classifier-evals-dataset

# Confusion matrix and classification metrics
pnpm add @reaatech/classifier-evals-metrics

# LLM-as-judge with cost tracking
pnpm add @reaatech/classifier-evals-judge

# Regression quality gates
pnpm add @reaatech/classifier-evals-gates

# JSON, HTML, Phoenix, and Langfuse exporters
pnpm add @reaatech/classifier-evals-exporters

# MCP server
pnpm add @reaatech/classifier-evals-mcp-server

# CLI tool
pnpm add @reaatech/classifier-evals-cli
```

### Contributing

```bash
# Clone the repository
git clone https://github.com/reaatech/classifier-evals.git
cd classifier-evals

# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run the test suite
pnpm test

# Run linting
pnpm lint

# Run type checking
pnpm typecheck
```

## Quick Start

Evaluate a classifier on a CSV dataset in under 10 lines:

```typescript
import { loadDataset } from "@reaatech/classifier-evals-dataset";
import { calculateAllMetrics, buildConfusionMatrix } from "@reaatech/classifier-evals-metrics";

// Load and evaluate
const dataset = await loadDataset("./test-set.csv");
const metrics = calculateAllMetrics(dataset.samples);
const cm = buildConfusionMatrix(dataset.samples);

console.log(`Accuracy: ${(metrics.accuracy * 100).toFixed(1)}%`);
console.log(`Macro F1: ${(metrics.f1_macro * 100).toFixed(1)}%`);

// Add LLM-as-judge
import { createJudgeEngine } from "@reaatech/classifier-evals-judge";
const judge = createJudgeEngine({ model: "claude-haiku", budgetLimit: 5.00 });
const judged = await judge.evaluate(dataset.samples);

// Check regression gates
import { createGateEngine } from "@reaatech/classifier-evals-gates";
const engine = createGateEngine();
const gateResult = engine.evaluateGates(metrics, [
  { name: "accuracy", type: "threshold", metric: "accuracy", operator: ">=", threshold: 0.85 },
]);
console.log(gateResult.passed ? "All gates passed" : "Some gates failed");
```

## Packages

| Package | Description |
| ------- | ----------- |
| [`@reaatech/classifier-evals`](./packages/classifier-evals) | Core types, Zod schemas, utilities, logging, OpenTelemetry, PII redaction |
| [`@reaatech/classifier-evals-dataset`](./packages/dataset) | Multi-format dataset loading, validation, splitting, label management |
| [`@reaatech/classifier-evals-metrics`](./packages/metrics) | Confusion matrix, 14 classification metrics, model comparison |
| [`@reaatech/classifier-evals-judge`](./packages/judge) | LLM-as-judge with cost tracking, consensus voting, prompt templates |
| [`@reaatech/classifier-evals-gates`](./packages/gates) | Regression quality gates for CI integration |
| [`@reaatech/classifier-evals-exporters`](./packages/exporters) | JSON, HTML, Phoenix, and Langfuse exporters |
| [`@reaatech/classifier-evals-mcp-server`](./packages/mcp-server) | MCP server exposing evaluation tools |
| [`@reaatech/classifier-evals-cli`](./packages/cli) | Commander.js CLI with eval, compare, gates, judge, and export commands |

## Documentation

- [`ARCHITECTURE.md`](./ARCHITECTURE.md) — System design, package relationships, and data flows
- [`AGENTS.md`](./AGENTS.md) — Coding conventions and development guidelines
- [`CONTRIBUTING.md`](./CONTRIBUTING.md) — Contribution workflow and release process
- [`datasets/examples/`](./datasets/examples/) — Sample datasets and gate configurations

## License

[MIT](LICENSE)
