/**
 * Structured logging for classifier-evals using Pino
 */
import pino from 'pino';

const LOG_LEVEL = process.env.LOG_LEVEL ?? 'info';

/**
 * Creates a Pino logger instance
 */
const logger = pino({
  level: LOG_LEVEL,
  formatters: {
    level: (label) => ({ level: label }),
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  redact: {
    paths: [
      '*.password', '*.secret', '*.key', '*.token', '*.apiKey',
      '*.api_key', '*.authorization', '*.bearer', '*.credential',
      '*.private_key', '*.access_token', '*.refresh_token', '*.secret_key',
    ],
    censor: '[REDACTED]',
  },
});

/**
 * Sets the eval run ID for context
 */
let currentEvalRunId: string | undefined;

export function setEvalRunId(runId: string): void {
  try {
    currentEvalRunId = runId;
  } catch { /* swallow */ }
}

export function getEvalRunId(): string | undefined {
  try {
    return currentEvalRunId;
  } catch { return undefined; }
}

/**
 * Logs evaluation start
 */
export function logEvalStart(dataset: string, samples: number, model?: string): void {
  try {
    logger.info({
      service: 'classifier-evals',
      eval_run_id: currentEvalRunId,
      event: 'eval.start',
      dataset,
      samples,
      model,
    }, 'Evaluation started');
  } catch { return; }
}

/**
 * Logs evaluation completion
 */
export function logEvalComplete(
  accuracy: number,
  f1Macro: number,
  cost?: number,
  gatesPassed?: boolean
): void {
  try {
    logger.info({
      service: 'classifier-evals',
      eval_run_id: currentEvalRunId,
      event: 'eval.complete',
      accuracy,
      f1_macro: f1Macro,
      judge_cost: cost,
      gates_passed: gatesPassed,
    }, 'Evaluation completed');
  } catch { return; }
}

/**
 * Logs gate evaluation result
 */
export function logGateResult(gateName: string, passed: boolean, reason?: string): void {
  try {
    logger.info({
      service: 'classifier-evals',
      eval_run_id: currentEvalRunId,
      event: 'gate.result',
      gate_name: gateName,
      passed,
      reason,
    }, `Gate ${gateName}: ${passed ? 'PASSED' : 'FAILED'}`);
  } catch { return; }
}

/**
 * Logs judge cost update
 */
export function logJudgeCost(
  model: string,
  samplesProcessed: number,
  totalCost: number,
  budgetLimit?: number
): void {
  try {
    logger.info({
      service: 'classifier-evals',
      eval_run_id: currentEvalRunId,
      event: 'judge.cost',
      model,
      samples_processed: samplesProcessed,
      total_cost: totalCost,
      budget_limit: budgetLimit,
    }, `Judge cost: $${totalCost.toFixed(4)}`);
  } catch { return; }
}

/**
 * Logs dataset load
 */
export function logDatasetLoad(format: string, path: string, rows: number): void {
  try {
    logger.info({
      service: 'classifier-evals',
      eval_run_id: currentEvalRunId,
      event: 'dataset.load',
      format,
      path,
      rows,
    }, `Dataset loaded: ${rows} rows from ${path}`);
  } catch { return; }
}

/**
 * Logs an error
 */
export function logError(error: Error, context?: Record<string, unknown>): void {
  try {
    logger.error(
      {
        service: 'classifier-evals',
        eval_run_id: currentEvalRunId,
        event: 'error',
        error: error.message,
        stack: error.stack,
        ...context,
      },
      'Error occurred'
    );
  } catch { return; }
}

/**
 * Logs a warning
 */
export function logWarn(message: string, context?: Record<string, unknown>): void {
  try {
    logger.warn(
      {
        service: 'classifier-evals',
        eval_run_id: currentEvalRunId,
        event: 'warn',
        ...context,
      },
      message
    );
  } catch { return; }
}

export { logger };
