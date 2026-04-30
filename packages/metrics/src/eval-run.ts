import { randomUUID } from 'crypto';
import path from 'path';
import { buildConfusionMatrix } from './confusion-matrix.js';
import { calculateAllMetrics } from './classification-metrics.js';
import type { ClassificationResult, EvalRun, JudgedResult, GateResult } from '@reaatech/classifier-evals';

export interface EvalRunBuildOptions {
  datasetPath?: string;
  datasetName?: string;
  samples: ClassificationResult[];
  judgedResults?: JudgedResult[];
  judgeCost?: number;
  gateResults?: GateResult[];
  startedAt?: Date;
  completedAt?: Date;
  metadata?: Record<string, unknown>;
}

export function buildDistributionMetadata(samples: ClassificationResult[]): Record<string, unknown> {
  const labelDistribution: Record<string, number> = {};
  const predictionDistribution: Record<string, number> = {};

  for (const sample of samples) {
    labelDistribution[sample.label] = (labelDistribution[sample.label] ?? 0) + 1;
    predictionDistribution[sample.predicted_label] =
      (predictionDistribution[sample.predicted_label] ?? 0) + 1;
  }

  const totalSamples = samples.length || 1;
  const unknownCount =
    (predictionDistribution.unknown ?? 0) + (predictionDistribution.UNKNOWN ?? 0);

  return {
    label_distribution: labelDistribution,
    prediction_distribution: predictionDistribution,
    distribution_metrics: {
      unknown_rate: unknownCount / totalSamples,
      label_cardinality: Object.keys(labelDistribution).length,
      prediction_cardinality: Object.keys(predictionDistribution).length,
    },
  };
}

export function createEvalRunFromSamples(options: EvalRunBuildOptions): EvalRun {
  const startedAt = options.startedAt ?? new Date();
  const completedAt = options.completedAt ?? new Date();
  const confusionMatrix = buildConfusionMatrix(options.samples);
  const metrics = calculateAllMetrics(options.samples);
  const metadata = {
    ...buildDistributionMetadata(options.samples),
    ...(options.metadata ?? {}),
  };

  return {
    run_id: randomUUID(),
    dataset_name:
      options.datasetName ??
      (options.datasetPath !== undefined && options.datasetPath !== ''
        ? path.basename(options.datasetPath)
        : undefined),
    dataset_path: options.datasetPath,
    total_samples: options.samples.length,
    confusion_matrix: confusionMatrix,
    metrics,
    judged_results: options.judgedResults,
    judge_cost: options.judgeCost,
    gate_results: options.gateResults?.map((result) => ({
      name: result.gate.name,
      passed: result.passed,
      message: result.message,
    })),
    all_gates_passed:
      options.gateResults !== undefined
        ? options.gateResults.every((result) => result.passed)
        : undefined,
    started_at: startedAt.toISOString(),
    completed_at: completedAt.toISOString(),
    duration_ms: completedAt.getTime() - startedAt.getTime(),
    metadata,
  };
}
