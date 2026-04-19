# classifier-evals — Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              Client Layer                                │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐                  │
│  │     CLI     │    │   Library   │    │  MCP Client │                  │
│  │   (npx)     │    │  (import)   │    │  (Agent)    │                  │
│  └──────┬──────┘    └──────┬──────┘    └──────┬──────┘                  │
│         │                   │                   │                         │
│         └───────────────────┼───────────────────┘                         │
│                             │                                               │
└─────────────────────────────┼─────────────────────────────────────────────┘
                              ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         Evaluation Core                                  │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │                      Eval Pipeline                                │   │
│  │                                                                   │   │
│  │  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐           │   │
│  │  │  Dataset    │───▶│   Metrics   │───▶│    LLM      │           │   │
│  │  │   Loader    │    │   Engine    │    │   Judge     │           │   │
│  │  └─────────────┘    └─────────────┘    └─────────────┘           │   │
│  │         │                   │                   │                 │   │
│  │         ▼                   ▼                   ▼                 │   │
│  │  ┌─────────────────────────────────────────────────────────────┐  │   │
│  │  │                    Regression Gates                          │  │   │
│  │  │              (CI Quality Gates + Baseline Comparison)        │  │   │
│  │  └─────────────────────────────────────────────────────────────┘  │   │
│  └──────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
                              ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                          Exporters                                       │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐    │
│  │   Phoenix   │  │   Langfuse  │  │    JSON     │  │    HTML     │    │
│  │  (Traces)   │  │ (Sessions)  │  │  (Machine)  │  │  (Report)   │    │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘    │
└─────────────────────────────────────────────────────────────────────────┘
                              ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                       Cross-Cutting Concerns                             │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐       │
│  │    Cost Track    │  │   Observability  │  │  Reproducibility │       │
│  │  - Per-request   │  │  - Tracing (OTel)│  │  - Seed mgmt     │       │
│  │  - Budget track  │  │  - Metrics (OTel)│  │  - Deterministic │       │
│  │  - Anomaly detect│  │  - Logging (pino)│  │  - Versioning    │       │
│  └──────────────────┘  └──────────────────┘  └──────────────────┘       │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Design Principles

### 1. Reproducibility First
- Same inputs always produce same outputs (deterministic seed management)
- Version all configuration and datasets
- Track eval run metadata for auditability

### 2. Cost-Aware Evaluation
- LLM-as-judge costs tracked per-request
- Budget limits enforced (soft and hard)
- Cost estimation before running expensive operations

### 3. CI-Native Design
- Exit codes suitable for automation
- JUnit XML and GitHub Actions output formatting
- Fast gate evaluation with caching

### 4. Pluggable Architecture
- Dataset loaders are swappable (CSV, JSON, Parquet)
- Metrics are extensible (add custom metrics)
- Exporters are pluggable (Phoenix, Langfuse, custom)

### 5. Privacy-Preserving
- Never log raw text from datasets
- PII redaction in all outputs
- Hash sensitive identifiers

---

## Component Deep Dive

### Dataset Loader

```
┌─────────────────────────────────────────────────────────────────────┐
│                      Dataset Loader                                  │
│                                                                      │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐              │
│  │    CSV      │    │   JSON/     │    │   Parquet   │              │
│  │   Loader    │    │   JSONL     │    │   Loader    │              │
│  │             │    │   Loader    │    │             │              │
│  └──────┬──────┘    └──────┬──────┘    └──────┬──────┘              │
│         │                  │                  │                       │
│         └──────────────────┼──────────────────┘                       │
│                            ▼                                         │
│                   ┌─────────────┐                                    │
│                   │  Validator  │                                    │
│                   │             │                                    │
│                   │ - Schema    │                                    │
│                   │ - Labels    │                                    │
│                   │ - Duplicates│                                    │
│                   └─────────────┘                                    │
└─────────────────────────────────────────────────────────────────────┘
```

**Supported Formats:**
- **CSV**: Standard comma-separated with header row
- **JSON**: Array of objects or single object with array field
- **JSONL**: Newline-delimited JSON (one sample per line)
- **Parquet**: Columnar format for large datasets

**Validation Steps:**
1. Schema validation (required columns: text, label, predicted_label)
2. Label distribution analysis (detect imbalance)
3. Duplicate detection (exact and fuzzy)
4. Empty/null value handling
5. Confidence score range validation (0-1)

### Metrics Engine

```
┌─────────────────────────────────────────────────────────────────────┐
│                      Metrics Engine                                  │
│                                                                      │
│  Input: EvalDataset { text, label, predicted_label, confidence? }   │
│                                                                      │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐  │
│  │  Confusion      │    │ Classification  │    │    Model        │  │
│  │  Matrix         │    │    Metrics      │    │  Comparison     │  │
│  │                 │    │                 │    │                 │  │
│  │ - Multi-class   │    │ - Accuracy      │    │ - Paired t-test │  │
│  │ - Per-class     │    │ - Precision     │    │ - McNemar's     │  │
│  │   TP/FP/FN/TN   │    │ - Recall        │    │ - Effect size   │  │
│  │ - Normalized    │    │ - F1 (macro/    │    │                 │  │
│  │   options       │    │ │   micro/      │    │                 │  │
│  │                 │    │ │   weighted)   │    │                 │  │
│  │                 │    │ - MCC           │    │                 │  │
│  │                 │    │ - Cohen's kappa │    │                 │  │
│  │                 │    │ - Top-K acc     │    │                 │  │
│  └─────────────────┘    └─────────────────┘    └─────────────────┘  │
│                                                                      │
│  Output: EvalResults { confusion_matrix, metrics, comparison? }     │
└─────────────────────────────────────────────────────────────────────┘
```

**Confusion Matrix:**
- Multi-class support (handles any number of classes)
- Per-class TP/FP/FN/TN calculation
- Row normalization (precision) and column normalization (recall) options
- Sparse matrix representation for many classes

**Classification Metrics:**
- **Accuracy**: Overall correct predictions
- **Precision**: TP / (TP + FP) per class
- **Recall**: TP / (TP + FN) per class
- **F1 Score**: Harmonic mean of precision and recall
- **Macro F1**: Unweighted mean across classes
- **Micro F1**: Global TP/FP/FN aggregation
- **Weighted F1**: Mean weighted by class support
- **Matthews Correlation Coefficient**: Balanced measure for imbalanced classes
- **Cohen's Kappa**: Inter-rater reliability

**Model Comparison:**
- Paired t-test for significance
- McNemar's test for paired nominal data
- Effect size calculation (Cohen's d)
- Per-class improvement/regression analysis

### LLM-as-Judge System

```
┌─────────────────────────────────────────────────────────────────────┐
│                     LLM-as-Judge System                              │
│                                                                      │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐              │
│  │   Judge     │    │   Prompt    │    │  Consensus  │              │
│  │   Engine    │    │  Templates  │    │   Voting    │              │
│  │             │    │             │    │             │              │
│  │ - Batch     │    │ - Classif-  │    │ - Majority  │              │
│  │   process   │    │ │ ication   │    │   voting    │              │
│  │ - Parallel  │    │ │ -eval     │    │ - Weighted  │              │
│  │   requests  │    │ │ -ambiguity│    │   voting    │              │
│  │ - Rate      │    │ │ -detect   │    │ - Disagree- │              │
│  │   limiting  │    │ │ -error-   │    │ │ ment      │              │
│  │             │    │ │ │categorize│   │ │ detection │              │
│  └──────┬──────┘    └──────┬──────┘    └──────┬──────┘              │
│         │                  │                  │                       │
│         └──────────────────┼──────────────────┘                       │
│                            ▼                                         │
│                   ┌─────────────┐                                    │
│                   │ Cost Tracker│                                    │
│                   │             │                                    │
│                   │ - Per-model │                                    │
│                   │   pricing   │                                    │
│                   │ - Budget    │                                    │
│                   │   tracking  │                                    │
│                   │ - Alerts    │                                    │
│                   └─────────────┘                                    │
└─────────────────────────────────────────────────────────────────────┘
```

**Judge Engine:**
- Batch processing of evaluation samples
- Parallel requests with configurable concurrency
- Retry logic with exponential backoff
- Timeout handling per request

**Prompt Templates:**
- **classification-eval**: "Given the input text, ground truth label, and predicted label, determine if the prediction is correct."
- **ambiguity-detection**: "Determine if this sample is ambiguous and could reasonably be labeled as multiple classes."
- **error-categorization**: "Categorize the type of error: false positive, false negative, label noise, or genuine ambiguity."
- **multi-turn-eval**: "Evaluate classification across a multi-turn conversation context."

**Consensus Voting:**
- Majority voting across multiple LLM judges
- Weighted voting by judge reliability (historical accuracy)
- Disagreement detection and flagging
- Cost vs accuracy tradeoff optimization

**Cost Tracking:**
- Per-model cost calculation (input + output tokens)
- Real-time budget tracking
- Cost estimation before running
- Budget alerts at configurable thresholds

### Regression Gates

```
┌─────────────────────────────────────────────────────────────────────┐
│                      Regression Gates                                │
│                                                                      │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐  │
│  │   Threshold     │    │   Baseline      │    │  Distribution   │  │
│  │     Gates       │    │  Comparison     │    │     Gates       │  │
│  │                 │    │                 │    │                 │  │
│  │ - Accuracy      │    │ - Compare to    │    │ - Label         │  │
│  │   threshold     │    │ │ baseline      │    │ │ distribution  │  │
│  │ - Per-class F1  │    │ │ - Statistical │    │ - Confidence    │  │
│  │   thresholds    │    │ │ │ significance│    │ │ score dist    │  │
│  │ - Macro/micro   │    │ │ - Regression  │    │ - Unknown rate  │  │
│  │ │ F1 thresholds │    │ │ │ detection   │    │ - Ambiguity     │  │
│  │                 │    │ │               │    │ │ rate          │  │
│  └─────────────────┘    └─────────────────┘    └─────────────────┘  │
│                                                                      │
│  Output: GateResult { passed: boolean, failures: GateFailure[] }    │
└─────────────────────────────────────────────────────────────────────┘
```

**Threshold Gates:**
- Overall accuracy threshold
- Per-class F1 thresholds
- Macro/micro F1 thresholds
- Confidence score distribution checks

**Baseline Comparison:**
- Compare against baseline model results
- Statistical significance testing (paired tests)
- Regression detection (any class degraded beyond threshold)
- Improvement requirements (must improve X classes by Y%)

**Distribution Gates:**
- Label distribution drift detection (KL divergence)
- Confidence score distribution checks
- Unknown rate threshold
- Ambiguity rate threshold

### Exporters

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Exporters                                     │
│                                                                      │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐              │
│  │   Phoenix   │    │   Langfuse  │    │    JSON     │              │
│  │  Exporter   │    │  Exporter   │    │  Exporter   │              │
│  │             │    │             │    │             │              │
│  │ - Dataset   │    │ - Traces    │    │ - Full      │              │
│  │ │ export    │    │ - Scores    │    │ │ results   │              │
│  │ - Embeddings│    │ - Observ-   │    │ - Summary   │              │
│  │ - Metrics   │    │ │ ations    │    │ │ stats     │              │
│  │             │    │ - Sessions  │    │ - Machine   │              │
│  │             │    │ │           │    │ │ readable  │              │
│  └─────────────┘    └─────────────┘    └─────────────┘              │
│                                                                      │
│  ┌─────────────┐                                                    │
│  │    HTML     │                                                    │
│  │  Exporter   │                                                    │
│  │             │                                                    │
│  │ - Interactive                                                    │
│  │ │ confusion                                                    │
│  │ │ matrix                                                       │
│  │ - Per-class                                                    │
│  │ │ metrics                                                     │
│  │ - Baseline                                                    │
│  │ │ comparison                                                │
│  └─────────────┘                                                    │
└─────────────────────────────────────────────────────────────────────┘
```

**Phoenix Exporter:**
- Export eval results as Phoenix dataset
- Embedding export for dimensionality reduction visualization
- Confusion matrix as Phoenix metrics
- Trace export for LLM judge decisions

**Langfuse Exporter:**
- Export eval runs as Langfuse traces
- Score export for quality metrics
- Observation export for individual predictions
- Session grouping by eval run

**JSON Exporter:**
- Full eval results in machine-readable JSON
- Summary statistics
- Per-class breakdown
- Metadata for downstream processing

**HTML Exporter:**
- Interactive confusion matrix heatmap
- Per-class metric charts
- Comparison with baseline (if available)
- LLM judge agreement analysis

---

## Data Flow

### Complete Evaluation Flow

```
1. Load dataset (CSV/JSON/Parquet)
        │
2. Validate dataset:
   - Schema validation
   - Label distribution
   - Duplicate detection
        │
3. Calculate confusion matrix:
   - Multi-class matrix
   - Per-class TP/FP/FN/TN
        │
4. Calculate classification metrics:
   - Accuracy, precision, recall, F1
   - Macro/micro/weighted averages
        │
5. (Optional) Run LLM-as-judge:
   - Batch process samples
   - Track costs
   - Consensus voting
        │
6. Evaluate regression gates:
   - Threshold checks
   - Baseline comparison
   - Distribution checks
        │
7. Export results:
   - JSON/HTML reports
   - Phoenix/Langfuse
        │
8. Log and trace complete run
```

---

## Security Model

### Defense in Depth

```
┌─────────────────────────────────────────────────────────────────────┐
│ Layer 1: Data                                                        │
│ - PII redaction in all logs                                         │
│ - Hash sensitive identifiers                                        │
│ - Never log raw text from datasets                                  │
├─────────────────────────────────────────────────────────────────────┤
│ Layer 2: API Keys                                                    │
│ - All LLM API keys from environment variables                       │
│ - Never log API keys or tokens                                      │
│ - Separate keys per provider                                        │
├─────────────────────────────────────────────────────────────────────┤
│ Layer 3: Cost Controls                                               │
│ - Budget limits enforced                                            │
│ - Cost estimation before expensive operations                       │
│ - Real-time cost monitoring with alerts                             │
├─────────────────────────────────────────────────────────────────────┤
│ Layer 4: Export Security                                             │
│ - PII sanitization before export                                    │
│ - Configurable data retention                                       │
│ - Secure transport (HTTPS) for remote exporters                     │
└─────────────────────────────────────────────────────────────────────┘
```

### PII Handling

- Text content is never logged (only hashed identifiers)
- User identifiers are hashed before logging
- Exports are sanitized to remove PII
- Configurable PII patterns for redaction

---

## Observability

### Tracing

Every evaluation run generates OpenTelemetry spans:

| Span | Attributes |
|------|------------|
| `eval.run` | dataset, samples, model |
| `dataset.load` | format, path, rows |
| `metrics.calculate` | metric_types, duration |
| `judge.evaluate` | model, samples, cost |
| `gates.check` | gate_count, passed |

### Metrics

| Metric | Type | Labels | Description |
|--------|------|--------|-------------|
| `classifier_evals.runs.total` | Counter | `status` | Total evaluation runs |
| `classifier_evals.samples.evaluated` | Counter | `dataset` | Samples processed |
| `classifier_evals.judge.calls` | Counter | `model`, `status` | LLM judge API calls |
| `classifier_evals.judge.cost` | Histogram | `model` | Judge cost per run |
| `classifier_evals.gates.result` | Gauge | `gate_name` | Gate pass/fail (1/0) |
| `classifier_evals.metrics.accuracy` | Gauge | `dataset` | Overall accuracy |
| `classifier_evals.metrics.f1_macro` | Gauge | `dataset` | Macro F1 score |

### Logging

All logs are structured JSON with standard fields:

```json
{
  "timestamp": "2026-04-15T23:00:00Z",
  "service": "classifier-evals",
  "eval_run_id": "eval-123",
  "level": "info",
  "message": "Evaluation completed",
  "dataset": "test-set.csv",
  "samples": 1000,
  "accuracy": 0.87,
  "f1_macro": 0.84,
  "judge_cost": 12.34,
  "gates_passed": true,
  "duration_ms": 4523
}
```

---

## Failure Modes

| Failure | Detection | Recovery |
|---------|-----------|----------|
| Dataset load error | File not found, parse error | Return detailed error, suggest fixes |
| Invalid schema | Missing required columns | List missing columns, show expected schema |
| LLM API error | Non-2xx response | Retry with backoff, skip sample, continue |
| Budget exceeded | Cost > budget limit | Stop judge, return partial results |
| Gate evaluation error | Invalid gate config | Log error, fail open (pass) with warning |
| Export error | Network/storage failure | Log error, continue with other exports |
| Timeout | Request exceeds timeout | Return partial results, log warning |

---

## Deployment Architecture

### GCP Cloud Run

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Cloud Run Service                            │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │                   classifier-evals Container                 │    │
│  │  ┌───────────┐  ┌───────────┐  ┌───────────┐                │    │
│  │  │ Eval      │  │ OTel      │  │ Secrets   │                │    │
│  │  │ Engine    │  │ Sidecar   │  │ Mounted   │                │    │
│  │  └───────────┘  └───────────┘  └───────────┘                │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                                                                      │
│  Config:                                                             │
│  - Min instances: 0 (scale to zero)                                 │
│  - Max instances: 5 (configurable)                                  │
│  - Memory: 1GB, CPU: 1 vCPU                                         │
│  - Timeout: 300s (for large evals)                                  │
│                                                                      │
│  Secrets: Secret Manager → mounted as env vars                       │
│  Observability: OTel → Cloud Monitoring / Datadog                    │
│  Storage: GCS for datasets and results                              │
└─────────────────────────────────────────────────────────────────────┘
```

---

## References

- **AGENTS.md** — Agent development guide
- **DEV_PLAN.md** — Development checklist
- **README.md** — Quick start and overview
- **datasets/examples/** — Example datasets and configurations
- **MCP Specification** — https://modelcontextprotocol.io/
- **agent-mesh/AGENTS.md** — Multi-agent orchestration patterns
