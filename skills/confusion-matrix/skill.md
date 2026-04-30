# Skill: Confusion Matrix

## Description

Confusion matrix calculation and classification metrics for multi-class intent classification evaluation. Provides comprehensive analysis of model performance including per-class and aggregate metrics.

**Package:** `@reaatech/classifier-evals-metrics`

## Capabilities

- **Multi-class confusion matrix**: Handles any number of classes
- **Per-class metrics**: TP, FP, FN, TN, precision, recall, F1, support for each class
- **14 aggregate metrics**: Accuracy, macro/micro/weighted precision/recall/F1, MCC, Cohen's kappa
- **Matrix normalization**: Row-wise (recall), column-wise (precision), or overall normalization
- **Top misclassifications**: Identify the most common class confusions
- **Model comparison**: Accuracy and F1 comparison with McNemar's test, effect size, per-class diffs
- **Visualization data**: Heatmap, bar chart, and cluster map data generation

## Usage

### Library

```typescript
import { buildConfusionMatrix, calculateAllMetrics } from '@reaatech/classifier-evals-metrics';

const samples = [
  { text: 'Hello', label: 'greeting', predicted_label: 'greeting', confidence: 0.95 },
  { text: 'Bye', label: 'farewell', predicted_label: 'greeting', confidence: 0.72 },
];

// Build confusion matrix
const cm = buildConfusionMatrix(samples);
console.log(cm.labels);        // ['farewell', 'greeting']
console.log(cm.per_class[0]);  // { label, tp, fp, fn, tn, precision, recall, f1, support }

// Calculate all 14 metrics
const metrics = calculateAllMetrics(samples);
console.log(`Accuracy: ${metrics.accuracy.toFixed(3)}`);
console.log(`Macro F1: ${metrics.f1_macro.toFixed(3)}`);
console.log(`MCC: ${metrics.matthews_correlation.toFixed(3)}`);
console.log(`Cohen's Kappa: ${metrics.cohens_kappa.toFixed(3)}`);
```

### Model Comparison

```typescript
import { compareModels } from '@reaatech/classifier-evals-metrics';

const comparison = compareModels(baselineSamples, candidateSamples, 'v1', 'v2');
console.log(`Accuracy diff: ${comparison.accuracy_difference.toFixed(3)}`);
console.log(`p-value: ${comparison.p_value?.toFixed(4)}`);
console.log(`Significant: ${comparison.is_significant}`);
```

### CLI

```bash
# Run evaluation with confusion matrix
classifier-evals eval --dataset test-set.csv --format json

# Compare two models
classifier-evals compare --baseline results/v1.json --candidate results/v2.json
```

## Metrics

| Metric | Description |
|--------|-------------|
| `accuracy` | Overall correct predictions / total |
| `precision_macro` | Unweighted mean precision per class |
| `recall_macro` | Unweighted mean recall per class |
| `f1_macro` | Unweighted mean F1 per class |
| `precision_micro` | Global precision (equals accuracy for multi-class) |
| `recall_micro` | Global recall (equals accuracy for multi-class) |
| `f1_micro` | Global F1 (equals accuracy for multi-class) |
| `precision_weighted` | Per-class precision weighted by support |
| `recall_weighted` | Per-class recall weighted by support |
| `f1_weighted` | Per-class F1 weighted by support |
| `matthews_correlation` | MCC (Gorodkin 2004 generalized multi-class) |
| `cohens_kappa` | Inter-rater agreement beyond chance |
| `total_samples` | Number of samples |
| `correct_predictions` | Number of correct predictions |

## Related Skills

- `dataset-loading` — Multi-format dataset ingestion
- `regression-gates` — CI integration with quality gates
