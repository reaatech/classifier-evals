/**
 * Baseline comparison gates
 */

import { readFileSync } from 'fs';
import { ClassificationMetrics, RegressionGate, GateResult } from '../types/index.js';
import type { EvalRun } from '../types/index.js';
import {
  compareThreshold,
  formatMetricValue,
  getMetricValue,
  type GateEvaluationContext,
} from './metric-lookup.js';

function loadBaselineEvalRun(baselinePath: string): EvalRun {
  try {
    return JSON.parse(readFileSync(baselinePath, 'utf8')) as EvalRun;
  } catch (err) {
    throw new Error(`Failed to load baseline from "${baselinePath}": ${(err as Error).message}`, {
      cause: err,
    });
  }
}

/**
 * Evaluate a baseline comparison gate
 */
export function evaluateBaselineComparison(
  metrics: ClassificationMetrics,
  gate: RegressionGate,
  baselinePath?: string,
  context?: GateEvaluationContext,
): GateResult {
  if (gate.type !== 'baseline-comparison') {
    return {
      passed: false,
      gate: gate,
      message: `Expected baseline-comparison gate, got ${gate.type}`,
      failures: [],
    };
  }

  const resolvedBaselinePath = gate.baseline_path ?? baselinePath;
  if (resolvedBaselinePath === undefined || resolvedBaselinePath === '') {
    return {
      passed: false,
      gate,
      message: 'Baseline comparison requires a baseline_path',
      failures: [],
    };
  }

  let baselineRun: EvalRun;
  try {
    baselineRun = loadBaselineEvalRun(resolvedBaselinePath);
  } catch (err) {
    return {
      passed: false,
      gate,
      message: (err as Error).message,
      failures: [],
    };
  }
  const candidateRun = context?.evalRun;

  if (gate.metric === 'f1_per_class') {
    const baselineClasses = baselineRun.confusion_matrix?.per_class ?? [];
    const candidateClasses = candidateRun?.confusion_matrix?.per_class ?? [];

    if (baselineClasses.length === 0) {
      return {
        passed: false,
        gate,
        message: 'Baseline has no per-class data for comparison',
        failures: [],
      };
    }

    if (candidateClasses.length === 0) {
      return {
        passed: false,
        gate,
        message: 'Per-class baseline comparison requires evalRun confusion matrix context',
        failures: [],
      };
    }

    const failures = baselineClasses.flatMap((baselineClass) => {
      const candidateClass = candidateClasses.find((entry) => entry.label === baselineClass.label);

      if (!candidateClass) {
        return [
          {
            label: baselineClass.label,
            metric: 'f1_per_class',
            actual: 0,
            expected: baselineClass.f1,
          },
        ];
      }

      if (candidateClass.f1 >= baselineClass.f1) {
        return [];
      }

      return [
        {
          label: baselineClass.label,
          metric: 'f1_per_class',
          actual: candidateClass.f1,
          expected: baselineClass.f1,
        },
      ];
    });

    const allowedRegressions = gate.allow_regression_in ?? 0;
    const passed = failures.length <= allowedRegressions;

    return {
      passed,
      gate,
      message: passed
        ? `Per-class F1 regression count ${failures.length} is within allowed limit ${allowedRegressions}`
        : `${failures.length} class(es) regressed in F1, exceeding allowed limit ${allowedRegressions}`,
      failures,
    };
  }

  const candidateValue = getMetricValue(metrics, gate.metric, context);
  const baselineValue = getMetricValue(baselineRun.metrics, gate.metric, { evalRun: baselineRun });

  if (candidateValue === undefined || baselineValue === undefined) {
    return {
      passed: false,
      gate,
      message: `Unable to compare baseline metric: ${gate.metric ?? 'unknown'}`,
      failures: [],
    };
  }

  const operator = gate.operator ?? '>=';
  const passed = compareThreshold(candidateValue, baselineValue, operator);

  return {
    passed,
    gate,
    actual_value: candidateValue,
    expected_value: baselineValue,
    message: passed
      ? `${gate.metric} matched or improved over baseline (${formatMetricValue(gate.metric, candidateValue)} vs ${formatMetricValue(gate.metric, baselineValue)})`
      : `${gate.metric} regressed from baseline (${formatMetricValue(gate.metric, baselineValue)} -> ${formatMetricValue(gate.metric, candidateValue)})`,
    failures: [],
  };
}
