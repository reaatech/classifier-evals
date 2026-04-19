/**
 * Evaluation run helpers for building and loading eval artifacts.
 */

import { randomUUID } from 'crypto';
import { readFileSync } from 'fs';
import path from 'path';
import YAML from 'yaml';
import { buildConfusionMatrix } from '../metrics/confusion-matrix.js';
import { calculateAllMetrics } from '../metrics/classification-metrics.js';
import type {
  ClassificationResult,
  EvalRun,
  GateResult,
  JudgedResult,
  RegressionGate,
} from '../types/index.js';

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

function buildDistributionMetadata(
  samples: ClassificationResult[]
): Record<string, unknown> {
  const labelDistribution: Record<string, number> = {};
  const predictionDistribution: Record<string, number> = {};

  for (const sample of samples) {
    labelDistribution[sample.label] = (labelDistribution[sample.label] ?? 0) + 1;
    predictionDistribution[sample.predicted_label] =
      (predictionDistribution[sample.predicted_label] ?? 0) + 1;
  }

  const totalSamples = samples.length || 1;
  const unknownCount =
    (predictionDistribution.unknown ?? 0) +
    (predictionDistribution.UNKNOWN ?? 0);

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

export function createEvalRunFromSamples(
  options: EvalRunBuildOptions
): EvalRun {
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

export function loadEvalRunFromFile(filePath: string): EvalRun {
  try {
    return JSON.parse(readFileSync(filePath, 'utf8')) as EvalRun;
  } catch (err) {
    throw new Error(`Failed to load eval run from file: ${filePath}: ${(err as Error).message}`);
  }
}

export function normalizeRegressionGate(
  gate: Record<string, unknown>
): RegressionGate {
  return {
    name: String(gate.name ?? 'unnamed-gate'),
    type: gate.type as RegressionGate['type'],
    metric: typeof gate.metric === 'string' ? gate.metric : undefined,
    operator:
      gate.operator === '>=' ||
      gate.operator === '<=' ||
      gate.operator === '>' ||
      gate.operator === '<' ||
      gate.operator === '=='
        ? gate.operator
        : undefined,
    threshold: typeof gate.threshold === 'number' ? gate.threshold : undefined,
    baseline_path:
      typeof gate.baseline_path === 'string'
        ? gate.baseline_path
        : typeof gate.baseline === 'string'
          ? gate.baseline
          : undefined,
    allow_regression_in:
      typeof gate.allow_regression_in === 'number'
        ? gate.allow_regression_in
        : undefined,
    description:
      typeof gate.description === 'string' ? gate.description : undefined,
  };
}

export function loadRegressionGatesFromFile(filePath: string): RegressionGate[] {
  const parsed = YAML.parse(readFileSync(filePath, 'utf8')) as
    | { gates?: Record<string, unknown>[] }
    | Record<string, unknown>[]
    | undefined;

  const gates = Array.isArray(parsed)
    ? parsed
    : Array.isArray(parsed?.gates)
      ? parsed.gates
      : undefined;

  if (!gates) {
    throw new Error(`No valid gates array found in: ${filePath}`);
  }

  return gates.map((gate) => normalizeRegressionGate(gate));
}
