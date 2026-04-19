# Skill: Confusion Matrix

## Description

Confusion matrix calculation and classification metrics for multi-class intent classification evaluation. Provides comprehensive analysis of model performance including per-class and aggregate metrics.

## Capabilities

- **Multi-class confusion matrix**: Handles any number of classes
- **Per-class metrics**: TP, FP, FN, TN for each class
- **Aggregate metrics**: Accuracy, precision, recall, F1 (macro/micro/weighted)
- **Advanced metrics**: Matthews correlation coefficient, Cohen's kappa
- **Model comparison**: Statistical significance testing between models
- **Visualization data**: Heatmap and chart data generation

## Usage

### Library

```typescript
import { buildConfusionMatrix, calculateAllMetrics } from 'classifier-evals';

const samples = [
  { text: 'Hello', label: 'greeting', predicted_label: 'greeting', confidence: 0.95 },
  { text: 'Bye', label: 'farewell', predicted_label: 'greeting', confidence: 0.72 }
];

// Build confusion matrix
const cm = buildConfusionMatrix(samples);

// Calculate all metrics
const metrics = calculateAllMetrics(samples);

console.log(`Accuracy: ${metrics.accuracy}`);
console.log(`Macro F1: ${metrics.f1_macro}`);
console.log(`Per-class metrics:`, metrics.per_class);
```

### CLI

```bash
# Run evaluation with confusion matrix
classifier-evals eval --dataset test-set.csv --metrics confusion_matrix,f1_macro

# Compare two models
classifier-evals compare --baseline results/v1.json --candidate results/v2.json
```

## Metrics

| Metric | Description |
|--------|-------------|
| `accuracy` | Overall correct predictions / total |
| `precision` | TP / (TP + FP) per class |
| `recall` | TP / (TP + FN) per class |
| `f1_macro` | Unweighted mean F1 across classes |
| `f1_micro` | Global TP/FP/FN aggregation |
| `f1_weighted` | Mean F1 weighted by class support |
| `mcc` | Matthews correlation coefficient |
| `cohen_kappa` | Inter-rater reliability |

## Related Skills

- `dataset-loading` — Multi-format dataset ingestion
- `regression-gates` — CI integration with quality gates
