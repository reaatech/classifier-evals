/**
 * Visualization data generation for confusion matrices and metrics
 */
import type { ClassificationResult, ConfusionMatrix } from '@reaatech/classifier-evals';

export interface HeatmapData {
  labels: string[];
  values: number[][];
  normalized: boolean;
}

export interface BarChartData {
  labels: string[];
  datasets: {
    label: string;
    data: number[];
  }[];
}

export interface PRCurveData {
  thresholds: number[];
  precision: number[];
  recall: number[];
}

/**
 * Generates heatmap data from confusion matrix
 */
export function generateHeatmapData(
  cm: ConfusionMatrix,
  normalize: 'row' | 'column' | false = false,
): HeatmapData {
  const labels = cm.labels;
  const size = labels.length;
  const values: number[][] = [];

  for (let i = 0; i < size; i++) {
    const row: number[] = [];
    const rowI = cm.matrix[i];
    for (let j = 0; j < size; j++) {
      let value = rowI?.[j] ?? 0;

      if (normalize === 'row') {
        const rowSum = (rowI ?? []).reduce((a, b) => a + (b ?? 0), 0);
        value = rowSum > 0 ? value / rowSum : 0;
      } else if (normalize === 'column') {
        let colSum = 0;
        for (let k = 0; k < size; k++) {
          colSum += cm.matrix[k]?.[j] ?? 0;
        }
        value = colSum > 0 ? value / colSum : 0;
      }

      row.push(Math.round(value * 10000) / 10000);
    }
    values.push(row);
  }

  return {
    labels,
    values,
    normalized: normalize !== false,
  };
}

/**
 * Generates bar chart data for per-class metrics
 */
export function generateMetricsBarChart(cm: ConfusionMatrix): BarChartData {
  const labels = cm.labels;
  const precision = cm.per_class.map((c) => c?.precision ?? 0);
  const recall = cm.per_class.map((c) => c?.recall ?? 0);
  const f1 = cm.per_class.map((c) => c?.f1 ?? 0);

  return {
    labels,
    datasets: [
      { label: 'Precision', data: precision },
      { label: 'Recall', data: recall },
      { label: 'F1', data: f1 },
    ],
  };
}

/**
 * Generates PR curve data from samples with confidence scores
 */
export function generatePRCurveData(
  samples: ClassificationResult[],
  positiveLabel: string,
): PRCurveData {
  const scoredSamples = samples
    .filter((s): s is ClassificationResult & { confidence: number } => s.confidence !== undefined)
    .map((s) => ({
      confidence: s.confidence,
      isPositive: s.label === positiveLabel,
    }))
    .sort((a, b) => b.confidence - a.confidence);

  if (scoredSamples.length === 0) {
    return { thresholds: [], precision: [], recall: [] };
  }

  const totalPositives = scoredSamples.filter((s) => s.isPositive).length;
  if (totalPositives === 0) {
    return { thresholds: [], precision: [], recall: [] };
  }

  const thresholds: number[] = [];
  const precision: number[] = [];
  const recall: number[] = [];

  let tp = 0;
  let fp = 0;

  // Start with all samples classified as negative
  thresholds.push(1.0);
  precision.push(1.0);
  recall.push(0.0);

  for (const sample of scoredSamples) {
    // Threshold sweep: every sample at or above this confidence is classified as positive
    if (sample.isPositive) {
      tp++;
    } else {
      fp++;
    }

    const p = tp + fp > 0 ? tp / (tp + fp) : 0;
    const r = tp / totalPositives;

    thresholds.push(sample.confidence);
    precision.push(Math.round(p * 10000) / 10000);
    recall.push(Math.round(r * 10000) / 10000);
  }

  return { thresholds, precision, recall };
}
