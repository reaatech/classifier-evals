# @reaatech/classifier-evals-judge

[![npm version](https://img.shields.io/npm/v/@reaatech/classifier-evals-judge.svg)](https://www.npmjs.com/package/@reaatech/classifier-evals-judge)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://github.com/reaatech/classifier-evals/blob/main/LICENSE)
[![CI](https://img.shields.io/github/actions/workflow/status/reaatech/classifier-evals/ci.yml?branch=main&label=CI)](https://github.com/reaatech/classifier-evals/actions/workflows/ci.yml)

> **Status:** Pre-1.0 — APIs may change in minor versions. Pin to a specific version in production.

LLM-as-judge for classifier evaluation with real-time cost tracking, multi-provider support (Anthropic + OpenAI), consensus voting across multiple judges, and comprehensive result aggregation and reporting.

## Installation

```bash
npm install @reaatech/classifier-evals-judge
# or
pnpm add @reaatech/classifier-evals-judge
```

## Feature Overview

- **Multi-provider judge engine** — supports Anthropic (Claude) and OpenAI (GPT-4) models with configurable temperature, max tokens, and timeouts
- **Real-time cost tracking** — per-token pricing with budget limits, automatic alerts, and remaining-budget checks
- **Consensus voting** — configurable number of judges with majority voting, disagreement analysis, and optimal judge count estimation
- **4 built-in prompt templates** — `classification-eval`, `ambiguity-detection`, `error-categorization`, `multi-turn-eval`
- **Custom templates** — register your own prompt templates with variable interpolation
- **Result aggregation** — aggregate individual judge results, calculate agreement rates, produce systematic-bias analysis, and export to JSON/CSV
- **PII safety** — automatic text redaction and prompt-injection sanitization before LLM calls
- **Dual ESM/CJS output** — works with `import` and `require`

## Quick Start

```typescript
import { createJudgeEngine } from "@reaatech/classifier-evals-judge";

const judge = createJudgeEngine({
  model: "claude-opus",
  budgetLimit: 50.00,
  concurrency: 5,
});

const results = await judge.evaluate([
  { text: "Reset my password", label: "password_reset", predicted_label: "password_reset", confidence: 0.95 },
  { text: "Cancel my subscription", label: "cancel_subscription", predicted_label: "refund_request", confidence: 0.72 },
]);

console.log(`Agreement rate: ${(results.agreementRate * 100).toFixed(1)}%`);
console.log(`Total cost: $${results.totalCost.toFixed(4)}`);
```

## API Reference

### Judge Engine

#### `createJudgeEngine(config: JudgeEngineConfig): JudgeEngine`

Creates a judge engine with the specified configuration.

```typescript
const judge = createJudgeEngine({
  model: "claude-opus",
  promptTemplate: "classification-eval",
  consensusCount: 3,
  maxCostPerSample: 0.05,
  budgetLimit: 50.00,
  retryCount: 3,
  timeoutMs: 30000,
  concurrency: 5,
});
```

| Config | Type | Default | Description |
|--------|------|---------|-------------|
| `model` | `string` | `"gpt-4-turbo"` | LLM model identifier |
| `promptTemplate` | `string` | `"classification-eval"` | Prompt template to use |
| `consensusCount` | `number` | `1` | Number of judges for voting |
| `maxCostPerSample` | `number` | `0.05` | Maximum cost per sample in USD |
| `budgetLimit` | `number` | `50.00` | Total budget limit in USD |
| `retryCount` | `number` | `3` | Max retries on failure |
| `timeoutMs` | `number` | `30000` | Timeout per API call in ms |
| `concurrency` | `number` | `5` | Max concurrent API calls |

#### `JudgeEngine.evaluate(samples: ClassificationResult[]): Promise<JudgeAggregateResult>`

Evaluates a batch of samples. Returns aggregated results with cost accounting.

```typescript
const result = await judge.evaluate(samples);
// {
//   samplesProcessed: number,
//   agreementRate: number,
//   totalCost: number,
//   costPerSample: number,
//   budgetRemaining: number,
//   budgetExceeded: boolean,
//   results: SampleJudgeResult[]
// }
```

#### `JudgeEngine.evaluateSingle(sample: ClassificationResult): Promise<LLMJudgeResult>`

Evaluates a single sample.

#### `JudgeEngine.getCostAccount(): CostAccount`

Returns current cost accounting: `{ total_cost, samples_processed, avg_cost_per_sample, input_tokens, output_tokens, api_calls, budget_limit, budget_remaining, budget_exceeded }`.

#### `JudgeEngine.resetCosts(): void`

Resets the cost tracker to zero.

### Cost Tracking

#### `createCostTracker(pricing?: ModelPricing): CostTracker`

Creates an independent cost tracker for use outside the judge engine.

```typescript
import { createCostTracker } from "@reaatech/classifier-evals-judge";

const tracker = createCostTracker();
tracker.recordCall("claude-opus", { inputTokens: 150, outputTokens: 50 });
console.log(`Current cost: $${tracker.totalCost.toFixed(4)}`);
console.log(`Remaining budget: $${tracker.budgetRemaining.toFixed(4)}`);
```

#### `CostTracker`

| Method | Description |
|--------|-------------|
| `recordCall(model, usage)` | Record a single LLM call with token counts |
| `getAccount()` | Get current cost accounting |
| `checkBudget()` | Check if budget has been exceeded |
| `reset()` | Reset all cost accumulators |
| `totalCost` | Cumulative cost of all recorded calls |
| `budgetRemaining` | Budget limit minus total cost |
| `budgetExceeded` | Whether the budget has been exceeded |

#### `ModelPricing`

Default pricing for common models:

| Model | Input ($/1M tokens) | Output ($/1M tokens) |
|-------|---------------------|----------------------|
| `claude-opus` | $15.00 | $75.00 |
| `claude-sonnet` | $3.00 | $15.00 |
| `claude-haiku` | $0.25 | $1.25 |
| `gpt-4-turbo` | $10.00 | $30.00 |
| `gpt-4` | $30.00 | $60.00 |
| `gpt-3.5-turbo` | $0.50 | $1.50 |

### Prompt Templates

#### `getPromptTemplate(type: PromptTemplateType): PromptTemplate`

Returns a pre-built prompt template by name.

```typescript
import { getPromptTemplate, formatPrompt } from "@reaatech/classifier-evals-judge";

const template = getPromptTemplate("classification-eval");
const prompt = formatPrompt(template, {
  text: "Reset my password",
  label: "password_reset",
  predicted_label: "password_reset",
  confidence: 0.95,
});
```

| Template | Purpose |
|----------|---------|
| `classification-eval` | Evaluate if prediction matches ground truth |
| `ambiguity-detection` | Detect if a sample is inherently ambiguous |
| `error-categorization` | Categorize the type of error (e.g., semantic, boundary) |
| `multi-turn-eval` | Evaluate multi-turn conversation classification |

#### `formatPrompt(template: PromptTemplate, variables: Record<string, unknown>): string`

Interpolates variables into a prompt template.

#### `registerCustomTemplate(type: string, template: PromptTemplate): void`

Registers a custom prompt template for use with the judge engine.

### Consensus Voting

#### `executeConsensusVoting(sample: ClassificationResult, judges: JudgeEngine[], config?: ConsensusConfig): Promise<ConsensusResult>`

Runs multiple judges on a single sample and resolves consensus.

```typescript
import { executeConsensusVoting } from "@reaatech/classifier-evals-judge";

const result = await executeConsensusVoting(sample, [judge1, judge2, judge3], {
  votingStrategy: "majority",
  tieBreaker: "highest_confidence",
});
```

| Config | Type | Default | Description |
|--------|------|---------|-------------|
| `votingStrategy` | `"majority" \| "unanimous" \| "weighted"` | `"majority"` | How votes are resolved |
| `tieBreaker` | `"highest_confidence" \| "most_experienced"` | `"highest_confidence"` | How ties are broken |

#### `executeBatchConsensusVoting(samples: ClassificationResult[], judges: JudgeEngine[]): Promise<ConsensusResult[]>`

Runs consensus voting on a batch of samples.

#### `analyzeDisagreements(results: ConsensusResult[]): DisagreementReport`

Analyzes where judges disagreed and why.

#### `optimizeJudgeCount(previousResults: ConsensusResult[], maxBudget: number): number`

Estimates the optimal number of judges to maximize accuracy within a budget.

### Result Aggregation

#### `aggregateJudgedResults(results: LLMJudgeResult[]): JudgeAggregateResults`

Aggregates individual judge results into comprehensive statistics.

#### `aggregateConsensusResults(results: ConsensusResult[]): JudgeAggregateResults`

Aggregates consensus results including agreement rates and per-class breakdowns.

```typescript
import { aggregateConsensusResults, generateJudgeSummaryReport } from "@reaatech/classifier-evals-judge";

const aggregated = aggregateConsensusResults(consensusResults);
console.log(`Agreement: ${(aggregated.agreementRate * 100).toFixed(1)}%`);

const report = generateJudgeSummaryReport(aggregated);
console.log(report);
```

#### `generateJudgeSummaryReport(results: JudgeAggregateResults): string`

Generates a human-readable summary report.

#### `exportJudgeResults(results: JudgeAggregateResults, format?: 'json' | 'csv'): string`

Exports judge results to JSON or CSV.

## Usage Patterns

### Budget-Aware Judging

```typescript
const judge = createJudgeEngine({
  model: "claude-sonnet",
  budgetLimit: 10.00,
});

const results = await judge.evaluate(largeBatch);
if (results.budgetExceeded) {
  console.warn(`Budget exceeded! Used $${results.totalCost.toFixed(2)} of $10.00`);
}
```

### Consensus with Multiple Providers

```typescript
const claudeJudge = createJudgeEngine({ model: "claude-sonnet" });
const gpt4Judge = createJudgeEngine({ model: "gpt-4-turbo" });
const haikuJudge = createJudgeEngine({ model: "claude-haiku" });

const result = await executeConsensusVoting(sample, [claudeJudge, gpt4Judge, haikuJudge]);
console.log(`Judges agree: ${result.agree}, Outcome: ${result.correct}`);
```

### Custom Prompt Template

```typescript
import { registerCustomTemplate } from "@reaatech/classifier-evals-judge";

registerCustomTemplate("domain-specific", {
  system: "You are an expert in healthcare classification.",
  user: `Is the predicted label correct for this medical text?

Text: {{text}}
Expected: {{label}}
Predicted: {{predicted_label}}

Respond with JSON: { "is_correct": boolean, "confidence": number, "reasoning": string }`,
});
```

## Related Packages

- [`@reaatech/classifier-evals`](https://www.npmjs.com/package/@reaatech/classifier-evals) — Core types and schemas
- [`@reaatech/classifier-evals-dataset`](https://www.npmjs.com/package/@reaatech/classifier-evals-dataset) — Dataset loading
- [`@reaatech/classifier-evals-metrics`](https://www.npmjs.com/package/@reaatech/classifier-evals-metrics) — Classification metrics

## License

[MIT](https://github.com/reaatech/classifier-evals/blob/main/LICENSE)
