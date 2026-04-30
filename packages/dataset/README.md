# @reaatech/classifier-evals-dataset

[![npm version](https://img.shields.io/npm/v/@reaatech/classifier-evals-dataset.svg)](https://www.npmjs.com/package/@reaatech/classifier-evals-dataset)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://github.com/reaatech/classifier-evals/blob/main/LICENSE)
[![CI](https://img.shields.io/github/actions/workflow/status/reaatech/classifier-evals/ci.yml?branch=main&label=CI)](https://github.com/reaatech/classifier-evals/actions/workflows/ci.yml)

> **Status:** Pre-1.0 — APIs may change in minor versions. Pin to a specific version in production.

Multi-format dataset loader for classifier evaluation with CSV (RFC 4180), JSON, and JSONL support. Includes validation, train/test splitting with stratification, K-fold cross-validation, label normalization, alias resolution, and hierarchical label handling.

## Installation

```bash
npm install @reaatech/classifier-evals-dataset
# or
pnpm add @reaatech/classifier-evals-dataset
```

## Feature Overview

- **Multi-format loading** — CSV (RFC 4180 compliant), JSON (array or `{ samples, data, results }`), JSONL
- **Schema validation** — validates required fields (`text`, `label`, `predicted_label`), confidence ranges, and data types
- **Train/test splitting** — random or stratified splits with reproducible seeding (Mulberry32 PRNG)
- **K-fold cross-validation** — generates K train/test folds with optional full-split pairs
- **Label normalization** — lowercase, trim, separator normalization, custom transforms
- **Label aliasing** — map synonyms to canonical labels (e.g., `"password_reset"` → `"account"`)
- **Unknown label handling** — keep, remove, or map unknown labels to a canonical `"unknown"` class
- **Hierarchical labels** — compute metrics at arbitrary hierarchy levels, navigate parent/child relationships
- **Distribution analysis** — imbalance detection, duplicate detection, data leakage checks, confidence distribution analysis
- **Dual ESM/CJS output** — works with `import` and `require`

## Quick Start

```typescript
import { loadDataset, validateDataset, splitDataset } from "@reaatech/classifier-evals-dataset";

// Load a CSV dataset
const dataset = await loadDataset("./datasets/test-set.csv");

// Validate for common issues
const validation = validateDataset(dataset);
if (validation.warnings.length > 0) {
  console.log("Warnings:", validation.warnings.map(w => w.message));
}

// Split into train/test (stratified by label, 80/20, seed 42)
const { train, test } = splitDataset(dataset, {
  testSize: 0.2,
  stratify: true,
  seed: 42,
});

console.log(`Train: ${train.samples.length}, Test: ${test.samples.length}`);
```

## API Reference

### Dataset Loading

#### `loadDataset(filePath: string, format?: 'csv' | 'json' | 'jsonl'): Promise<EvalDataset>`

Loads a dataset from a file path. Format is auto-detected from the file extension. Returns an `EvalDataset` with `samples` and `metadata`.

```typescript
const csvData = await loadDataset("./data/samples.csv");
const jsonData = await loadDataset("./data/samples.json");
const jsonlData = await loadDataset("./data/samples.jsonl");
```

#### `loadDatasetFromContent(content: string, format: 'csv' | 'json' | 'jsonl'): Promise<EvalDataset>`

Loads a dataset from a raw string. Useful for in-memory data or streaming sources.

```typescript
const csvContent = "text,label,predicted_label\nHello,greeting,greeting";
const dataset = await loadDatasetFromContent(csvContent, "csv");
```

### Dataset Validation

#### `validateDataset(dataset: EvalDataset): ValidationResult`

Validates a dataset for common issues. Returns `{ valid, errors, warnings }`.

```typescript
const result = validateDataset(dataset);

// Schema errors (empty text, missing labels, invalid confidence)
result.errors; // ValidationError[]

// Distribution warnings (imbalance, duplicates, leakage)
result.warnings; // ValidationWarning[]
```

| Check | Type | When |
|-------|------|------|
| Empty text | Error | `text` field is missing or empty |
| Empty label | Error | `label` field is missing or empty |
| Empty predicted_label | Error | `predicted_label` field is missing or empty |
| Invalid confidence | Error | Confidence outside [0, 1] range |
| Severe imbalance | Warning | Min/max class ratio > 10:1 |
| Duplicate texts | Warning | Identical text content across samples |
| Data leakage | Warning | >95% accuracy on raw predictions |
| Low confidence | Warning | >50% of predictions below 0.5 |

#### `validateSamples(samples: ClassificationResult[]): ValidationResult`

Validates a raw array of classification results without full dataset metadata.

#### `getDatasetSummary(dataset: EvalDataset): DatasetSummary`

Returns a summary object with `totalSamples`, `numLabels`, `labelDistribution`, `accuracy`, and `avgConfidence`.

### Dataset Splitting

#### `splitDataset(dataset: EvalDataset, options: SplitOptions): { train: EvalDataset, test: EvalDataset }`

Splits a dataset into train and test sets with optional stratification.

```typescript
const { train, test } = splitDataset(dataset, {
  testSize: 0.3,       // 30% test split
  stratify: true,      // Maintain label proportions
  seed: 42,            // Reproducible splits
  shuffle: true,       // Shuffle before splitting
});
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `testSize` | `number` | (required) | Fraction (0-1) or absolute count for test set |
| `stratify` | `boolean` | `true` | Maintain label proportions across splits |
| `seed` | `number` | `42` | Random seed for reproducibility (Mulberry32) |
| `shuffle` | `boolean` | `true` | Shuffle data before splitting |

#### `kFoldSplit(dataset: EvalDataset, k?: number, seed?: number): EvalDataset[]`

Generates K evenly-distributed folds for cross-validation.

```typescript
const folds = kFoldSplit(dataset, 5, 42);
for (const fold of folds) {
  console.log(`${fold.samples.length} samples in fold`);
}
```

#### `kFoldSplits(dataset: EvalDataset, k?: number, seed?: number): { train: EvalDataset, test: EvalDataset }[]`

Generates K train/test pairs for cross-validation, where each fold serves as the test set once.

```typescript
const splits = kFoldSplits(dataset, 5);
for (const { train, test } of splits) {
  // train = all other folds, test = current fold
}
```

### Label Management

#### `normalizeLabels(dataset: EvalDataset, options: NormalizationOptions): EvalDataset`

Normalizes all labels in a dataset with configurable transformations.

```typescript
const normalized = normalizeLabels(dataset, {
  lowercase: true,
  trim: true,
  normalizeSeparators: "underscores", // "password reset" → "password_reset"
});
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `lowercase` | `boolean` | `true` | Convert labels to lowercase |
| `trim` | `boolean` | `true` | Trim whitespace |
| `normalizeSeparators` | `"spaces" \| "underscores" \| "none"` | — | Convert between space and underscore separators |
| `custom` | `(label: string) => string` | — | Custom normalization function |

#### `applyLabelAliases(dataset: EvalDataset, aliases: LabelAliases): EvalDataset`

Maps synonyms to canonical labels.

```typescript
const mapped = applyLabelAliases(dataset, {
  "password_reset": "account",
  "forgot_password": "account",
  "change_pw": "account",
});
```

#### `handleUnknownLabels(dataset: EvalDataset, options: UnknownLabelOptions): EvalDataset`

Handles labels not in a known set with configurable actions.

```typescript
const cleaned = handleUnknownLabels(dataset, {
  action: "map_to_unknown",
  knownLabels: ["greeting", "account", "billing"],
  unknownLabel: "other",
});
```

| Action | Behavior |
|--------|----------|
| `keep` | Leave unknown labels as-is |
| `remove` | Remove samples with unknown labels |
| `map_to_unknown` | Replace unknown labels with a canonical class |

#### `getLabelStats(dataset: EvalDataset): LabelStats`

Returns `{ totalLabels, uniqueLabels, distribution, mostCommon, leastCommon, avgSamplesPerLabel }`.

#### `getParentLabel(label: string, hierarchy: LabelHierarchy): string | null`

Finds the parent of a label in a hierarchy.

#### `computeHierarchicalMetrics(dataset: EvalDataset, hierarchy: LabelHierarchy, level?: number): HierarchicalMetrics`

Computes accuracy at a specific hierarchy level by walking labels up to their parent nodes.

## CSV Format (RFC 4180)

The CSV parser follows RFC 4180 with proper quoted-field handling:

```csv
text,label,predicted_label,confidence
"Reset my password, please",password_reset,password_reset,0.95
"Cancel my subscription",cancel_subscription,refund_request,0.72
"Where is my order",order_status,order_status,0.88
```

Required columns: `text`, `label`, `predicted_label`. Optional: `confidence` (defaults to 1.0).

## Usage Pattern

Each schema export has a matching type export. Use the schema for runtime validation and the type for compile-time checking:

```typescript
import { EvalDatasetSchema, type EvalDataset } from "@reaatech/classifier-evals";

function handleResponse(raw: unknown): EvalDataset {
  return EvalDatasetSchema.parse(raw);
}
```

## Related Packages

- [`@reaatech/classifier-evals`](https://www.npmjs.com/package/@reaatech/classifier-evals) — Core types and schemas
- [`@reaatech/classifier-evals-metrics`](https://www.npmjs.com/package/@reaatech/classifier-evals-metrics) — Confusion matrix and classification metrics

## License

[MIT](https://github.com/reaatech/classifier-evals/blob/main/LICENSE)
