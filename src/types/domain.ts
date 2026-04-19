/**
 * Core domain types for classifier-evals
 */

import { z } from 'zod';

// ============================================
// Classification Result Types
// ============================================

/**
 * A single classification result with ground truth and prediction
 */
export const ClassificationResultSchema = z.object({
  text: z.string().min(1, 'text is required'),
  label: z.string().min(1, 'label is required'),
  predicted_label: z.string().min(1, 'predicted_label is required'),
  confidence: z.number().min(0).max(1).default(1.0),
  sample_id: z.string().uuid().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export type ClassificationResult = z.infer<typeof ClassificationResultSchema>;

/**
 * Classification result with judge evaluation
 */
export const JudgedResultSchema = ClassificationResultSchema.extend({
  judge_correct: z.boolean().optional(),
  judge_confidence: z.number().min(0).max(1).optional(),
  judge_reasoning: z.string().optional(),
  judge_model: z.string().optional(),
  judge_cost: z.number().min(0).optional(),
  judge_method: z.string().optional(),
});

export type JudgedResult = z.infer<typeof JudgedResultSchema>;

// ============================================
// Dataset Types
// ============================================

/**
 * Metadata about a loaded dataset
 */
export const DatasetMetadataSchema = z.object({
  format: z.enum(['csv', 'json', 'jsonl', 'parquet']),
  path: z.string().optional(),
  total_samples: z.number().min(0),
  labels: z.array(z.string()),
  label_distribution: z.record(z.number()),
  has_confidence: z.boolean(),
  loaded_at: z.string().datetime(),
});

export type DatasetMetadata = z.infer<typeof DatasetMetadataSchema>;

/**
 * Complete evaluation dataset
 */
export const EvalDatasetSchema = z.object({
  samples: z.array(ClassificationResultSchema),
  metadata: DatasetMetadataSchema,
});

export type EvalDataset = z.infer<typeof EvalDatasetSchema>;

/**
 * Validation error from dataset validation
 */
export const ValidationErrorSchema = z.object({
  type: z.string(),
  message: z.string(),
  sample_index: z.number().min(0).optional(),
  field: z.string().optional(),
});

export type ValidationError = z.infer<typeof ValidationErrorSchema>;

/**
 * Warning from dataset validation
 */
export const ValidationWarningSchema = z.object({
  type: z.string(),
  message: z.string(),
  sample_index: z.number().min(0).optional(),
});

export type ValidationWarning = z.infer<typeof ValidationWarningSchema>;

// ============================================
// Confusion Matrix Types
// ============================================

/**
 * Per-class confusion matrix metrics
 */
export const ClassMetricsSchema = z.object({
  label: z.string(),
  true_positives: z.number().min(0),
  false_positives: z.number().min(0),
  false_negatives: z.number().min(0),
  true_negatives: z.number().min(0),
  precision: z.number().min(0).max(1),
  recall: z.number().min(0).max(1),
  f1: z.number().min(0).max(1),
  support: z.number().min(0),
});

export type ClassMetrics = z.infer<typeof ClassMetricsSchema>;

/**
 * Complete confusion matrix data
 */
export const ConfusionMatrixSchema = z.object({
  labels: z.array(z.string()),
  matrix: z.array(z.array(z.number())),
  per_class: z.array(ClassMetricsSchema),
});

export type ConfusionMatrix = z.infer<typeof ConfusionMatrixSchema>;

// ============================================
// Evaluation Metrics Types
// ============================================

/**
 * Overall classification metrics
 */
export const ClassificationMetricsSchema = z.object({
  accuracy: z.number().min(0).max(1),
  precision_macro: z.number().min(0).max(1),
  recall_macro: z.number().min(0).max(1),
  f1_macro: z.number().min(0).max(1),
  precision_micro: z.number().min(0).max(1),
  recall_micro: z.number().min(0).max(1),
  f1_micro: z.number().min(0).max(1),
  precision_weighted: z.number().min(0).max(1),
  recall_weighted: z.number().min(0).max(1),
  f1_weighted: z.number().min(0).max(1),
  matthews_correlation: z.number().min(-1).max(1),
  cohens_kappa: z.number().min(-1).max(1),
  total_samples: z.number().min(0),
  correct_predictions: z.number().min(0),
});

export type ClassificationMetrics = z.infer<typeof ClassificationMetricsSchema>;

/**
 * Model comparison results
 */
export const ModelComparisonSchema = z.object({
  baseline_accuracy: z.number().min(0).max(1),
  candidate_accuracy: z.number().min(0).max(1),
  accuracy_difference: z.number(),
  p_value: z.number().min(0).max(1).optional(),
  is_significant: z.boolean().optional(),
  effect_size: z.number().optional(),
  per_class_comparison: z.array(z.object({
    label: z.string(),
    baseline_f1: z.number().min(0).max(1),
    candidate_f1: z.number().min(0).max(1),
    difference: z.number(),
    improved: z.boolean(),
  })).default([]),
});

export type ModelComparison = z.infer<typeof ModelComparisonSchema>;

// ============================================
// Evaluation Run Types
// ============================================

/**
 * Complete evaluation run results
 */
export const EvalRunSchema = z.object({
  run_id: z.string().uuid(),
  dataset_name: z.string().optional(),
  dataset_path: z.string().optional(),
  total_samples: z.number().min(0),
  confusion_matrix: ConfusionMatrixSchema,
  metrics: ClassificationMetricsSchema,
  judged_results: z.array(JudgedResultSchema).optional(),
  judge_cost: z.number().min(0).optional(),
  gate_results: z.array(z.object({
    name: z.string(),
    passed: z.boolean(),
    message: z.string().optional(),
  })).optional(),
  all_gates_passed: z.boolean().optional(),
  started_at: z.string().datetime(),
  completed_at: z.string().datetime(),
  duration_ms: z.number().min(0),
  metadata: z.record(z.unknown()).optional(),
});

export type EvalRun = z.infer<typeof EvalRunSchema>;

// ============================================
// LLM Judge Types
// ============================================

/**
 * Request to LLM judge
 */
export const LLMJudgeRequestSchema = z.object({
  text: z.string(),
  label: z.string(),
  predicted_label: z.string(),
  confidence: z.number().min(0).max(1).optional(),
  prompt_template: z.string().optional(),
  sample_id: z.string().optional(),
});

export type LLMJudgeRequest = z.infer<typeof LLMJudgeRequestSchema>;

/**
 * Response from LLM judge
 */
export const LLMJudgeResponseSchema = z.object({
  is_correct: z.boolean(),
  confidence: z.number().min(0).max(1),
  reasoning: z.string().optional(),
  model: z.string(),
  input_tokens: z.number().min(0),
  output_tokens: z.number().min(0),
  cost: z.number().min(0),
  latency_ms: z.number().min(0),
});

export type LLMJudgeResponse = z.infer<typeof LLMJudgeResponseSchema>;

/**
 * LLM judge configuration
 */
export const LLMJudgeConfigSchema = z.object({
  model: z.string().default('gpt-4-turbo'),
  prompt_template: z.string().default('classification-eval'),
  consensus_count: z.number().min(1).max(10).default(1),
  max_cost_per_sample: z.number().min(0).default(0.05),
  budget_limit: z.number().min(0).default(50.00),
  retry_count: z.number().min(0).max(5).default(3),
  timeout_ms: z.number().min(1000).max(60000).default(30000),
  concurrency: z.number().min(1).max(100).default(5),
});

export type LLMJudgeConfig = z.infer<typeof LLMJudgeConfigSchema>;

// ============================================
// Cost Tracking Types
// ============================================

/**
 * Cost accounting for LLM judging
 */
export const CostAccountSchema = z.object({
  total_cost: z.number().min(0),
  samples_processed: z.number().min(0),
  avg_cost_per_sample: z.number().min(0),
  input_tokens: z.number().min(0),
  output_tokens: z.number().min(0),
  api_calls: z.number().min(0),
  budget_limit: z.number().min(0),
  budget_remaining: z.number().min(0),
  budget_exceeded: z.boolean(),
  cost_by_model: z.record(z.number()).default({}),
  cost_by_category: z.record(z.number()).default({}),
});

export type CostAccount = z.infer<typeof CostAccountSchema>;

// ============================================
// Regression Gate Types
// ============================================

/**
 * Regression gate definition
 */
export const RegressionGateSchema = z.object({
  name: z.string().min(1),
  type: z.enum(['threshold', 'baseline-comparison', 'distribution']),
  metric: z.string().optional(),
  operator: z.enum(['>=', '<=', '>', '<', '==']).optional(),
  threshold: z.number().optional(),
  baseline_path: z.string().optional(),
  allow_regression_in: z.number().min(0).optional(),
  description: z.string().optional(),
});

export type RegressionGate = z.infer<typeof RegressionGateSchema>;

/**
 * Gate evaluation result
 */
export const GateResultSchema = z.object({
  gate: RegressionGateSchema,
  passed: z.boolean(),
  actual_value: z.number().optional(),
  expected_value: z.number().optional(),
  message: z.string().optional(),
  failures: z.array(z.object({
    label: z.string().optional(),
    metric: z.string(),
    actual: z.number(),
    expected: z.number(),
  })).default([]),
});

export type GateResult = z.infer<typeof GateResultSchema>;

// ============================================
// Export Types
// ============================================

/**
 * Export target configuration
 */
export const ExportTargetSchema = z.object({
  type: z.enum(['phoenix', 'langfuse', 'json', 'html']),
  path: z.string().optional(),
  endpoint: z.string().url().optional(),
  dataset_name: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export type ExportTarget = z.infer<typeof ExportTargetSchema>;

/**
 * Export result
 */
export const ExportResultSchema = z.object({
  success: z.boolean(),
  target_type: z.enum(['phoenix', 'langfuse', 'json', 'html']),
  location: z.string().optional(),
  error: z.string().optional(),
  exported_at: z.string().datetime(),
  json: z.string().optional(),
  html: z.string().optional(),
});

export type ExportResult = z.infer<typeof ExportResultSchema>;
