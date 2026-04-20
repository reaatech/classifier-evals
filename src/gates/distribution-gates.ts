/**
 * Distribution-based regression gates
 */

import { ClassificationMetrics, RegressionGate, GateResult } from '../types/index.js';
import {
  compareThreshold,
  formatMetricValue,
  getMetricValue,
  type GateEvaluationContext,
} from './metric-lookup.js';

/**
 * Evaluate a distribution gate
 */
export function evaluateDistributionGate(
  metrics: ClassificationMetrics,
  gate: RegressionGate,
  context?: GateEvaluationContext,
): GateResult {
  if (gate.type !== 'distribution') {
    return {
      passed: false,
      gate: gate,
      message: `Expected distribution gate, got ${gate.type}`,
      failures: [],
    };
  }

  const metricValue = getMetricValue(metrics, gate.metric, context);
  if (metricValue === undefined) {
    return {
      passed: false,
      gate,
      message: `Unknown distribution metric: ${gate.metric ?? 'unknown'}`,
      failures: [],
    };
  }

  const threshold = gate.threshold ?? 0;
  const operator = gate.operator ?? '<=';
  const passed = compareThreshold(metricValue, threshold, operator);

  return {
    passed,
    gate,
    actual_value: metricValue,
    expected_value: threshold,
    message: passed
      ? `${gate.metric} (${formatMetricValue(gate.metric, metricValue)}) ${operator} ${formatMetricValue(gate.metric, threshold)}`
      : `${gate.metric} (${formatMetricValue(gate.metric, metricValue)}) violated distribution threshold ${operator} ${formatMetricValue(gate.metric, threshold)}`,
    failures: [],
  };
}
