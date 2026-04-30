# @reaatech/classifier-evals-gates

[![npm version](https://img.shields.io/npm/v/@reaatech/classifier-evals-gates.svg)](https://www.npmjs.com/package/@reaatech/classifier-evals-gates)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://github.com/reaatech/classifier-evals/blob/main/LICENSE)
[![CI](https://img.shields.io/github/actions/workflow/status/reaatech/classifier-evals/ci.yml?branch=main&label=CI)](https://github.com/reaatech/classifier-evals/actions/workflows/ci.yml)

> **Status:** Pre-1.0 — APIs may change in minor versions. Pin to a specific version in production.

Regression quality gates for CI-integrated classifier evaluation. Define threshold, baseline-comparison, and distribution gates; evaluate them against metrics; and generate GitHub Actions, JUnit, and PR-comment output formats.

## Installation

```bash
npm install @reaatech/classifier-evals-gates
# or
pnpm add @reaatech/classifier-evals-gates
```

## Feature Overview

- **Three gate types** — threshold, baseline-comparison, and distribution gates
- **Gate engine** — evaluates all gates with optional caching, error handling, and result aggregation
- **Baseline comparison** — compare per-class F1 stats against a persisted baseline `EvalRun`
- **CI integration** — GitHub Actions output annotations, JUnit XML, PR comment markdown
- **Configurable metrics** — look up any metric from `ClassificationMetrics` or distribution metadata
- **YAML-based config** — load gate definitions from YAML files with automatic normalization
- **Per-class regression** — allow a specified number of per-class F1 regressions before failing
- **Dual ESM/CJS output** — works with `import` and `require`

## Quick Start

```typescript
import { createGateEngine } from "@reaatech/classifier-evals-gates";
import { calculateAllMetrics } from "@reaatech/classifier-evals-metrics";

const metrics = calculateAllMetrics(samples);

const gates = [
  { name: "overall-accuracy", type: "threshold", metric: "accuracy", operator: ">=", threshold: 0.85 },
  { name: "macro-f1", type: "threshold", metric: "f1_macro", operator: ">=", threshold: 0.80 },
  { name: "unknown-rate", type: "distribution", metric: "unknown_rate", operator: "<=", threshold: 0.05 },
];

const engine = createGateEngine();
const result = engine.evaluateGates(metrics, gates);

console.log(result.passed ? "All gates passed" : "Some gates failed");
// Individual results: result.gateResults[]
```

## API Reference

### Gate Engine

#### `createGateEngine(config?: GateEngineConfig): GateEngine`

Creates a gate engine instance.

```typescript
const engine = createGateEngine({
  cacheResults: true,     // Cache gate results for 60 seconds (default: true)
  baselinePath: "./results/baseline.json",  // Default baseline path
});
```

#### `GateEngine.evaluateGates(metrics: ClassificationMetrics, gates: RegressionGate[], context?: GateEvaluationContext): GateEvaluationResult`

Evaluates all gates against the provided metrics. Returns `{ passed, gateResults, passedCount, failedCount, totalCount }`.

```typescript
const result = engine.evaluateGates(metrics, gates, {
  evalRun, // Include EvalRun context for distribution metrics and per-class comparison
});
```

#### `GateEngine.clearCache(): void`

Clears the internal gate evaluation cache.

#### `GateEngine.formatForGitHubActions(result: GateEvaluationResult): string`

Generates GitHub Actions formatted output with `::group::` blocks and `::error::` annotations.

#### `GateEngine.formatAsJUnit(result: GateEvaluationResult): string`

Generates JUnit XML for CI systems that consume test report formats.

### Gate Types

#### Threshold Gate

Simple comparison of a metric against a threshold with configurable operator.

```typescript
const gate = {
  name: "overall-accuracy",
  type: "threshold",
  metric: "accuracy",
  operator: ">=",
  threshold: 0.85,
};
```

Supported operators: `>=`, `<=`, `>`, `<`, `==`.

Available metrics: `accuracy`, `precision_macro`, `recall_macro`, `f1_macro`, `precision_micro`, `recall_micro`, `f1_micro`, `precision_weighted`, `recall_weighted`, `f1_weighted`, `matthews_correlation`, `cohens_kappa`, `total_samples`, `correct_predictions`.

#### Baseline Comparison Gate

Compares current metrics against a persisted baseline evaluation run.

```typescript
const gate = {
  name: "no-regression",
  type: "baseline-comparison",
  metric: "f1_per_class",
  allow_regression_in: 0, // No class can regress below baseline F1
  baseline_path: "./results/baseline.json",
};
```

When `metric` is `"f1_per_class"`, the gate compares per-class F1 scores against the baseline's `confusion_matrix.per_class` entries. Use `allow_regression_in` to tolerate a specified number of regressions (e.g., `1` allows one class to regress).

For other metrics (e.g., `"accuracy"`), the gate compares the scalar metric value against the baseline using the specified operator.

#### Distribution Gate

Checks distribution properties from the eval run's metadata (e.g., `unknown_rate`, `label_cardinality`).

```typescript
const gate = {
  name: "unknown-rate",
  type: "distribution",
  metric: "unknown_rate",
  operator: "<=",
  threshold: 0.05,
};
```

Distribution metrics are looked up from `evalRun.metadata.distribution_metrics`.

### YAML Configuration

#### `loadRegressionGatesFromFile(filePath: string): RegressionGate[]`

Loads gate definitions from a YAML file.

```yaml
# gates.yaml
gates:
  - name: overall-accuracy
    type: threshold
    metric: accuracy
    operator: ">="
    threshold: 0.85

  - name: macro-f1
    type: threshold
    metric: f1_macro
    operator: ">="
    threshold: 0.80

  - name: no-regression
    type: baseline-comparison
    baseline: results/baseline.json
    metric: f1_per_class
    allow_regression_in: 0

  - name: unknown-rate
    type: distribution
    metric: unknown_rate
    operator: "<="
    threshold: 0.05
```

```typescript
import { loadRegressionGatesFromFile } from "@reaatech/classifier-evals-gates";

const gates = loadRegressionGatesFromFile("./gates.yaml");
const result = engine.evaluateGates(metrics, gates, { evalRun });
```

#### `normalizeRegressionGate(gate: Record<string, unknown>): RegressionGate`

Normalizes a raw gate configuration object into a typed `RegressionGate`. Handles field name variations (`baseline_path` vs `baseline`).

### CI Integration

#### `generateGitHubOutput(results: GateResult[]): CIOutput`

Generates `{ exitCode, summary, details, annotations }` for GitHub Actions integration.

```typescript
import { generateGitHubOutput, isGitHubActions } from "@reaatech/classifier-evals-gates";

const output = generateGitHubOutput(result.gateResults);
console.log(output.summary);

if (output.exitCode !== 0) {
  process.exit(output.exitCode);
}
```

#### `generateJUnitXML(results: GateResult[], evalResults?: EvalRun): string`

Generates JUnit XML test results for CI systems.

#### `generatePRComment(results: GateResult[], evalResults?: EvalRun): string`

Generates a Markdown PR comment with gate results table and summary metrics.

#### `isGitHubActions(): boolean`

Returns `true` if the process is running in a GitHub Actions environment.

#### `setGitHubOutput(name: string, value: string): void`

Sets a GitHub Actions output variable.

## Usage Patterns

### Gate with Per-Class Baseline Comparison

```typescript
import { loadRegressionGatesFromFile, createGateEngine } from "@reaatech/classifier-evals-gates";
import { loadEvalRunFromFile } from "@reaatech/classifier-evals";

const gates = loadRegressionGatesFromFile("./gates.yaml");
const evalRun = loadEvalRunFromFile("./results/latest.json");

const engine = createGateEngine({ baselinePath: "./results/baseline.json" });
const result = engine.evaluateGates(evalRun.metrics, gates, { evalRun });

for (const gateResult of result.gateResults) {
  console.log(`${gateResult.passed ? "PASS" : "FAIL"}: ${gateResult.gate.name}`);
}
```

### GitHub Actions Workflow Integration

```yaml
- name: Check gates
  run: |
    npx classifier-evals gates \
      --results results/latest.json \
      --gates gates.yaml \
      --baseline results/baseline.json
```

## Related Packages

- [`@reaatech/classifier-evals`](https://www.npmjs.com/package/@reaatech/classifier-evals) — Core types, schemas, and eval-run persistence
- [`@reaatech/classifier-evals-metrics`](https://www.npmjs.com/package/@reaatech/classifier-evals-metrics) — Classification metrics
- [`@reaatech/classifier-evals-cli`](https://www.npmjs.com/package/@reaatech/classifier-evals-cli) — CLI tool with gates command

## License

[MIT](https://github.com/reaatech/classifier-evals/blob/main/LICENSE)
