# @reaatech/classifier-evals-exporters

[![npm version](https://img.shields.io/npm/v/@reaatech/classifier-evals-exporters.svg)](https://www.npmjs.com/package/@reaatech/classifier-evals-exporters)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://github.com/reaatech/classifier-evals/blob/main/LICENSE)
[![CI](https://img.shields.io/github/actions/workflow/status/reaatech/classifier-evals/ci.yml?branch=main&label=CI)](https://github.com/reaatech/classifier-evals/actions/workflows/ci.yml)

> **Status:** Pre-1.0 — APIs may change in minor versions. Pin to a specific version in production.

Exporters for classifier evaluation results. Supports JSON (machine-readable), HTML (interactive report), Arize Phoenix (traces and embeddings), and Langfuse (observability traces).

## Installation

```bash
npm install @reaatech/classifier-evals-exporters
# or
pnpm add @reaatech/classifier-evals-exporters
```

## Feature Overview

- **JSON export** — machine-readable output with optional sample inclusion, PII-aware redaction
- **HTML report** — interactive SVG-based confusion matrix heatmap, per-class bar charts, metrics dashboard
- **Phoenix export** — Arize Phoenix trace export with full metrics as span attributes and HTTP transport
- **Langfuse export** — Langfuse trace ingestion with authentication, session grouping, and structured metadata
- **Dual ESM/CJS output** — works with `import` and `require`

## Quick Start

```typescript
import {
  exportToJson,
  exportToHtml,
  exportToPhoenix,
  exportToLangfuse,
} from "@reaatech/classifier-evals-exporters";

// JSON export (PII-redacted by default)
const jsonResult = exportToJson({ evalRun });
console.log(jsonResult.json);

// HTML report with confusion matrix and per-class metrics
const htmlResult = exportToHtml(evalRun, {
  includeConfusionMatrix: true,
  includePerClassMetrics: true,
  title: "Classifier v2 Evaluation",
});
console.log(htmlResult.html);

// Phoenix trace export
await exportToPhoenix({
  evalRun,
  options: { endpoint: "http://localhost:6006", datasetName: "intent-classifier-v2" },
});

// Langfuse trace export
await exportToLangfuse({
  evalRun,
  options: {
    publicKey: process.env.LANGFUSE_PUBLIC_KEY,
    secretKey: process.env.LANGFUSE_SECRET_KEY,
    traceName: "classifier-evaluation",
  },
});
```

## API Reference

### JSON Exporter

#### `exportToJson(input: JsonExportInput): ExportResult`

Exports an `EvalRun` as a structured JSON payload with configurable options.

```typescript
const result = exportToJson({
  evalRun,
  options: { includeSamples: false },
});
// result.json → string, result.success → boolean
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `includeSamples` | `boolean` | `false` | Include raw sample data (PII consideration) |
| `includePerClass` | `boolean` | `true` | Include per-class breakdown |
| `includeVisualizationData` | `boolean` | `false` | Include visualization-ready data |

The JSON payload includes: `run_id`, `dataset_name`, `dataset_path`, `total_samples`, `duration_ms`, `started_at`, `completed_at`, `metrics`, `confusion_matrix`, `gate_results` (if present), judge summary (if judged), and redacted metadata.

### HTML Exporter

#### `exportToHtml(evalRun: EvalRun, options?: HtmlExportOptions): HtmlExportResult`

Generates a self-contained interactive HTML report with inline SVG charts.

```typescript
const report = exportToHtml(evalRun, {
  includeConfusionMatrix: true,   // SVG heatmap (default: true)
  includePerClassMetrics: true,   // Per-class metrics table (default: true)
  includeBaselineComparison: true, // Baseline comparison section (default: false)
  includeJudgeAnalysis: true,     // LLM judge results section (default: true)
  title: "My Evaluation Report",
});
```

The report includes:
- **Header** — dataset name, run ID, total samples, duration, timestamps
- **Metrics grid** — accuracy, macro/micro F1, precision, recall, MCC, Cohen's Kappa
- **Confusion matrix** — SVG heatmap with color-coded cells and labels
- **Per-class metrics** — table with precision, recall, F1, and support per label
- **Gate results** — pass/fail status for each gate (if gate results present)
- **Judge results** — agreement rate, cost breakdown (if judged)

SVG charts are generated inline — no external dependencies or CDN requests.

### Phoenix Exporter

#### `exportToPhoenix(input: PhoenixExportInput): Promise<ExportResult>`

Publishes evaluation results to an [Arize Phoenix](https://github.com/Arize-AI/phoenix) server as OpenTelemetry traces.

```typescript
await exportToPhoenix({
  evalRun,
  options: {
    endpoint: "http://localhost:6006",  // Phoenix endpoint (default)
    datasetName: "intent-classifier",   // Dataset name in Phoenix (default: "classifier-evals")
    apiKey: process.env.PHOENIX_API_KEY, // Optional API key
    metadata: { model: "v2", env: "staging" },
  },
});
```

The export creates a single trace per eval run with one span containing:
- **Dataset info** — name, path, total samples
- **Full metrics** — all 14 `ClassificationMetrics` as span attributes
- **Confusion matrix metadata** — labels array and class count
- **Custom metadata** — user-provided metadata merged with PII-redacted content

Uses `fetch()` with a 30-second timeout and configurable authentication via `Authorization: Bearer` header.

### Langfuse Exporter

#### `exportToLangfuse(input: LangfuseExportInput): Promise<ExportResult>`

Publishes evaluation results to [Langfuse](https://langfuse.com/) as trace events.

```typescript
await exportToLangfuse({
  evalRun,
  options: {
    publicKey: process.env.LANGFUSE_PUBLIC_KEY,
    secretKey: process.env.LANGFUSE_SECRET_KEY,
    baseUrl: "https://cloud.langfuse.com",  // Default
    traceName: "classifier-evaluation",       // Default
    sessionId: `eval-${Date.now()}`,
  },
});
```

The export creates a trace event with:
- **Input** — dataset path, total samples
- **Output** — full metrics, gate pass status
- **Metadata** — duration, run ID, confusion matrix class count

Uses HTTP Basic Authentication with `publicKey:secretKey` over `fetch()` with a 30-second timeout.

## Usage Patterns

### Export Pipeline

```typescript
import { createEvalRunFromSamples } from "@reaatech/classifier-evals-metrics";
import { exportToJson, exportToHtml } from "@reaatech/classifier-evals-exporters";

// Build the eval run
const evalRun = createEvalRunFromSamples({ datasetPath: "./test.csv", samples });

// Export to JSON for CI artifacts
const jsonResult = exportToJson({ evalRun });
await fs.writeFile("results.json", jsonResult.json);

// Export to HTML for human review
const htmlResult = exportToHtml(evalRun, { title: "Production Eval — v2.1.0" });
await fs.writeFile("report.html", htmlResult.html);
```

### PII-Safe Export

```typescript
// JSON export redacts PII by default (includesSamples: false)
const safe = exportToJson({ evalRun });

// Metadata is automatically redacted for PII before inclusion
// Phoenix export also redacts metadata via redactObjectPII()
```

## Related Packages

- [`@reaatech/classifier-evals`](https://www.npmjs.com/package/@reaatech/classifier-evals) — Core types and PII redaction
- [`@reaatech/classifier-evals-metrics`](https://www.npmjs.com/package/@reaatech/classifier-evals-metrics) — Classification metrics and eval run construction

## License

[MIT](https://github.com/reaatech/classifier-evals/blob/main/LICENSE)
