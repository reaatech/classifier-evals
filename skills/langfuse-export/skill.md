# Skill: Langfuse Export

## Description

Export evaluation results to Langfuse for production observability. Enables tracking of evaluation metrics, traces, and scores in the Langfuse dashboard for real-time monitoring and debugging.

## Capabilities

- **Trace export**: Export eval runs as Langfuse traces
- **Score export**: Export quality metrics as Langfuse scores
- **Observations**: Export individual predictions as observations
- **Session grouping**: Group by eval run for organized tracking
- **Metadata**: Include model version, timestamps, and custom tags

## Usage

### Library

```typescript
import { LangfuseExporter } from 'classifier-evals';

const exporter = new LangfuseExporter({
  publicKey: process.env.LANGFUSE_PUBLIC_KEY,
  secretKey: process.env.LANGFUSE_SECRET_KEY,
  baseUrl: 'https://cloud.langfuse.com'
});

await exporter.export({
  evalResults: results,
  traceName: 'classifier-evaluation',
  sessionId: `eval-${Date.now()}`
});
```

### CLI

```bash
# Export to Langfuse
classifier-evals export --results results.json --target langfuse

# With custom session
classifier-evals export --results results.json --target langfuse --session eval-2026-04
```

## Configuration

| Option | Description |
|--------|-------------|
| `publicKey` | Langfuse public key (env: LANGFUSE_PUBLIC_KEY) |
| `secretKey` | Langfuse secret key (env: LANGFUSE_SECRET_KEY) |
| `baseUrl` | Langfuse API endpoint (default: https://cloud.langfuse.com) |
| `traceName` | Name for the evaluation trace |
| `sessionId` | Session identifier for grouping |

## Environment Variables

| Variable | Description |
|----------|-------------|
| `LANGFUSE_PUBLIC_KEY` | Langfuse public API key |
| `LANGFUSE_SECRET_KEY` | Langfuse secret API key |
| `LANGFUSE_BASE_URL` | Custom Langfuse endpoint (optional) |

## Exported Data

- **Traces**: One trace per evaluation run
- **Scores**: Accuracy, F1, precision, recall, etc.
- **Observations**: Individual prediction results with metadata
- **Sessions**: Grouped by evaluation run ID

## Related Skills

- `phoenix-export` — Arize Phoenix trace export
- `confusion-matrix` — Confusion matrix calculation
