/**
 * Dashboard Metrics for classifier-evals
 * Provides historical tracking and trend analysis for evaluation runs
 */

import type { EvalRun } from './domain.js';

/**
 * Historical data point for trend analysis
 */
export interface TrendDataPoint {
  timestamp: string;
  runId: string;
  datasetName?: string;
  model?: string;
  metrics: {
    accuracy: number;
    f1_macro: number;
    f1_micro: number;
    precision_macro: number;
    recall_macro: number;
  };
  cost?: {
    total: number;
    per_sample: number;
  };
  gateResults?: {
    passed: boolean;
    passedCount: number;
    totalCount: number;
  };
}

/**
 * Aggregated trend statistics
 */
export interface TrendStatistics {
  metric: string;
  values: number[];
  timestamps: string[];
  min: number;
  max: number;
  mean: number;
  median: number;
  stdDev: number;
  trend: 'improving' | 'declining' | 'stable';
  changeRate: number;
}

/**
 * Dashboard summary for a set of evaluation runs
 */
export interface DashboardSummary {
  totalRuns: number;
  dateRange: {
    start: string;
    end: string;
  };
  models: string[];
  datasets: string[];
  latestRun?: TrendDataPoint;
  bestRun?: TrendDataPoint;
  worstRun?: TrendDataPoint;
  averageMetrics: {
    accuracy: number;
    f1_macro: number;
    f1_micro: number;
  };
  gatePassRate: number;
  totalCost: number;
  avgCostPerRun: number;
}

/**
 * Configuration for dashboard metrics
 */
export interface DashboardConfig {
  /** Number of days to include in trends */
  trendWindowDays: number;
  /** Minimum number of data points for trend analysis */
  minDataPoints: number;
  /** Threshold for considering a trend as improving/declining */
  trendThreshold: number;
}

/**
 * Default dashboard configuration
 */
export const DEFAULT_DASHBOARD_CONFIG: DashboardConfig = {
  trendWindowDays: 30,
  minDataPoints: 3,
  trendThreshold: 0.05,
};

/**
 * Convert an EvalRun to a TrendDataPoint
 */
export function evalRunToTrendDataPoint(run: EvalRun): TrendDataPoint {
  return {
    timestamp: run.started_at,
    runId: run.run_id,
    datasetName: run.dataset_name,
    model: run.metadata?.model as string | undefined,
    metrics: {
      accuracy: run.metrics.accuracy,
      f1_macro: run.metrics.f1_macro,
      f1_micro: run.metrics.f1_micro,
      precision_macro: run.metrics.precision_macro,
      recall_macro: run.metrics.recall_macro,
    },
    cost:
      run.judge_cost !== undefined
        ? {
            total: run.judge_cost,
            per_sample: run.total_samples > 0 ? run.judge_cost / run.total_samples : 0,
          }
        : undefined,
    gateResults: run.gate_results
      ? {
          passed: run.all_gates_passed ?? false,
          passedCount: run.gate_results.filter((g) => g.passed).length,
          totalCount: run.gate_results.length,
        }
      : undefined,
  };
}

/**
 * Calculate trend statistics for a specific metric
 */
export function calculateTrendStatistics(
  dataPoints: TrendDataPoint[],
  metricKey: keyof TrendDataPoint['metrics'],
  config: DashboardConfig = DEFAULT_DASHBOARD_CONFIG,
): TrendStatistics | null {
  if (dataPoints.length < config.minDataPoints) {
    return null;
  }

  const values = dataPoints.map((dp) => dp.metrics[metricKey]);
  const timestamps = dataPoints.map((dp) => dp.timestamp);

  const sortedValues = [...values].sort((a, b) => a - b);
  const min = sortedValues[0]!;
  const max = sortedValues[sortedValues.length - 1]!;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const median =
    sortedValues.length % 2 === 0
      ? (sortedValues[sortedValues.length / 2 - 1]! + sortedValues[sortedValues.length / 2]!) / 2
      : sortedValues[Math.floor(sortedValues.length / 2)]!;

  const variance = values.reduce((sum, val) => sum + (val - mean) ** 2, 0) / values.length;
  const stdDev = Math.sqrt(variance);

  // Calculate trend using linear regression slope
  const n = values.length;
  const xMean = (n - 1) / 2;
  const slope =
    values.reduce((sum, y, i) => sum + (i - xMean) * (y - mean), 0) /
    values.reduce((sum, _, i) => sum + (i - xMean) ** 2, 0);

  const changeRate = slope;
  let trend: 'improving' | 'declining' | 'stable';
  if (slope > config.trendThreshold) {
    trend = 'improving';
  } else if (slope < -config.trendThreshold) {
    trend = 'declining';
  } else {
    trend = 'stable';
  }

  return {
    metric: metricKey,
    values,
    timestamps,
    min,
    max,
    mean,
    median,
    stdDev,
    trend,
    changeRate,
  };
}

/**
 * Generate a dashboard summary from multiple evaluation runs
 */
export function generateDashboardSummary(runs: EvalRun[]): DashboardSummary {
  if (runs.length === 0) {
    return {
      totalRuns: 0,
      dateRange: { start: '', end: '' },
      models: [],
      datasets: [],
      averageMetrics: { accuracy: 0, f1_macro: 0, f1_micro: 0 },
      gatePassRate: 0,
      totalCost: 0,
      avgCostPerRun: 0,
    };
  }

  const dataPoints = runs
    .map(evalRunToTrendDataPoint)
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  const models = [
    ...new Set(runs.map((r) => r.metadata?.model as string).filter(Boolean)),
  ] as string[];
  const datasets = [...new Set(runs.map((r) => r.dataset_name).filter(Boolean))] as string[];

  const latestRun = dataPoints[dataPoints.length - 1];
  const bestRun = [...dataPoints].sort((a, b) => b.metrics.accuracy - a.metrics.accuracy)[0];
  const worstRun = [...dataPoints].sort((a, b) => a.metrics.accuracy - b.metrics.accuracy)[0];

  const avgAccuracy =
    dataPoints.reduce((sum, dp) => sum + dp.metrics.accuracy, 0) / dataPoints.length;
  const avgF1Macro =
    dataPoints.reduce((sum, dp) => sum + dp.metrics.f1_macro, 0) / dataPoints.length;
  const avgF1Micro =
    dataPoints.reduce((sum, dp) => sum + dp.metrics.f1_micro, 0) / dataPoints.length;

  const gateResults = runs.filter((r) => r.gate_results);
  const gatePassCount = gateResults.filter((r) => r.all_gates_passed === true).length;
  const gatePassRate = gateResults.length > 0 ? gatePassCount / gateResults.length : 0;

  const totalCost = runs.reduce((sum, r) => sum + (r.judge_cost ?? 0), 0);

  return {
    totalRuns: runs.length,
    dateRange: {
      start: dataPoints[0]?.timestamp ?? '',
      end: dataPoints[dataPoints.length - 1]?.timestamp ?? '',
    },
    models,
    datasets,
    latestRun,
    bestRun,
    worstRun,
    averageMetrics: {
      accuracy: avgAccuracy,
      f1_macro: avgF1Macro,
      f1_micro: avgF1Micro,
    },
    gatePassRate,
    totalCost,
    avgCostPerRun: totalCost / runs.length,
  };
}

/**
 * Filter data points by date range
 */
export function filterByDateRange(dataPoints: TrendDataPoint[], days: number): TrendDataPoint[] {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);

  return dataPoints.filter((dp) => new Date(dp.timestamp).getTime() >= cutoff.getTime());
}

/**
 * Filter data points by model
 */
export function filterByModel(dataPoints: TrendDataPoint[], model: string): TrendDataPoint[] {
  return dataPoints.filter((dp) => dp.model === model);
}

/**
 * Filter data points by dataset
 */
export function filterByDataset(
  dataPoints: TrendDataPoint[],
  datasetName: string,
): TrendDataPoint[] {
  return dataPoints.filter((dp) => dp.datasetName === datasetName);
}

/**
 * Compare two sets of evaluation runs (e.g., baseline vs candidate)
 */
export function compareEvalRuns(
  baselineRuns: EvalRun[],
  candidateRuns: EvalRun[],
): {
  baseline: DashboardSummary;
  candidate: DashboardSummary;
  differences: {
    accuracy: number;
    f1_macro: number;
    f1_micro: number;
    gatePassRate: number;
    cost: number;
  };
} {
  const baseline = generateDashboardSummary(baselineRuns);
  const candidate = generateDashboardSummary(candidateRuns);

  return {
    baseline,
    candidate,
    differences: {
      accuracy: candidate.averageMetrics.accuracy - baseline.averageMetrics.accuracy,
      f1_macro: candidate.averageMetrics.f1_macro - baseline.averageMetrics.f1_macro,
      f1_micro: candidate.averageMetrics.f1_micro - baseline.averageMetrics.f1_micro,
      gatePassRate: candidate.gatePassRate - baseline.gatePassRate,
      cost: candidate.totalCost - baseline.totalCost,
    },
  };
}

/**
 * Generate a text report of dashboard metrics
 */
export function generateDashboardReport(summary: DashboardSummary): string {
  const lines: string[] = [];

  lines.push('=== Classifier Evals Dashboard ===');
  lines.push('');
  lines.push(`Total Evaluation Runs: ${summary.totalRuns}`);
  lines.push(`Date Range: ${summary.dateRange.start} to ${summary.dateRange.end}`);
  lines.push('');

  if (summary.models.length > 0) {
    lines.push(`Models: ${summary.models.join(', ')}`);
  }
  if (summary.datasets.length > 0) {
    lines.push(`Datasets: ${summary.datasets.join(', ')}`);
  }
  lines.push('');

  lines.push('--- Average Metrics ---');
  lines.push(`Accuracy: ${(summary.averageMetrics.accuracy * 100).toFixed(2)}%`);
  lines.push(`Macro F1: ${(summary.averageMetrics.f1_macro * 100).toFixed(2)}%`);
  lines.push(`Micro F1: ${(summary.averageMetrics.f1_micro * 100).toFixed(2)}%`);
  lines.push('');

  if (summary.latestRun) {
    lines.push('--- Latest Run ---');
    lines.push(`Run ID: ${summary.latestRun.runId}`);
    lines.push(`Timestamp: ${summary.latestRun.timestamp}`);
    lines.push(`Accuracy: ${(summary.latestRun.metrics.accuracy * 100).toFixed(2)}%`);
    lines.push(`Macro F1: ${(summary.latestRun.metrics.f1_macro * 100).toFixed(2)}%`);
    lines.push('');
  }

  if (summary.bestRun) {
    lines.push('--- Best Run ---');
    lines.push(`Run ID: ${summary.bestRun.runId}`);
    lines.push(`Accuracy: ${(summary.bestRun.metrics.accuracy * 100).toFixed(2)}%`);
    lines.push('');
  }

  lines.push(`Gate Pass Rate: ${(summary.gatePassRate * 100).toFixed(2)}%`);
  lines.push(`Total Cost: $${summary.totalCost.toFixed(4)}`);
  lines.push(`Average Cost per Run: $${summary.avgCostPerRun.toFixed(4)}`);

  return lines.join('\n');
}

/**
 * Export dashboard data for external visualization
 */
export function exportDashboardData(
  dataPoints: TrendDataPoint[],
  format: 'json' | 'csv' = 'json',
): string {
  if (format === 'json') {
    return JSON.stringify(dataPoints, null, 2);
  }

  // CSV export
  const headers = [
    'timestamp',
    'run_id',
    'dataset_name',
    'model',
    'accuracy',
    'f1_macro',
    'f1_micro',
    'precision_macro',
    'recall_macro',
    'cost_total',
    'cost_per_sample',
    'gate_passed',
    'gate_passed_count',
    'gate_total_count',
  ];

  const rows = dataPoints.map((dp) => [
    dp.timestamp,
    dp.runId,
    dp.datasetName ?? '',
    dp.model ?? '',
    dp.metrics.accuracy.toString(),
    dp.metrics.f1_macro.toString(),
    dp.metrics.f1_micro.toString(),
    dp.metrics.precision_macro.toString(),
    dp.metrics.recall_macro.toString(),
    (dp.cost?.total ?? '').toString(),
    (dp.cost?.per_sample ?? '').toString(),
    (dp.gateResults?.passed ?? '').toString(),
    (dp.gateResults?.passedCount ?? '').toString(),
    (dp.gateResults?.totalCount ?? '').toString(),
  ]);

  return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
}
