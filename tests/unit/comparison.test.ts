import { describe, expect, it } from 'vitest';
import {
  calculateEffectSize,
  compareModels,
  comparePersistedEvalRuns,
  mcnemarTest,
  pairedComparison,
  summarizeComparison,
} from '../../src/metrics/comparison.js';
import { createEvalRunFromSamples } from '../../src/utils/eval-run.js';

describe('comparePersistedEvalRuns', () => {
  it('compares persisted eval runs without raw predictions', () => {
    const baseline = createEvalRunFromSamples({
      samples: [
        { text: 'a', label: 'alpha', predicted_label: 'alpha', confidence: 0.9 },
        { text: 'b', label: 'beta', predicted_label: 'beta', confidence: 0.9 },
      ],
    });
    const candidate = createEvalRunFromSamples({
      samples: [
        { text: 'a', label: 'alpha', predicted_label: 'alpha', confidence: 0.9 },
        { text: 'b', label: 'beta', predicted_label: 'alpha', confidence: 0.9 },
      ],
    });

    const comparison = comparePersistedEvalRuns(baseline, candidate);
    expect(comparison.baseline_accuracy).toBe(1);
    expect(comparison.candidate_accuracy).toBe(0.5);
    expect(comparison.p_value).toBeDefined();
    expect(comparison.is_significant).toBeDefined();
    expect(comparison.effect_size).toBeDefined();
    expect(comparison.per_class_comparison).toHaveLength(2);
    expect(summarizeComparison(comparison)).toContain('regression');
  });

  it('compares raw model predictions with paired statistics', () => {
    const samples = [
      { text: 'a', label: 'alpha', predicted_label: 'alpha', confidence: 0.9 },
      { text: 'b', label: 'beta', predicted_label: 'beta', confidence: 0.9 },
      { text: 'c', label: 'gamma', predicted_label: 'beta', confidence: 0.9 },
    ];
    const baselinePredictions = ['alpha', 'beta', 'alpha'];
    const candidatePredictions = ['alpha', 'alpha', 'gamma'];

    const paired = pairedComparison(samples, baselinePredictions, candidatePredictions);
    expect(paired.total).toBe(3);

    const mcnemar = mcnemarTest(samples, baselinePredictions, candidatePredictions);
    expect(mcnemar.pValue).toBeGreaterThanOrEqual(0);

    const rawComparison = compareModels(
      samples.map((sample, index) => ({
        ...sample,
        predicted_label: baselinePredictions[index]!,
      })),
      samples.map((sample, index) => ({
        ...sample,
        predicted_label: candidatePredictions[index]!,
      })),
    );
    expect(rawComparison.per_class_comparison).toHaveLength(3);
    expect(calculateEffectSize([0.5, 0.6], [0.7, 0.8])).toBeGreaterThan(0);
  });

  it('summarizes comparison with p_value and effect_size', () => {
    const baseline = createEvalRunFromSamples({
      samples: [
        { text: 'a', label: 'alpha', predicted_label: 'alpha', confidence: 0.9 },
        { text: 'b', label: 'beta', predicted_label: 'beta', confidence: 0.9 },
      ],
    });
    const candidate = createEvalRunFromSamples({
      samples: [
        { text: 'a', label: 'alpha', predicted_label: 'alpha', confidence: 0.9 },
        { text: 'b', label: 'beta', predicted_label: 'alpha', confidence: 0.9 },
      ],
    });

    const comparison = comparePersistedEvalRuns(baseline, candidate);
    comparison.p_value = 0.03;
    comparison.effect_size = 0.5;
    comparison.is_significant = true;

    const summary = summarizeComparison(comparison);
    expect(summary).toContain('Statistical test p-value');
    expect(summary).toContain('Effect size');
    expect(summary).toContain('significant');
  });

  it('handles McNemar test when n01 + n10 is 0', () => {
    const samples = [
      { text: 'a', label: 'alpha', predicted_label: 'alpha', confidence: 0.9 },
      { text: 'b', label: 'beta', predicted_label: 'beta', confidence: 0.9 },
    ];
    const baselinePredictions = ['alpha', 'beta'];
    const candidatePredictions = ['alpha', 'beta'];
    const result = mcnemarTest(samples, baselinePredictions, candidatePredictions);
    expect(result.statistic).toBe(0);
    expect(result.pValue).toBe(1);
    expect(result.significant).toBe(false);
  });

  it('handles McNemar test with discordant pairs', () => {
    const samples = [
      { text: 'a', label: 'alpha', predicted_label: 'alpha', confidence: 0.9 },
      { text: 'b', label: 'beta', predicted_label: 'beta', confidence: 0.9 },
      { text: 'c', label: 'gamma', predicted_label: 'gamma', confidence: 0.9 },
      { text: 'd', label: 'delta', predicted_label: 'delta', confidence: 0.9 },
    ];
    const baselinePredictions = ['alpha', 'wrong1', 'gamma', 'wrong2'];
    const candidatePredictions = ['wrong1', 'beta', 'wrong2', 'delta'];
    const result = mcnemarTest(samples, baselinePredictions, candidatePredictions);
    expect(result.pValue).toBeGreaterThanOrEqual(0);
    expect(result.pValue).toBeLessThanOrEqual(1);
  });

  it('effect size returns 0 for empty arrays', () => {
    expect(calculateEffectSize([], [0.5])).toBe(0);
    expect(calculateEffectSize([0.5], [])).toBe(0);
    expect(calculateEffectSize([], [])).toBe(0);
  });

  it('effect size returns 0 for zero pooled std', () => {
    expect(calculateEffectSize([0.5, 0.5], [0.5, 0.5])).toBe(0);
  });

  it('effect size returns 0 for non-finite result', () => {
    expect(calculateEffectSize([0], [0])).toBe(0);
  });

  it('pairedComparison throws for mismatched lengths', () => {
    const samples = [{ text: 'a', label: 'alpha', predicted_label: 'alpha', confidence: 0.9 }];
    expect(() => pairedComparison(samples, ['alpha'], ['alpha', 'beta'])).toThrow('same length');
    expect(() => pairedComparison(samples, ['alpha', 'beta'], ['alpha'])).toThrow('same length');
  });

  it('covers all four paired comparison outcomes', () => {
    const samples = [
      { text: '1', label: 'a', predicted_label: 'a', confidence: 0.9 },
      { text: '2', label: 'b', predicted_label: 'b', confidence: 0.9 },
      { text: '3', label: 'c', predicted_label: 'c', confidence: 0.9 },
      { text: '4', label: 'd', predicted_label: 'd', confidence: 0.9 },
    ];
    const baseline = ['a', 'wrong', 'c', 'wrong'];
    const candidate = ['a', 'b', 'wrong', 'wrong'];
    const result = pairedComparison(samples, baseline, candidate);
    expect(result.bothCorrect).toBe(1);
    expect(result.neitherCorrect).toBe(1);
  });

  it('summarizes improvement comparison', () => {
    const baseline = createEvalRunFromSamples({
      samples: [
        { text: 'a', label: 'alpha', predicted_label: 'alpha', confidence: 0.9 },
        { text: 'b', label: 'beta', predicted_label: 'alpha', confidence: 0.9 },
      ],
    });
    const candidate = createEvalRunFromSamples({
      samples: [
        { text: 'a', label: 'alpha', predicted_label: 'alpha', confidence: 0.9 },
        { text: 'b', label: 'beta', predicted_label: 'beta', confidence: 0.9 },
      ],
    });
    const comparison = comparePersistedEvalRuns(baseline, candidate);
    comparison.p_value = 0.01;
    comparison.effect_size = 0.9;
    comparison.is_significant = true;
    const summary = summarizeComparison(comparison);
    expect(summary).toContain('improvement');
    expect(summary).toContain('large');
    expect(summary).toContain('significant');
  });
});
