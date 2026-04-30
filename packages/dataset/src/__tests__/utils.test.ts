import { describe, expect, it } from 'vitest';
import {
  applyLabelAliases,
  computeHierarchicalMetrics,
  getLabelStats,
  getLabelsAtLevel,
  getParentLabel,
  handleUnknownLabels,
  isLeafLabel,
  normalizeLabel,
  normalizeLabels,
} from '../label-manager.js';
import { kFoldSplit, kFoldSplits, splitDataset } from '../splitter.js';
import {
  getDatasetSummary,
  validateDataset,
  validateSamples,
} from '../validator.js';
import type { EvalDataset } from '@reaatech/classifier-evals';

function createDataset(): EvalDataset {
  return {
    samples: [
      {
        text: 'Reset password',
        label: 'auth.login',
        predicted_label: 'auth.login',
        confidence: 0.9,
      },
      {
        text: 'Refund request',
        label: 'billing.refund',
        predicted_label: 'billing.refund',
        confidence: 0.8,
      },
      {
        text: 'Close account',
        label: 'account.close',
        predicted_label: 'unknown',
        confidence: 0.4,
      },
      {
        text: 'Reset password',
        label: 'auth.login',
        predicted_label: 'auth.login',
        confidence: 0.95,
      },
      {
        text: 'Need help',
        label: 'support.agent',
        predicted_label: 'support.agent',
        confidence: 0.7,
      },
      {
        text: 'Delete profile',
        label: 'account.close',
        predicted_label: 'account.close',
        confidence: 0.9,
      },
    ],
    metadata: {
      format: 'jsonl',
      path: '/tmp/test.jsonl',
      total_samples: 6,
      labels: ['account.close', 'auth.login', 'billing.refund', 'support.agent'],
      label_distribution: {
        'account.close': 2,
        'auth.login': 2,
        'billing.refund': 1,
        'support.agent': 1,
      },
      has_confidence: true,
      loaded_at: new Date().toISOString(),
    },
  };
}

describe('dataset utilities', () => {
  it('normalizes labels, applies aliases, and handles unknown labels', () => {
    const dataset = createDataset();
    expect(normalizeLabel('  Auth Login  ', { normalizeSeparators: 'underscores' })).toBe(
      'auth_login',
    );

    const normalized = normalizeLabels(dataset, { normalizeSeparators: 'underscores' });
    expect(normalized.samples[0]?.label).toBe('auth.login');

    const aliased = applyLabelAliases(dataset, { unknown: 'support.agent' });
    expect(aliased.samples[2]?.predicted_label).toBe('support.agent');

    const removed = handleUnknownLabels(dataset, {
      action: 'remove',
      knownLabels: ['auth.login', 'billing.refund', 'account.close', 'support.agent'],
    });
    expect(removed.samples).toHaveLength(5);

    const mapped = handleUnknownLabels(dataset, {
      action: 'map_to_unknown',
      knownLabels: ['auth.login', 'billing.refund', 'account.close', 'support.agent'],
    });
    expect(mapped.samples[2]?.predicted_label).toBe('unknown');
  });

  it('computes hierarchy helpers and stats', () => {
    const dataset = createDataset();
    const hierarchy = {
      auth: ['auth.login'],
      billing: ['billing.refund'],
      account: ['account.close'],
      support: ['support.agent'],
    };

    expect(getParentLabel('auth.login', hierarchy)).toBe('auth');
    expect(isLeafLabel('auth.login', hierarchy)).toBe(true);
    expect(getLabelsAtLevel(hierarchy, 0)).toContain('auth');
    expect(computeHierarchicalMetrics(dataset, hierarchy, 0).total).toBe(0);

    const stats = getLabelStats(dataset);
    expect(stats.uniqueLabels).toBe(4);
    expect(stats.mostCommon).toBeDefined();
  });

  it('splits and validates datasets', () => {
    const dataset = createDataset();
    const split = splitDataset(dataset, { testSize: 0.33, stratify: true, seed: 7 });
    expect(split.train.samples.length + split.test.samples.length).toBe(dataset.samples.length);

    const folds = kFoldSplit(dataset, 3, 7);
    expect(folds).toHaveLength(3);

    const foldSplits = kFoldSplits(dataset, 3, 7);
    expect(foldSplits).toHaveLength(3);
    expect(() => kFoldSplit(dataset, 1)).toThrow('k must be at least 2');

    const validation = validateDataset(dataset);
    expect(validation.valid).toBe(true);
    expect(validation.warnings.length).toBeGreaterThan(0);

    const invalid = validateSamples([
      { text: '', label: 'x', predicted_label: 'x', confidence: 2 },
    ]);
    expect(invalid.valid).toBe(false);

    const summary = getDatasetSummary(dataset);
    expect(summary.totalSamples).toBe(6);
    expect(summary.hasConfidence).toBe(true);
  });

  it('handleUnknownLabels with keep action preserves all samples', () => {
    const dataset = createDataset();
    const result = handleUnknownLabels(dataset, {
      action: 'keep',
      knownLabels: ['auth.login'],
    });
    expect(result.samples).toHaveLength(6);
  });

  it('handleUnknownLabels uses dataset labels when knownLabels not provided', () => {
    const dataset = createDataset();
    const result = handleUnknownLabels(dataset, { action: 'remove' });
    expect(result.samples).toHaveLength(5);
  });

  it('normalizes labels with spaces separator and custom normalizer', () => {
    expect(normalizeLabel('auth_login', { normalizeSeparators: 'spaces' })).toBe('auth login');
    expect(normalizeLabel('  HELLO  ', { lowercase: false, trim: true })).toBe('HELLO');
    expect(normalizeLabel('test', { custom: (l) => l.toUpperCase() })).toBe('TEST');
  });

  it('computeHierarchicalMetrics exercises the hierarchy walk paths', () => {
    const dataset: EvalDataset = {
      samples: [
        { text: 'a', label: 'auth', predicted_label: 'auth', confidence: 0.9 },
        { text: 'b', label: 'billing', predicted_label: 'billing', confidence: 0.8 },
        { text: 'c', label: 'auth', predicted_label: 'billing', confidence: 0.7 },
      ],
      metadata: {
        format: 'jsonl',
        path: '/tmp/test.jsonl',
        total_samples: 3,
        labels: ['auth', 'billing'],
        label_distribution: { auth: 2, billing: 1 },
        has_confidence: true,
        loaded_at: new Date().toISOString(),
      },
    };

    const hierarchy = {
      root: ['auth', 'billing'],
    };

    const metrics = computeHierarchicalMetrics(dataset, hierarchy, 1);
    expect(metrics).toBeDefined();
    expect(typeof metrics.total).toBe('number');
    expect(typeof metrics.accuracy).toBe('number');
  });

  it('getLabelsAtLevel returns labels at level 1', () => {
    const hierarchy = {
      auth: ['auth.login', 'auth.logout'],
      billing: ['billing.refund'],
    };

    const level1 = getLabelsAtLevel(hierarchy, 1);
    expect(level1).toContain('auth.login');
    expect(level1).toContain('auth.logout');
    expect(level1).toContain('billing.refund');
  });

  it('isLeafLabel returns true for labels not in hierarchy', () => {
    const hierarchy = { auth: ['auth.login'] };
    expect(isLeafLabel('auth', hierarchy)).toBe(false);
    expect(isLeafLabel('nonexistent', hierarchy)).toBe(true);
  });

  it('getParentLabel returns null for unknown labels', () => {
    const hierarchy = { auth: ['auth.login'] };
    expect(getParentLabel('unknown', hierarchy)).toBeNull();
  });

  it('applyLabelAliases recomputes metadata', () => {
    const dataset = createDataset();
    const aliased = applyLabelAliases(dataset, {});
    expect(aliased.metadata.labels).toBeDefined();
    expect(aliased.metadata.labels!.length).toBeGreaterThan(0);
  });

  it('normalizeLabels recomputes metadata', () => {
    const dataset = createDataset();
    const normalized = normalizeLabels(dataset, {});
    expect(normalized.metadata.labels).toBeDefined();
  });

  it('detects moderate class imbalance', () => {
    const dataset: EvalDataset = {
      samples: Array.from({ length: 20 }, (_, i) => ({
        text: `sample-${i}`,
        label: i < 17 ? 'majority' : 'minority',
        predicted_label: i < 17 ? 'majority' : 'minority',
        confidence: 0.9,
      })),
      metadata: {
        format: 'jsonl',
        path: '/tmp/test.jsonl',
        total_samples: 20,
        labels: ['majority', 'minority'],
        label_distribution: { majority: 17, minority: 3 },
        has_confidence: true,
        loaded_at: new Date().toISOString(),
      },
    };

    const result = validateDataset(dataset);
    const imbalanceWarnings = result.warnings.filter((w) => w.type === 'moderate_imbalance');
    expect(imbalanceWarnings.length).toBeGreaterThan(0);
  });

  it('detects too many classes relative to samples', () => {
    const samples = Array.from({ length: 4 }, (_, i) => ({
      text: `sample-${i}`,
      label: `label-${i}`,
      predicted_label: `label-${i}`,
      confidence: 0.9,
    }));

    const result = validateSamples(samples);
    const classWarnings = result.warnings.filter((w) => w.type === 'too_many_classes');
    expect(classWarnings.length).toBeGreaterThan(0);
  });

  it('detects suspected data leakage with high accuracy', async () => {
    const samples = Array.from({ length: 20 }, (_, i) => ({
      text: `sample-${i}`,
      label: `label-${i % 3}`,
      predicted_label: `label-${i % 3}`,
      confidence: 0.9,
    }));

    const { loadDatasetFromContent } = await import('../loader.js');
    const dataset = await loadDatasetFromContent(JSON.stringify(samples), 'json');
    const result = validateDataset(dataset);
    const leakageWarnings = result.warnings.filter((w) => w.type === 'suspected_data_leakage');
    expect(leakageWarnings.length).toBeGreaterThan(0);
  });

  it('detects low confidence majority', async () => {
    const samples = Array.from({ length: 10 }, (_, i) => ({
      text: `sample-${i}`,
      label: `label-${i % 2}`,
      predicted_label: `label-${i % 2}`,
      confidence: 0.2,
    }));

    const { loadDatasetFromContent } = await import('../loader.js');
    const dataset = await loadDatasetFromContent(JSON.stringify(samples), 'json');
    const result = validateDataset(dataset);
    const confWarnings = result.warnings.filter((w) => w.type === 'low_confidence_majority');
    expect(confWarnings.length).toBeGreaterThan(0);
  });
});
