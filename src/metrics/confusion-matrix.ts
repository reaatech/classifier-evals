/**
 * Confusion matrix calculation for multi-class classification
 */

import { ClassificationResult, ConfusionMatrix } from '../types/index.js';

/**
 * Build a confusion matrix from classification results
 *
 * @param samples - Array of classification results
 * @returns Confusion matrix data structure
 */
export function buildConfusionMatrix(samples: ClassificationResult[]): ConfusionMatrix {
  // Get all unique labels (union of true labels and predictions)
  const labelSet = new Set<string>();
  for (const sample of samples) {
    labelSet.add(sample.label);
    labelSet.add(sample.predicted_label);
  }
  const labels = Array.from(labelSet).sort();
  const numLabels = labels.length;

  // Create label to index mapping
  const labelToIndex = new Map<string, number>();
  labels.forEach((label, index) => {
    labelToIndex.set(label, index);
  });

  // Initialize matrix with zeros
  const matrix: number[][] = Array.from({ length: numLabels }, () => Array(numLabels).fill(0));

  // Populate matrix: matrix[true_label][predicted_label]
  for (const sample of samples) {
    const trueIdx = labelToIndex.get(sample.label);
    const predIdx = labelToIndex.get(sample.predicted_label);
    if (trueIdx === undefined || predIdx === undefined) {
      continue;
    }
    matrix[trueIdx]![predIdx]!++;
  }

  // Calculate per-class metrics
  const perClass = labels.map((label, i) => {
    const tp = matrix[i]![i]!; // True positives
    const fn = matrix[i]!.reduce((sum, val, j) => sum + (j !== i ? val : 0), 0); // False negatives (row minus diagonal)
    const fp = matrix.reduce((sum, row, j) => sum + (j !== i ? row[i]! : 0), 0); // False positives (column minus diagonal)
    const tn = samples.length - tp - fp - fn; // True negatives

    const precision = tp + fp > 0 ? tp / (tp + fp) : 0;
    const recall = tp + fn > 0 ? tp / (tp + fn) : 0;
    const f1 = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;
    const support = matrix[i]!.reduce((sum, val) => sum + val, 0);

    // accuracy calculated but not used in return object
    return {
      label,
      true_positives: tp,
      false_positives: fp,
      false_negatives: fn,
      true_negatives: tn,
      precision,
      recall,
      f1: f1,
      support,
    };
  });

  return {
    labels,
    matrix,
    per_class: perClass,
  };
}

/**
 * Normalize a confusion matrix
 *
 * @param cm - Confusion matrix to normalize
 * @param mode - 'true' (row-wise), 'pred' (column-wise), or 'all' (overall)
 * @returns Normalized confusion matrix
 */
export function normalizeConfusionMatrix(
  cm: ConfusionMatrix,
  mode: 'true' | 'pred' | 'all' = 'true',
): number[][] {
  const { matrix, labels } = cm;
  const numLabels = labels.length;
  const normalized: number[][] = Array.from({ length: numLabels }, () => Array(numLabels).fill(0));

  if (mode === 'all') {
    // Normalize by total
    const total = matrix.reduce((sum, row) => sum + row.reduce((s, v) => s + v, 0), 0);
    if (total === 0) {
      return normalized;
    }

    for (let i = 0; i < numLabels; i++) {
      for (let j = 0; j < numLabels; j++) {
        normalized[i]![j] = (matrix[i]?.[j] ?? 0) / total;
      }
    }
  } else if (mode === 'true') {
    // Normalize by row (true labels) - shows recall per class
    for (let i = 0; i < numLabels; i++) {
      const rowSum = (matrix[i] ?? []).reduce((sum, v) => sum + v, 0);
      if (rowSum === 0) {
        continue;
      }
      for (let j = 0; j < numLabels; j++) {
        normalized[i]![j] = (matrix[i]?.[j] ?? 0) / rowSum;
      }
    }
  } else {
    // Normalize by column (predicted labels) - shows precision per class
    for (let j = 0; j < numLabels; j++) {
      const colSum = matrix.reduce((sum, row) => sum + (row[j] ?? 0), 0);
      if (colSum === 0) {
        continue;
      }
      for (let i = 0; i < numLabels; i++) {
        normalized[i]![j] = (matrix[i]?.[j] ?? 0) / colSum;
      }
    }
  }

  return normalized;
}

/**
 * Get the diagonal of the confusion matrix (correct predictions)
 */
export function getDiagonal(cm: ConfusionMatrix): number[] {
  return cm.matrix.map((row, i) => row[i]!);
}

/**
 * Calculate total correct predictions from confusion matrix
 */
export function getTotalCorrect(cm: ConfusionMatrix): number {
  return getDiagonal(cm).reduce((sum, v) => sum + (v ?? 0), 0);
}

/**
 * Calculate total samples from confusion matrix
 */
export function getTotalSamples(cm: ConfusionMatrix): number {
  return cm.matrix.reduce((sum, row) => sum + row.reduce((s, v) => s + v, 0), 0);
}

/**
 * Format confusion matrix as a string for display
 */
export function formatConfusionMatrix(cm: ConfusionMatrix): string {
  const { labels, matrix } = cm;
  const numLabels = labels.length;

  // Calculate column widths
  const labelWidth = Math.max(...labels.map((l) => l.length), 7); // 'Predicted' header
  const cellWidth = 8;

  let result = '';

  // Header
  result += ' '.repeat(labelWidth + 1) + 'Predicted\n';
  result += ' '.repeat(labelWidth + 1);
  for (let j = 0; j < numLabels; j++) {
    result += labels[j]!.substring(0, cellWidth - 1).padStart(cellWidth);
  }
  result += '\n';

  // Separator
  result += ' '.repeat(labelWidth + 1) + '-'.repeat(numLabels * cellWidth) + '\n';

  // Rows
  for (let i = 0; i < numLabels; i++) {
    result += labels[i]!.substring(0, labelWidth).padEnd(labelWidth) + ' |';
    for (let j = 0; j < numLabels; j++) {
      result += matrix[i]![j]!.toString().padStart(cellWidth);
    }
    result += '\n';
  }

  return result;
}

/**
 * Calculate error rate per class
 */
export function getErrorRates(cm: ConfusionMatrix): Record<string, number> {
  const errorRates: Record<string, number> = {};

  for (let i = 0; i < cm.labels.length; i++) {
    const label = cm.labels[i]!;
    const total = cm.matrix[i]!.reduce((sum, v) => sum + v, 0);
    const errors = total - cm.matrix[i]![i]!;
    errorRates[label] = total > 0 ? errors / total : 0;
  }

  return errorRates;
}

/**
 * Find the most common misclassifications
 */
export function getTopMisclassifications(
  cm: ConfusionMatrix,
  topN: number = 10,
): Array<{ trueLabel: string; predictedLabel: string; count: number }> {
  const misclassifications: Array<{ trueLabel: string; predictedLabel: string; count: number }> =
    [];

  for (let i = 0; i < cm.labels.length; i++) {
    for (let j = 0; j < cm.labels.length; j++) {
      if (i !== j && cm.matrix[i]![j]! > 0) {
        misclassifications.push({
          trueLabel: cm.labels[i]!,
          predictedLabel: cm.labels[j]!,
          count: cm.matrix[i]![j]!,
        });
      }
    }
  }

  // Sort by count descending
  misclassifications.sort((a, b) => b.count - a.count);

  return misclassifications.slice(0, topN);
}
