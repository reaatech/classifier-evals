/**
 * OpenTelemetry metrics for classifier-evals
 */
import {
  MeterProvider,
  MetricReader,
  PeriodicExportingMetricReader,
} from '@opentelemetry/sdk-metrics';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-grpc';
import { Counter, Histogram, Gauge, Meter } from '@opentelemetry/api';

const METER_NAME = 'classifier-evals';

let meterProvider: MeterProvider | undefined;
let meter: Meter | undefined;

// Metric instruments
let runsTotalCounter: Counter | undefined;
let samplesEvaluatedCounter: Counter | undefined;
let judgeCallsCounter: Counter | undefined;
let judgeCostHistogram: Histogram | undefined;
let gatesResultGauge: Gauge | undefined;
let accuracyGauge: Gauge | undefined;
let f1MacroGauge: Gauge | undefined;

/**
 * Initializes the metrics system
 */
export function initMetrics(exporter?: OTLPMetricExporter): void {
  if (meterProvider) {
    return;
  }

  const readers: MetricReader[] = [];

  if (exporter) {
    readers.push(new PeriodicExportingMetricReader({ exporter }));
  }

  meterProvider = new MeterProvider({ readers });
  meter = meterProvider.getMeter(METER_NAME);

  // Create metric instruments
  runsTotalCounter = meter.createCounter('classifier_evals.runs.total', {
    description: 'Total number of evaluation runs',
  });

  samplesEvaluatedCounter = meter.createCounter('classifier_evals.samples.evaluated', {
    description: 'Number of samples processed',
  });

  judgeCallsCounter = meter.createCounter('classifier_evals.judge.calls', {
    description: 'Number of LLM judge API calls',
  });

  judgeCostHistogram = meter.createHistogram('classifier_evals.judge.cost', {
    description: 'Cost of LLM judging per run',
    unit: 'USD',
  });

  gatesResultGauge = meter.createGauge('classifier_evals.gates.result', {
    description: 'Gate pass/fail result (1=pass, 0=fail)',
  });

  accuracyGauge = meter.createGauge('classifier_evals.metrics.accuracy', {
    description: 'Overall accuracy metric',
  });

  f1MacroGauge = meter.createGauge('classifier_evals.metrics.f1_macro', {
    description: 'Macro F1 score metric',
  });
}

/**
 * Records an evaluation run
 */
export function recordEvalRun(status: 'success' | 'failure' = 'success'): void {
  runsTotalCounter?.add(1, { status });
}

/**
 * Records samples evaluated
 */
export function recordSamplesEvaluated(dataset: string, count: number): void {
  samplesEvaluatedCounter?.add(count, { dataset });
}

/**
 * Records LLM judge API call
 */
export function recordJudgeCall(model: string, status: 'success' | 'failure'): void {
  judgeCallsCounter?.add(1, { model, status });
}

/**
 * Records judge cost
 */
export function recordJudgeCost(model: string, cost: number): void {
  judgeCostHistogram?.record(cost, { model });
}

/**
 * Records gate result
 */
export function recordGateResult(gateName: string, passed: boolean): void {
  gatesResultGauge?.record(passed ? 1 : 0, { gate_name: gateName });
}

/**
 * Records accuracy metric
 */
export function recordAccuracy(dataset: string, value: number): void {
  accuracyGauge?.record(value, { dataset });
}

/**
 * Records F1 macro metric
 */
export function recordF1Macro(dataset: string, value: number): void {
  f1MacroGauge?.record(value, { dataset });
}

/**
 * Shuts down the metrics system
 */
export async function shutdownMetrics(): Promise<void> {
  if (meterProvider) {
    await meterProvider.shutdown();
  }
  meterProvider = undefined;
  meter = undefined;
  runsTotalCounter = undefined;
  samplesEvaluatedCounter = undefined;
  judgeCallsCounter = undefined;
  judgeCostHistogram = undefined;
  gatesResultGauge = undefined;
  accuracyGauge = undefined;
  f1MacroGauge = undefined;
}

/**
 * Gets the meter instance
 */
export function getMeter(): Meter | undefined {
  return meter;
}
