/**
 * Threshold-based regression gates
 */

import type { ClassificationMetrics, GateResult, RegressionGate } from '@reaatech/classifier-evals';
import {
  type GateEvaluationContext,
  compareThreshold,
  formatMetricValue,
  getMetricValue,
} from './metric-lookup.js';

/**
 * Evaluate a threshold gate
 */
export function evaluateThresholdGate(
  metrics: ClassificationMetrics,
  gate: RegressionGate,
  context?: GateEvaluationContext,
): GateResult {
  if (gate.type !== 'threshold') {
    return {
      passed: false,
      gate: gate,
      message: `Expected threshold gate, got ${gate.type}`,
      failures: [],
    };
  }

  const metricValue = getMetricValue(metrics, gate.metric, context);

  if (metricValue === undefined) {
    return {
      passed: false,
      gate: gate,
      message: `Unknown metric: ${gate.metric}`,
      failures: [],
    };
  }

  const threshold = gate.threshold ?? 0;
  const operator = gate.operator ?? '>=';

  const passed = compareThreshold(metricValue, threshold, operator);
  const actualValue = formatMetricValue(gate.metric, metricValue);
  const thresholdValue = formatMetricValue(gate.metric, threshold);

  return {
    passed,
    gate: gate,
    actual_value: metricValue,
    expected_value: threshold,
    message: passed
      ? `${gate.metric} (${actualValue}) ${operator} ${thresholdValue}`
      : `${gate.metric} (${actualValue}) did not meet threshold ${operator} ${thresholdValue}`,
    failures: [],
  };
}
