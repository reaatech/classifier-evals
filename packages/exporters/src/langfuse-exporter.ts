/**
 * Langfuse Exporter - Langfuse observability export
 */

import { randomUUID } from 'node:crypto';
import { logger } from '@reaatech/classifier-evals';
import type { EvalRun, ExportResult } from '@reaatech/classifier-evals';

export interface LangfuseExportOptions {
  /** Langfuse public key */
  publicKey?: string;
  /** Langfuse secret key */
  secretKey?: string;
  /** Langfuse base URL */
  baseUrl?: string;
  /** Trace name */
  traceName?: string;
  /** Session ID for grouping */
  sessionId?: string;
}

export interface LangfuseExportInput {
  evalRun: EvalRun;
  options?: LangfuseExportOptions;
}

interface LangfuseEvent {
  id: string;
  type: 'trace-create';
  timestamp: string;
  body: {
    id: string;
    name: string;
    sessionId?: string;
    input: Record<string, unknown>;
    output: Record<string, unknown>;
    metadata: Record<string, unknown>;
  };
}

async function sendToLangfuse(
  baseUrl: string,
  publicKey: string,
  secretKey: string,
  events: LangfuseEvent[],
): Promise<void> {
  const url = `${baseUrl}/api/public/ingestion`;
  const authHeader = Buffer.from(`${publicKey}:${secretKey}`).toString('base64');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${authHeader}`,
      },
      body: JSON.stringify({
        batch: events,
      }),
      signal: controller.signal as AbortSignal,
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new Error(
        `Langfuse API error: ${response.status} ${response.statusText}${body !== '' ? ` - ${body}` : ''}`,
      );
    }
  } finally {
    clearTimeout(timeout);
  }
}

export async function exportToLangfuse(input: LangfuseExportInput): Promise<ExportResult> {
  const { evalRun, options = {} } = input;
  const {
    publicKey = process.env.LANGFUSE_PUBLIC_KEY,
    secretKey = process.env.LANGFUSE_SECRET_KEY,
    baseUrl = process.env.LANGFUSE_BASE_URL ?? 'https://cloud.langfuse.com',
    traceName = 'classifier-evaluation',
    sessionId,
  } = options;

  try {
    if (
      publicKey === undefined ||
      publicKey === '' ||
      secretKey === undefined ||
      secretKey === ''
    ) {
      logger.warn({ runId: evalRun.run_id }, 'Langfuse keys not configured, export skipped');

      return {
        success: false,
        target_type: 'langfuse',
        exported_at: new Date().toISOString(),
        error: 'Langfuse keys not configured',
        location: baseUrl,
      };
    }

    const traceId = randomUUID();
    const timestamp = new Date().toISOString();

    const event: LangfuseEvent = {
      id: randomUUID(),
      type: 'trace-create',
      timestamp,
      body: {
        id: traceId,
        name: traceName,
        sessionId: sessionId ?? `eval-${evalRun.run_id}`,
        input: {
          dataset_path: evalRun.dataset_path,
          total_samples: evalRun.total_samples,
        },
        output: {
          metrics: evalRun.metrics,
          all_gates_passed: evalRun.all_gates_passed,
        },
        metadata: {
          duration_ms: evalRun.duration_ms,
          run_id: evalRun.run_id,
          confusion_matrix_labels: evalRun.confusion_matrix?.labels,
          confusion_matrix_num_classes: evalRun.confusion_matrix?.labels?.length,
        },
      },
    };

    await sendToLangfuse(baseUrl, publicKey, secretKey, [event]);

    logger.info(
      {
        runId: evalRun.run_id,
        baseUrl,
        traceName,
      },
      'Langfuse export completed',
    );

    return {
      success: true,
      target_type: 'langfuse',
      exported_at: new Date().toISOString(),
      location: baseUrl,
    };
  } catch (error) {
    const err = error as Error;
    logger.error(
      {
        runId: evalRun.run_id,
        error: err.message,
      },
      'Langfuse export failed',
    );

    return {
      success: false,
      target_type: 'langfuse',
      exported_at: new Date().toISOString(),
      error: err.message,
    };
  }
}
