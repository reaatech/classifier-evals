/**
 * Classification metrics calculation
 * Accuracy, precision, recall, F1 (macro/micro/weighted), MCC, Cohen's kappa
 */

import type {
  ClassificationMetrics,
  ClassificationResult,
  ConfusionMatrix,
} from '@reaatech/classifier-evals';
import { buildConfusionMatrix, getTotalCorrect, getTotalSamples } from './confusion-matrix.js';

/**
 * Calculate overall accuracy
 */
export function calculateAccuracy(samples: ClassificationResult[]): number {
  if (samples.length === 0) {
    return 0;
  }
  const correct = samples.filter((s) => s.label === s.predicted_label).length;
  return correct / samples.length;
}

/**
 * Calculate precision for a single class
 */
function calculatePrecision(samples: ClassificationResult[], label: string): number {
  const tp = samples.filter((s) => s.predicted_label === label && s.label === label).length;
  const fp = samples.filter((s) => s.predicted_label === label && s.label !== label).length;
  return tp + fp > 0 ? tp / (tp + fp) : 0;
}

/**
 * Calculate recall for a single class
 */
function calculateRecall(samples: ClassificationResult[], label: string): number {
  const tp = samples.filter((s) => s.predicted_label === label && s.label === label).length;
  const fn = samples.filter((s) => s.predicted_label !== label && s.label === label).length;
  return tp + fn > 0 ? tp / (tp + fn) : 0;
}

/**
 * Calculate F1 score for a single class
 */
function calculateF1(precision: number, recall: number): number {
  return precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;
}

/**
 * Calculate macro-averaged precision
 */
export function calculatePrecisionMacro(samples: ClassificationResult[], labels: string[]): number {
  if (labels.length === 0) {
    return 0;
  }
  const precisions = labels.map((l) => calculatePrecision(samples, l));
  return precisions.reduce((sum, p) => sum + p, 0) / labels.length;
}

/**
 * Calculate macro-averaged recall
 */
export function calculateRecallMacro(samples: ClassificationResult[], labels: string[]): number {
  if (labels.length === 0) {
    return 0;
  }
  const recalls = labels.map((l) => calculateRecall(samples, l));
  return recalls.reduce((sum, r) => sum + r, 0) / labels.length;
}

/**
 * Calculate macro-averaged F1 score
 */
export function calculateF1Macro(samples: ClassificationResult[], labels: string[]): number {
  if (labels.length === 0) {
    return 0;
  }
  const f1s = labels.map((l) => {
    const p = calculatePrecision(samples, l);
    const r = calculateRecall(samples, l);
    return calculateF1(p, r);
  });
  return f1s.reduce((sum, f) => sum + f, 0) / labels.length;
}

/**
 * Calculate micro-averaged precision (equals accuracy for multi-class)
 */
export function calculatePrecisionMicro(samples: ClassificationResult[]): number {
  return calculateAccuracy(samples);
}

/**
 * Calculate micro-averaged recall (equals accuracy for multi-class)
 */
export function calculateRecallMicro(samples: ClassificationResult[]): number {
  return calculateAccuracy(samples);
}

/**
 * Calculate micro-averaged F1 score (equals accuracy for multi-class)
 */
export function calculateF1Micro(samples: ClassificationResult[]): number {
  return calculateAccuracy(samples);
}

/**
 * Calculate weighted-averaged precision
 */
export function calculatePrecisionWeighted(
  samples: ClassificationResult[],
  labels: string[],
): number {
  if (labels.length === 0) {
    return 0;
  }
  const total = samples.length;
  const weighted = labels.map((l) => {
    const support = samples.filter((s) => s.label === l).length;
    return calculatePrecision(samples, l) * (support / total);
  });
  return weighted.reduce((sum, w) => sum + w, 0);
}

/**
 * Calculate weighted-averaged recall
 */
export function calculateRecallWeighted(samples: ClassificationResult[], labels: string[]): number {
  if (labels.length === 0) {
    return 0;
  }
  const total = samples.length;
  const weighted = labels.map((l) => {
    const support = samples.filter((s) => s.label === l).length;
    return calculateRecall(samples, l) * (support / total);
  });
  return weighted.reduce((sum, w) => sum + w, 0);
}

/**
 * Calculate weighted-averaged F1 score
 */
export function calculateF1Weighted(samples: ClassificationResult[], labels: string[]): number {
  if (labels.length === 0) {
    return 0;
  }
  const total = samples.length;
  const weighted = labels.map((l) => {
    const support = samples.filter((s) => s.label === l).length;
    const p = calculatePrecision(samples, l);
    const r = calculateRecall(samples, l);
    return calculateF1(p, r) * (support / total);
  });
  return weighted.reduce((sum, w) => sum + w, 0);
}

/**
 * Calculate Matthews Correlation Coefficient (MCC)
 * A balanced measure that works well even with imbalanced classes
 * Uses the Gorodkin (2004) generalized multiclass formula:
 * MCC = (c*s - sum_k(p_k*t_k)) / sqrt((s^2 - sum_k(p_k^2)) * (s^2 - sum_k(t_k^2)))
 */
export function calculateMCC(samples: ClassificationResult[]): number {
  const cm = buildConfusionMatrix(samples);
  const matrix = cm.matrix;
  const n = samples.length;

  if (n === 0) {
    return 0;
  }

  const k = cm.labels.length;
  if (k < 2) {
    return 0;
  }

  // c = trace (total correct)
  const c = matrix.reduce((sum, row, i) => sum + row[i]!, 0);
  const s = n;

  // Row sums (true counts) and column sums (predicted counts)
  const t: number[] = matrix.map((row) => row.reduce((a, b) => a + b, 0));
  const p: number[] = matrix[0]?.map((_, j) => matrix.reduce((sum, row) => sum + row[j]!, 0));

  const sumPKTK = p.reduce((sum, pk, i) => sum + pk * t[i]!, 0);
  const numerator = c * s - sumPKTK;

  const s2 = s * s;
  const sumPK2 = p.reduce((sum, pk) => sum + pk * pk, 0);
  const sumTK2 = t.reduce((sum, tk) => sum + tk * tk, 0);

  const denomLeft = s2 - sumPK2;
  const denomRight = s2 - sumTK2;

  if (denomLeft <= 0 || denomRight <= 0) {
    return 0;
  }

  return numerator / Math.sqrt(denomLeft * denomRight);
}

/**
 * Calculate Cohen's Kappa
 * Measures inter-rater reliability (agreement beyond chance)
 */
export function calculateCohensKappa(samples: ClassificationResult[]): number {
  const cm = buildConfusionMatrix(samples);
  const labels = cm.labels;
  const matrix = cm.matrix;
  const n = samples.length;

  if (n === 0) {
    return 0;
  }

  // Observed agreement
  const po = cm.matrix.reduce((sum, row, i) => sum + (row[i] ?? 0), 0) / n;

  // Expected agreement by chance
  let pe = 0;
  for (let i = 0; i < labels.length; i++) {
    const trueCount = matrix[i]?.reduce((sum, v) => sum + v, 0);
    const predCount = matrix.reduce((sum, row) => sum + row[i]!, 0);
    pe += (trueCount / n) * (predCount / n);
  }

  if (pe === 1) {
    return 1;
  } // Perfect agreement

  return (po - pe) / (1 - pe);
}

/**
 * Calculate all classification metrics at once
 */
export function calculateAllMetrics(samples: ClassificationResult[]): ClassificationMetrics {
  const cm = buildConfusionMatrix(samples);
  const labels = cm.labels;
  const correct = getTotalCorrect(cm);
  const total = getTotalSamples(cm);

  const precisionMacro = calculatePrecisionMacro(samples, labels);
  const recallMacro = calculateRecallMacro(samples, labels);
  const f1Macro = calculateF1Macro(samples, labels);

  return {
    accuracy: total > 0 ? correct / total : 0,
    precision_macro: precisionMacro,
    recall_macro: recallMacro,
    f1_macro: f1Macro,
    precision_micro: calculatePrecisionMicro(samples),
    recall_micro: calculateRecallMicro(samples),
    f1_micro: calculateF1Micro(samples),
    precision_weighted: calculatePrecisionWeighted(samples, labels),
    recall_weighted: calculateRecallWeighted(samples, labels),
    f1_weighted: calculateF1Weighted(samples, labels),
    matthews_correlation: calculateMCC(samples),
    cohens_kappa: calculateCohensKappa(samples),
    total_samples: total,
    correct_predictions: correct,
  };
}

/**
 * Calculate MCC from a confusion matrix using Gorodkin (2004) formula
 */
function calculateMCCFromMatrix(cm: ConfusionMatrix): number {
  const matrix = cm.matrix;
  const total = getTotalSamples(cm);
  if (total === 0) {
    return 0;
  }
  const k = cm.labels.length;
  if (k < 2) {
    return 0;
  }

  const c = matrix.reduce((sum, row, i) => sum + row[i]!, 0);
  const s = total;
  const t: number[] = matrix.map((row) => row.reduce((a, b) => a + b, 0));
  const p: number[] = matrix[0]?.map((_, j) => matrix.reduce((sum, row) => sum + row[j]!, 0));

  const sumPKTK = p.reduce((sum, pk, i) => sum + pk * t[i]!, 0);
  const numerator = c * s - sumPKTK;
  const s2 = s * s;
  const sumPK2 = p.reduce((sum, pk) => sum + pk * pk, 0);
  const sumTK2 = t.reduce((sum, tk) => sum + tk * tk, 0);
  const denomLeft = s2 - sumPK2;
  const denomRight = s2 - sumTK2;
  if (denomLeft <= 0 || denomRight <= 0) {
    return 0;
  }
  return numerator / Math.sqrt(denomLeft * denomRight);
}

/**
 * Calculate Cohen's Kappa from a confusion matrix
 */
function calculateKappaFromMatrix(cm: ConfusionMatrix): number {
  const matrix = cm.matrix;
  const n = getTotalSamples(cm);
  if (n === 0) {
    return 0;
  }

  const po = matrix.reduce((sum, row, i) => sum + row[i]!, 0) / n;
  let pe = 0;
  for (let i = 0; i < cm.labels.length; i++) {
    const trueCount = matrix[i]?.reduce((sum, v) => sum + v, 0);
    const predCount = matrix.reduce((sum, row) => sum + row[i]!, 0);
    pe += (trueCount / n) * (predCount / n);
  }
  if (pe === 1) {
    return 1;
  }
  return (po - pe) / (1 - pe);
}
export function calculateMetricsFromCM(cm: ConfusionMatrix): ClassificationMetrics {
  const total = getTotalSamples(cm);
  const correct = getTotalCorrect(cm);

  // We need samples for some calculations, so we'll compute from the matrix
  const labels = cm.labels;
  const perClass = cm.per_class;

  const precisionMacro = perClass.reduce((sum, m) => sum + m.precision, 0) / labels.length;
  const recallMacro = perClass.reduce((sum, m) => sum + m.recall, 0) / labels.length;
  const f1Macro = perClass.reduce((sum, m) => sum + m.f1, 0) / labels.length;

  // Weighted averages
  let precisionWeighted = 0;
  let recallWeighted = 0;
  let f1Weighted = 0;
  for (const m of perClass) {
    const weight = m.support / total;
    precisionWeighted += m.precision * weight;
    recallWeighted += m.recall * weight;
    f1Weighted += m.f1 * weight;
  }

  return {
    accuracy: total > 0 ? correct / total : 0,
    precision_macro: precisionMacro,
    recall_macro: recallMacro,
    f1_macro: f1Macro,
    precision_micro: total > 0 ? correct / total : 0,
    recall_micro: total > 0 ? correct / total : 0,
    f1_micro: total > 0 ? correct / total : 0,
    precision_weighted: precisionWeighted,
    recall_weighted: recallWeighted,
    f1_weighted: f1Weighted,
    matthews_correlation: calculateMCCFromMatrix(cm),
    cohens_kappa: calculateKappaFromMatrix(cm),
    total_samples: total,
    correct_predictions: correct,
  };
}
