# Skill: Phoenix Export

## Description

Export evaluation results to Arize Phoenix for interactive analysis. Enables visualization of confusion matrices, embeddings, and evaluation traces in the Phoenix dashboard.

## Capabilities

- **Dataset export**: Export eval results as Phoenix dataset
- **Embeddings**: Export embedding vectors for dimensionality reduction
- **Confusion matrix**: Export as Phoenix metrics for visualization
- **Trace export**: Export LLM judge decisions as traces
- **Metadata**: Include model version, timestamps, and custom metadata

## Usage

### Library

```typescript
import { PhoenixExporter } from 'classifier-evals';

const exporter = new PhoenixExporter({
  endpoint: 'http://localhost:6006',
  dataset_name: 'intent-classifier-v2'
});

await exporter.export({
  evalResults: results,
  embeddings: embeddingVectors, // Optional
  metadata: {
    model: 'v2',
    date: new Date().toISOString()
  }
});
```

### CLI

```bash
# Export to Phoenix
classifier-evals export --results results.json --target phoenix --endpoint http://localhost:6006

# With embeddings
classifier-evals export --results results.json --target phoenix --embeddings embeddings.npy
```

## Configuration

| Option | Description |
|--------|-------------|
| `endpoint` | Phoenix server endpoint (default: http://localhost:6006) |
| `dataset_name` | Name for the exported dataset |
| `embeddings` | Path to embedding vectors (numpy or parquet) |
| `metadata` | Custom metadata key-value pairs |

## Embedding Formats

- **NumPy**: `.npy` files with shape (n_samples, n_dimensions)
- **Parquet**: Columnar format with embedding column
- **CSV**: CSV with embedding as comma-separated values

## Related Skills

- `confusion-matrix` — Confusion matrix calculation
- `langfuse-export` — Langfuse observability export
