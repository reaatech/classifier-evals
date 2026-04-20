/**
 * Label management utilities for classifier evaluation
 * Handles label normalization, aliasing, unknown label handling, and hierarchy
 */

import { ClassificationResult, EvalDataset } from '../types/index.js';

/**
 * Label alias mapping (synonym -> canonical label)
 */
export type LabelAliases = Record<string, string>;

/**
 * Label hierarchy (parent -> children)
 */
export type LabelHierarchy = Record<string, string[]>;

/**
 * Options for label normalization
 */
export interface NormalizationOptions {
  /** Convert to lowercase */
  lowercase?: boolean;
  /** Trim whitespace */
  trim?: boolean;
  /** Replace underscores with spaces or vice versa */
  normalizeSeparators?: 'spaces' | 'underscores' | 'none';
  /** Custom normalization function */
  custom?: (label: string) => string;
}

/**
 * Normalize a single label string
 */
export function normalizeLabel(label: string, options: NormalizationOptions = {}): string {
  let normalized = label;

  if (options.lowercase ?? true) {
    normalized = normalized.toLowerCase();
  }

  if (options.trim ?? true) {
    normalized = normalized.trim();
  }

  if (options.normalizeSeparators === 'spaces') {
    normalized = normalized.replace(/[_-]/g, ' ');
  } else if (options.normalizeSeparators === 'underscores') {
    normalized = normalized.replace(/\s+/g, '_');
  }

  if (options.custom) {
    normalized = options.custom(normalized);
  }

  return normalized;
}

/**
 * Apply label aliases to a classification result
 */
function applyAliases(sample: ClassificationResult, aliases: LabelAliases): ClassificationResult {
  const applyAlias = (label: string): string => {
    const normalized = normalizeLabel(label);
    return aliases[normalized] ?? label;
  };

  return {
    ...sample,
    label: applyAlias(sample.label),
    predicted_label: applyAlias(sample.predicted_label),
  };
}

/**
 * Apply label aliases to a dataset
 */
export function applyLabelAliases(dataset: EvalDataset, aliases: LabelAliases): EvalDataset {
  const newSamples = dataset.samples.map((s) => applyAliases(s, aliases));

  // Recompute metadata
  const labels = new Set<string>();
  const labelDist: Record<string, number> = {};
  for (const sample of newSamples) {
    labels.add(sample.label);
    labelDist[sample.label] = (labelDist[sample.label] ?? 0) + 1;
  }

  return {
    samples: newSamples,
    metadata: {
      ...dataset.metadata,
      labels: Array.from(labels).sort(),
      label_distribution: labelDist,
    },
  };
}

/**
 * Normalize labels across a dataset
 */
export function normalizeLabels(
  dataset: EvalDataset,
  options: NormalizationOptions = {},
): EvalDataset {
  const newSamples = dataset.samples.map((sample) => ({
    ...sample,
    label: normalizeLabel(sample.label, options),
    predicted_label: normalizeLabel(sample.predicted_label, options),
  }));

  // Recompute metadata
  const labels = new Set<string>();
  const labelDist: Record<string, number> = {};
  for (const sample of newSamples) {
    labels.add(sample.label);
    labelDist[sample.label] = (labelDist[sample.label] ?? 0) + 1;
  }

  return {
    samples: newSamples,
    metadata: {
      ...dataset.metadata,
      labels: Array.from(labels).sort(),
      label_distribution: labelDist,
    },
  };
}

/**
 * Handle unknown labels (labels not in the known set)
 */
export interface UnknownLabelOptions {
  /** Action to take for unknown labels: 'keep', 'remove', 'map_to_unknown' */
  action: 'keep' | 'remove' | 'map_to_unknown';
  /** Known labels (if not provided, uses labels from dataset) */
  knownLabels?: string[];
  /** Unknown label name (default: 'unknown') */
  unknownLabel?: string;
}

/**
 * Handle unknown labels in a dataset
 */
export function handleUnknownLabels(
  dataset: EvalDataset,
  options: UnknownLabelOptions,
): EvalDataset {
  const knownLabels = new Set(options.knownLabels ?? dataset.metadata.labels);
  const unknownLabel = options.unknownLabel ?? 'unknown';

  let newSamples: ClassificationResult[];

  switch (options.action) {
    case 'keep':
      newSamples = dataset.samples;
      break;

    case 'remove':
      newSamples = dataset.samples.filter(
        (s) => knownLabels.has(s.label) && knownLabels.has(s.predicted_label),
      );
      break;

    case 'map_to_unknown':
      newSamples = dataset.samples.map((s) => ({
        ...s,
        label: knownLabels.has(s.label) ? s.label : unknownLabel,
        predicted_label: knownLabels.has(s.predicted_label) ? s.predicted_label : unknownLabel,
      }));
      break;
  }

  // Recompute metadata
  const labels = new Set<string>();
  const labelDist: Record<string, number> = {};
  for (const sample of newSamples) {
    labels.add(sample.label);
    labelDist[sample.label] = (labelDist[sample.label] ?? 0) + 1;
  }

  return {
    samples: newSamples,
    metadata: {
      ...dataset.metadata,
      labels: Array.from(labels).sort(),
      label_distribution: labelDist,
    },
  };
}

/**
 * Get parent label for a given label in a hierarchy
 */
export function getParentLabel(label: string, hierarchy: LabelHierarchy): string | null {
  for (const [parent, children] of Object.entries(hierarchy)) {
    if (children.includes(label)) {
      return parent;
    }
  }
  return null;
}

/**
 * Check if a label is a leaf node in the hierarchy
 */
export function isLeafLabel(label: string, hierarchy: LabelHierarchy): boolean {
  return !hierarchy[label] || hierarchy[label].length === 0;
}

/**
 * Get all labels at a specific level in the hierarchy
 */
export function getLabelsAtLevel(hierarchy: LabelHierarchy, level: number = 0): string[] {
  if (level === 0) {
    // Root level - labels that are not children of any other label
    const allChildren = new Set(Object.values(hierarchy).flat());
    return Object.keys(hierarchy).filter((k) => !allChildren.has(k));
  }

  // Get labels at the specified level
  const labelsAtLevel: string[] = [];

  function traverse(current: string, currentLevel: number): void {
    if (currentLevel === level) {
      labelsAtLevel.push(current);
      return;
    }

    const children = hierarchy[current] ?? [];
    for (const child of children) {
      traverse(child, currentLevel + 1);
    }
  }

  // Start from root labels
  const rootLabels = getLabelsAtLevel(hierarchy, 0);
  for (const root of rootLabels) {
    traverse(root, 0);
  }

  return labelsAtLevel;
}

/**
 * Compute metrics at a specific level in the hierarchy
 */
export function computeHierarchicalMetrics(
  dataset: EvalDataset,
  hierarchy: LabelHierarchy,
  level: number = 0,
): { total: number; correct: number; accuracy: number } {
  const labelsAtLevel = getLabelsAtLevel(hierarchy, level);
  const labelSet = new Set(labelsAtLevel);

  let total = 0;
  let correct = 0;

  for (const sample of dataset.samples) {
    // Get parent labels at the specified level
    let labelParent = sample.label;
    let predictedParent = sample.predicted_label;

    // Walk up the hierarchy until we reach the target level or a root
    let currentLevel = 0;
    while (currentLevel < level) {
      const parent = getParentLabel(labelParent, hierarchy);
      if (parent === null) {
        break;
      }
      labelParent = parent;
      currentLevel++;
    }

    currentLevel = 0;
    while (currentLevel < level) {
      const parent = getParentLabel(predictedParent, hierarchy);
      if (parent === null) {
        break;
      }
      predictedParent = parent;
      currentLevel++;
    }

    // Only count if both are at the target level
    if (labelSet.has(labelParent) && labelSet.has(predictedParent)) {
      total++;
      if (labelParent === predictedParent) {
        correct++;
      }
    }
  }

  return {
    total,
    correct,
    accuracy: total > 0 ? correct / total : 0,
  };
}

/**
 * Get label statistics for a dataset
 */
export function getLabelStats(dataset: EvalDataset): {
  totalLabels: number;
  uniqueLabels: number;
  distribution: Record<string, number>;
  mostCommon: string;
  leastCommon: string;
  avgSamplesPerLabel: number;
} {
  const distribution = dataset.metadata.label_distribution;
  const entries = Object.entries(distribution);

  const mostCommon = entries.reduce((a, b) => (b[1] > a[1] ? b : a))[0];
  const leastCommon = entries.reduce((a, b) => (b[1] < a[1] ? b : a))[0];

  return {
    totalLabels: dataset.samples.length,
    uniqueLabels: dataset.metadata.labels.length,
    distribution,
    mostCommon,
    leastCommon,
    avgSamplesPerLabel: dataset.samples.length / dataset.metadata.labels.length,
  };
}
