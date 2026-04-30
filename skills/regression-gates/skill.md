# Skill: Regression Gates

## Description

CI integration with quality gates for classifier evaluation. Provides threshold-based gates, baseline comparison, and distribution checks to prevent model regressions from reaching production.

**Package:** `@reaatech/classifier-evals-gates`

## Capabilities

- **Threshold gates**: Any ClassificationMetrics scalar with configurable operator (`>=`, `<=`, `>`, `<`, `==`)
- **Baseline comparison**: Per-class F1 regression detection, scalar metric comparison
- **Distribution gates**: Unknown rate, label cardinality, prediction cardinality checks
- **CI integration**: GitHub Actions output, JUnit XML, PR comment markdown
- **Gate caching**: 60-second TTL cache for fast CI evaluation
- **YAML configuration**: Load gate definitions from YAML files
- **Detailed reporting**: Pass/fail with actionable failure messages

## Usage

### Library

```typescript
import { createGateEngine, loadRegressionGatesFromFile } from '@reaatech/classifier-evals-gates';

const engine = createGateEngine({
  baselinePath: 'results/baseline.json',
  cacheResults: true,
});

const gates = loadRegressionGatesFromFile('gates.yaml');
const result = engine.evaluateGates(metrics, gates, { evalRun });

if (!result.passed) {
  console.error('Gate failures:', result.gateResults.filter(g => !g.passed));
  process.exit(1);
}
```

### Gate Configuration (YAML)

```yaml
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

### CI Formats

```typescript
import { generatePRComment, generateJUnitXML } from '@reaatech/classifier-evals-gates';

// GitHub Actions annotations
const ciOutput = engine.formatForGitHubActions(result);

// JUnit XML for CI test reports
const xml = generateJUnitXML(result.gateResults);

// PR comment markdown
const comment = generatePRComment(result.gateResults, evalRun);
```

### CLI

```bash
# Check gates against results
classifier-evals gates --results results/latest.json --gates gates.yaml

# With baseline comparison
classifier-evals gates --results results.json --gates gates.yaml --baseline results/baseline.json

# JUnit XML output
classifier-evals gates --results results.json --gates gates.yaml --format junit
```

## Gate Types

| Type | Description |
|------|-------------|
| `threshold` | Simple threshold on a metric (e.g., `accuracy >= 0.85`) |
| `baseline-comparison` | Compare against baseline EvalRun with per-class regression limits |
| `distribution` | Check distribution properties (`unknown_rate`, `label_cardinality`, etc.) |

## Supported Metrics

`accuracy`, `precision_macro`, `recall_macro`, `f1_macro`, `precision_micro`, `recall_micro`, `f1_micro`, `precision_weighted`, `recall_weighted`, `f1_weighted`, `matthews_correlation`, `cohens_kappa`, `total_samples`, `correct_predictions`, plus any metric from `metadata.distribution_metrics`.

## CI Integration

```yaml
# .github/workflows/eval.yml
- name: Check gates
  run: |
    classifier-evals gates \
      --results results/latest.json \
      --gates gates.yaml
```

Exit codes: `0` = all passed, `1` = some failed, `2` = error.

## Related Skills

- `confusion-matrix` — Confusion matrix calculation and metrics
- `dataset-loading` — Multi-format dataset ingestion
