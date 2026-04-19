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

## Architecture Overview

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Eval Dataset   │────▶│  classifier-evals │────▶│   Metrics &    │
│  (CSV/JSONL)    │     │   (Eval Engine)   │     │   Reports      │
└─────────────────┘     └──────────────────┘     └─────────────────┘
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

| Component | Location | Purpose |
|-----------|----------|---------|
| **Dataset Loader** | `src/dataset/` | Multi-format dataset loading and validation |
| **Metrics Engine** | `src/metrics/` | Confusion matrix and classification metrics |
| **LLM Judge** | `src/judge/` | LLM-as-judge with cost tracking |
| **Regression Gates** | `src/gates/` | CI quality gates with threshold enforcement |
| **Exporters** | `src/exporters/` | Phoenix, Langfuse, JSON, HTML export |
| **MCP Server** | `src/mcp-server/` | Expose eval tools via MCP protocol |

---

## Skill System

Skills represent the atomic capabilities of the evaluation system. Each skill
corresponds to a component of the evaluation pipeline.

### Available Skills

| Skill ID | File | Description |
|----------|------|-------------|
| `dataset-loading` | `skills/dataset-loading/skill.md` | Multi-format dataset ingestion and validation |
| `confusion-matrix` | `skills/confusion-matrix/skill.md` | Confusion matrix calculation and metrics |
| `llm-as-judge` | `skills/llm-as-judge/skill.md` | LLM-based evaluation with cost tracking |
| `regression-gates` | `skills/regression-gates/skill.md` | CI integration with quality gates |
| `phoenix-export` | `skills/phoenix-export/skill.md` | Arize Phoenix trace export |
| `langfuse-export` | `skills/langfuse-export/skill.md` | Langfuse observability export |

---

## MCP Integration

The evaluation harness exposes MCP tools for agent integration:

### run_eval Tool

Execute a full evaluation pipeline:

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

Compare two model evaluations:

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

Evaluate regression gates for CI:

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

Run LLM-as-judge on samples:

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

### Configuration

```yaml
# judge-config.yaml
judge:
  model: claude-opus
  prompt_template: classification-eval
  consensus_count: 3
  max_cost_per_sample: 0.05
  budget_limit: 50.00
  retry_count: 3
  timeout_ms: 30000
```

### Prompt Templates

The system includes built-in prompt templates:

| Template | Purpose |
|----------|---------|
| `classification-eval` | Evaluate if prediction matches ground truth |
| `ambiguity-detection` | Detect if sample is ambiguous |
| `error-categorization` | Categorize the type of error |
| `multi-turn-eval` | Evaluate multi-turn conversation classification |

### Cost Tracking

The judge tracks costs in real-time:

```typescript
import { createJudgeEngine } from 'classifier-evals';

const judge = createJudgeEngine({
  model: 'claude-opus',
  budgetLimit: 50.00,
});

const result = await judge.evaluate(samples);

console.log(`Total cost: $${result.totalCost.toFixed(4)}`);
console.log(`Samples judged: ${result.samplesProcessed}`);
console.log(`Agreement rate: ${result.agreementRate}`);
```

### Consensus Voting

For higher accuracy, use multiple judges:

```yaml
judge:
  models:
    - claude-opus
    - gpt-4-turbo
    - gemini-pro
  voting_strategy: majority
  tie_breaker: highest_confidence
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
    allow_regression_in: 0  # No class can regress

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
      
      - name: Run evaluation
        run: |
          npx classifier-evals eval \
            --dataset datasets/test-set.csv \
            --format json \
            --output results.json
      
      - name: Check gates
        run: |
          npx classifier-evals gates \
            --results results.json \
            --gates gates.yaml
          
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

Export evaluation results to Arize Phoenix for interactive analysis:

```typescript
import { exportToPhoenix } from 'classifier-evals';

await exportToPhoenix({
  evalResults: results,
  endpoint: 'http://localhost:6006',
  datasetName: 'intent-classifier-v2',
  embeddings: embeddingVectors, // Optional
  metadata: { model: 'v2', date: new Date().toISOString() },
});
```

### Langfuse Export

Export to Langfuse for production observability:

```typescript
import { exportToLangfuse } from 'classifier-evals';

await exportToLangfuse({
  evalResults: results,
  publicKey: process.env.LANGFUSE_PUBLIC_KEY,
  secretKey: process.env.LANGFUSE_SECRET_KEY,
  baseUrl: 'https://cloud.langfuse.com',
  traceName: 'classifier-evaluation',
  sessionId: `eval-${Date.now()}`,
});
```

### HTML Report

Generate interactive HTML reports:

```bash
npx classifier-evals report \
  --results results.json \
  --format html \
  --output reports/eval-report.html \
  --include-confusion-matrix \
  --include-per-class-metrics
```

---

## Using with Multi-Agent Systems

### Integration with agent-mesh

Register classifier-evals as an agent in agent-mesh:

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

### Agent-to-Agent Workflow

```
User Query → agent-mesh (orchestrator)
                  │
                  ▼
           classifier-evals (agent)
                  │
                  ▼
           Evaluation Results → Phoenix/Langfuse
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

### Tracing

Each evaluation run generates OpenTelemetry spans:
- `eval.run` — root span for evaluation
- `dataset.load` — dataset loading
- `metrics.calculate` — metrics calculation
- `judge.evaluate` — LLM judge calls
- `gates.check` — regression gate evaluation

---

## Checklist: Production Readiness

Before deploying an evaluation pipeline to production:

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
- **agent-mesh/AGENTS.md** — Multi-agent orchestration patterns
