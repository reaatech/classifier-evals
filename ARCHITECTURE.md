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
│                    Monorepo Packages (pnpm workspace)                     │
│                                                                          │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │                     Eval Pipeline                                  │   │
│  │                                                                   │   │
│  │  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐           │   │
│  │  │ @reaatech/  │───▶│ @reaatech/  │───▶│ @reaatech/  │           │   │
│  │  │ -evals-     │    │ -evals-     │    │ -evals-     │           │   │
│  │  │ dataset     │    │ metrics     │    │ judge       │           │   │
│  │  └─────────────┘    └─────────────┘    └─────────────┘           │   │
│  │         │                   │                   │                 │   │
│  │         ▼                   ▼                   ▼                 │   │
│  │  ┌─────────────────────────────────────────────────────────────┐  │   │
│  │  │           @reaatech/classifier-evals-gates                   │  │   │
│  │  │            (CI Quality Gates + Baseline Comparison)          │  │   │
│  │  └─────────────────────────────────────────────────────────────┘  │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │          @reaatech/classifier-evals (Core — Foundation Layer)     │   │
│  │  ┌──────────────────┐  ┌──────────────────┐  ┌─────────────────┐ │   │
│  │  │  Types + Zod      │  │  Observability   │  │   Utilities     │ │   │
│  │  │  (domain.ts)      │  │  (logger, OTel,  │  │   (hash, PII,   │ │   │
│  │  │  50+ schemas      │  │   dashboard)     │  │    eval-run)    │ │   │
│  │  └──────────────────┘  └──────────────────┘  └─────────────────┘ │   │
│  └──────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
                               ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                          Exporters                                       │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐    │
│  │   Phoenix   │  │   Langfuse  │  │    JSON     │  │    HTML     │    │
│  │  (Traces)   │  │ (Sessions)  │  │  (Machine)  │  │  (Report)   │    │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘    │
│        @reaatech/classifier-evals-exporters                              │
└─────────────────────────────────────────────────────────────────────────┘
                               ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    MCP Server + CLI                                      │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │  @reaatech/classifier-evals-mcp-server   (5 MCP tools over stdio) │   │
│  │  @reaatech/classifier-evals-cli          (Commander.js commands)  │   │
│  └──────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Package Architecture

### Package Dependency Graph

```
@reaatech/classifier-evals (no internal deps)
  └── External only: zod, pino, @opentelemetry/*
       │
       ├─→ @reaatech/classifier-evals-dataset        (depends on core)
       ├─→ @reaatech/classifier-evals-metrics        (depends on core)
       ├─→ @reaatech/classifier-evals-judge          (depends on core)
       │
       ├─→ @reaatech/classifier-evals-gates          (depends on core, metrics)
       ├─→ @reaatech/classifier-evals-exporters      (depends on core, metrics)
       │
       ├─→ @reaatech/classifier-evals-mcp-server     (depends on all above)
       └─→ @reaatech/classifier-evals-cli            (depends on all above)
```

### Per-Package Build

Each package uses **tsup** for building, configured identically:

```json
{
  "build": "tsup src/index.ts --format cjs,esm --dts --clean"
}
```

Output per package:
- `dist/index.js` — ESM
- `dist/index.cjs` — CJS
- `dist/index.d.ts` — TypeScript declarations
- `dist/index.d.cts` — CJS declarations

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
- Dataset loaders are swappable (CSV, JSON)
- Metrics are extensible (add custom metrics)
- Exporters are pluggable (Phoenix, Langfuse, custom)

### 5. Privacy-Preserving
- Never log raw text from datasets
- PII redaction in all outputs
- Hash sensitive identifiers

---

## Component Deep Dive

### Dataset Loader (`@reaatech/classifier-evals-dataset`)

```
┌─────────────────────────────────────────────────────────────────────┐
│                      Dataset Loader                                  │
│                                                                      │
│  ┌─────────────┐    ┌─────────────┐                                 │
│  │    CSV      │    │   JSON/     │                                 │
│  │   Loader    │    │   JSONL     │                                 │
│  │  (RFC 4180) │    │   Loader    │                                 │
│  └──────┬──────┘    └──────┬──────┘                                 │
│         │                  │                                          │
│         └──────────────────┼──────────────────┘                       │
│                            ▼                                         │
│                   ┌─────────────┐                                    │
│                   │  Validator  │                                    │
│                   │             │                                    │
│                   │ - Schema    │                                    │
│                   │ - Label     │                                    │
│                   │   distribution│                                  │
│                   │ - Duplicates│                                    │
│                   │ - Leakage   │                                    │
│                   └─────────────┘                                    │
│                            │                                         │
│                   ┌─────────────┐                                    │
│                   │  Splitter   │                                    │
│                   │             │                                    │
│                   │ - Train/test│                                    │
│                   │ - Stratified│                                    │
│                   │ - K-fold    │                                    │
│                   └─────────────┘                                    │
│                            │                                         │
│                   ┌─────────────┐                                    │
│                   │ Label       │                                    │
│                   │ Manager     │                                    │
│                   │             │                                    │
│                   │ - Normalize │                                    │
│                   │ - Aliases   │                                    │
│                   │ - Unknown   │                                    │
│                   │ - Hierarchy │                                    │
│                   └─────────────┘                                    │
└─────────────────────────────────────────────────────────────────────┘
```

**Supported Formats:**
- **CSV**: RFC 4180 compliant with quoted-field handling
- **JSON**: Array of objects or object with `{ samples, data, results }` field
- **JSONL**: Newline-delimited JSON (one sample per line)

**Validation Steps:**
1. Schema validation (required columns: text, label, predicted_label)
2. Confidence score range validation (0-1)
3. Label distribution analysis (imbalance detection)
4. Duplicate detection (exact text matches)
5. Data leakage detection (>95% accuracy on raw predictions)

### Metrics Engine (`@reaatech/classifier-evals-metrics`)

```
┌─────────────────────────────────────────────────────────────────────┐
│                      Metrics Engine                                  │
│                                                                      │
│  Input: ClassificationResult[] { text, label, predicted_label, confidence }│
│                                                                      │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐  │
│  │  Confusion      │    │ Classification  │    │    Model        │  │
│  │  Matrix         │    │    Metrics      │    │  Comparison     │  │
│  │                 │    │                 │    │                 │  │
│  │ - Multi-class   │    │ - Accuracy      │    │ - Accuracy diff │  │
│  │ - Per-class     │    │ - Precision     │    │ - McNemar's     │  │
│  │   TP/FP/FN/TN   │    │ - Recall        │    │   p-value       │  │
│  │ - Normalized    │    │ - F1 (macro/    │    │ - Effect size   │  │
│  │   view (3 modes)│    │ │   micro/      │    │   (Cohen's d)   │  │
│  │ - Top misclass  │    │ │   weighted)   │    │ - Per-class F1  │  │
│  │ - Error rates   │    │ - MCC (Gorodkin)│    │   comparison    │  │
│  │                 │    │ - Cohen's kappa │    │                 │  │
│  │                 │    │ - 14 metrics    │    │                 │  │
│  └─────────────────┘    └─────────────────┘    └─────────────────┘  │
│                                                                      │
│  Also: eval-run.ts — createEvalRunFromSamples()                      │
│        visualization-data.ts — heatmap, bar chart, cluster map       │
└─────────────────────────────────────────────────────────────────────┘
```

**Confusion Matrix:**
- Multi-class support (handles any number of classes)
- Per-class TP/FP/FN/TN calculation
- Row normalization (recall view), column normalization (precision view), overall normalization
- Error rate per class, top misclassification pairs

**Classification Metrics (14 total):**
- **Accuracy**: Overall correct predictions
- **Precision/Recall/F1**: Macro, micro, and weighted averages
- **Matthews Correlation Coefficient**: Gorodkin (2004) generalized multi-class formula
- **Cohen's Kappa**: Inter-rater reliability beyond chance

**Model Comparison:**
- Accuracy difference with McNemar's test p-value
- Cohen's d effect size
- Per-class F1 comparison with improvement/regression flags

### LLM-as-Judge System (`@reaatech/classifier-evals-judge`)

```
┌─────────────────────────────────────────────────────────────────────┐
│                     LLM-as-Judge System                              │
│                                                                      │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐              │
│  │   Judge     │    │   Prompt    │    │  Consensus  │              │
│  │   Engine    │    │  Templates  │    │   Voting    │              │
│  │             │    │             │    │             │              │
│  │ - Anthropic │    │ - classif-  │    │ - Majority  │              │
│  │   + OpenAI  │    │ │ ication-  │    │   voting    │              │
│  │ - Batch     │    │ │ eval      │    │ - Unanimous │              │
│  │ - Parallel  │    │ │ -ambiguity│    │ - Weighted  │              │
│  │ - Retry     │    │ │ -detect   │    │ - Disagree- │              │
│  │             │    │ │ -error-   │    │ | ment      │              │
│  │             │    │ │ |categorize│   │ | detection │              │
│  │             │    │ │ -multi-   │    │             │              │
│  │             │    │ │ |turn-eval│    │             │              │
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
│                            │                                         │
│                   ┌─────────────┐                                    │
│                   │  Result     │                                    │
│                   │ Aggregator  │                                    │
│                   │             │                                    │
│                   │ - Individual│                                    │
│                   │ - Consensus │                                    │
│                   │ - Reports   │                                    │
│                   │ - JSON/CSV  │                                    │
│                   └─────────────┘                                    │
└─────────────────────────────────────────────────────────────────────┘
```

**Judge Engine:**
- Multi-provider support (Anthropic Claude + OpenAI GPT)
- Batch processing with configurable concurrency
- Exponential backoff retry on failures
- Per-request timeout handling
- PII redaction before sending to LLM

**Prompt Templates:**
- `classification-eval` — "Is the predicted label correct?"
- `ambiguity-detection` — "Is this sample ambiguous?"
- `error-categorization` — "What type of error occurred?"
- `multi-turn-eval` — "Is the classification correct in context?"
- Custom templates registerable via `registerCustomTemplate()`

**Consensus Voting:**
- Majority voting across N judges
- Weighted voting by judge reliability
- Disagreement analysis and flagging
- Optimal judge count estimation for budget constraints

**Cost Tracking:**
- Per-model token pricing (Claude Opus, Sonnet, Haiku; GPT-4, GPT-4-turbo, GPT-3.5)
- Real-time budget tracking with limit enforcement
- Cost accounting by model and category

### Regression Gates (`@reaatech/classifier-evals-gates`)

```
┌─────────────────────────────────────────────────────────────────────┐
│                      Regression Gates                                │
│                                                                      │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐  │
│  │   Threshold     │    │   Baseline      │    │  Distribution   │  │
│  │     Gates       │    │  Comparison     │    │     Gates       │  │
│  │                 │    │                 │    │                 │  │
│  │ - accuracy      │    │ - Compare to    │    │ - unknown_rate  │  │
│  │ - f1_macro      │    │ | baseline      │    │ - label_card-   │  │
│  │ - precision     │    │ | EvalRun       │    │ | inality       │  │
│  │ - recall        │    │ - Per-class F1  │    │ - prediction_   │  │
│  │ - mcc           │    │ | regression    │    │ | cardinality   │  │
│  │ - kappa         │    │ | detection     │    │                 │  │
│  │ - Any operator  │    │ - Allow_regress │    │                 │  │
│  │                 │    │ :ion_in >= 0    │    │                 │  │
│  └─────────────────┘    └─────────────────┘    └─────────────────┘  │
│                                                                      │
│  Gate Engine: caching, error handling, result aggregation            │
│                                                                      │
│  Output: GateResult { passed, gate, actual_value?, expected_value?  │
│                        message?, failures? }                         │
└─────────────────────────────────────────────────────────────────────┘
```

**Threshold Gates:**
- Any ClassificationMetrics scalar with configurable operator (`>=`, `<=`, `>`, `<`, `==`)
- YAML-based configuration loading

**Baseline Comparison:**
- Compare `f1_per_class` against persisted baseline `EvalRun`
- Allow a configurable number of per-class regressions
- Compare scalar metrics with operator-based threshold

**Distribution Gates:**
- Check `unknown_rate` from `evalRun.metadata.distribution_metrics`
- Extensible to any distribution metric stored in metadata

**CI Integration:**
- GitHub Actions annotations (`::error::` format)
- JUnit XML for CI test report consumption
- PR comment markdown generation
- Exit code 0 (pass) / 1 (fail) for CI pipelines

### Exporters (`@reaatech/classifier-evals-exporters`)

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Exporters                                     │
│                                                                      │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐              │
│  │   Phoenix   │    │   Langfuse  │    │    JSON     │              │
│  │  Exporter   │    │  Exporter   │    │  Exporter   │              │
│  │             │    │             │    │             │              │
│  │ - OTel      │    │ - Traces    │    │ - Full      │              │
│  │   trace     │    │ - Sessions  │    │   results   │              │
│  │ - Span      │    │ - HTTP      │    │ - PII-safe  │              │
│  │   attributes│    │   auth      │    │   (redacted)│              │
│  │ - HTTP POST │    │ - Fetch()   │    │ - Machine   │              │
│  │   transport │    │             │    │   readable  │              │
│  └─────────────┘    └─────────────┘    └─────────────┘              │
│                                                                      │
│  ┌─────────────┐                                                    │
│  │    HTML     │                                                    │
│  │  Exporter   │                                                    │
│  │             │                                                    │
│  │ - SVG       │                                                    │
│  │   heatmap   │                                                    │
│  │ - SVG bar   │                                                    │
│  │   charts    │                                                    │
│  │ - Metrics   │                                                    │
│  │   dashboard │                                                    │
│  │ - Gate      │                                                    │
│  │   results   │                                                    │
│  └─────────────┘                                                    │
└─────────────────────────────────────────────────────────────────────┘
```

**JSON Exporter:**
- Full eval results in structured JSON
- PII-redacted metadata
- Optional sample inclusion
- Judge results summary

**HTML Exporter:**
- Self-contained HTML with inline SVGs (no CDN)
- Confusion matrix heatmap with color-coded cells
- Per-class grouped bar charts
- Metrics dashboard with key numbers
- Gate results and judge results sections (when present)

**Phoenix Exporter:**
- OTel trace with full metrics as span attributes
- HTTP POST transport with configurable endpoint
- Auth via `Authorization: Bearer` header
- 30-second timeout with AbortController

**Langfuse Exporter:**
- Trace ingestion via Langfuse public API
- HTTP Basic Authentication
- Structured input/output/metadata
- Session grouping by eval run

---

## Data Flow

### Complete Evaluation Flow

```
1. Load dataset (CSV/JSON/JSONL)
   │  @reaatech/classifier-evals-dataset
   │
2. Validate dataset:
   - Schema validation, label distribution, duplicates, leakage
   │
3. Calculate confusion matrix:
   - Multi-class matrix, per-class TP/FP/FN/TN
   │  @reaatech/classifier-evals-metrics
   │
4. Calculate classification metrics:
   - 14 metrics including macro/micro/weighted, MCC, Cohen's kappa
   │
5. (Optional) Run LLM-as-judge:
   - Batch process, cost tracking, consensus voting
   │  @reaatech/classifier-evals-judge
   │
6. Evaluate regression gates:
   - Threshold, baseline comparison, distribution gates
   │  @reaatech/classifier-evals-gates
   │
7. Export results:
   - JSON, HTML, Phoenix, Langfuse
   │  @reaatech/classifier-evals-exporters
   │
8. Log and trace complete run (OpenTelemetry)
    @reaatech/classifier-evals (observability)
```

---

## Security Model

### Defense in Depth

```
┌─────────────────────────────────────────────────────────────────────┐
│ Layer 1: Data                                                        │
│ - PII redaction in all logs (credit cards, emails, phones, SSNs, IPs)│
│ - Hash sensitive identifiers (SHA-256)                              │
│ - Never log raw text from datasets                                  │
├─────────────────────────────────────────────────────────────────────┤
│ Layer 2: API Keys                                                    │
│ - All LLM API keys from environment variables                       │
│ - Never log API keys or tokens (pino redaction)                     │
│ - Separate keys per provider (Anthropic, OpenAI)                    │
├─────────────────────────────────────────────────────────────────────┤
│ Layer 3: Cost Controls                                               │
│ - Budget limits enforced (soft and hard)                            │
│ - Cost estimation before expensive operations                       │
│ - Real-time cost monitoring with alerts                             │
├─────────────────────────────────────────────────────────────────────┤
│ Layer 4: Export Security                                             │
│ - PII sanitization before export (JSON, Phoenix)                    │
│ - Configurable sample inclusion (off by default)                    │
│ - Secure transport (HTTPS) for remote exporters                     │
└─────────────────────────────────────────────────────────────────────┘
```

### PII Handling

- Text content is never logged (only hashed identifiers)
- User identifiers are hashed before logging
- Exports are sanitized to remove PII
- Configurable PII patterns for redaction
- Prompt injection sanitization before LLM calls

---

## Observability

### Tracing

Every evaluation run generates OpenTelemetry spans:

| Span | Attributes | Source |
|------|------------|--------|
| `eval.run` | dataset, samples, model | `@reaatech/classifier-evals` |
| `dataset.load` | format, path | `@reaatech/classifier-evals` |
| `metrics.calculate` | metrics.types | `@reaatech/classifier-evals` |
| `judge.evaluate` | model, samples | `@reaatech/classifier-evals` |
| `gates.check` | gates.count | `@reaatech/classifier-evals` |

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

All logs are structured JSON with Pino and automatic redaction of secrets:

```json
{
  "level": "info",
  "service": "classifier-evals",
  "eval_run_id": "eval-123",
  "event": "eval.complete",
  "accuracy": 0.87,
  "f1_macro": 0.84,
  "judge_cost": 12.34,
  "gates_passed": true
}
```

---

## Failure Modes

| Failure | Detection | Recovery |
|---------|-----------|----------|
| Dataset load error | File not found, parse error | Return detailed error, suggest fixes |
| Invalid schema | Missing required columns | List missing columns, show expected schema |
| LLM API error | Non-2xx response | Retry with exponential backoff, skip sample |
| Budget exceeded | Cost > budget limit | Stop judge, return partial results |
| Gate evaluation error | Invalid gate config | Log error, fail open with warning |
| Export error | Network/storage failure | Log error, continue with other exports |
| Timeout | Request exceeds timeout | Return partial results, log warning |

---

## Repository Structure

```
classifier-evals/
  .changeset/           — Changesets config
  .github/
    workflows/
      ci.yml            — Install → Audit → Format → Lint → Typecheck → Build → Test → Coverage → Docker → All-checks
      release.yml       — Changesets-based npm + GitHub Packages publish
      eval.yml          — Classifier eval + gate check on PRs
  packages/
    classifier-evals/   — Core: types, schemas, observability, PII redaction, eval-run persistence
    dataset/            — Dataset: loader, validator, splitter, label manager
    metrics/            — Metrics: confusion matrix, 14 metrics, comparison, eval-run construction
    judge/              — Judge: judge engine, cost tracker, prompt templates, consensus voting
    gates/              — Gates: gate engine, threshold, baseline, distribution, CI integration
    exporters/          — Exporters: JSON, HTML, Phoenix, Langfuse
    mcp-server/         — MCP server + 5 tool implementations
    cli/                — CLI entry point + 5 command implementations
  datasets/             — Sample datasets and gate configurations
  skills/               — Skill documentation for each package
  docker/               — Docker Compose configurations
  infra/                — Terraform IaC
```

## References

- **AGENTS.md** — Agent development guide with coding conventions
- **README.md** — Quick start and overview
- **datasets/examples/** — Example datasets and configurations
- **MCP Specification** — https://modelcontextprotocol.io/
