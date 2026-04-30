# @reaatech/classifier-evals-metrics

[![npm version](https://img.shields.io/npm/v/@reaatech/classifier-evals-metrics.svg)](https://www.npmjs.com/package/@reaatech/classifier-evals-metrics)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://github.com/reaatech/classifier-evals/blob/main/LICENSE)
[![CI](https://img.shields.io/github/actions/workflow/status/reaatech/classifier-evals/ci.yml?branch=main&label=CI)](https://github.com/reaatech/classifier-evals/actions/workflows/ci.yml)

> **Status:** Pre-1.0 — APIs may change in minor versions. Pin to a specific version in production.

Confusion matrix calculation, comprehensive classification metrics, model comparison with statistical significance, and evaluation run construction. Built on the `@reaatech/classifier-evals` core types.

## Installation

```bash
npm install @reaatech/classifier-evals-metrics
# or
pnpm add @reaatech/classifier-evals-metrics
```

## Feature Overview

- **Confusion matrix** — multi-class matrix with per-class precision, recall, F1, and support
- **14 classification metrics** — accuracy, macro/micro/weighted precision/recall/F1, Matthews Correlation Coefficient (Gorodkin 2004), Cohen's Kappa
- **Matrix normalization** — row-wise (recall), column-wise (precision), or overall normalization
- **Top misclassifications** — identify the most common class confusions
- **Model comparison** — accuracy and F1 comparison with McNemar's test p-values, Cohen's d effect size, and per-class F1 diffs
- **Evaluation run construction** — assemble a complete `EvalRun` from samples with metadata, metrics, judge results, and gate results
- **Visualization data** — generate chart-ready data for confusion matrix heatmaps, per-class bar charts, and cluster maps
- **Dual ESM/CJS output** — works with `import` and `require`

## Quick Start

```typescript
import {
  buildConfusionMatrix,
  calculateAllMetrics,
  compareModels,
} from "@reaatech/classifier-evals-metrics";

const samples = [
  { text: "Reset password", label: "account", predicted_label: "account", confidence: 0.95 },
  { text: "Cancel sub", label: "billing", predicted_label: "account", confidence: 0.72 },
  { text: "Where is order", label: "order", predicted_label: "order", confidence: 0.88 },
];

// Build confusion matrix
const cm = buildConfusionMatrix(samples);
console.log(cm.labels);     // ["account", "billing", "order"]
console.log(cm.per_class);  // Per-class precision, recall, F1, support

// Calculate all metrics at once
const metrics = calculateAllMetrics(samples);
console.log(`Accuracy: ${(metrics.accuracy * 100).toFixed(1)}%`);
console.log(`Macro F1: ${(metrics.f1_macro * 100).toFixed(1)}%`);
console.log(`MCC: ${metrics.matthews_correlation.toFixed(3)}`);

// Compare two models
const comparison = compareModels(baselineSamples, candidateSamples, "baseline", "candidate");
console.log(`Accuracy diff: ${comparison.accuracy_difference.toFixed(3)}`);
```

## API Reference

### Confusion Matrix

#### `buildConfusionMatrix(samples: ClassificationResult[]): ConfusionMatrix`

Builds a multi-class confusion matrix from classification results. The union of all unique labels (both true and predicted) forms the label set. Returns `{ labels, matrix, per_class }`.

```typescript
const cm = buildConfusionMatrix(samples);
// cm.matrix[trueLabel][predictedLabel] = count
// cm.per_class[i] = { label, true_positives, false_positives, false_negatives, true_negatives,
//                      precision, recall, f1, support }
```

#### `normalizeConfusionMatrix(cm: ConfusionMatrix, mode?: 'true' | 'pred' | 'all'): number[][]`

Normalizes the matrix by row (true — shows recall per class), column (pred — shows precision per class), or overall (shows proportion of total).

```typescript
const rowNormalized = normalizeConfusionMatrix(cm, "true");
// rowNormalized[i][j] = proportion of true class i predicted as class j
```

#### `getDiagonal(cm: ConfusionMatrix): number[]`

Returns the diagonal of the confusion matrix (correct predictions per class).

#### `getTotalCorrect(cm: ConfusionMatrix): number`

Total correct predictions across all classes.

#### `getTotalSamples(cm: ConfusionMatrix): number`

Total samples in the matrix.

#### `getErrorRates(cm: ConfusionMatrix): Record<string, number>`

Error rate per class (1 - recall).

#### `getTopMisclassifications(cm: ConfusionMatrix, topN?: number): Misclassification[]`

Returns the most common misclassifications, sorted by count descending.

```typescript
const top = getTopMisclassifications(cm, 5);
// [{ trueLabel: "billing", predictedLabel: "account", count: 42 }, ...]
```

#### `formatConfusionMatrix(cm: ConfusionMatrix): string`

Returns a human-readable formatted string of the confusion matrix.

### Classification Metrics

#### `calculateAccuracy(samples: ClassificationResult[]): number`

Simple accuracy: `#correct / #total`.

#### `calculateAllMetrics(samples: ClassificationResult[]): ClassificationMetrics`

Calculates all 14 metrics in a single pass. Returns:

| Metric | Description |
|--------|-------------|
| `accuracy` | Correct predictions / total |
| `precision_macro` | Unweighted mean precision per class |
| `recall_macro` | Unweighted mean recall per class |
| `f1_macro` | Unweighted mean F1 per class |
| `precision_micro` | Global precision (equals accuracy for multi-class) |
| `recall_micro` | Global recall (equals accuracy for multi-class) |
| `f1_micro` | Global F1 (equals accuracy for multi-class) |
| `precision_weighted` | Per-class precision weighted by support |
| `recall_weighted` | Per-class recall weighted by support |
| `f1_weighted` | Per-class F1 weighted by support |
| `matthews_correlation` | MCC (Gorodkin 2004 generalized multi-class formula) |
| `cohens_kappa` | Inter-rater agreement beyond chance |
| `total_samples` | Number of samples |
| `correct_predictions` | Number of correct predictions |

Individual metric functions are also exported: `calculatePrecisionMacro`, `calculateRecallMacro`, `calculateF1Macro`, `calculatePrecisionMicro`, `calculateRecallMicro`, `calculateF1Micro`, `calculatePrecisionWeighted`, `calculateRecallWeighted`, `calculateF1Weighted`, `calculateMCC`, `calculateCohensKappa`.

### Model Comparison

#### `compareModels(baseline: ClassificationResult[], candidate: ClassificationResult[], baselineName?: string, candidateName?: string): ModelComparison`

Compares two sets of predictions with statistical significance tests.

```typescript
const comp = compareModels(baselineSamples, candidateSamples);
// {
//   baseline_accuracy, candidate_accuracy, accuracy_difference,
//   p_value: McNemar's test, is_significant: p < 0.05,
//   effect_size: Cohen's d,
//   per_class_comparison: [{ label, baseline_f1, candidate_f1, difference, improved }]
// }
```

#### `summarizeComparison(comparison: ModelComparison): string`

Returns a human-readable summary string of the comparison.

#### `comparePersistedEvalRuns(baseline: EvalRun, candidate: EvalRun): ModelComparison`

Compares two `EvalRun` objects from their persisted metrics.

### Evaluation Run Construction

#### `createEvalRunFromSamples(options: EvalRunBuildOptions): EvalRun`

Builds a complete `EvalRun` from raw samples, computing the confusion matrix, all metrics, and distribution metadata.

```typescript
const evalRun = createEvalRunFromSamples({
  datasetPath: "./test-set.csv",
  datasetName: "production-test",
  samples,
  judgedResults,
  judgeCost: 12.34,
  gateResults,
  metadata: { model: "v2", commit: "abc123" },
});
```

| Option | Type | Description |
|--------|------|-------------|
| `datasetPath` | `string` | Source dataset path |
| `datasetName` | `string` | Display name for the dataset |
| `samples` | `ClassificationResult[]` | Classification results |
| `judgedResults` | `JudgedResult[]` | LLM judge results |
| `judgeCost` | `number` | Total LLM judge cost |
| `gateResults` | `GateResult[]` | Gate evaluation results |
| `metadata` | `Record<string, unknown>` | Additional metadata |

The returned `EvalRun` includes `distribution_metrics` in its metadata: `unknown_rate`, `label_cardinality`, and `prediction_cardinality`.

### Visualization Data

#### `generateHeatmapData(cm: ConfusionMatrix): { x, y, z }[]`

Generates x, y, z tuples for heatmap charting libraries.

#### `generatePerClassBarData(cm: ConfusionMatrix): { labels, precision, recall, f1 }`

Generates arrays suitable for grouped bar charts.

#### `generateClusterMapData(cm: ConfusionMatrix): { labels, matrix, similarity }`

Generates normalized data for cluster heatmap visualization.

## Usage Pattern

```typescript
import { buildConfusionMatrix, calculateAllMetrics } from "@reaatech/classifier-evals-metrics";
import { loadDataset } from "@reaatech/classifier-evals-dataset";

const dataset = await loadDataset("./data/classifications.csv");
const cm = buildConfusionMatrix(dataset.samples);
const metrics = calculateAllMetrics(dataset.samples);

console.log(`F1: ${metrics.f1_macro.toFixed(3)}, MCC: ${metrics.matthews_correlation.toFixed(3)}`);
```

## Related Packages

- [`@reaatech/classifier-evals`](https://www.npmjs.com/package/@reaatech/classifier-evals) — Core types and schemas
- [`@reaatech/classifier-evals-dataset`](https://www.npmjs.com/package/@reaatech/classifier-evals-dataset) — Dataset loading and validation

## License

[MIT](https://github.com/reaatech/classifier-evals/blob/main/LICENSE)
