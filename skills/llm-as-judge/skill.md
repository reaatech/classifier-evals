# Skill: LLM-as-Judge

## Description

LLM-based evaluation with cost tracking for classifier predictions. Uses large language models (Anthropic Claude and OpenAI GPT) to judge whether predictions are correct, detect ambiguity, and categorize errors with full cost accountability.

**Package:** `@reaatech/classifier-evals-judge`

## Capabilities

- **Multi-provider judge engine**: Anthropic (Claude Opus, Sonnet, Haiku) and OpenAI (GPT-4, GPT-4 Turbo, GPT-3.5)
- **Classification evaluation**: Judge if predictions match ground truth
- **Ambiguity detection**: Identify samples that could be multiple classes
- **Error categorization**: Classify types of errors (FP, FN, label noise)
- **Cost tracking**: Real-time per-token budget tracking with alerts
- **Consensus voting**: Multi-judge majority/unanimous/weighted voting
- **Custom templates**: Register your own prompt templates
- **Result aggregation**: Per-class breakdowns, systematic bias detection, JSON/CSV export
- **PII safety**: Automatic text redaction and prompt-injection sanitization

## Usage

### Library

```typescript
import { createJudgeEngine } from '@reaatech/classifier-evals-judge';

const judge = createJudgeEngine({
  model: 'claude-opus',
  budgetLimit: 50.00,
  maxCostPerSample: 0.05,
  concurrency: 5,
  retryCount: 3,
  timeoutMs: 30000,
});

const result = await judge.evaluate(samples);

console.log(`Total cost: $${result.totalCost.toFixed(4)}`);
console.log(`Samples judged: ${result.samplesProcessed}`);
console.log(`Agreement rate: ${result.agreementRate}`);
console.log(`Budget remaining: $${result.budgetRemaining.toFixed(2)}`);
```

### Consensus Voting

```typescript
import { executeConsensusVoting } from '@reaatech/classifier-evals-judge';

const result = await executeConsensusVoting(sample, [judge1, judge2, judge3], {
  votingStrategy: 'majority',
  tieBreaker: 'highest_confidence',
});

console.log(`Judges agree: ${result.agree}, Correct: ${result.correct}`);
```

### Custom Prompt Templates

```typescript
import { registerCustomTemplate } from '@reaatech/classifier-evals-judge';

registerCustomTemplate('domain-specific', {
  system: 'You are an expert in healthcare classification.',
  user: `Is the predicted label correct?
Text: {{text}}
Expected: {{label}}
Predicted: {{predicted_label}}

Respond with JSON: { "is_correct": boolean, "confidence": number, "reasoning": string }`,
});
```

### CLI

```bash
# Run LLM judge on misclassifications
classifier-evals judge --dataset errors.csv --model claude-opus --budget 50.00

# With consensus voting
classifier-evals judge --dataset data.csv --consensus 3 --budget 25.00
```

## Prompt Templates

| Template | Purpose |
|----------|---------|
| `classification-eval` | Evaluate if prediction matches ground truth |
| `ambiguity-detection` | Detect if sample is ambiguous |
| `error-categorization` | Categorize the type of error |
| `multi-turn-eval` | Evaluate multi-turn conversation classification |

## Cost Control

Default pricing per 1M tokens:

| Model | Input | Output |
|-------|-------|--------|
| `claude-opus` | $15.00 | $75.00 |
| `claude-sonnet` | $3.00 | $15.00 |
| `claude-haiku` | $0.25 | $1.25 |
| `gpt-4` | $30.00 | $60.00 |
| `gpt-4-turbo` | $10.00 | $30.00 |
| `gpt-3.5-turbo` | $0.50 | $1.50 |

- Set `budgetLimit` to prevent runaway costs
- Configure `maxCostPerSample` for per-sample limits
- Costs tracked per model and per category
- Budget exceeded status exposed via `budgetExceeded`

## Related Skills

- `confusion-matrix` — Confusion matrix calculation and metrics
- `regression-gates` — CI integration with quality gates
