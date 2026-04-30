/**
 * Shared metric lookup helpers for gate evaluation.
 */

import type { ClassificationMetrics, EvalRun } from '@reaatech/classifier-evals';

export interface GateEvaluationContext {
  evalRun?: EvalRun;
}

export function getMetricValue(
  metrics: ClassificationMetrics,
  metricName: string | undefined,
  context?: GateEvaluationContext,
): number | undefined {
  if (metricName === undefined || metricName === '') {
    return undefined;
  }

  const metricMap: Record<string, number> = {
    accuracy: metrics.accuracy,
    precision_macro: metrics.precision_macro,
    recall_macro: metrics.recall_macro,
    f1_macro: metrics.f1_macro,
    precision_micro: metrics.precision_micro,
    recall_micro: metrics.recall_micro,
    f1_micro: metrics.f1_micro,
    precision_weighted: metrics.precision_weighted,
    recall_weighted: metrics.recall_weighted,
    f1_weighted: metrics.f1_weighted,
    matthews_correlation: metrics.matthews_correlation,
    cohens_kappa: metrics.cohens_kappa,
    total_samples: metrics.total_samples,
    correct_predictions: metrics.correct_predictions,
  };

  if (metricName in metricMap) {
    return metricMap[metricName];
  }

  const distributionMetrics = context?.evalRun?.metadata?.distribution_metrics;
  if (
    distributionMetrics !== undefined &&
    distributionMetrics !== null &&
    typeof distributionMetrics === 'object' &&
    metricName in distributionMetrics
  ) {
    const value = (distributionMetrics as Record<string, unknown>)[metricName];
    return typeof value === 'number' ? value : undefined;
  }

  const metadataValue = context?.evalRun?.metadata?.[metricName];
  return typeof metadataValue === 'number' ? metadataValue : undefined;
}

export function compareThreshold(actual: number, expected: number, operator: string): boolean {
  switch (operator) {
    case '>=':
      return actual >= expected;
    case '<=':
      return actual <= expected;
    case '>':
      return actual > expected;
    case '<':
      return actual < expected;
    case '==':
      return Math.abs(actual - expected) < 0.0001;
    case '!=':
      return Math.abs(actual - expected) >= 0.0001;
    default:
      return false;
  }
}

export function formatMetricValue(metricName: string | undefined, value: number): string {
  if (metricName === 'total_samples' || metricName === 'correct_predictions') {
    return value.toFixed(0);
  }

  return `${(value * 100).toFixed(2)}%`;
}
