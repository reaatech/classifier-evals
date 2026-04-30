/**
 * Gate utility functions extracted from eval-run helpers.
 */

import { readFileSync } from 'node:fs';
import type { RegressionGate } from '@reaatech/classifier-evals';
import YAML from 'yaml';

export function normalizeRegressionGate(gate: Record<string, unknown>): RegressionGate {
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
      typeof gate.allow_regression_in === 'number' ? gate.allow_regression_in : undefined,
    description: typeof gate.description === 'string' ? gate.description : undefined,
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
