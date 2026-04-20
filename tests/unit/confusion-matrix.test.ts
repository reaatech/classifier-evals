/**
 * Unit tests for confusion matrix calculation
 */

import { describe, it, expect } from 'vitest';
import {
  buildConfusionMatrix,
  formatConfusionMatrix,
  getDiagonal,
  getErrorRates,
  getTopMisclassifications,
  getTotalCorrect,
  getTotalSamples,
  normalizeConfusionMatrix,
} from '../../src/metrics/confusion-matrix.js';
import { calculateAllMetrics } from '../../src/metrics/classification-metrics.js';

describe('Confusion Matrix', () => {
  const samples = [
    { text: 'a', label: 'cat', predicted_label: 'cat', confidence: 0.9 },
    { text: 'b', label: 'cat', predicted_label: 'dog', confidence: 0.8 },
    { text: 'c', label: 'dog', predicted_label: 'dog', confidence: 0.7 },
    { text: 'd', label: 'dog', predicted_label: 'bird', confidence: 0.6 },
    { text: 'e', label: 'bird', predicted_label: 'bird', confidence: 0.5 },
  ];

  it('should build confusion matrix correctly', () => {
    const cm = buildConfusionMatrix(samples);

    expect(cm.labels).toEqual(['bird', 'cat', 'dog']);
    // bird: 1->bird, cat: 1->cat, 1->dog, dog: 1->dog, 1->bird
    expect(cm.matrix).toEqual([
      [1, 0, 0], // bird -> bird, cat, dog
      [0, 1, 1], // cat -> bird, cat, dog
      [1, 0, 1], // dog -> bird, cat, dog
    ]);
  });

  it('should calculate per-class metrics', () => {
    const cm = buildConfusionMatrix(samples);

    expect(cm.per_class.length).toBe(3);

    // Verify the actual values from our implementation
    const catMetrics = cm.per_class.find((c) => c.label === 'cat');
    // cat: TP=1, FP=0 (nothing predicted as cat incorrectly), FN=1 (one cat predicted as dog)
    // => precision=1.0, recall=0.5
    expect(catMetrics?.precision).toBeCloseTo(1.0);
    expect(catMetrics?.recall).toBeCloseTo(0.5);

    const dogMetrics = cm.per_class.find((c) => c.label === 'dog');
    // dog: TP=1, FP=1 (cat predicted as dog), FN=1 (dog predicted as bird)
    // => precision=0.5, recall=0.5
    expect(dogMetrics?.precision).toBeCloseTo(0.5);
    expect(dogMetrics?.recall).toBeCloseTo(0.5);

    const birdMetrics = cm.per_class.find((c) => c.label === 'bird');
    // bird: TP=1, FP=1 (dog predicted as bird), FN=0
    // => precision=0.5, recall=1.0
    expect(birdMetrics?.precision).toBeCloseTo(0.5);
    expect(birdMetrics?.recall).toBeCloseTo(1.0);
  });

  it('should get diagonal correctly', () => {
    const cm = buildConfusionMatrix(samples);
    expect(getDiagonal(cm)).toEqual([1, 1, 1]);
  });

  it('should calculate total correct', () => {
    const cm = buildConfusionMatrix(samples);
    expect(getTotalCorrect(cm)).toBe(3);
  });

  it('should calculate total samples', () => {
    const cm = buildConfusionMatrix(samples);
    expect(getTotalSamples(cm)).toBe(5);
  });

  it('should normalize the confusion matrix and report error helpers', () => {
    const cm = buildConfusionMatrix(samples);

    const normalizedRows = normalizeConfusionMatrix(cm, 'true');
    expect(normalizedRows[1]?.[1]).toBeCloseTo(0.5);
    expect(normalizedRows[1]?.[2]).toBeCloseTo(0.5);

    const normalizedAll = normalizeConfusionMatrix(cm, 'all');
    expect(normalizedAll.flat().reduce((sum, value) => sum + value, 0)).toBeCloseTo(1);

    const errors = getErrorRates(cm);
    expect(errors.cat).toBeCloseTo(0.5);

    const topMisclassifications = getTopMisclassifications(cm, 2);
    expect(topMisclassifications[0]).toEqual({
      trueLabel: 'cat',
      predictedLabel: 'dog',
      count: 1,
    });

    const formatted = formatConfusionMatrix(cm);
    expect(formatted).toContain('Predicted');
    expect(formatted).toContain('bird');
  });
});

describe('Classification Metrics', () => {
  const samples = [
    { text: 'a', label: 'cat', predicted_label: 'cat', confidence: 0.9 },
    { text: 'b', label: 'cat', predicted_label: 'dog', confidence: 0.8 },
    { text: 'c', label: 'dog', predicted_label: 'dog', confidence: 0.7 },
    { text: 'd', label: 'dog', predicted_label: 'bird', confidence: 0.6 },
    { text: 'e', label: 'bird', predicted_label: 'bird', confidence: 0.5 },
  ];

  it('should calculate all metrics', () => {
    const metrics = calculateAllMetrics(samples);

    expect(metrics.accuracy).toBe(0.6);
    expect(metrics.total_samples).toBe(5);
    expect(metrics.correct_predictions).toBe(3);
  });

  it('should calculate accuracy correctly', () => {
    const metrics = calculateAllMetrics(samples);
    expect(metrics.accuracy).toBeCloseTo(0.6);
  });

  it('should handle empty samples', () => {
    const metrics = calculateAllMetrics([]);
    expect(metrics.accuracy).toBe(0);
    expect(metrics.total_samples).toBe(0);
  });

  it('should normalize by predicted labels (pred mode)', () => {
    const cm = buildConfusionMatrix(samples);
    const normalizedPred = normalizeConfusionMatrix(cm, 'pred');

    // Verify column-wise normalization
    const colSums = cm.matrix[0]!.map((_, j) => cm.matrix.reduce((sum, row) => sum + row[j]!, 0));

    for (let j = 0; j < cm.labels.length; j++) {
      if (colSums[j]! > 0) {
        const colTotal = normalizedPred.reduce((s, row) => s + row[j]!, 0);
        expect(colTotal).toBeCloseTo(1);
      }
    }
  });

  it('should handle empty rows in true normalization mode', () => {
    const cm = {
      labels: ['a', 'b', 'c'],
      matrix: [
        [0, 0, 0],
        [1, 2, 0],
        [0, 0, 3],
      ],
      per_class: [
        {
          label: 'a',
          true_positives: 0,
          false_positives: 0,
          false_negatives: 0,
          true_negatives: 6,
          precision: 0,
          recall: 0,
          f1: 0,
          support: 0,
        },
        {
          label: 'b',
          true_positives: 2,
          false_positives: 1,
          false_negatives: 0,
          true_negatives: 3,
          precision: 0.67,
          recall: 1,
          f1: 0.8,
          support: 3,
        },
        {
          label: 'c',
          true_positives: 3,
          false_positives: 0,
          false_negatives: 0,
          true_negatives: 3,
          precision: 1,
          recall: 1,
          f1: 1,
          support: 3,
        },
      ],
    };

    const normalized = normalizeConfusionMatrix(cm, 'true');
    expect(normalized[0]).toEqual([0, 0, 0]);
  });
});
