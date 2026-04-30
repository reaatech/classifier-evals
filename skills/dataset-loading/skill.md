# Skill: Dataset Loading

## Description

Multi-format dataset ingestion and validation for classifier evaluation. This skill handles loading evaluation datasets from CSV, JSON, and JSONL files and validates them against the expected schema.

**Package:** `@reaatech/classifier-evals-dataset`

## Capabilities

- **Multi-format support**: CSV (RFC 4180), JSON, and JSONL files
- **Auto-detection**: Automatically detects format from file extension
- **Schema validation**: Validates required columns (text, label, predicted_label)
- **Train/test splitting**: Random or stratified splits with reproducible seeding
- **K-fold cross-validation**: Generates K train/test folds
- **Label management**: Normalization, aliasing, unknown label handling, hierarchical labels
- **Distribution analysis**: Class imbalance, duplicate detection, data leakage checks
- **Confidence validation**: Validates confidence scores are in [0, 1] range

## Usage

### Library

```typescript
import { loadDataset, validateDataset, splitDataset } from '@reaatech/classifier-evals-dataset';

// Load a dataset
const dataset = await loadDataset('path/to/dataset.csv');

// Validate for common issues
const validationResult = validateDataset(dataset);

if (validationResult.warnings.length > 0) {
  console.log('Warnings:', validationResult.warnings.map(w => w.message));
}

// Split into train/test (stratified by label)
const { train, test } = splitDataset(dataset, {
  testSize: 0.2,
  stratify: true,
  seed: 42,
});
```

### Label Management

```typescript
import { normalizeLabels, applyLabelAliases } from '@reaatech/classifier-evals-dataset';

// Normalize labels
const normalized = normalizeLabels(dataset, {
  lowercase: true,
  normalizeSeparators: 'underscores',
});

// Map synonyms to canonical labels
const mapped = applyLabelAliases(dataset, {
  'password_reset': 'account',
  'forgot_password': 'account',
});
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
