/**
 * Type exports for classifier-evals
 */

export * from './domain.js';

// Re-export Zod schemas for validation
export {
  ClassificationResultSchema,
  JudgedResultSchema,
  DatasetMetadataSchema,
  EvalDatasetSchema,
  ValidationErrorSchema,
  ValidationWarningSchema,
  ClassMetricsSchema,
  ConfusionMatrixSchema,
  ClassificationMetricsSchema,
  ModelComparisonSchema,
  EvalRunSchema,
  LLMJudgeRequestSchema,
  LLMJudgeResponseSchema,
  LLMJudgeConfigSchema,
  CostAccountSchema,
  RegressionGateSchema,
  GateResultSchema,
  ExportTargetSchema,
  ExportResultSchema,
} from './domain.js';

// Re-export types
export type {
  ClassificationResult,
  JudgedResult,
  DatasetMetadata,
  EvalDataset,
  ValidationError,
  ValidationWarning,
  ClassMetrics,
  ConfusionMatrix,
  ClassificationMetrics,
  ModelComparison,
  EvalRun,
  LLMJudgeRequest,
  LLMJudgeResponse,
  LLMJudgeConfig,
  CostAccount,
  RegressionGate,
  GateResult,
  ExportTarget,
  ExportResult,
} from './domain.js';
