# Skill: Langfuse Export

## Description

Export evaluation results to Langfuse for production observability. Publishes evaluation metrics as trace events for real-time monitoring and debugging in the Langfuse dashboard.

**Package:** `@reaatech/classifier-evals-exporters`

## Capabilities

- **Trace export**: One trace per evaluation run with structured input/output
- **Score tracking**: Full metrics included in trace output
- **Session grouping**: Eval runs grouped by session ID for organized dashboards
- **HTTP auth**: Basic authentication via public/secret key pair
- **Environment config**: Keys from `LANGFUSE_PUBLIC_KEY`, `LANGFUSE_SECRET_KEY` env vars
- **Timeout**: 30-second AbortController per request

## Usage

### Library

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

### CLI

```bash
# Export to Langfuse
classifier-evals export --results results.json --langfuse
```

## Configuration

| Option | Description | Default |
|--------|-------------|---------|
| `publicKey` | Langfuse public key | `LANGFUSE_PUBLIC_KEY` env var |
| `secretKey` | Langfuse secret key | `LANGFUSE_SECRET_KEY` env var |
| `baseUrl` | Langfuse API endpoint | `https://cloud.langfuse.com` |
| `traceName` | Name for the trace | `classifier-evaluation` |
| `sessionId` | Session ID for grouping | `eval-<run_id>` |

## Environment Variables

| Variable | Description |
|----------|-------------|
| `LANGFUSE_PUBLIC_KEY` | Langfuse public API key |
| `LANGFUSE_SECRET_KEY` | Langfuse secret API key |
| `LANGFUSE_BASE_URL` | Custom Langfuse endpoint (optional) |

## Exported Data

Each eval run creates one trace event with:
- **Input**: `dataset_path`, `total_samples`
- **Output**: Full `metrics` object, `all_gates_passed`
- **Metadata**: `duration_ms`, `run_id`, confusion matrix label count

## Related Skills

- `phoenix-export` — Arize Phoenix trace export
- `confusion-matrix` — Confusion matrix calculation
