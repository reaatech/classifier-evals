/**
 * Phoenix Exporter - Arize Phoenix export
 */

import { randomUUID } from 'node:crypto';
import { logger } from '@reaatech/classifier-evals';
import type { EvalRun, ExportResult } from '@reaatech/classifier-evals';
import { redactObjectPII } from '@reaatech/classifier-evals';

export interface PhoenixExportOptions {
  /** Phoenix endpoint URL */
  endpoint?: string;
  /** Dataset name in Phoenix */
  datasetName?: string;
  /** API key for Phoenix */
  apiKey?: string;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

export interface PhoenixExportInput {
  evalRun: EvalRun;
  options?: PhoenixExportOptions;
}

interface PhoenixSpan {
  name: string;
  span_id: string;
  trace_id: string;
  parent_id?: string;
  start_time: number;
  end_time: number;
  attributes: Record<string, unknown>;
}

interface PhoenixTrace {
  trace_id: string;
  spans: PhoenixSpan[];
}

async function sendToPhoenix(
  endpoint: string,
  apiKey: string | undefined,
  datasetName: string,
  traces: PhoenixTrace[],
): Promise<void> {
  const url = `${endpoint}/api/traces`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (apiKey !== undefined && apiKey !== '') {
    headers.Authorization = `Bearer ${apiKey}`;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        dataset_name: datasetName,
        traces,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new Error(
        `Phoenix API error: ${response.status} ${response.statusText}${body !== '' ? ` - ${body}` : ''}`,
      );
    }
  } finally {
    clearTimeout(timeout);
  }
}

export async function exportToPhoenix(input: PhoenixExportInput): Promise<ExportResult> {
  const { evalRun, options = {} } = input;
  const {
    endpoint = 'http://localhost:6006',
    datasetName = 'classifier-evals',
    apiKey = process.env.PHOENIX_API_KEY,
    metadata = {},
  } = options;

  try {
    const traceId = `eval-${evalRun.run_id}`;
    const spanId = randomUUID();

    const startTimeNs = evalRun.started_at
      ? new Date(evalRun.started_at).getTime() * 1_000_000
      : Date.now() * 1_000_000;
    const endTimeNs = evalRun.completed_at
      ? new Date(evalRun.completed_at).getTime() * 1_000_000
      : startTimeNs + (evalRun.duration_ms ?? 0) * 1_000_000;

    const span: PhoenixSpan = {
      name: 'classifier-evaluation',
      span_id: spanId,
      trace_id: traceId,
      start_time: startTimeNs,
      end_time: endTimeNs,
      attributes: {
        'dataset.name': datasetName,
        'dataset.path': evalRun.dataset_path,
        'dataset.total_samples': evalRun.total_samples,
        'eval.run_id': evalRun.run_id,
        'metrics.accuracy': evalRun.metrics.accuracy,
        'metrics.f1_macro': evalRun.metrics.f1_macro,
        'metrics.f1_micro': evalRun.metrics.f1_micro,
        'metrics.precision_macro': evalRun.metrics.precision_macro,
        'metrics.precision_micro': evalRun.metrics.precision_micro,
        'metrics.precision_weighted': evalRun.metrics.precision_weighted,
        'metrics.recall_macro': evalRun.metrics.recall_macro,
        'metrics.recall_micro': evalRun.metrics.recall_micro,
        'metrics.recall_weighted': evalRun.metrics.recall_weighted,
        'metrics.f1_weighted': evalRun.metrics.f1_weighted,
        'metrics.matthews_correlation': evalRun.metrics.matthews_correlation,
        'metrics.cohens_kappa': evalRun.metrics.cohens_kappa,
        'metrics.total_samples': evalRun.metrics.total_samples,
        'metrics.correct_predictions': evalRun.metrics.correct_predictions,
        ...redactObjectPII(metadata),
      },
    };

    const cm = evalRun.confusion_matrix;
    span.attributes['confusion_matrix.labels'] = cm.labels;
    span.attributes['confusion_matrix.num_classes'] = cm.labels.length;

    const trace: PhoenixTrace = {
      trace_id: traceId,
      spans: [span],
    };

    await sendToPhoenix(endpoint, apiKey, datasetName, [trace]);

    logger.info(
      {
        runId: evalRun.run_id,
        endpoint,
        datasetName,
      },
      'Phoenix export completed',
    );

    return {
      success: true,
      target_type: 'phoenix',
      exported_at: new Date().toISOString(),
      location: endpoint,
    };
  } catch (error) {
    const err = error as Error;
    logger.error(
      {
        runId: evalRun.run_id,
        error: err.message,
      },
      'Phoenix export failed',
    );

    return {
      success: false,
      target_type: 'phoenix',
      exported_at: new Date().toISOString(),
      error: err.message,
    };
  }
}
