/**
 * LLM-as-Judge module exports
 */

export {
  analyzeDisagreements,
  type ConsensusConfig,
  type ConsensusResult,
  executeBatchConsensusVoting,
  executeConsensusVoting,
  type JudgeVote,
  optimizeJudgeCount,
} from './consensus-voting.js';
export {
  type BudgetConfig,
  type CostBreakdown,
  CostTracker,
  createCostTracker,
  type ModelPricing,
} from './cost-tracker.js';
export {
  createJudgeEngine,
  type JudgeAggregateResult,
  JudgeEngine,
  type JudgeEngineConfig,
  type LLMJudgeResult,
  type SampleJudgeResult,
} from './judge-engine.js';
export {
  formatPrompt,
  getPromptTemplate,
  type PromptTemplate,
  type PromptTemplateType,
  registerCustomTemplate,
} from './prompt-templates.js';

export {
  type AggregatorConfig,
  aggregateConsensusResults,
  aggregateJudgeResults,
  type ClassBreakdown,
  type DisagreementAnalysis,
  exportJudgeResults,
  generateJudgeSummaryReport,
  type JudgeAggregateResults,
  type SystematicBias,
} from './result-aggregator.js';
