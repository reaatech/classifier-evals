/**
 * JSON Exporter - Machine-readable export format
 */

import { logger } from '@reaatech/classifier-evals';
import type { EvalRun, ExportResult } from '@reaatech/classifier-evals';
import { redactObjectPII } from '@reaatech/classifier-evals';

export interface JsonExportOptions {
  /** Include raw sample data (default: false for PII safety) */
  includeSamples?: boolean;
  /** Include per-class breakdown (default: true) */
  includePerClass?: boolean;
  /** Include visualization data (default: false) */
  includeVisualizationData?: boolean;
}

export interface JsonExportInput {
  evalRun: EvalRun;
  options?: JsonExportOptions;
}

export function exportToJson(input: JsonExportInput): ExportResult {
  const { evalRun, options = {} } = input;
  const {
    includeSamples = false,
    // includePerClass and includeVisualizationData are reserved for future use
  } = options;

  try {
    // Build export payload
    const payload: Record<string, unknown> = {
      run_id: evalRun.run_id,
      dataset_name: evalRun.dataset_name,
      dataset_path: evalRun.dataset_path,
      total_samples: evalRun.total_samples,
      duration_ms: evalRun.duration_ms,
      started_at: evalRun.started_at,
      completed_at: evalRun.completed_at,
      metrics: evalRun.metrics,
    };

    // Include confusion matrix
    payload.confusion_matrix = {
      labels: evalRun.confusion_matrix.labels,
      matrix: evalRun.confusion_matrix.matrix,
      per_class: evalRun.confusion_matrix.per_class,
    };

    // Include gate results if present
    if (evalRun.gate_results) {
      payload.gate_results = evalRun.gate_results;
    }

    // Include all_gates_passed if present
    if (evalRun.all_gates_passed !== undefined) {
      payload.all_gates_passed = evalRun.all_gates_passed;
    }

    if (evalRun.metadata) {
      payload.metadata = redactObjectPII(evalRun.metadata);
    }

    // Include judge results summary if present
    if (evalRun.judged_results && evalRun.judged_results.length > 0) {
      const judged = evalRun.judged_results;
      const totalCost = evalRun.judge_cost ?? 0;
      payload.judged_results = {
        samples_judged: judged.length,
        total_cost: totalCost,
        avg_cost_per_sample: judged.length > 0 ? totalCost / judged.length : 0,
      };
    }

    // Include samples only if explicitly requested (PII consideration)
    if (includeSamples) {
      // Note: samples are not directly in EvalRun type, would need to be passed separately
      payload.include_samples_note = 'Samples not included in EvalRun type';
    }

    const json = JSON.stringify(payload, null, 2);

    logger.info(
      {
        runId: evalRun.run_id,
        payloadSize: json.length,
      },
      'JSON export completed',
    );

    return {
      success: true,
      target_type: 'json',
      location: 'stdout',
      exported_at: new Date().toISOString(),
      json,
    };
  } catch (error) {
    const err = error as Error;
    logger.error(
      {
        runId: evalRun.run_id,
        error: err.message,
      },
      'JSON export failed',
    );

    return {
      success: false,
      target_type: 'json',
      error: err.message,
      exported_at: new Date().toISOString(),
    };
  }
}
