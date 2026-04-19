/**
 * Model comparison utilities
 * Statistical significance testing, effect size calculation
 */

import { ClassificationResult, EvalRun, ModelComparison } from '../types/index.js';
import { calculateAccuracy } from './classification-metrics.js';
import { buildConfusionMatrix } from './confusion-matrix.js';

/**
 * Result of a paired comparison between two models
 */
export interface PairedComparisonResult {
  /** Number of samples where only baseline was correct */
  baselineOnlyCorrect: number;
  /** Number of samples where only candidate was correct */
  candidateOnlyCorrect: number;
  /** Number of samples where both were correct */
  bothCorrect: number;
  /** Number of samples where neither was correct */
  neitherCorrect: number;
  /** Total samples */
  total: number;
}

function calculateProportionEffectSize(
  baselineAccuracy: number,
  candidateAccuracy: number
): number {
  const clamp = (value: number): number => Math.max(0, Math.min(1, value));
  const baseline = clamp(baselineAccuracy);
  const candidate = clamp(candidateAccuracy);
  return 2 * Math.asin(Math.sqrt(candidate)) - 2 * Math.asin(Math.sqrt(baseline));
}

function approximateSignificanceFromRuns(
  baselineRun: EvalRun,
  candidateRun: EvalRun,
  alpha: number
): { pValue?: number; significant?: boolean } {
  const baselineSamples = baselineRun.metrics.total_samples;
  const candidateSamples = candidateRun.metrics.total_samples;

  if (baselineSamples <= 0 || candidateSamples <= 0) {
    return {};
  }

  const baselineCorrect = baselineRun.metrics.correct_predictions;
  const candidateCorrect = candidateRun.metrics.correct_predictions;
  const pooled =
    (baselineCorrect + candidateCorrect) / (baselineSamples + candidateSamples);
  const standardError = Math.sqrt(
    pooled * (1 - pooled) * (1 / baselineSamples + 1 / candidateSamples)
  );

  if (standardError === 0) {
    return {
      pValue: 1,
      significant: false,
    };
  }

  const zScore =
    (candidateRun.metrics.accuracy - baselineRun.metrics.accuracy) / standardError;
  const pValue = 2 * normalSurvivalFunction(Math.abs(zScore));

  return {
    pValue,
    significant: pValue < alpha,
  };
}

/**
 * Compare predictions from two models on the same samples
 */
export function pairedComparison(
  samples: ClassificationResult[],
  baselinePredictions: string[],
  candidatePredictions: string[]
): PairedComparisonResult {
  if (samples.length !== baselinePredictions.length || samples.length !== candidatePredictions.length) {
    throw new Error('All arrays must have the same length');
  }

  let baselineOnlyCorrect = 0;
  let candidateOnlyCorrect = 0;
  let bothCorrect = 0;
  let neitherCorrect = 0;

  for (let i = 0; i < samples.length; i++) {
    const trueLabel = samples[i]!.label;
    const baselineCorrect = baselinePredictions[i]! === trueLabel;
    const candidateCorrect = candidatePredictions[i]! === trueLabel;

    if (baselineCorrect && candidateCorrect) {
      bothCorrect++;
    } else if (baselineCorrect) {
      baselineOnlyCorrect++;
    } else if (candidateCorrect) {
      candidateOnlyCorrect++;
    } else {
      neitherCorrect++;
    }
  }

  return {
    baselineOnlyCorrect,
    candidateOnlyCorrect,
    bothCorrect,
    neitherCorrect,
    total: samples.length,
  };
}

/**
 * McNemar's test for paired nominal data
 * Tests if two classifiers have significantly different error rates
 */
export function mcnemarTest(
  samples: ClassificationResult[],
  baselinePredictions: string[],
  candidatePredictions: string[]
): { statistic: number; pValue: number; significant: boolean; alpha?: number } {
  const comparison = pairedComparison(samples, baselinePredictions, candidatePredictions);
  
  const n01 = comparison.baselineOnlyCorrect; // Baseline correct, candidate wrong
  const n10 = comparison.candidateOnlyCorrect; // Candidate correct, baseline wrong

  if (n01 + n10 === 0) {
    return { statistic: 0, pValue: 1, significant: false };
  }

  // McNemar's chi-squared statistic with continuity correction
  const statistic = (Math.abs(n01 - n10) - 1) ** 2 / (n01 + n10);
  
  // Approximate p-value using chi-squared distribution with 1 degree of freedom
  const pValue = chi2SurvivalFunction(statistic, 1);

  return {
    statistic,
    pValue,
    significant: pValue < 0.05,
    alpha: 0.05,
  };
}

/**
 * Approximate chi-squared survival function (1 - CDF)
 * Uses the regularized incomplete gamma function approximation
 */
function chi2SurvivalFunction(x: number, k: number): number {
  // For k=1 (McNemar's test), use the relationship with normal distribution
  if (k === 1) {
    const z = Math.sqrt(x);
    return 2 * normalSurvivalFunction(z);
  }
  
  // For other k values, use a simple approximation
  // This is not highly accurate but sufficient for evaluation purposes
  const a = k / 2;
  const x2 = x / 2;
  
  // Use series expansion for the regularized incomplete gamma function
  let sum = 0;
  let term = 1;
  for (let i = 0; i < 100; i++) {
    term *= x2 / (a + i + 1);
    sum += term;
    if (Math.abs(term) < 1e-10) {break;}
  }
  
  const gammaReg = Math.exp(-x2 + a * Math.log(x2) - logGamma(a)) * sum / a;
  return 1 - gammaReg;
}

/**
 * Standard normal survival function (1 - Phi(z))
 */
function normalSurvivalFunction(z: number): number {
  // Approximation using the error function
  return 0.5 * erfc(z / Math.sqrt(2));
}

/**
 * Complementary error function approximation
 */
function erfc(x: number): number {
  // Abramowitz and Stegun approximation 7.1.26
  const p = 0.3275911;
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;

  const t = 1 / (1 + p * Math.abs(x));
  const y = 1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);

  return x >= 0 ? 1 - y : 1 + y;
}

/**
 * Log of the gamma function (Stirling's approximation)
 */
function logGamma(x: number): number {
  if (x <= 0) {return 0;}
  
  // Stirling's approximation
  return 0.5 * Math.log(2 * Math.PI) + (x - 0.5) * Math.log(x) - x + 1 / (12 * x);
}

/**
 * Calculate Cohen's d effect size
 */
export function calculateEffectSize(
  baselineAccuracies: number[],
  candidateAccuracies: number[]
): number {
  const n1 = baselineAccuracies.length;
  const n2 = candidateAccuracies.length;

  if (n1 === 0 || n2 === 0) {return 0;}

  const mean1 = baselineAccuracies.reduce((s, v) => s + v, 0) / n1;
  const mean2 = candidateAccuracies.reduce((s, v) => s + v, 0) / n2;

  const var1 = baselineAccuracies.reduce((s, v) => s + (v - mean1) ** 2, 0) / (n1 - 1 || 1);
  const var2 = candidateAccuracies.reduce((s, v) => s + (v - mean2) ** 2, 0) / (n2 - 1 || 1);

  // Pooled standard deviation
  const pooledStd = Math.sqrt(((n1 - 1) * var1 + (n2 - 1) * var2) / (n1 + n2 - 2 || 1));

  if (pooledStd === 0) {return 0;}

  const result = (mean2 - mean1) / pooledStd;
  return Number.isFinite(result) ? result : 0;
}

/**
 * Compare two models and return comprehensive comparison results
 */
export function compareModels(
  baselineResults: ClassificationResult[],
  candidateResults: ClassificationResult[],
  alpha: number = 0.05
): ModelComparison {
  const baselineAccuracy = calculateAccuracy(baselineResults);
  const candidateAccuracy = calculateAccuracy(candidateResults);
  const accuracyDifference = candidateAccuracy - baselineAccuracy;

  // Get predictions for paired comparison
  const baselinePredictions = baselineResults.map(r => r.predicted_label);
  const candidatePredictions = candidateResults.map(r => r.predicted_label);

  // McNemar's test
  const mcnemar = mcnemarTest(baselineResults, baselinePredictions, candidatePredictions);

  const effectSize = calculateProportionEffectSize(
    baselineAccuracy,
    candidateAccuracy
  );

  // Per-class comparison
  const baselineCM = buildConfusionMatrix(baselineResults);
  const candidateCM = buildConfusionMatrix(candidateResults);

  // Get all unique labels
  const allLabels = new Set([...baselineCM.labels, ...candidateCM.labels]);
  const perClassComparison = Array.from(allLabels).map(label => {
    const baselineClass = baselineCM.per_class.find(c => c.label === label);
    const candidateClass = candidateCM.per_class.find(c => c.label === label);

    const baselineF1 = baselineClass?.f1 ?? 0;
    const candidateF1 = candidateClass?.f1 ?? 0;
    const difference = candidateF1 - baselineF1;

    return {
      label,
      baseline_f1: baselineF1,
      candidate_f1: candidateF1,
      difference,
      improved: difference > 0,
    };
  });

  return {
    baseline_accuracy: baselineAccuracy,
    candidate_accuracy: candidateAccuracy,
    accuracy_difference: accuracyDifference,
    p_value: mcnemar.pValue,
    is_significant: mcnemar.pValue < alpha,
    effect_size: effectSize,
    per_class_comparison: perClassComparison,
  };
}

/**
 * Compare two persisted eval runs.
 */
export function comparePersistedEvalRuns(
  baselineRun: EvalRun,
  candidateRun: EvalRun,
  alpha: number = 0.05
): ModelComparison {
  const baselineCM = baselineRun.confusion_matrix;
  const candidateCM = candidateRun.confusion_matrix;
  const allLabels = new Set([...baselineCM.labels, ...candidateCM.labels]);
  const approximateSignificance = approximateSignificanceFromRuns(
    baselineRun,
    candidateRun,
    alpha
  );

  return {
    baseline_accuracy: baselineRun.metrics.accuracy,
    candidate_accuracy: candidateRun.metrics.accuracy,
    accuracy_difference:
      candidateRun.metrics.accuracy - baselineRun.metrics.accuracy,
    p_value: approximateSignificance.pValue,
    is_significant: approximateSignificance.significant,
    effect_size: calculateProportionEffectSize(
      baselineRun.metrics.accuracy,
      candidateRun.metrics.accuracy
    ),
    per_class_comparison: Array.from(allLabels).map((label) => {
      const baselineClass = baselineCM.per_class.find((entry) => entry.label === label);
      const candidateClass = candidateCM.per_class.find((entry) => entry.label === label);
      const baselineF1 = baselineClass?.f1 ?? 0;
      const candidateF1 = candidateClass?.f1 ?? 0;
      const difference = candidateF1 - baselineF1;

      return {
        label,
        baseline_f1: baselineF1,
        candidate_f1: candidateF1,
        difference,
        improved: difference > 0,
      };
    }),
  };
}

/**
 * Interpret Cohen's d effect size
 */
export function interpretEffectSize(d: number): string {
  const absD = Math.abs(d);
  if (absD < 0.2) {return 'negligible';}
  if (absD < 0.5) {return 'small';}
  if (absD < 0.8) {return 'medium';}
  return 'large';
}

/**
 * Summary of model comparison
 */
export function summarizeComparison(comparison: ModelComparison): string {
  const direction = comparison.accuracy_difference > 0 ? 'improvement' : 'regression';
  const magnitude = Math.abs(comparison.accuracy_difference * 100).toFixed(2);
  
  let summary = `Candidate shows ${direction === 'improvement' ? 'an' : 'a'} ${direction} of ${magnitude}% in accuracy `;
  summary += `(${(comparison.baseline_accuracy * 100).toFixed(2)}% → ${(comparison.candidate_accuracy * 100).toFixed(2)}%)`;

  if (comparison.p_value !== undefined) {
    summary += `. Statistical test p-value: ${comparison.p_value.toFixed(4)}`;
    summary += ` (${comparison.is_significant === true ? 'significant' : 'not significant'} at α=0.05)`;
  }

  if (comparison.effect_size !== undefined) {
    const interpretation = interpretEffectSize(comparison.effect_size);
    summary += `. Effect size: ${comparison.effect_size.toFixed(3)} (${interpretation})`;
  }

  // Per-class summary
  const improved = comparison.per_class_comparison.filter(c => c.improved).length;
  const regressed = comparison.per_class_comparison.filter(c => !c.improved).length;
  summary += `. Classes: ${improved} improved, ${regressed} regressed`;

  return summary;
}
