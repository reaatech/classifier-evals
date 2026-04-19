/**
 * Result Aggregator for LLM-as-Judge Evaluations
 * Combines judge scores with ground truth, calculates agreement rates,
 * identifies systematic biases, and exports results for analysis
 */

import {
  ClassificationResult,
  JudgedResult,
  CostAccount,
} from '../types/index.js';
import { ConsensusResult } from './consensus-voting.js';

/**
 * Aggregated results from judge evaluation
 */
export interface JudgeAggregateResults {
  /** Total samples evaluated */
  totalSamples: number;
  /** Samples where judge agreed with ground truth */
  judgeAgreedCount: number;
  /** Samples where judge disagreed with ground truth */
  judgeDisagreedCount: number;
  /** Agreement rate (judge agreed / total) */
  agreementRate: number;
  /** Average judge confidence */
  avgJudgeConfidence: number;
  /** Breakdown by class */
  perClassBreakdown: ClassBreakdown[];
  /** Systematic biases detected */
  biases: SystematicBias[];
  /** Cost breakdown */
  costBreakdown: CostAccount;
  /** Disagreement analysis */
  disagreementAnalysis?: DisagreementAnalysis;
}

/**
 * Per-class breakdown of judge results
 */
export interface ClassBreakdown {
  label: string;
  totalSamples: number;
  judgeAgreed: number;
  judgeDisagreed: number;
  agreementRate: number;
  avgConfidence: number;
  avgModelConfidence: number;
}

/**
 * Systematic bias detected in judge evaluations
 */
export interface SystematicBias {
  type: 'label_bias' | 'confidence_bias' | 'model_bias';
  description: string;
  severity: 'low' | 'medium' | 'high';
  affectedLabels?: string[];
  metric: string;
  value: number;
  threshold: number;
}

/**
 * Analysis of disagreements between judge and model
 */
export interface DisagreementAnalysis {
  /** Cases where model was correct but judge said incorrect */
  falseNegatives: Array<{
    sample: ClassificationResult;
    judgeResult: JudgedResult;
  }>;
  /** Cases where model was incorrect but judge said correct */
  falsePositives: Array<{
    sample: ClassificationResult;
    judgeResult: JudgedResult;
  }>;
  /** Cases where both model and judge agree on incorrect classification */
  mutualErrors: Array<{
    sample: ClassificationResult;
    judgeResult: JudgedResult;
  }>;
}

/**
 * Configuration for result aggregation
 */
export interface AggregatorConfig {
  /** Minimum samples per class for bias detection */
  minSamplesPerClass: number;
  /** Threshold for detecting systematic bias */
  biasDetectionThreshold: number;
  /** Whether to include detailed disagreement analysis */
  includeDisagreementAnalysis: boolean;
  /** Maximum samples to include in disagreement details */
  maxDisagreementSamples: number;
}

/**
 * Default aggregator configuration
 */
export const DEFAULT_AGGREGATOR_CONFIG: AggregatorConfig = {
  minSamplesPerClass: 10,
  biasDetectionThreshold: 0.2,
  includeDisagreementAnalysis: true,
  maxDisagreementSamples: 50,
};

/**
 * Aggregate results from individual judge evaluations
 */
export function aggregateJudgeResults(
  judgedResults: JudgedResult[],
  costBreakdown: CostAccount,
  config: AggregatorConfig = DEFAULT_AGGREGATOR_CONFIG
): JudgeAggregateResults {
  const totalSamples = judgedResults.length;
  const agreedResults = judgedResults.filter(r => {
    const modelCorrect = r.label === r.predicted_label;
    const judgeCorrect = r.judge_correct ?? false;
    return modelCorrect === judgeCorrect;
  });

  const agreementRate = totalSamples > 0 ? agreedResults.length / totalSamples : 0;
  const avgJudgeConfidence =
    totalSamples > 0
      ? judgedResults.reduce((sum, r) => sum + (r.judge_confidence ?? 0), 0) /
        totalSamples
      : 0;

  // Per-class breakdown
  const perClassBreakdown = calculatePerClassBreakdown(judgedResults);

  // Detect systematic biases
  const biases = detectSystematicBiases(perClassBreakdown, judgedResults, config);

  // Disagreement analysis
  let disagreementAnalysis: DisagreementAnalysis | undefined;
  if (config.includeDisagreementAnalysis) {
    disagreementAnalysis = analyzeDisagreements(judgedResults, config);
  }

  return {
    totalSamples,
    judgeAgreedCount: agreedResults.length,
    judgeDisagreedCount: totalSamples - agreedResults.length,
    agreementRate,
    avgJudgeConfidence,
    perClassBreakdown,
    biases,
    costBreakdown,
    disagreementAnalysis,
  };
}

/**
 * Aggregate results from consensus voting
 */
export function aggregateConsensusResults(
  consensusResults: ConsensusResult[],
  costBreakdown: CostAccount,
  config: AggregatorConfig = DEFAULT_AGGREGATOR_CONFIG
): JudgeAggregateResults {
  const totalSamples = consensusResults.length;

  // Count agreements (where consensus matches model's correctness)
  let judgeAgreedCount = 0;
  let totalConfidence = 0;

  for (const result of consensusResults) {
    const modelCorrect = result.sample.label === result.sample.predicted_label;
    if (modelCorrect === result.consensusCorrect) {
      judgeAgreedCount++;
    }
    totalConfidence += result.consensusConfidence;
  }

  const agreementRate = totalSamples > 0 ? judgeAgreedCount / totalSamples : 0;
  const avgJudgeConfidence = totalSamples > 0 ? totalConfidence / totalSamples : 0;

  // Per-class breakdown from consensus results
  const perClassBreakdown = calculatePerClassBreakdownFromConsensus([...consensusResults]);

  // Detect systematic biases
  const biases = detectSystematicBiasesFromConsensus(
    perClassBreakdown,
    [...consensusResults],
    config
  );

  // Calculate total cost from votes
  const totalCost = consensusResults.reduce((sum, r) => sum + r.totalCost, 0);
  const adjustedCostBreakdown: CostAccount = {
    ...costBreakdown,
    total_cost: totalCost,
    samples_processed: totalSamples,
    avg_cost_per_sample: totalSamples > 0 ? totalCost / totalSamples : 0,
  };

  return {
    totalSamples,
    judgeAgreedCount,
    judgeDisagreedCount: totalSamples - judgeAgreedCount,
    agreementRate,
    avgJudgeConfidence,
    perClassBreakdown,
    biases,
    costBreakdown: adjustedCostBreakdown,
    disagreementAnalysis: undefined,
  };
}

/**
 * Calculate per-class breakdown from judged results
 */
function calculatePerClassBreakdown(
  judgedResults: JudgedResult[]
): ClassBreakdown[] {
  const classData = new Map<
    string,
    {
      total: number;
      agreed: number;
      totalJudgeConfidence: number;
      totalModelConfidence: number;
    }
  >();

  for (const result of judgedResults) {
    const label = result.label;
    const existing = classData.get(label) ?? {
      total: 0,
      agreed: 0,
      totalJudgeConfidence: 0,
      totalModelConfidence: 0,
    };

    existing.total++;
    existing.totalJudgeConfidence += result.judge_confidence ?? 0;
    existing.totalModelConfidence += result.confidence ?? 0;

    const modelCorrect = result.label === result.predicted_label;
    const judgeCorrect = result.judge_correct ?? false;
    if (modelCorrect === judgeCorrect) {
      existing.agreed++;
    }

    classData.set(label, existing);
  }

  return Array.from(classData.entries()).map(([label, data]) => ({
    label,
    totalSamples: data.total,
    judgeAgreed: data.agreed,
    judgeDisagreed: data.total - data.agreed,
    agreementRate: data.total > 0 ? data.agreed / data.total : 0,
    avgConfidence:
      data.total > 0 ? data.totalJudgeConfidence / data.total : 0,
    avgModelConfidence:
      data.total > 0 ? data.totalModelConfidence / data.total : 0,
  }));
}

/**
 * Calculate per-class breakdown from consensus results
 */
function calculatePerClassBreakdownFromConsensus(
  consensusResults: ConsensusResult[]
): ClassBreakdown[] {
  const classData = new Map<
    string,
    {
      total: number;
      agreed: number;
      totalConfidence: number;
      totalModelConfidence: number;
    }
  >();

  for (const result of consensusResults) {
    const label = result.sample.label;
    const existing = classData.get(label) ?? {
      total: 0,
      agreed: 0,
      totalConfidence: 0,
      totalModelConfidence: 0,
    };

    existing.total++;
    existing.totalConfidence += result.consensusConfidence;
    existing.totalModelConfidence += result.sample.confidence ?? 0;

    const modelCorrect = result.sample.label === result.sample.predicted_label;
    if (modelCorrect === result.consensusCorrect) {
      existing.agreed++;
    }

    classData.set(label, existing);
  }

  return Array.from(classData.entries()).map(([label, data]) => ({
    label,
    totalSamples: data.total,
    judgeAgreed: data.agreed,
    judgeDisagreed: data.total - data.agreed,
    agreementRate: data.total > 0 ? data.agreed / data.total : 0,
    avgConfidence:
      data.total > 0 ? data.totalConfidence / data.total : 0,
    avgModelConfidence:
      data.total > 0 ? data.totalModelConfidence / data.total : 0,
  }));
}

/**
 * Detect systematic biases in judge evaluations
 */
function detectSystematicBiases(
  perClassBreakdown: ClassBreakdown[],
  judgedResults: JudgedResult[],
  config: AggregatorConfig
): SystematicBias[] {
  const biases: SystematicBias[] = [];

  // Detect label bias (judge agrees more with certain labels)
  const filteredBreakdown = perClassBreakdown.filter(
    b => b.totalSamples >= config.minSamplesPerClass
  );

  if (filteredBreakdown.length >= 2) {
    const rates = filteredBreakdown.map(b => b.agreementRate);
    const maxRate = Math.max(...rates);
    const minRate = Math.min(...rates);
    const variance = maxRate - minRate;

    if (variance > config.biasDetectionThreshold) {
      biases.push({
        type: 'label_bias',
        description: `Judge agreement rate varies significantly across labels (max: ${(maxRate * 100).toFixed(1)}%, min: ${(minRate * 100).toFixed(1)}%)`,
        severity: variance > 0.4 ? 'high' : variance > 0.3 ? 'medium' : 'low',
        affectedLabels: [
          filteredBreakdown.find(b => b.agreementRate === maxRate)?.label,
          filteredBreakdown.find(b => b.agreementRate === minRate)?.label,
        ].filter((l): l is string => l !== undefined && l !== ''),
        metric: 'agreement_rate_variance',
        value: variance,
        threshold: config.biasDetectionThreshold,
      });
    }
  }

  // Detect confidence bias (judge confidence correlates with model confidence)
  const confidenceCorrelation = calculateConfidenceCorrelation(judgedResults);
  if (Math.abs(confidenceCorrelation) > 0.7) {
    biases.push({
      type: 'confidence_bias',
      description: `Strong correlation (${confidenceCorrelation.toFixed(2)}) between judge confidence and model confidence`,
      severity: Math.abs(confidenceCorrelation) > 0.9 ? 'high' : 'medium',
      metric: 'confidence_correlation',
      value: confidenceCorrelation,
      threshold: 0.7,
    });
  }

  return biases;
}

/**
 * Detect systematic biases from consensus results
 */
function detectSystematicBiasesFromConsensus(
  perClassBreakdown: ClassBreakdown[],
  _consensusResults: ConsensusResult[],
  config: AggregatorConfig
): SystematicBias[] {
  const biases: SystematicBias[] = [];

  // Detect label bias
  const filteredBreakdown = perClassBreakdown.filter(
    b => b.totalSamples >= config.minSamplesPerClass
  );

  if (filteredBreakdown.length >= 2) {
    const rates = filteredBreakdown.map(b => b.agreementRate);
    const maxRate = Math.max(...rates);
    const minRate = Math.min(...rates);
    const variance = maxRate - minRate;

    if (variance > config.biasDetectionThreshold) {
      biases.push({
        type: 'label_bias',
        description: `Consensus agreement rate varies significantly across labels (max: ${(maxRate * 100).toFixed(1)}%, min: ${(minRate * 100).toFixed(1)}%)`,
        severity: variance > 0.4 ? 'high' : variance > 0.3 ? 'medium' : 'low',
        affectedLabels: [
          filteredBreakdown.find(b => b.agreementRate === maxRate)?.label,
          filteredBreakdown.find(b => b.agreementRate === minRate)?.label,
        ].filter((l): l is string => l !== undefined && l !== ''),
        metric: 'agreement_rate_variance',
        value: variance,
        threshold: config.biasDetectionThreshold,
      });
    }
  }

  return biases;
}

/**
 * Calculate correlation between judge confidence and model confidence
 */
function calculateConfidenceCorrelation(judgedResults: JudgedResult[]): number {
  const n = judgedResults.length;
  if (n < 3) {return 0;}

  const judgeConfidences = judgedResults.map(r => r.judge_confidence ?? 0);
  const modelConfidences = judgedResults.map(r => r.confidence ?? 0);

  const meanJudge = judgeConfidences.reduce((a, b) => a + b, 0) / n;
  const meanModel = modelConfidences.reduce((a, b) => a + b, 0) / n;

  let numerator = 0;
  let sumJudgeSq = 0;
  let sumModelSq = 0;

  for (let i = 0; i < n; i++) {
    const judgeDiff = judgeConfidences[i]! - meanJudge;
    const modelDiff = modelConfidences[i]! - meanModel;
    numerator += judgeDiff * modelDiff;
    sumJudgeSq += judgeDiff * judgeDiff;
    sumModelSq += modelDiff * modelDiff;
  }

  const denominator = Math.sqrt(sumJudgeSq * sumModelSq);
  return denominator > 0 ? numerator / denominator : 0;
}

/**
 * Analyze disagreements between model and judge
 */
function analyzeDisagreements(
  judgedResults: JudgedResult[],
  _config: AggregatorConfig
): DisagreementAnalysis {
  const falseNegatives: DisagreementAnalysis['falseNegatives'] = [];
  const falsePositives: DisagreementAnalysis['falsePositives'] = [];
  const mutualErrors: DisagreementAnalysis['mutualErrors'] = [];

  for (const result of judgedResults) {
    const modelCorrect = result.label === result.predicted_label;
    const judgeCorrect = result.judge_correct ?? false;

    if (modelCorrect && !judgeCorrect) {
      // Model was right, judge said wrong
      if (falseNegatives.length < _config.maxDisagreementSamples) {
        falseNegatives.push({ sample: result, judgeResult: result });
      }
    } else if (!modelCorrect && judgeCorrect) {
      // Model was wrong, judge said right
      if (falsePositives.length < _config.maxDisagreementSamples) {
        falsePositives.push({ sample: result, judgeResult: result });
      }
    } else if (!modelCorrect && !judgeCorrect) {
      // Both agree it's wrong
      if (mutualErrors.length < _config.maxDisagreementSamples) {
        mutualErrors.push({ sample: result, judgeResult: result });
      }
    } else {
      // Both agree it's correct - no action needed
    }
  }

  return { falseNegatives, falsePositives, mutualErrors };
}

/**
 * Export judge results for external analysis
 */
export function exportJudgeResults(
  judgedResults: JudgedResult[],
  format: 'json' | 'csv' = 'json'
): string {
  if (format === 'json') {
    return JSON.stringify(judgedResults, null, 2);
  }

  // CSV export
  const headers = [
    'text',
    'label',
    'predicted_label',
    'confidence',
    'judge_correct',
    'judge_confidence',
    'judge_reasoning',
    'judge_model',
    'judge_cost',
  ];

  const rows = judgedResults.map(r => [
    `"${(r.text ?? '').replace(/"/g, '""')}"`,
    `"${(r.label ?? '').replace(/"/g, '""')}"`,
    `"${(r.predicted_label ?? '').replace(/"/g, '""')}"`,
    r.confidence?.toString() ?? '1.0',
    (r.judge_correct ?? false).toString(),
    (r.judge_confidence ?? 0).toString(),
    `"${(r.judge_reasoning ?? '').replace(/"/g, '""')}"`,
    `"${(r.judge_model ?? '').replace(/"/g, '""')}"`,
    (r.judge_cost ?? 0).toString(),
  ]);

  return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
}

/**
 * Generate a summary report of judge evaluation results
 */
export function generateJudgeSummaryReport(
  results: JudgeAggregateResults
): string {
  const lines: string[] = [];

  lines.push('=== LLM Judge Evaluation Summary ===');
  lines.push('');
  lines.push(`Total Samples: ${results.totalSamples}`);
  lines.push(`Judge Agreement Rate: ${(results.agreementRate * 100).toFixed(1)}%`);
  lines.push(`Average Judge Confidence: ${(results.avgJudgeConfidence * 100).toFixed(1)}%`);
  lines.push('');

  lines.push('--- Per-Class Breakdown ---');
  for (const breakdown of results.perClassBreakdown) {
    lines.push(
      `  ${breakdown.label}: ${breakdown.agreementRate * 100}% agreement (${breakdown.totalSamples} samples)`
    );
  }
  lines.push('');

  if (results.biases.length > 0) {
    lines.push('--- Systematic Biases Detected ---');
    for (const bias of results.biases) {
      lines.push(
        `  [${bias.severity.toUpperCase()}] ${bias.type}: ${bias.description}`
      );
    }
    lines.push('');
  }

  lines.push(
    `Total Cost: $${results.costBreakdown.total_cost.toFixed(4)}`
  );
  lines.push(
    `Average Cost per Sample: $${results.costBreakdown.avg_cost_per_sample.toFixed(6)}`
  );

  return lines.join('\n');
}
