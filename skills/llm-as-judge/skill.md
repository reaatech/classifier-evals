# Skill: LLM-as-Judge

## Description

LLM-based evaluation with cost tracking for classifier predictions. Uses large language models to judge whether predictions are correct, detect ambiguity, and categorize errors with full cost accountability.

## Capabilities

- **Classification evaluation**: Judge if predictions match ground truth
- **Ambiguity detection**: Identify samples that could be multiple classes
- **Error categorization**: Classify types of errors (FP, FN, label noise)
- **Cost tracking**: Real-time budget tracking and alerts
- **Consensus voting**: Multi-judge voting for higher accuracy
- **Rate limiting**: Configurable parallel requests with backoff

## Usage

### Library

```typescript
import { createJudgeEngine } from 'classifier-evals';

const judge = createJudgeEngine({
  model: 'claude-opus',
  budget: {
    maxBudget: 50.00,
    alertThreshold: 80,
  },
  maxConcurrency: 5,
  retryCount: 3,
  timeoutMs: 30000,
});

const result = await judge.evaluateBatch(samples);

console.log(`Total cost: $${result.totalCost.toFixed(4)}`);
console.log(`Samples judged: ${result.samplesProcessed}`);
console.log(`Agreement rate: ${result.agreementRate}`);
```

### CLI

```bash
# Run LLM judge on misclassifications
classifier-evals judge --samples misclassifications.jsonl --model claude-opus --budget 50.00

# With consensus voting
classifier-evals judge --samples data.jsonl --consensus-count 3
```

## Prompt Templates

| Template | Purpose |
|----------|---------|
| `classification-eval` | Evaluate if prediction matches ground truth |
| `ambiguity-detection` | Detect if sample is ambiguous |
| `error-categorization` | Categorize the type of error |
| `multi-turn-eval` | Evaluate multi-turn conversation classification |

## Cost Control

- Set `budgetLimit` to prevent runaway costs
- Configure `maxCostPerSample` for per-sample limits
- Monitor costs in real-time with alerts
- Cost estimation before running expensive operations

## Related Skills

- `confusion-matrix` — Confusion matrix calculation
- `regression-gates` — CI integration with quality gates
