# Skill: Phoenix Export

## Description

Export evaluation results to Arize Phoenix for interactive analysis. Publishes evaluation metrics as OpenTelemetry traces with span attributes for visualization in the Phoenix dashboard.

**Package:** `@reaatech/classifier-evals-exporters`

## Capabilities

- **OTel trace export**: Entire eval run as a single trace with one span
- **Full metrics**: All 14 ClassificationMetrics as span attributes
- **Confusion matrix metadata**: Labels and class count as trace attributes
- **HTTP transport**: POST to Phoenix API with configurable endpoint
- **Authentication**: Bearer token via `PHOENIX_API_KEY` environment variable
- **Timeout**: 30-second AbortController per request
- **PII-safe**: Metadata is redacted before export

## Usage

### Library

```typescript
import { exportToPhoenix } from '@reaatech/classifier-evals-exporters';

await exportToPhoenix({
  evalRun,
  options: {
    endpoint: 'http://localhost:6006',
    datasetName: 'intent-classifier-v2',
    apiKey: process.env.PHOENIX_API_KEY,
    metadata: { model: 'v2', date: new Date().toISOString() },
  },
});
```

### CLI

```bash
# Export to Phoenix
classifier-evals export --results results.json --phoenix http://localhost:6006
```

## Configuration

| Option | Description | Default |
|--------|-------------|---------|
| `endpoint` | Phoenix server URL | `http://localhost:6006` |
| `datasetName` | Name for the exported dataset/trace | `classifier-evals` |
| `apiKey` | Bearer token for authentication | `PHOENIX_API_KEY` env var |

## Exported Data

Each eval run produces one trace with a single span containing:
- **Dataset info**: `dataset.name`, `dataset.path`, `dataset.total_samples`
- **Full metrics**: `metrics.accuracy`, `metrics.f1_macro`, `metrics.f1_micro`, `metrics.precision_macro`, `metrics.precision_micro`, `metrics.precision_weighted`, `metrics.recall_macro`, `metrics.recall_micro`, `metrics.recall_weighted`, `metrics.f1_weighted`, `metrics.matthews_correlation`, `metrics.cohens_kappa`, `metrics.total_samples`, `metrics.correct_predictions`
- **Confusion matrix**: `confusion_matrix.labels`, `confusion_matrix.num_classes`
- **Custom metadata**: PII-redacted user-provided metadata

## Related Skills

- `langfuse-export` — Langfuse observability trace export
- `confusion-matrix` — Confusion matrix calculation
