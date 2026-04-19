# Skill: Regression Gates

## Description

CI integration with quality gates for classifier evaluation. Provides threshold-based gates, baseline comparison, and distribution checks to prevent model regressions from reaching production.

## Capabilities

- **Threshold gates**: Overall accuracy, per-class F1, macro/micro F1 thresholds
- **Baseline comparison**: Compare against baseline model with statistical testing
- **Distribution gates**: Label distribution drift, confidence score checks
- **CI integration**: GitHub Actions output, JUnit XML, exit codes
- **Gate caching**: Fast evaluation for CI speed
- **Detailed reporting**: Pass/fail with actionable reasons

## Usage

### Library

```typescript
import { createGateEngine } from 'classifier-evals';

const engine = createGateEngine({
  baselinePath: 'results/baseline.json',
});

const gateConfig: RegressionGate[] = [
  {
    name: 'overall-accuracy',
    type: 'threshold',
    metric: 'accuracy',
    operator: '>=',
    threshold: 0.85
  },
  {
    name: 'no-regression',
    type: 'baseline-comparison',
    baseline_path: 'results/baseline.json',
    metric: 'f1_per_class',
    allow_regression_in: 0
  }
];

const result = engine.evaluateGates(metrics, gateConfig);

if (!result.passed) {
  console.error('Gate failures:', result.failures);
  process.exit(1);
}
```

### CLI

```bash
# Check regression gates
classifier-evals gates --results results/latest.json --gates gates.yaml

# With baseline comparison
classifier-evals gates --results results.json --gates gates.yaml --baseline results/baseline.json
```

## Gate Types

| Type | Description |
|------|-------------|
| `threshold` | Simple threshold on a metric (e.g., accuracy >= 0.85) |
| `baseline-comparison` | Compare against baseline with statistical significance |
| `distribution` | Check distribution properties (label drift, unknown rate) |

## CI Integration

```yaml
# .github/workflows/eval.yml
- name: Check gates
  run: |
    npx classifier-evals gates \
      --results results.json \
      --gates gates.yaml
```

## Related Skills

- `confusion-matrix` — Confusion matrix calculation
- `dataset-loading` — Multi-format dataset ingestion
