# Skill: Dataset Loading

## Description

Multi-format dataset ingestion and validation for classifier evaluation. This skill handles loading evaluation datasets from CSV, JSON, and JSONL files and validates them against the expected schema.

## Capabilities

- **Multi-format support**: CSV, JSON, and JSONL files
- **Auto-detection**: Automatically detects format from file extension
- **Schema validation**: Validates required columns (text, label, predicted_label)
- **Label distribution analysis**: Analyzes class distribution for imbalance detection
- **Duplicate detection**: Identifies exact and fuzzy duplicates
- **Empty/null handling**: Graceful handling of missing values
- **Confidence validation**: Validates confidence scores are in [0, 1] range

## Usage

### Library

```typescript
import { loadDataset, validateDataset } from 'classifier-evals';

// Load a dataset
const dataset = await loadDataset('path/to/dataset.csv');

// Validate the dataset
const validationResult = validateDataset(dataset);

if (!validationResult.valid) {
  console.error('Validation errors:', validationResult.errors);
}
```

### CLI

```bash
# Load and validate a dataset
classifier-evals eval --dataset datasets/test-set.csv

# Specify format explicitly
classifier-evals eval --dataset data.jsonl --format jsonl
```

## Input Format

### Required Columns

| Column | Type | Description |
|--------|------|-------------|
| `text` | string | The input text that was classified |
| `label` | string | Ground truth label |
| `predicted_label` | string | Model's predicted label |

### Optional Columns

| Column | Type | Description |
|--------|------|-------------|
| `confidence` | number | Model's confidence score (0-1) |

## Examples

### CSV Format

```csv
text,label,predicted_label,confidence
"Reset my password",password_reset,password_reset,0.95
"Cancel my subscription",cancel_subscription,refund_request,0.72
```

### JSONL Format

```jsonl
{"text": "Reset my password", "label": "password_reset", "predicted_label": "password_reset", "confidence": 0.95}
{"text": "Cancel my subscription", "label": "cancel_subscription", "predicted_label": "refund_request", "confidence": 0.72}
```

## Related Skills

- `confusion-matrix` — Confusion matrix calculation and metrics
- `regression-gates` — CI integration with quality gates
