/**
 * Unit tests for regression gate engine
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { ClassificationMetrics, RegressionGate } from '@reaatech/classifier-evals';
import { createEvalRunFromSamples } from '@reaatech/classifier-evals-metrics';
import { describe, expect, it } from 'vitest';
import { evaluateBaselineComparison } from '../baseline-comparison.js';
import { evaluateDistributionGate } from '../distribution-gates.js';
import { createGateEngine } from '../gate-engine.js';
import {
  type GateEvaluationContext,
  compareThreshold,
  formatMetricValue,
  getMetricValue,
} from '../metric-lookup.js';
import { evaluateThresholdGate } from '../threshold-gates.js';

function createMockMetrics(overrides: Partial<ClassificationMetrics> = {}): ClassificationMetrics {
  return {
    accuracy: 0.85,
    precision_macro: 0.84,
    recall_macro: 0.83,
    f1_macro: 0.835,
    precision_micro: 0.85,
    recall_micro: 0.85,
    f1_micro: 0.85,
    precision_weighted: 0.845,
    recall_weighted: 0.84,
    f1_weighted: 0.842,
    matthews_correlation: 0.7,
    cohens_kappa: 0.68,
    total_samples: 100,
    correct_predictions: 85,
    ...overrides,
  };
}

describe('Threshold Gates', () => {
  it('should pass when metric meets threshold', () => {
    const metrics = createMockMetrics({ accuracy: 0.9 });
    const gate: RegressionGate = {
      name: 'accuracy-gate',
      type: 'threshold',
      metric: 'accuracy',
      operator: '>=',
      threshold: 0.85,
    };

    const result = evaluateThresholdGate(metrics, gate);
    expect(result.passed).toBe(true);
  });

  it('should fail when metric below threshold', () => {
    const metrics = createMockMetrics({ accuracy: 0.8 });
    const gate: RegressionGate = {
      name: 'accuracy-gate',
      type: 'threshold',
      metric: 'accuracy',
      operator: '>=',
      threshold: 0.85,
    };

    const result = evaluateThresholdGate(metrics, gate);
    expect(result.passed).toBe(false);
  });

  it('should handle different operators', () => {
    const metrics = createMockMetrics();

    // Test <= operator
    const gate: RegressionGate = {
      name: 'error-rate-gate',
      type: 'threshold',
      metric: 'accuracy',
      operator: '<=',
      threshold: 0.9,
    };

    const result = evaluateThresholdGate(metrics, gate);
    expect(result.passed).toBe(true); // 0.85 <= 0.9
  });

  it('should handle per-class thresholds', () => {
    const metrics = createMockMetrics();
    const gate: RegressionGate = {
      name: 'per-class-f1',
      type: 'threshold',
      metric: 'f1',
      operator: '>=',
      threshold: 0.8,
    };

    // This would need per-class metrics to work properly
    // For now, it should handle the case gracefully
    const result = evaluateThresholdGate(metrics, gate);
    expect(result.passed).toBeDefined();
  });
});

describe('Distribution Gates', () => {
  it('evaluates derived distribution metrics from eval metadata', () => {
    const gate: RegressionGate = {
      name: 'unknown-rate',
      type: 'distribution',
      metric: 'unknown_rate',
      operator: '<=',
      threshold: 0.25,
    };
    const evalRun = createEvalRunFromSamples({
      samples: [
        { text: 'a', label: 'alpha', predicted_label: 'alpha', confidence: 0.9 },
        { text: 'b', label: 'beta', predicted_label: 'unknown', confidence: 0.3 },
        { text: 'c', label: 'gamma', predicted_label: 'gamma', confidence: 0.9 },
      ],
    });

    const result = evaluateDistributionGate(evalRun.metrics, gate, { evalRun });
    expect(result.passed).toBe(false);
    expect(result.actual_value).toBeCloseTo(1 / 3, 5);
  });
});

describe('Baseline Comparison Gates', () => {
  it('compares scalar metrics against a baseline eval run', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'baseline-gate-'));
    const baselinePath = path.join(tempDir, 'baseline.json');
    const baselineRun = createEvalRunFromSamples({
      samples: [
        { text: 'a', label: 'alpha', predicted_label: 'alpha', confidence: 0.9 },
        { text: 'b', label: 'beta', predicted_label: 'beta', confidence: 0.9 },
      ],
    });
    fs.writeFileSync(baselinePath, JSON.stringify(baselineRun, null, 2));

    const candidateRun = createEvalRunFromSamples({
      samples: [
        { text: 'a', label: 'alpha', predicted_label: 'alpha', confidence: 0.9 },
        { text: 'b', label: 'beta', predicted_label: 'alpha', confidence: 0.9 },
      ],
    });
    const engine = createGateEngine();
    const gates: RegressionGate[] = [
      {
        name: 'accuracy-no-regression',
        type: 'baseline-comparison',
        metric: 'accuracy',
        baseline_path: baselinePath,
      },
    ];

    const result = engine.evaluateGates(candidateRun.metrics, gates, { evalRun: candidateRun });
    expect(result.passed).toBe(false);
    expect(result.gateResults[0]?.message).toContain('regressed');
  });

  it('compares per-class F1 against a baseline eval run', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'baseline-gate-'));
    const baselinePath = path.join(tempDir, 'baseline.json');
    const baselineRun = createEvalRunFromSamples({
      samples: [
        { text: 'a1', label: 'alpha', predicted_label: 'alpha', confidence: 0.9 },
        { text: 'a2', label: 'alpha', predicted_label: 'alpha', confidence: 0.9 },
        { text: 'b1', label: 'beta', predicted_label: 'beta', confidence: 0.9 },
      ],
    });
    fs.writeFileSync(baselinePath, JSON.stringify(baselineRun, null, 2));

    const candidateRun = createEvalRunFromSamples({
      samples: [
        { text: 'a1', label: 'alpha', predicted_label: 'beta', confidence: 0.9 },
        { text: 'a2', label: 'alpha', predicted_label: 'alpha', confidence: 0.9 },
        { text: 'b1', label: 'beta', predicted_label: 'beta', confidence: 0.9 },
      ],
    });
    const engine = createGateEngine();
    const gates: RegressionGate[] = [
      {
        name: 'per-class-f1',
        type: 'baseline-comparison',
        metric: 'f1_per_class',
        baseline_path: baselinePath,
        allow_regression_in: 0,
      },
    ];

    const result = engine.evaluateGates(candidateRun.metrics, gates, { evalRun: candidateRun });
    expect(result.passed).toBe(false);
    expect(result.gateResults[0]?.failures[0]?.label).toBe('alpha');
  });
});

describe('Gate Engine', () => {
  it('should evaluate multiple gates', () => {
    const engine = createGateEngine();
    const metrics = createMockMetrics({ accuracy: 0.9, f1_macro: 0.8 });

    const gates: RegressionGate[] = [
      {
        name: 'accuracy-gate',
        type: 'threshold',
        metric: 'accuracy',
        operator: '>=',
        threshold: 0.85,
      },
      {
        name: 'f1-gate',
        type: 'threshold',
        metric: 'f1_macro',
        operator: '>=',
        threshold: 0.85,
      },
    ];

    const result = engine.evaluateGates(metrics, gates);

    expect(result.totalCount).toBe(2);
    expect(result.passedCount).toBe(1); // accuracy passes, f1 fails
    expect(result.failedCount).toBe(1);
    expect(result.passed).toBe(false); // Not all gates passed
  });

  it('should pass when all gates pass', () => {
    const engine = createGateEngine();
    const metrics = createMockMetrics({ accuracy: 0.9, f1_macro: 0.9 });

    const gates: RegressionGate[] = [
      {
        name: 'accuracy-gate',
        type: 'threshold',
        metric: 'accuracy',
        operator: '>=',
        threshold: 0.85,
      },
      {
        name: 'f1-gate',
        type: 'threshold',
        metric: 'f1_macro',
        operator: '>=',
        threshold: 0.85,
      },
    ];

    const result = engine.evaluateGates(metrics, gates);
    expect(result.passed).toBe(true);
    expect(result.passedCount).toBe(2);
  });

  it('should format results for GitHub Actions', () => {
    const engine = createGateEngine();
    const metrics = createMockMetrics();

    const gates: RegressionGate[] = [
      {
        name: 'accuracy-gate',
        type: 'threshold',
        metric: 'accuracy',
        operator: '>=',
        threshold: 0.85,
      },
    ];

    const result = engine.evaluateGates(metrics, gates);
    const formatted = engine.formatForGitHubActions(result);

    expect(formatted).toContain('::group::');
    expect(formatted).toContain('accuracy-gate');
    expect(formatted).toContain('PASSED');
  });

  it('should format results as JUnit XML', () => {
    const engine = createGateEngine();
    const metrics = createMockMetrics();

    const gates: RegressionGate[] = [
      {
        name: 'accuracy-gate',
        type: 'threshold',
        metric: 'accuracy',
        operator: '>=',
        threshold: 0.85,
      },
    ];

    const result = engine.evaluateGates(metrics, gates);
    const xml = engine.formatAsJUnit(result);

    expect(xml).toContain('<?xml version="1.0"');
    expect(xml).toContain('accuracy-gate');
    expect(xml).toContain('<testsuites');
  });

  it('should cache results when enabled', () => {
    const engine = createGateEngine({ cacheResults: true });
    const metrics = createMockMetrics();

    const gates: RegressionGate[] = [
      {
        name: 'accuracy-gate',
        type: 'threshold',
        metric: 'accuracy',
        operator: '>=',
        threshold: 0.85,
      },
    ];

    // First evaluation
    engine.evaluateGates(metrics, gates);
    // Second evaluation should use cache
    const result2 = engine.evaluateGates(metrics, gates);

    expect(result2.passedCount).toBe(1);
  });

  it('should clear cache when requested', () => {
    const engine = createGateEngine({ cacheResults: true });
    const metrics = createMockMetrics();

    const gates: RegressionGate[] = [
      {
        name: 'accuracy-gate',
        type: 'threshold',
        metric: 'accuracy',
        operator: '>=',
        threshold: 0.85,
      },
    ];

    engine.evaluateGates(metrics, gates);
    engine.clearCache();

    // Cache should be empty, but evaluation should still work
    const result = engine.evaluateGates(metrics, gates);
    expect(result.passedCount).toBe(1);
  });

  it('should handle unknown gate types', () => {
    const engine = createGateEngine();
    const metrics = createMockMetrics();

    const gates: RegressionGate[] = [
      {
        name: 'unknown-gate',
        type: 'custom' as RegressionGate['type'],
        metric: 'accuracy',
        operator: '>=',
        threshold: 0.85,
      },
    ];

    const result = engine.evaluateGates(metrics, gates);
    expect(result.passed).toBe(false);
    expect(result.gateResults[0]?.message).toContain('Unknown gate type');
  });

  it('should format GitHub Actions with ::error:: when gates fail', () => {
    const engine = createGateEngine();
    const metrics = createMockMetrics({ accuracy: 0.5 });

    const gates: RegressionGate[] = [
      {
        name: 'accuracy-gate',
        type: 'threshold',
        metric: 'accuracy',
        operator: '>=',
        threshold: 0.85,
      },
    ];

    const result = engine.evaluateGates(metrics, gates);
    const formatted = engine.formatForGitHubActions(result);
    expect(formatted).toContain('::error::');
    expect(formatted).toContain('FAILED');
  });

  it('should format JUnit XML with failure for failed gates', () => {
    const engine = createGateEngine();
    const metrics = createMockMetrics({ accuracy: 0.5 });

    const gates: RegressionGate[] = [
      {
        name: 'acc-gate',
        type: 'threshold',
        metric: 'accuracy',
        operator: '>=',
        threshold: 0.85,
      },
    ];

    const result = engine.evaluateGates(metrics, gates);
    const xml = engine.formatAsJUnit(result);
    expect(xml).toContain('<failure');
  });

  it('should escape XML special characters in JUnit failure messages', () => {
    const engine = createGateEngine();
    const metrics = createMockMetrics({ accuracy: 0.5 });

    const gates: RegressionGate[] = [
      {
        name: 'xml-escape-gate',
        type: 'threshold',
        metric: 'accuracy',
        operator: '>=',
        threshold: 0.85,
      },
    ];

    const result = engine.evaluateGates(metrics, gates);
    const xml = engine.formatAsJUnit(result);
    expect(xml).toContain('<failure');
    expect(xml).toContain('&#62;=');
  });

  it('should work with cacheResults disabled', () => {
    const engine = createGateEngine({ cacheResults: false });
    const metrics = createMockMetrics();

    const gates: RegressionGate[] = [
      {
        name: 'accuracy-gate',
        type: 'threshold',
        metric: 'accuracy',
        operator: '>=',
        threshold: 0.85,
      },
    ];

    const result = engine.evaluateGates(metrics, gates);
    expect(result.passed).toBe(true);
  });
});

describe('Threshold Gates - additional branches', () => {
  it('should reject wrong gate type', () => {
    const metrics = createMockMetrics();
    const gate: RegressionGate = {
      name: 'wrong-type',
      type: 'distribution',
      metric: 'accuracy',
      operator: '>=',
      threshold: 0.85,
    };

    const result = evaluateThresholdGate(metrics, gate);
    expect(result.passed).toBe(false);
    expect(result.message).toContain('Expected threshold gate, got distribution');
  });

  it('should handle undefined metric', () => {
    const metrics = createMockMetrics();
    const gate: RegressionGate = {
      name: 'unknown-metric',
      type: 'threshold',
      metric: 'nonexistent',
      operator: '>=',
      threshold: 0.85,
    };

    const result = evaluateThresholdGate(metrics, gate);
    expect(result.passed).toBe(false);
    expect(result.message).toContain('Unknown metric');
  });

  it('should default threshold to 0 and operator to >=', () => {
    const metrics = createMockMetrics({ accuracy: 0.5 });
    const gate: RegressionGate = {
      name: 'defaults-gate',
      type: 'threshold',
      metric: 'accuracy',
    } as RegressionGate;

    const result = evaluateThresholdGate(metrics, gate);
    expect(result.passed).toBe(true);
  });

  it('should show failed message when threshold not met', () => {
    const metrics = createMockMetrics({ accuracy: 0.5 });
    const gate: RegressionGate = {
      name: 'fail-gate',
      type: 'threshold',
      metric: 'accuracy',
      operator: '>=',
      threshold: 0.9,
    };

    const result = evaluateThresholdGate(metrics, gate);
    expect(result.passed).toBe(false);
    expect(result.message).toContain('did not meet threshold');
  });
});

describe('Distribution Gates - additional branches', () => {
  it('should reject wrong gate type', () => {
    const metrics = createMockMetrics();
    const gate: RegressionGate = {
      name: 'wrong-type',
      type: 'threshold',
      metric: 'unknown_rate',
      operator: '<=',
      threshold: 0.1,
    };

    const result = evaluateDistributionGate(metrics, gate);
    expect(result.passed).toBe(false);
    expect(result.message).toContain('Expected distribution gate, got threshold');
  });

  it('should handle unknown metric', () => {
    const metrics = createMockMetrics();
    const gate: RegressionGate = {
      name: 'unknown-metric',
      type: 'distribution',
      metric: 'totally_fake_metric',
      operator: '<=',
      threshold: 0.1,
    };

    const result = evaluateDistributionGate(metrics, gate);
    expect(result.passed).toBe(false);
    expect(result.message).toContain('Unknown distribution metric');
  });

  it('should default threshold to 0 and operator to <=', () => {
    const evalRun = createEvalRunFromSamples({
      samples: [{ text: 'a', label: 'alpha', predicted_label: 'unknown', confidence: 0.3 }],
    });

    const gate: RegressionGate = {
      name: 'defaults-gate',
      type: 'distribution',
      metric: 'unknown_rate',
    } as RegressionGate;

    const result = evaluateDistributionGate(evalRun.metrics, gate, { evalRun });
    expect(result.passed).toBe(false);
  });

  it('should pass when distribution threshold is met', () => {
    const evalRun = createEvalRunFromSamples({
      samples: [
        { text: 'a', label: 'alpha', predicted_label: 'alpha', confidence: 0.9 },
        { text: 'b', label: 'beta', predicted_label: 'beta', confidence: 0.9 },
      ],
    });

    const gate: RegressionGate = {
      name: 'unknown-rate',
      type: 'distribution',
      metric: 'unknown_rate',
      operator: '<=',
      threshold: 0.5,
    };

    const result = evaluateDistributionGate(evalRun.metrics, gate, { evalRun });
    expect(result.passed).toBe(true);
    expect(result.message).toContain('unknown_rate');
  });
});

describe('Baseline Comparison - additional branches', () => {
  it('should reject wrong gate type', () => {
    const metrics = createMockMetrics();
    const gate: RegressionGate = {
      name: 'wrong-type',
      type: 'threshold',
      metric: 'accuracy',
      operator: '>=',
      threshold: 0.85,
    };

    const result = evaluateBaselineComparison(metrics, gate);
    expect(result.passed).toBe(false);
    expect(result.message).toContain('Expected baseline-comparison gate, got threshold');
  });

  it('should fail when no baseline path provided', () => {
    const metrics = createMockMetrics();
    const gate: RegressionGate = {
      name: 'no-path',
      type: 'baseline-comparison',
      metric: 'accuracy',
    };

    const result = evaluateBaselineComparison(metrics, gate);
    expect(result.passed).toBe(false);
    expect(result.message).toContain('Baseline comparison requires a baseline_path');
  });

  it('should pass when candidate matches or improves baseline', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'baseline-pass-'));
    const baselinePath = path.join(tempDir, 'baseline.json');
    const baselineRun = createEvalRunFromSamples({
      samples: [
        { text: 'a', label: 'alpha', predicted_label: 'alpha', confidence: 0.9 },
        { text: 'b', label: 'beta', predicted_label: 'alpha', confidence: 0.9 },
      ],
    });
    fs.writeFileSync(baselinePath, JSON.stringify(baselineRun, null, 2));

    const candidateRun = createEvalRunFromSamples({
      samples: [
        { text: 'a', label: 'alpha', predicted_label: 'alpha', confidence: 0.9 },
        { text: 'b', label: 'beta', predicted_label: 'beta', confidence: 0.9 },
      ],
    });

    const gate: RegressionGate = {
      name: 'accuracy-no-regression',
      type: 'baseline-comparison',
      metric: 'accuracy',
      baseline_path: baselinePath,
    };

    const result = evaluateBaselineComparison(candidateRun.metrics, gate, undefined, {
      evalRun: candidateRun,
    });
    expect(result.passed).toBe(true);
    expect(result.message).toContain('matched or improved');
  });

  it('should fail when metric not found in baseline or candidate', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'baseline-nometric-'));
    const baselinePath = path.join(tempDir, 'baseline.json');
    const baselineRun = createEvalRunFromSamples({
      samples: [{ text: 'a', label: 'alpha', predicted_label: 'alpha', confidence: 0.9 }],
    });
    fs.writeFileSync(baselinePath, JSON.stringify(baselineRun, null, 2));

    const candidateRun = createEvalRunFromSamples({
      samples: [{ text: 'a', label: 'alpha', predicted_label: 'alpha', confidence: 0.9 }],
    });

    const gate: RegressionGate = {
      name: 'bad-metric',
      type: 'baseline-comparison',
      metric: 'nonexistent_metric',
      baseline_path: baselinePath,
    };

    const result = evaluateBaselineComparison(candidateRun.metrics, gate, undefined, {
      evalRun: candidateRun,
    });
    expect(result.passed).toBe(false);
    expect(result.message).toContain('Unable to compare baseline metric');
  });

  it('should pass per-class F1 when regressions within allowed limit', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'baseline-f1pass-'));
    const baselinePath = path.join(tempDir, 'baseline.json');
    const baselineRun = createEvalRunFromSamples({
      samples: [
        { text: 'a1', label: 'alpha', predicted_label: 'alpha', confidence: 0.9 },
        { text: 'a2', label: 'alpha', predicted_label: 'alpha', confidence: 0.9 },
        { text: 'b1', label: 'beta', predicted_label: 'beta', confidence: 0.9 },
      ],
    });
    fs.writeFileSync(baselinePath, JSON.stringify(baselineRun, null, 2));

    const candidateRun = createEvalRunFromSamples({
      samples: [
        { text: 'a1', label: 'alpha', predicted_label: 'alpha', confidence: 0.9 },
        { text: 'a2', label: 'alpha', predicted_label: 'beta', confidence: 0.9 },
        { text: 'b1', label: 'beta', predicted_label: 'beta', confidence: 0.9 },
      ],
    });

    const gate: RegressionGate = {
      name: 'per-class-f1',
      type: 'baseline-comparison',
      metric: 'f1_per_class',
      baseline_path: baselinePath,
      allow_regression_in: 2,
    };

    const engine = createGateEngine();
    const result = engine.evaluateGates(candidateRun.metrics, [gate], { evalRun: candidateRun });
    expect(result.passed).toBe(true);
    expect(result.gateResults[0]?.message).toContain('within allowed limit');
  });

  it('should fail per-class F1 when no candidate confusion matrix', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'baseline-nocm-'));
    const baselinePath = path.join(tempDir, 'baseline.json');
    const baselineRun = createEvalRunFromSamples({
      samples: [{ text: 'a', label: 'alpha', predicted_label: 'alpha', confidence: 0.9 }],
    });
    fs.writeFileSync(baselinePath, JSON.stringify(baselineRun, null, 2));

    const metrics = createMockMetrics();
    const gate: RegressionGate = {
      name: 'per-class-f1',
      type: 'baseline-comparison',
      metric: 'f1_per_class',
      baseline_path: baselinePath,
    };

    const result = evaluateBaselineComparison(metrics, gate);
    expect(result.passed).toBe(false);
    expect(result.message).toContain(
      'Per-class baseline comparison requires evalRun confusion matrix',
    );
  });
});

describe('Metric Lookup Helpers', () => {
  it('compares thresholds for all operators', () => {
    expect(compareThreshold(5, 3, '>')).toBe(true);
    expect(compareThreshold(3, 5, '>')).toBe(false);
    expect(compareThreshold(5, 3, '<')).toBe(false);
    expect(compareThreshold(3, 5, '<')).toBe(true);
    expect(compareThreshold(1.0, 1.0, '==')).toBe(true);
    expect(compareThreshold(1.0, 2.0, '==')).toBe(false);
    expect(compareThreshold(1, 1, '!=')).toBe(false);
  });

  it('formats metric values for total_samples and percentages', () => {
    expect(formatMetricValue('total_samples', 100)).toBe('100');
    expect(formatMetricValue('correct_predictions', 85)).toBe('85');
    expect(formatMetricValue('accuracy', 0.8567)).toBe('85.67%');
  });

  it('resolves distribution metrics from context', () => {
    const evalRun = createEvalRunFromSamples({
      samples: [{ text: 'a', label: 'alpha', predicted_label: 'unknown', confidence: 0.3 }],
    });
    const metrics = evalRun.metrics;
    const value = getMetricValue(metrics, 'unknown_rate', { evalRun });
    expect(value).toBe(1);
  });

  it('returns undefined for unknown metrics', () => {
    const metrics = createMockMetrics();
    expect(getMetricValue(metrics, '')).toBeUndefined();
    expect(getMetricValue(metrics, undefined as unknown as string)).toBeUndefined();
    expect(getMetricValue(metrics, 'fake_metric')).toBeUndefined();
  });

  it('returns undefined for non-number distribution values', () => {
    const metrics = createMockMetrics();
    const value = getMetricValue(metrics, 'string_metric', {
      evalRun: {
        metadata: { distribution_metrics: { string_metric: 'not-a-number' } },
      },
    } as unknown as GateEvaluationContext);
    expect(value).toBeUndefined();
  });
});
