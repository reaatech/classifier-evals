/**
 * OpenTelemetry tracing for classifier-evals
 */
import { trace, Span, SpanStatusCode } from '@opentelemetry/api';

const TRACER_NAME = 'classifier-evals';

/**
 * Creates a span for an evaluation run
 */
export function startEvalSpan(
  dataset: string,
  samples: number,
  model?: string
): Span {
  const tracer = trace.getTracer(TRACER_NAME);
  const span = tracer.startSpan('eval.run');
  span.setAttributes({
    'eval.dataset': dataset,
    'eval.samples': samples,
    'eval.model': model ?? 'unknown',
  });
  return span;
}

/**
 * Creates a span for dataset loading
 */
export function startDatasetLoadSpan(format: string, path: string): Span {
  const tracer = trace.getTracer(TRACER_NAME);
  const span = tracer.startSpan('dataset.load');
  span.setAttributes({
    'dataset.format': format,
    'dataset.path': path,
  });
  return span;
}

/**
 * Creates a span for metrics calculation
 */
export function startMetricsSpan(metricTypes: string[]): Span {
  const tracer = trace.getTracer(TRACER_NAME);
  const span = tracer.startSpan('metrics.calculate');
  span.setAttributes({
    'metrics.types': metricTypes.join(','),
  });
  return span;
}

/**
 * Creates a span for LLM judge calls
 */
export function startJudgeSpan(model: string, samples: number): Span {
  const tracer = trace.getTracer(TRACER_NAME);
  const span = tracer.startSpan('judge.evaluate');
  span.setAttributes({
    'judge.model': model,
    'judge.samples': samples,
  });
  return span;
}

/**
 * Creates a span for gate evaluation
 */
export function startGatesSpan(gateCount: number): Span {
  const tracer = trace.getTracer(TRACER_NAME);
  const span = tracer.startSpan('gates.check');
  span.setAttributes({
    'gates.count': gateCount,
  });
  return span;
}

/**
 * Ends a span with status
 */
export function endSpan(span: Span, error?: Error): void {
  if (error) {
    span.recordException(error);
    span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
  } else {
    span.setStatus({ code: SpanStatusCode.OK });
  }
  span.end();
}

/**
 * Executes a function within a span
 */
export function withSpan<T>(
  span: Span,
  fn: () => T
): T {
  try {
    const result = fn();
    if (result instanceof Promise) {
      return result.then(
        (value) => {
          endSpan(span);
          return value;
        },
        (error) => {
          endSpan(span, error);
          throw error;
        }
      ) as T;
    }
    endSpan(span);
    return result;
  } catch (error) {
    endSpan(span, error as Error);
    throw error;
  }
}
