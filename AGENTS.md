---
agent_id: "classifier-evals"
display_name: "Classifier Evals"
version: "0.1.0"
description: "Evaluation suite for agent classification and routing accuracy"
type: "evaluator"
confidence_threshold: 0.9
---

# classifier-evals — Agent Development Guide

## What this is

This document defines how to use `classifier-evals` to build evaluation pipelines
for intent classification systems. It covers dataset loading, confusion matrix analysis,
LLM-as-judge with cost accounting, regression gates for CI, and Phoenix/Langfuse
exporters for observability.

**Target audience:** ML engineers and platform teams building AI agents with intent
classification capabilities who need reproducible offline evaluation, cost-aware LLM
judging, and CI-integrated quality gates.

---

## Monorepo Structure

This project is a **pnpm monorepo** with 8 packages under `packages/`, using
Turborepo for orchestration, Biome for linting/formatting, and Changesets for
versioning.

```
classifier-evals/
  packages/
    classifier-evals/    →  @reaatech/classifier-evals          (core types, schemas, observability)
    dataset/             →  @reaatech/classifier-evals-dataset   (loader, validator, splitter, labels)
    metrics/             →  @reaatech/classifier-evals-metrics   (confusion matrix, metrics, comparison)
    judge/               →  @reaatech/classifier-evals-judge     (LLM judge, cost tracking, consensus)
    gates/               →  @reaatech/classifier-evals-gates     (regression gates, CI integration)
    exporters/           →  @reaatech/classifier-evals-exporters (JSON, HTML, Phoenix, Langfuse)
    mcp-server/          →  @reaatech/classifier-evals-mcp-server(MCP tools)
    cli/                 →  @reaatech/classifier-evals-cli       (CLI commands)
  datasets/
  skills/
  docker/
  infra/
```

### Package Dependency Graph

```
@reaatech/classifier-evals (no internal deps)
 ├─→ @reaatech/classifier-evals-dataset
 ├─→ @reaatech/classifier-evals-metrics
 ├─→ @reaatech/classifier-evals-judge
 ├─→ @reaatech/classifier-evals-gates ──→ metrics
 ├─→ @reaatech/classifier-evals-exporters ──→ core, metrics
 ├─→ @reaatech/classifier-evals-mcp-server ──→ all above
 └─→ @reaatech/classifier-evals-cli ──→ all above
```

### Tooling

| Tool | Purpose |
|------|---------|
| **pnpm** | Package manager with workspaces (`pnpm-workspace.yaml`) |
| **Turborepo** | Task orchestration (`turbo.json`) |
| **Biome** | Linting + formatting (`biome.json`) |
| **Changesets** | Versioning + CHANGELOG (`.changeset/`) |
| **tsup** | Per-package build (dual ESM/CJS) |
| **vitest** | Per-package test runner |

---

## Architecture Overview

```
┌─────────────────┐     ┌──────────────────────────┐     ┌─────────────────┐
│  Eval Dataset   │────▶│   @reaatech/             │────▶│   Metrics &    │
│  (CSV/JSONL)    │     │   classifier-evals-*     │     │   Reports      │
└─────────────────┘     │   (Eval Engine)          │     └─────────────────┘
                        └──────────────────────────┘
                                 │
                                 ▼
                        ┌──────────────────┐
                        │   LLM-as-Judge   │
                        │   + Cost Track   │
                        └──────────────────┘
                                 │
                                 ▼
                        ┌──────────────────┐
                        │  Regression      │
                        │  Gates for CI    │
                        └──────────────────┘
                                 │
                                 ▼
                        ┌──────────────────┐
                        │  Phoenix/        │
                        │  Langfuse        │
                        └──────────────────┘
```

### Key Components

| Component | Package | Purpose |
|-----------|---------|---------|
| **Dataset Loader** | `@reaatech/classifier-evals-dataset` | Multi-format dataset loading and validation |
| **Metrics Engine** | `@reaatech/classifier-evals-metrics` | Confusion matrix and classification metrics |
| **LLM Judge** | `@reaatech/classifier-evals-judge` | LLM-as-judge with cost tracking |
| **Regression Gates** | `@reaatech/classifier-evals-gates` | CI quality gates with threshold enforcement |
| **Exporters** | `@reaatech/classifier-evals-exporters` | Phoenix, Langfuse, JSON, HTML export |
| **MCP Server** | `@reaatech/classifier-evals-mcp-server` | Expose eval tools via MCP protocol |
| **CLI** | `@reaatech/classifier-evals-cli` | Commander.js CLI for all eval operations |
| **Core** | `@reaatech/classifier-evals` | Types, Zod schemas, observability, PII redaction |

---

## Skill System

Skills represent the atomic capabilities of the evaluation system. Each skill
corresponds to a package in the monorepo.

### Available Skills

| Skill ID | File | Package |
|----------|------|---------|
| `dataset-loading` | `skills/dataset-loading/skill.md` | `@reaatech/classifier-evals-dataset` |
| `confusion-matrix` | `skills/confusion-matrix/skill.md` | `@reaatech/classifier-evals-metrics` |
| `llm-as-judge` | `skills/llm-as-judge/skill.md` | `@reaatech/classifier-evals-judge` |
| `regression-gates` | `skills/regression-gates/skill.md` | `@reaatech/classifier-evals-gates` |
| `phoenix-export` | `skills/phoenix-export/skill.md` | `@reaatech/classifier-evals-exporters` |
| `langfuse-export` | `skills/langfuse-export/skill.md` | `@reaatech/classifier-evals-exporters` |

---

## MCP Integration

The MCP server (`@reaatech/classifier-evals-mcp-server`) exposes 5 tools:

### run_eval Tool

```json
{
  "name": "run_eval",
  "arguments": {
    "dataset_path": "datasets/test-set.csv",
    "predictions": [
      {"text": "Reset my password", "label": "password_reset", "predicted_label": "password_reset", "confidence": 0.95}
    ],
    "metrics": ["accuracy", "f1", "confusion_matrix"],
    "output_format": "json"
  }
}
```

### compare_models Tool

```json
{
  "name": "compare_models",
  "arguments": {
    "baseline_results": "results/model-v1.json",
    "candidate_results": "results/model-v2.json"
  }
}
```

### check_gates Tool

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

### llm_judge Tool

```json
{
  "name": "llm_judge",
  "arguments": {
    "samples": [{"text": "...", "label": "...", "predicted_label": "..."}],
    "judge_model": "claude-opus",
    "consensus_count": 3,
    "budget_limit": 10.00
  }
}
```

### generate_report Tool

```json
{
  "name": "generate_report",
  "arguments": {
    "eval_results": "results/latest.json",
    "format": "html"
  }
}
```

---

## Dataset Format

### CSV Format

```csv
text,label,predicted_label,confidence
"Reset my password",password_reset,password_reset,0.95
"Cancel my subscription",cancel_subscription,refund_request,0.72
"Where is my order",order_status,order_status,0.88
```

### JSONL Format

```jsonl
{"text": "Reset my password", "label": "password_reset", "predicted_label": "password_reset", "confidence": 0.95}
{"text": "Cancel my subscription", "label": "cancel_subscription", "predicted_label": "refund_request", "confidence": 0.72}
{"text": "Where is my order", "label": "order_status", "predicted_label": "order_status", "confidence": 0.88}
```

### Required Fields

| Field | Required | Type | Description |
|-------|----------|------|-------------|
| `text` | yes | string | The input text that was classified |
| `label` | yes | string | Ground truth label |
| `predicted_label` | yes | string | Model's predicted label |
| `confidence` | no | number | Model's confidence score (0-1) |

---

## LLM-as-Judge

```typescript
import { createJudgeEngine } from '@reaatech/classifier-evals-judge';

const judge = createJudgeEngine({
  model: 'claude-opus',
  budgetLimit: 50.00,
});

const result = await judge.evaluate(samples);

console.log(`Total cost: $${result.totalCost.toFixed(4)}`);
console.log(`Samples judged: ${result.samplesProcessed}`);
console.log(`Agreement rate: ${result.agreementRate}`);
```

### Prompt Templates

| Template | Purpose |
|----------|---------|
| `classification-eval` | Evaluate if prediction matches ground truth |
| `ambiguity-detection` | Detect if sample is ambiguous |
| `error-categorization` | Categorize the type of error |
| `multi-turn-eval` | Evaluate multi-turn conversation classification |

### Consensus Voting

```typescript
import { executeConsensusVoting } from '@reaatech/classifier-evals-judge';

const result = await executeConsensusVoting(sample, [judge1, judge2, judge3], {
  votingStrategy: 'majority',
  tieBreaker: 'highest_confidence',
});
```

---

## Regression Gates

### Gate Configuration

```yaml
# gates.yaml
gates:
  - name: overall-accuracy
    type: threshold
    metric: accuracy
    operator: ">="
    threshold: 0.85

  - name: macro-f1
    type: threshold
    metric: f1_macro
    operator: ">="
    threshold: 0.80

  - name: no-regression
    type: baseline-comparison
    baseline: results/baseline.json
    metric: f1_per_class
    allow_regression_in: 0

  - name: unknown-rate
    type: distribution
    metric: unknown_rate
    operator: "<="
    threshold: 0.05
```

### CI Integration

```yaml
# .github/workflows/eval.yml
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
        with: { node-version: 22, cache: 'pnpm' }
      - run: pnpm install --frozen-lockfile
      - run: pnpm build

      - name: Run evaluation
        run: |
          mkdir -p results
          pnpm --filter @reaatech/classifier-evals-cli exec classifier-evals eval \
            --dataset datasets/examples/sample.csv \
            --format json \
            --output results/latest.json

      - name: Check gates
        run: |
          pnpm --filter @reaatech/classifier-evals-cli exec classifier-evals gates \
            --results results/latest.json \
            --gates datasets/examples/gates.yaml

      - name: Upload results
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: eval-results
          path: results/
```

### Gate Types

| Gate Type | Description |
|-----------|-------------|
| `threshold` | Simple threshold on a metric |
| `baseline-comparison` | Compare against baseline results |
| `distribution` | Check distribution properties |

---

## Exporters

### Phoenix Export

```typescript
import { exportToPhoenix } from '@reaatech/classifier-evals-exporters';

await exportToPhoenix({
  evalRun,
  options: {
    endpoint: 'http://localhost:6006',
    datasetName: 'intent-classifier-v2',
    metadata: { model: 'v2', date: new Date().toISOString() },
  },
});
```

### Langfuse Export

```typescript
import { exportToLangfuse } from '@reaatech/classifier-evals-exporters';

await exportToLangfuse({
  evalRun,
  options: {
    publicKey: process.env.LANGFUSE_PUBLIC_KEY,
    secretKey: process.env.LANGFUSE_SECRET_KEY,
    baseUrl: 'https://cloud.langfuse.com',
    traceName: 'classifier-evaluation',
    sessionId: `eval-${Date.now()}`,
  },
});
```

### HTML Report

```bash
pnpm --filter @reaatech/classifier-evals-cli exec classifier-evals export \
  --results results.json \
  --format html \
  --output report.html
```

---

## Using with Multi-Agent Systems

### Integration with agent-mesh

```yaml
# agents/classifier-evals.yaml
agent_id: classifier-evals
display_name: Classifier Evaluation
description: >-
  Offline evaluation harness for intent classification.
  Provides confusion matrices, LLM-as-judge, regression gates,
  and Phoenix/Langfuse exporters.
endpoint: "${CLASSIFIER_EVALS_ENDPOINT:-http://localhost:8083}"
type: mcp
is_default: false
confidence_threshold: 0.9
examples:
  - "Evaluate my classifier on the test set"
  - "Run LLM-as-judge on misclassifications"
  - "Check if the new model passes regression gates"
```

---

## Security Considerations

### PII Handling

- **Never log raw text** — the logger redacts text content automatically
- **Hash sensitive data** — use hashes for user identifiers
- **Sanitize exports** — remove PII before exporting to Phoenix/Langfuse

### API Key Management

- All LLM API keys come from environment variables
- Never log API keys or tokens
- Use separate keys per model/provider

### Cost Controls

- Set budget limits to prevent runaway costs
- Use cost estimation before running LLM judge
- Monitor costs in real-time with alerts

---

## Observability

### Structured Logging

Every evaluation run is logged with:

```json
{
  "timestamp": "2026-04-15T23:00:00Z",
  "service": "classifier-evals",
  "eval_run_id": "eval-123",
  "dataset": "test-set.csv",
  "samples": 1000,
  "accuracy": 0.87,
  "f1_macro": 0.84,
  "judge_cost": 12.34,
  "gates_passed": true
}
```

### OpenTelemetry Metrics

| Metric | Type | Description |
|--------|------|-------------|
| `classifier_evals.runs.total` | Counter | Total evaluation runs |
| `classifier_evals.samples.evaluated` | Counter | Samples processed |
| `classifier_evals.judge.calls` | Counter | LLM judge API calls |
| `classifier_evals.judge.cost` | Histogram | Judge cost per run |
| `classifier_evals.gates.result` | Gauge | Gate pass/fail (1/0) |
| `classifier_evals.metrics.accuracy` | Gauge | Overall accuracy |
| `classifier_evals.metrics.f1_macro` | Gauge | Macro F1 score |

### Tracing

Each evaluation run generates OpenTelemetry spans:
- `eval.run` — root span for evaluation
- `dataset.load` — dataset loading
- `metrics.calculate` — metrics calculation
- `judge.evaluate` — LLM judge calls
- `gates.check` — regression gate evaluation

---

## Checklist: Production Readiness

- [ ] Dataset format validated (required columns present)
- [ ] Label distribution analyzed (no severe imbalance)
- [ ] Baseline results established for regression comparison
- [ ] Regression gates configured with appropriate thresholds
- [ ] LLM judge budget limits set
- [ ] PII redaction verified in logs
- [ ] Phoenix/Langfuse exporters configured
- [ ] CI integration tested (exit codes, reports)
- [ ] Cost tracking enabled and alerts configured
- [ ] Reproducibility verified (same inputs → same outputs)

---

## References

- **ARCHITECTURE.md** — System design deep dive
- **DEV_PLAN.md** — Development checklist
- **README.md** — Quick start and overview
- **datasets/examples/** — Example datasets and configurations
- **MCP Specification** — https://modelcontextprotocol.io/
