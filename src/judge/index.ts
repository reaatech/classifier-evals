/**
 * LLM-as-Judge module exports
 */

export {
  JudgeEngine,
  createJudgeEngine,
  type JudgeEngineConfig,
  type LLMJudgeResult,
  type SampleJudgeResult,
  type JudgeAggregateResult,
} from './judge-engine.js';

export {
  getPromptTemplate,
  formatPrompt,
  registerCustomTemplate,
  type PromptTemplateType,
  type PromptTemplate,
} from './prompt-templates.js';

export {
  CostTracker,
  createCostTracker,
  type BudgetConfig,
  type CostBreakdown,
  type ModelPricing,
} from './cost-tracker.js';

export {
  executeConsensusVoting,
  executeBatchConsensusVoting,
  analyzeDisagreements,
  optimizeJudgeCount,
  type JudgeVote,
  type ConsensusResult,
  type ConsensusConfig,
} from './consensus-voting.js';

export {
  aggregateJudgeResults,
  aggregateConsensusResults,
  exportJudgeResults,
  generateJudgeSummaryReport,
  type JudgeAggregateResults,
  type ClassBreakdown,
  type SystematicBias,
  type DisagreementAnalysis,
  type AggregatorConfig,
} from './result-aggregator.js';
