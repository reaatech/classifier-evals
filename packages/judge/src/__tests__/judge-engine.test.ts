import { calculateMetricsFromCM } from '@reaatech/classifier-evals-metrics';
import { buildConfusionMatrix } from '@reaatech/classifier-evals-metrics';
import {
  generateHeatmapData,
  generateMetricsBarChart,
  generatePRCurveData,
} from '@reaatech/classifier-evals-metrics';
import { describe, expect, it, vi } from 'vitest';
import { executeConsensusVoting } from '../consensus-voting.js';
import { createCostTracker } from '../cost-tracker.js';
import { createJudgeEngine } from '../judge-engine.js';
import { formatPrompt, getPromptTemplate, registerCustomTemplate } from '../prompt-templates.js';
import {
  aggregateConsensusResults,
  aggregateJudgeResults,
  exportJudgeResults,
  generateJudgeSummaryReport,
} from '../result-aggregator.js';

const sample = {
  text: 'Reset password',
  label: 'auth',
  predicted_label: 'auth',
  confidence: 0.9,
};

describe('judge engine and helpers', () => {
  it('tracks cost and evaluates batches with heuristic fallback', async () => {
    const tracker = createCostTracker({ maxBudget: 0.000001, alertThreshold: 50 });
    tracker.addCost('gpt-4o', 1000, 500, 'correct');
    expect(tracker.getBreakdown().samplesProcessed).toBe(1);
    expect(tracker.isAlertTriggered()).toBe(true);

    const judge = createJudgeEngine({
      model: 'gpt-4o',
      budget: { maxBudget: 1, alertThreshold: 80 },
    });
    const result = await judge.evaluateBatch([
      sample,
      { ...sample, label: 'billing', predicted_label: 'auth', confidence: 0.2 },
    ]);

    expect(result.samplesProcessed).toBe(2);
    expect(result.results[0]?.result.judge_model).toContain('heuristic');
    expect(judge.getCostBreakdown().samplesProcessed).toBe(2);
  });

  it('aggregates judge and consensus results and exports summaries', () => {
    const judgedResults = [
      {
        ...sample,
        judge_correct: true,
        judge_confidence: 0.95,
        judge_reasoning: 'match',
        judge_model: 'gpt-4o',
        judge_cost: 0.01,
      },
      {
        ...sample,
        text: 'Need refund',
        label: 'billing',
        predicted_label: 'auth',
        confidence: 0.3,
        judge_correct: false,
        judge_confidence: 0.8,
        judge_reasoning: 'mismatch',
        judge_model: 'gpt-4o',
        judge_cost: 0.02,
      },
      {
        ...sample,
        text: 'Talk to agent',
        label: 'support',
        predicted_label: 'support',
        confidence: 0.7,
        judge_correct: true,
        judge_confidence: 0.7,
        judge_reasoning: 'match',
        judge_model: 'gpt-4o',
        judge_cost: 0.03,
      },
    ];
    const costAccount = {
      total_cost: 0.06,
      samples_processed: 3,
      avg_cost_per_sample: 0.02,
      input_tokens: 300,
      output_tokens: 120,
      api_calls: 3,
      budget_limit: 1,
      budget_remaining: 0.94,
      budget_exceeded: false,
      cost_by_model: { 'gpt-4o': 0.06 },
      cost_by_category: { default: 0.06 },
    };

    const aggregated = aggregateJudgeResults(judgedResults, costAccount, {
      minSamplesPerClass: 1,
      biasDetectionThreshold: 0.1,
      includeDisagreementAnalysis: true,
      maxDisagreementSamples: 10,
    });
    expect(aggregated.totalSamples).toBe(3);
    expect(exportJudgeResults(judgedResults, 'csv')).toContain('judge_reasoning');
    expect(generateJudgeSummaryReport(aggregated)).toContain('LLM Judge Evaluation Summary');

    const consensus = executeConsensusVoting(
      sample,
      [
        { judgeId: 'j1', model: 'gpt-4o', cost: 0.01, result: judgedResults[0]! },
        { judgeId: 'j2', model: 'gpt-4o', cost: 0.01, result: judgedResults[0]! },
        { judgeId: 'j3', model: 'gpt-4o', cost: 0.01, result: judgedResults[1]! },
      ],
      {
        minJudges: 3,
        strategy: 'majority',
        agreementThreshold: 0.5,
        useWeightedVoting: false,
      },
    );
    const aggregatedConsensus = aggregateConsensusResults([consensus], costAccount, {
      minSamplesPerClass: 1,
      biasDetectionThreshold: 0.1,
      includeDisagreementAnalysis: false,
      maxDisagreementSamples: 10,
    });
    expect(aggregatedConsensus.totalSamples).toBe(1);
  });

  it('formats prompts and visualization data', () => {
    const template = getPromptTemplate('classification-eval');
    const prompt = formatPrompt(template, sample);
    expect(prompt.user).toContain('Ground Truth Label');

    const confusionMatrix = {
      labels: ['auth', 'billing'],
      matrix: [
        [2, 0],
        [1, 1],
      ],
      per_class: [
        {
          label: 'auth',
          true_positives: 2,
          false_positives: 1,
          false_negatives: 0,
          true_negatives: 1,
          precision: 0.67,
          recall: 1,
          f1: 0.8,
          support: 2,
        },
        {
          label: 'billing',
          true_positives: 1,
          false_positives: 0,
          false_negatives: 1,
          true_negatives: 2,
          precision: 1,
          recall: 0.5,
          f1: 0.67,
          support: 2,
        },
      ],
    };

    expect(generateHeatmapData(confusionMatrix, 'row').normalized).toBe(true);
    expect(generateMetricsBarChart(confusionMatrix).datasets).toHaveLength(3);
    expect(
      generatePRCurveData(
        [
          sample,
          {
            ...sample,
            text: 'billing',
            label: 'billing',
            predicted_label: 'billing',
            confidence: 0.8,
          },
        ],
        'auth',
      ).thresholds.length,
    ).toBeGreaterThan(0);
  });

  it('PR curve returns empty for samples without confidence', () => {
    const result = generatePRCurveData(
      [
        {
          text: 'a',
          label: 'auth',
          predicted_label: 'auth',
        } as import('@reaatech/classifier-evals').ClassificationResult,
        {
          text: 'b',
          label: 'billing',
          predicted_label: 'billing',
        } as import('@reaatech/classifier-evals').ClassificationResult,
      ],
      'auth',
    );
    expect(result.thresholds).toEqual([]);
    expect(result.precision).toEqual([]);
    expect(result.recall).toEqual([]);
  });

  it('PR curve returns empty when no samples match positive label', () => {
    const result = generatePRCurveData(
      [
        { text: 'a', label: 'auth', predicted_label: 'auth', confidence: 0.9 },
        { text: 'b', label: 'billing', predicted_label: 'billing', confidence: 0.8 },
      ],
      'nonexistent',
    );
    expect(result.thresholds).toEqual([]);
    expect(result.precision).toEqual([]);
  });

  it('heatmap with column normalization divides by column sums', () => {
    const cm = {
      labels: ['a', 'b'],
      matrix: [
        [2, 1],
        [3, 4],
      ],
      per_class: [
        {
          label: 'a',
          true_positives: 2,
          false_positives: 3,
          false_negatives: 1,
          true_negatives: 4,
          precision: 0.4,
          recall: 0.67,
          f1: 0.5,
          support: 3,
        },
        {
          label: 'b',
          true_positives: 4,
          false_positives: 1,
          false_negatives: 3,
          true_negatives: 2,
          precision: 0.8,
          recall: 0.57,
          f1: 0.67,
          support: 7,
        },
      ],
    };
    const result = generateHeatmapData(cm, 'column');
    expect(result.normalized).toBe(true);
    expect(result.values[0]?.[0]).toBeCloseTo(0.4);
    expect(result.values[1]?.[1]).toBeCloseTo(0.8);
  });

  it('heatmap with no normalization returns raw values', () => {
    const cm = {
      labels: ['a', 'b'],
      matrix: [
        [2, 1],
        [3, 4],
      ],
      per_class: [
        {
          label: 'a',
          true_positives: 2,
          false_positives: 3,
          false_negatives: 1,
          true_negatives: 4,
          precision: 0.4,
          recall: 0.67,
          f1: 0.5,
          support: 3,
        },
        {
          label: 'b',
          true_positives: 4,
          false_positives: 1,
          false_negatives: 3,
          true_negatives: 2,
          precision: 0.8,
          recall: 0.57,
          f1: 0.67,
          support: 7,
        },
      ],
    };
    const result = generateHeatmapData(cm, false);
    expect(result.normalized).toBe(false);
    expect(result.values[0]?.[0]).toBe(2);
  });

  it('PR curve produces thresholds with mixed positive/negative samples', () => {
    const samples = [
      { text: '1', label: 'auth', predicted_label: 'auth', confidence: 0.95 },
      { text: '2', label: 'billing', predicted_label: 'auth', confidence: 0.8 },
      { text: '3', label: 'auth', predicted_label: 'billing', confidence: 0.7 },
      { text: '4', label: 'auth', predicted_label: 'auth', confidence: 0.6 },
    ];
    const result = generatePRCurveData(samples, 'auth');
    expect(result.thresholds[0]).toBe(1.0);
    expect(result.precision[0]).toBe(1.0);
    expect(result.recall[0]).toBe(0);
    expect(result.thresholds.length).toBe(5);
  });

  it('supports custom prompt templates and empty aggregate edge cases', () => {
    registerCustomTemplate('strict-audit', {
      type: 'strict-audit',
      systemPrompt: 'Use strict rubric.',
      userPrompt: (currentSample) =>
        `Audit ${currentSample.label} against ${currentSample.predicted_label}`,
    });

    const template = getPromptTemplate('strict-audit');
    const prompt = formatPrompt(template, sample);
    expect(prompt.system).toBe('Use strict rubric.');
    expect(prompt.user).toContain('Audit auth against auth');

    const emptyCostAccount = {
      total_cost: 0,
      samples_processed: 0,
      avg_cost_per_sample: 0,
      input_tokens: 0,
      output_tokens: 0,
      api_calls: 0,
      budget_limit: 1,
      budget_remaining: 1,
      budget_exceeded: false,
      cost_by_model: {},
      cost_by_category: {},
    };

    const emptyAggregated = aggregateJudgeResults([], emptyCostAccount, {
      minSamplesPerClass: 1,
      biasDetectionThreshold: 0.1,
      includeDisagreementAnalysis: true,
      maxDisagreementSamples: 2,
    });
    expect(emptyAggregated.totalSamples).toBe(0);
    expect(emptyAggregated.avgJudgeConfidence).toBe(0);
    expect(emptyAggregated.agreementRate).toBe(0);
    expect(emptyAggregated.disagreementAnalysis?.falseNegatives).toEqual([]);

    const emptyConsensus = aggregateConsensusResults([], emptyCostAccount, {
      minSamplesPerClass: 1,
      biasDetectionThreshold: 0.1,
      includeDisagreementAnalysis: false,
      maxDisagreementSamples: 2,
    });
    expect(emptyConsensus.totalSamples).toBe(0);
    expect(emptyConsensus.avgJudgeConfidence).toBe(0);
    expect(emptyConsensus.costBreakdown.total_cost).toBe(0);
  });

  it('caps disagreement detail collections at the configured maximum', () => {
    const judgedResults = [
      {
        ...sample,
        text: 'false negative 1',
        judge_correct: false,
        judge_confidence: 0.4,
      },
      {
        ...sample,
        text: 'false negative 2',
        judge_correct: false,
        judge_confidence: 0.4,
      },
      {
        ...sample,
        text: 'false positive',
        label: 'billing',
        predicted_label: 'auth',
        judge_correct: true,
        judge_confidence: 0.7,
      },
      {
        ...sample,
        text: 'mutual error',
        label: 'support',
        predicted_label: 'auth',
        judge_correct: false,
        judge_confidence: 0.7,
      },
    ];
    const costAccount = {
      total_cost: 0.04,
      samples_processed: 4,
      avg_cost_per_sample: 0.01,
      input_tokens: 400,
      output_tokens: 100,
      api_calls: 4,
      budget_limit: 1,
      budget_remaining: 0.96,
      budget_exceeded: false,
      cost_by_model: { 'gpt-4o': 0.04 },
      cost_by_category: { default: 0.04 },
    };

    const aggregated = aggregateJudgeResults(judgedResults, costAccount, {
      minSamplesPerClass: 1,
      biasDetectionThreshold: 0.1,
      includeDisagreementAnalysis: true,
      maxDisagreementSamples: 1,
    });

    expect(aggregated.disagreementAnalysis?.falseNegatives).toHaveLength(1);
    expect(aggregated.disagreementAnalysis?.falsePositives).toHaveLength(1);
    expect(aggregated.disagreementAnalysis?.mutualErrors).toHaveLength(1);
  });

  it('calls callOpenAI path when OPENAI_API_KEY is set', async () => {
    vi.stubEnv('OPENAI_API_KEY', 'test-key');
    const judge = createJudgeEngine({
      model: 'gpt-4o',
      budget: { maxBudget: 10, alertThreshold: 80 },
    });
    const result = await judge.evaluateSample(sample);
    expect(result.result.judge_model).toContain('heuristic');
    vi.unstubAllEnvs();
  });

  it('calls callAnthropic path when ANTHROPIC_API_KEY is set', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'test-key');
    const judge = createJudgeEngine({
      model: 'claude-sonnet',
      budget: { maxBudget: 10, alertThreshold: 80 },
    });
    const result = await judge.evaluateSample(sample);
    expect(result.result.judge_model).toContain('heuristic');
    vi.unstubAllEnvs();
  });

  it('exposes isBudgetExceeded', () => {
    const judge = createJudgeEngine({
      model: 'gpt-4o',
      budget: { maxBudget: 10, alertThreshold: 80 },
    });
    expect(judge.isBudgetExceeded()).toBe(false);
    expect(judge.getCostBreakdown()).toBeDefined();
  });

  it('estimateCost returns a number', () => {
    const tracker = createCostTracker();
    const cost = tracker.estimateCost('gpt-4o', 1000, 500, 10);
    expect(cost).toBeGreaterThan(0);
  });

  it('estimateCost uses default pricing for unknown model', () => {
    const tracker = createCostTracker();
    const cost = tracker.estimateCost('unknown-model', 1000, 500, 10);
    expect(cost).toBeGreaterThan(0);
  });

  it('reset clears all counters', () => {
    const tracker = createCostTracker({ maxBudget: 1, alertThreshold: 50 });
    tracker.addCost('gpt-4o', 10000, 5000, 'correct');
    expect(tracker.getBreakdown().samplesProcessed).toBe(1);
    tracker.reset();
    expect(tracker.getBreakdown().samplesProcessed).toBe(0);
    expect(tracker.getBreakdown().totalCost).toBe(0);
    expect(tracker.isBudgetExceeded()).toBe(false);
    expect(tracker.isAlertTriggered()).toBe(false);
  });

  it('detects budget exceeded and alert transitions', () => {
    const tracker = createCostTracker({ maxBudget: 0.0001, alertThreshold: 50 });
    tracker.addCost('gpt-4o', 100, 50);
    expect(tracker.isBudgetExceeded()).toBe(true);
    expect(tracker.isAlertTriggered()).toBe(true);
  });

  it('stops batch evaluation when budget is exceeded mid-batch', async () => {
    const judge = createJudgeEngine({
      model: 'gpt-4o',
      budget: { maxBudget: 0.0000001, alertThreshold: 50 },
      maxConcurrency: 1,
    });
    const manySamples = Array.from({ length: 10 }, (_, i) => ({
      text: `text-${i}`,
      label: 'auth',
      predicted_label: 'auth',
      confidence: 0.9,
    }));
    const result = await judge.evaluateBatch(manySamples);
    expect(result.budgetExceeded).toBe(true);
    expect(result.samplesProcessed).toBeLessThan(10);
  });

  it('prevents evaluating a sample when the next request would exceed budget', () => {
    const judge = createJudgeEngine({
      model: 'gpt-4o',
      budget: { maxBudget: 0.0000001, alertThreshold: 50 },
    });

    expect(judge.canEvaluateSample(sample)).toBe(false);
    expect(judge.isBudgetExceeded()).toBe(true);
  });

  it('uses custom judge when provided', async () => {
    const judge = createJudgeEngine({
      model: 'gpt-4o',
      customJudge: async () => ({
        text: 'hi',
        label: 'auth',
        predicted_label: 'auth',
        confidence: 0.9,
        judge_correct: true,
        judge_confidence: 0.99,
        judge_reasoning: 'custom judge',
        judge_model: 'custom',
      }),
    });
    const result = await judge.evaluateSample(sample);
    expect(result.result.judge_correct).toBe(true);
    expect(result.result.judge_reasoning).toBe('custom judge');
  });

  it('reports failedCount when batch has failures', async () => {
    const judge = createJudgeEngine({
      model: 'gpt-4o',
      customJudge: async () => {
        throw new Error('judge failure');
      },
    });
    const result = await judge.evaluateBatch([sample]);
    expect(result.failedCount).toBe(1);
    expect(result.samplesProcessed).toBe(0);
  });

  it('returns agreementRate 0 for empty batch', async () => {
    const judge = createJudgeEngine({ model: 'gpt-4o' });
    const result = await judge.evaluateBatch([]);
    expect(result.agreementRate).toBe(0);
    expect(result.samplesProcessed).toBe(0);
  });

  it('heuristic judge returns correct result for mismatched labels', async () => {
    const judge = createJudgeEngine({ model: 'unknown-model' });
    const mismatchSample = {
      text: 'hello',
      label: 'billing',
      predicted_label: 'auth',
      confidence: 0.5,
    };
    const result = await judge.evaluateSample(mismatchSample);
    expect(result.result.judge_correct).toBe(false);
    expect(result.result.judge_confidence).toBe(0.8);
    expect(result.result.judge_reasoning).toContain('Predicted');
    expect(result.result.judge_model).toContain('heuristic');
  });

  it('heuristic judge returns correct result for matching labels', async () => {
    const judge = createJudgeEngine({ model: 'unknown-model' });
    const result = await judge.evaluateSample(sample);
    expect(result.result.judge_correct).toBe(true);
    expect(result.result.judge_confidence).toBe(0.95);
    expect(result.result.judge_reasoning).toContain('matches');
  });

  it('cost tracker tracks maxCostPerSample budget exceeded', () => {
    const tracker = createCostTracker({
      maxBudget: 100,
      alertThreshold: 80,
      maxCostPerSample: 0.000001,
    });
    tracker.addCost('gpt-4o', 10000, 5000, 'correct');
    expect(tracker.isBudgetExceeded()).toBe(true);
  });
});

describe('Prompt Templates', () => {
  it('formats error-categorization template', () => {
    const template = getPromptTemplate('error-categorization');
    const prompt = formatPrompt(template, sample);
    expect(prompt.system).toContain('categorizing classification errors');
    expect(prompt.user).toContain('Categorize this classification result');
    expect(prompt.user).toContain('Reset password');
  });

  it('formats ambiguity-detection template', () => {
    const template = getPromptTemplate('ambiguity-detection');
    const prompt = formatPrompt(template, sample);
    expect(prompt.system).toContain('ambiguity');
    expect(prompt.user).toContain('ambiguity');
  });

  it('formats multi-turn-eval template with conversation context', () => {
    const template = getPromptTemplate('multi-turn-eval');
    const multiSample = { ...sample, conversation_context: 'User previously asked about billing' };
    const prompt = formatPrompt(template, multiSample);
    expect(prompt.user).toContain('Conversation Context');
    expect(prompt.user).toContain('billing');
  });

  it('formats multi-turn-eval template without conversation context', () => {
    const template = getPromptTemplate('multi-turn-eval');
    const prompt = formatPrompt(template, sample);
    expect(prompt.user).not.toContain('Conversation Context');
    expect(prompt.user).toContain('Evaluate this classification');
  });

  it('falls back to classification-eval for unknown template', () => {
    const template = getPromptTemplate('nonexistent-template');
    expect(template.type).toBe('classification-eval');
  });
});

describe('calculateMetricsFromCM', () => {
  it('computes metrics from a confusion matrix', () => {
    const cm = buildConfusionMatrix([
      { text: 'a', label: 'cat', predicted_label: 'cat', confidence: 0.9 },
      { text: 'b', label: 'cat', predicted_label: 'dog', confidence: 0.8 },
      { text: 'c', label: 'dog', predicted_label: 'dog', confidence: 0.7 },
    ]);
    const metrics = calculateMetricsFromCM(cm);
    expect(metrics.accuracy).toBeGreaterThan(0);
    expect(metrics.total_samples).toBe(3);
    expect(metrics.matthews_correlation).toBeGreaterThan(-1);
    expect(metrics.matthews_correlation).toBeLessThanOrEqual(1);
    expect(metrics.cohens_kappa).toBeGreaterThan(-1);
    expect(metrics.cohens_kappa).toBeLessThanOrEqual(1);
  });
});

describe('Bias detection in summary report', () => {
  it('includes bias section when biases detected', () => {
    const judgedResults = Array.from({ length: 15 }, (_, i) => ({
      text: `text-${i}`,
      label: i < 5 ? 'alpha' : i < 10 ? 'beta' : 'gamma',
      predicted_label: i < 3 ? 'alpha' : i < 5 ? 'wrong' : i < 10 ? 'beta' : 'gamma',
      confidence: 0.9,
      judge_correct: i < 3 || (i >= 5 && i < 10) || i >= 12,
      judge_confidence: i < 5 ? 0.9 : 0.5,
      judge_reasoning: 'reason',
      judge_model: 'test',
      judge_cost: 0.01,
    }));

    const costAccount = {
      total_cost: 0.15,
      samples_processed: 15,
      avg_cost_per_sample: 0.01,
      input_tokens: 1500,
      output_tokens: 600,
      api_calls: 15,
      budget_limit: 1,
      budget_remaining: 0.85,
      budget_exceeded: false,
      cost_by_model: { test: 0.15 },
      cost_by_category: { default: 0.15 },
    };

    const aggregated = aggregateJudgeResults(judgedResults, costAccount, {
      minSamplesPerClass: 1,
      biasDetectionThreshold: 0.1,
      includeDisagreementAnalysis: true,
      maxDisagreementSamples: 10,
    });

    const report = generateJudgeSummaryReport(aggregated);
    if (aggregated.biases.length > 0) {
      expect(report).toContain('Systematic Biases Detected');
    }
    expect(report).toContain('LLM Judge Evaluation Summary');
  });
});
