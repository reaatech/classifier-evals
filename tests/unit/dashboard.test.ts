/**
 * Unit tests for dashboard metrics
 */

import { describe, it, expect } from 'vitest';
import {
  evalRunToTrendDataPoint,
  calculateTrendStatistics,
  generateDashboardSummary,
  filterByDateRange,
  filterByModel,
  filterByDataset,
  compareEvalRuns,
  generateDashboardReport,
  exportDashboardData,
  type TrendDataPoint,
} from '../../src/observability/dashboard.js';
import { EvalRun } from '../../src/types/index.js';

function createMockEvalRun(overrides: Partial<EvalRun> = {}): EvalRun {
  const now = new Date().toISOString();
  return {
    run_id: 'test-run-id',
    dataset_name: 'test-dataset',
    total_samples: 100,
    confusion_matrix: {
      labels: ['cat', 'dog'],
      matrix: [[40, 10], [5, 45]],
      per_class: [
        { label: 'cat', true_positives: 40, false_positives: 5, false_negatives: 10, true_negatives: 45, precision: 0.8, recall: 0.8, f1: 0.8, support: 50 },
        { label: 'dog', true_positives: 45, false_positives: 10, false_negatives: 5, true_negatives: 40, precision: 0.9, recall: 0.9, f1: 0.9, support: 50 },
      ],
    },
    metrics: {
      accuracy: 0.85,
      precision_macro: 0.85,
      recall_macro: 0.85,
      f1_macro: 0.85,
      precision_micro: 0.85,
      recall_micro: 0.85,
      f1_micro: 0.85,
      precision_weighted: 0.85,
      recall_weighted: 0.85,
      f1_weighted: 0.85,
      matthews_correlation: 0.7,
      cohens_kappa: 0.7,
      total_samples: 100,
      correct_predictions: 85,
    },
    started_at: now,
    completed_at: now,
    duration_ms: 1000,
    ...overrides,
  };
}

describe('Dashboard', () => {
  describe('evalRunToTrendDataPoint', () => {
    it('should convert eval run to trend data point', () => {
      const run = createMockEvalRun();
      const point = evalRunToTrendDataPoint(run);

      expect(point.runId).toBe(run.run_id);
      expect(point.datasetName).toBe(run.dataset_name);
      expect(point.metrics.accuracy).toBe(run.metrics.accuracy);
      expect(point.metrics.f1_macro).toBe(run.metrics.f1_macro);
    });

    it('should include cost when available', () => {
      const run = createMockEvalRun({ judge_cost: 0.50, total_samples: 100 });
      const point = evalRunToTrendDataPoint(run);

      expect(point.cost).toBeDefined();
      expect(point.cost?.total).toBe(0.50);
      expect(point.cost?.per_sample).toBe(0.005);
    });

    it('should include gate results when available', () => {
      const run = createMockEvalRun({
        gate_results: [
          { name: 'gate1', passed: true },
          { name: 'gate2', passed: false },
        ],
        all_gates_passed: false,
      });
      const point = evalRunToTrendDataPoint(run);

      expect(point.gateResults).toBeDefined();
      expect(point.gateResults?.passed).toBe(false);
      expect(point.gateResults?.passedCount).toBe(1);
      expect(point.gateResults?.totalCount).toBe(2);
    });
  });

  describe('calculateTrendStatistics', () => {
    it('should return null for insufficient data points', () => {
      const dataPoints: TrendDataPoint[] = [
        { timestamp: '2024-01-01', runId: '1', metrics: { accuracy: 0.8, f1_macro: 0.8, f1_micro: 0.8, precision_macro: 0.8, recall_macro: 0.8 } },
        { timestamp: '2024-01-02', runId: '2', metrics: { accuracy: 0.85, f1_macro: 0.85, f1_micro: 0.85, precision_macro: 0.85, recall_macro: 0.85 } },
      ];

      const result = calculateTrendStatistics(dataPoints, 'accuracy', {
        trendWindowDays: 30,
        minDataPoints: 3,
        trendThreshold: 0.05,
      });
      expect(result).toBeNull();
    });

    it('should calculate statistics correctly', () => {
      const dataPoints: TrendDataPoint[] = [
        { timestamp: '2024-01-01', runId: '1', metrics: { accuracy: 0.8, f1_macro: 0.8, f1_micro: 0.8, precision_macro: 0.8, recall_macro: 0.8 } },
        { timestamp: '2024-01-02', runId: '2', metrics: { accuracy: 0.85, f1_macro: 0.85, f1_micro: 0.85, precision_macro: 0.85, recall_macro: 0.85 } },
        { timestamp: '2024-01-03', runId: '3', metrics: { accuracy: 0.9, f1_macro: 0.9, f1_micro: 0.9, precision_macro: 0.9, recall_macro: 0.9 } },
      ];

      const result = calculateTrendStatistics(dataPoints, 'accuracy');

      expect(result).not.toBeNull();
      expect(result?.min).toBe(0.8);
      expect(result?.max).toBe(0.9);
      expect(result?.mean).toBeCloseTo(0.85);
      expect(result?.values).toHaveLength(3);
    });

    it('should detect improving trend', () => {
      const dataPoints: TrendDataPoint[] = [
        { timestamp: '2024-01-01', runId: '1', metrics: { accuracy: 0.7, f1_macro: 0.7, f1_micro: 0.7, precision_macro: 0.7, recall_macro: 0.7 } },
        { timestamp: '2024-01-02', runId: '2', metrics: { accuracy: 0.8, f1_macro: 0.8, f1_micro: 0.8, precision_macro: 0.8, recall_macro: 0.8 } },
        { timestamp: '2024-01-03', runId: '3', metrics: { accuracy: 0.9, f1_macro: 0.9, f1_micro: 0.9, precision_macro: 0.9, recall_macro: 0.9 } },
      ];

      const result = calculateTrendStatistics(dataPoints, 'accuracy');
      expect(result?.trend).toBe('improving');
      expect(result?.changeRate).toBeGreaterThan(0);
    });

    it('should detect declining trend', () => {
      const dataPoints: TrendDataPoint[] = [
        { timestamp: '2024-01-01', runId: '1', metrics: { accuracy: 0.9, f1_macro: 0.9, f1_micro: 0.9, precision_macro: 0.9, recall_macro: 0.9 } },
        { timestamp: '2024-01-02', runId: '2', metrics: { accuracy: 0.8, f1_macro: 0.8, f1_micro: 0.8, precision_macro: 0.8, recall_macro: 0.8 } },
        { timestamp: '2024-01-03', runId: '3', metrics: { accuracy: 0.7, f1_macro: 0.7, f1_micro: 0.7, precision_macro: 0.7, recall_macro: 0.7 } },
      ];

      const result = calculateTrendStatistics(dataPoints, 'accuracy');
      expect(result?.trend).toBe('declining');
      expect(result?.changeRate).toBeLessThan(0);
    });
  });

  describe('generateDashboardSummary', () => {
    it('should return empty summary for no runs', () => {
      const summary = generateDashboardSummary([]);

      expect(summary.totalRuns).toBe(0);
      expect(summary.averageMetrics.accuracy).toBe(0);
    });

    it('should calculate average metrics', () => {
      const runs: EvalRun[] = [
        createMockEvalRun({ metrics: { ...createMockEvalRun().metrics, accuracy: 0.8 } }),
        createMockEvalRun({ metrics: { ...createMockEvalRun().metrics, accuracy: 0.9 } }),
      ];

      const summary = generateDashboardSummary(runs);

      expect(summary.totalRuns).toBe(2);
      expect(summary.averageMetrics.accuracy).toBeCloseTo(0.85);
    });

    it('should identify best and worst runs', () => {
      const runs: EvalRun[] = [
        createMockEvalRun({ run_id: 'worst', metrics: { ...createMockEvalRun().metrics, accuracy: 0.7 } }),
        createMockEvalRun({ run_id: 'best', metrics: { ...createMockEvalRun().metrics, accuracy: 0.95 } }),
        createMockEvalRun({ run_id: 'middle', metrics: { ...createMockEvalRun().metrics, accuracy: 0.85 } }),
      ];

      const summary = generateDashboardSummary(runs);

      expect(summary.bestRun?.runId).toBe('best');
      expect(summary.worstRun?.runId).toBe('worst');
    });

    it('should calculate gate pass rate', () => {
      const runs: EvalRun[] = [
        createMockEvalRun({
          gate_results: [{ name: 'g1', passed: true }],
          all_gates_passed: true,
        }),
        createMockEvalRun({
          gate_results: [{ name: 'g1', passed: false }],
          all_gates_passed: false,
        }),
      ];

      const summary = generateDashboardSummary(runs);

      expect(summary.gatePassRate).toBe(0.5);
    });

    it('should collect unique models and datasets', () => {
      const runs: EvalRun[] = [
        createMockEvalRun({ dataset_name: 'dataset1', metadata: { model: 'model-a' } }),
        createMockEvalRun({ dataset_name: 'dataset2', metadata: { model: 'model-b' } }),
        createMockEvalRun({ dataset_name: 'dataset1', metadata: { model: 'model-a' } }),
      ];

      const summary = generateDashboardSummary(runs);

      expect(summary.models).toHaveLength(2);
      expect(summary.datasets).toHaveLength(2);
    });
  });

  describe('Filtering', () => {
    const dataPoints: TrendDataPoint[] = [
      { timestamp: '2024-01-15', runId: '1', model: 'model-a', datasetName: 'dataset-1', metrics: { accuracy: 0.8, f1_macro: 0.8, f1_micro: 0.8, precision_macro: 0.8, recall_macro: 0.8 } },
      { timestamp: '2024-01-10', runId: '2', model: 'model-b', datasetName: 'dataset-2', metrics: { accuracy: 0.85, f1_macro: 0.85, f1_micro: 0.85, precision_macro: 0.85, recall_macro: 0.85 } },
      { timestamp: new Date().toISOString(), runId: '3', model: 'model-a', datasetName: 'dataset-1', metrics: { accuracy: 0.9, f1_macro: 0.9, f1_micro: 0.9, precision_macro: 0.9, recall_macro: 0.9 } },
    ];

    it('should filter by date range', () => {
      const filtered = filterByDateRange(dataPoints, 7);
      // Only the most recent point should be within 7 days
      expect(filtered.length).toBeGreaterThanOrEqual(1);
      expect(filtered[0]?.runId).toBe('3');
    });

    it('should filter by model', () => {
      const filtered = filterByModel(dataPoints, 'model-a');
      expect(filtered).toHaveLength(2);
      expect(filtered.every(dp => dp.model === 'model-a')).toBe(true);
    });

    it('should filter by dataset', () => {
      const filtered = filterByDataset(dataPoints, 'dataset-1');
      expect(filtered).toHaveLength(2);
      expect(filtered.every(dp => dp.datasetName === 'dataset-1')).toBe(true);
    });
  });

  describe('compareEvalRuns', () => {
    it('should compare baseline and candidate runs', () => {
      const baselineRuns: EvalRun[] = [
        createMockEvalRun({ metrics: { ...createMockEvalRun().metrics, accuracy: 0.8, f1_macro: 0.8, f1_micro: 0.8 } }),
      ];
      const candidateRuns: EvalRun[] = [
        createMockEvalRun({ metrics: { ...createMockEvalRun().metrics, accuracy: 0.85, f1_macro: 0.85, f1_micro: 0.85 } }),
      ];

      const comparison = compareEvalRuns(baselineRuns, candidateRuns);

      expect(comparison.differences.accuracy).toBeCloseTo(0.05);
      expect(comparison.differences.f1_macro).toBeCloseTo(0.05);
      expect(comparison.differences.f1_micro).toBeCloseTo(0.05);
    });
  });

  describe('generateDashboardReport', () => {
    it('should generate text report', () => {
      const runs: EvalRun[] = [createMockEvalRun()];
      const summary = generateDashboardSummary(runs);
      const report = generateDashboardReport(summary);

      expect(report).toContain('Classifier Evals Dashboard');
      expect(report).toContain('Total Evaluation Runs: 1');
      expect(report).toContain('Accuracy:');
    });
  });

  describe('exportDashboardData', () => {
    const dataPoints: TrendDataPoint[] = [
      { timestamp: '2024-01-01', runId: '1', datasetName: 'test', model: 'm1', metrics: { accuracy: 0.8, f1_macro: 0.8, f1_micro: 0.8, precision_macro: 0.8, recall_macro: 0.8 } },
      { timestamp: '2024-01-02', runId: '2', datasetName: 'test', model: 'm1', metrics: { accuracy: 0.85, f1_macro: 0.85, f1_micro: 0.85, precision_macro: 0.85, recall_macro: 0.85 } },
    ];

    it('should export as JSON', () => {
      const json = exportDashboardData(dataPoints, 'json');
      const parsed = JSON.parse(json);
      expect(parsed).toHaveLength(2);
    });

    it('should export as CSV', () => {
      const csv = exportDashboardData(dataPoints, 'csv');
      const lines = csv.split('\n');
      expect(lines[0]).toContain('timestamp');
      expect(lines.length).toBe(3); // header + 2 data rows
    });
  });
});
