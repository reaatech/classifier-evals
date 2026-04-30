/**
 * Dataset splitting utilities for classifier evaluation
 * Supports train/test split with stratification and K-fold cross-validation
 */

import type { ClassificationResult, EvalDataset } from '@reaatech/classifier-evals';

/**
 * Options for dataset splitting
 */
export interface SplitOptions {
  /** Test set size as a fraction (0-1) or absolute number */
  testSize: number;
  /** Whether to stratify by label */
  stratify?: boolean;
  /** Random seed for reproducibility */
  seed?: number;
  /** Whether to shuffle the data */
  shuffle?: boolean;
}

/**
 * Result of a dataset split
 */
export interface SplitResult {
  train: ClassificationResult[];
  test: ClassificationResult[];
  trainSize: number;
  testSize: number;
}

/**
 * Seeded random number generator (Mulberry32)
 */
function createRng(seed: number): () => number {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Fisher-Yates shuffle with seeded RNG
 */
function shuffleArray<T>(array: T[], rng: () => number): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const temp = shuffled[i] as T;
    shuffled[i] = shuffled[j] as T;
    shuffled[j] = temp;
  }
  return shuffled;
}

/**
 * Split samples into train and test sets with optional stratification
 */
function splitSamples(
  samples: ClassificationResult[],
  testSize: number,
  stratify: boolean,
  rng: () => number,
): SplitResult {
  // Determine actual test size
  const numTest =
    testSize < 1
      ? Math.round(samples.length * testSize)
      : Math.min(Math.round(testSize), samples.length - 1);

  const numTrain = samples.length - numTest;

  if (!stratify) {
    // Simple random split
    const shuffled = shuffleArray(samples, rng);
    return {
      train: shuffled.slice(0, numTrain),
      test: shuffled.slice(numTrain),
      trainSize: numTrain,
      testSize: numTest,
    };
  }

  // Stratified split
  const byLabel = new Map<string, ClassificationResult[]>();
  for (const sample of samples) {
    const existing = byLabel.get(sample.label) ?? [];
    existing.push(sample);
    byLabel.set(sample.label, existing);
  }

  const train: ClassificationResult[] = [];
  const test: ClassificationResult[] = [];

  for (const [, labelSamples] of byLabel.entries()) {
    const shuffled = shuffleArray(labelSamples, rng);
    const labelTestSize = Math.round(shuffled.length * testSize);

    train.push(...shuffled.slice(0, shuffled.length - labelTestSize));
    test.push(...shuffled.slice(shuffled.length - labelTestSize));
  }

  // Shuffle the final train and test sets
  const trainShuffled = shuffleArray(train, rng);
  const testShuffled = shuffleArray(test, rng);

  return {
    train: trainShuffled,
    test: testShuffled,
    trainSize: trainShuffled.length,
    testSize: testShuffled.length,
  };
}

/**
 * Split a dataset into train and test sets
 *
 * @param dataset - The dataset to split
 * @param options - Split options
 * @returns Train and test datasets
 */
export function splitDataset(
  dataset: EvalDataset,
  options: SplitOptions,
): { train: EvalDataset; test: EvalDataset } {
  const seed = options.seed ?? 42;
  const rng = createRng(seed);
  const stratify = options.stratify ?? true;
  const shuffle = options.shuffle ?? true;

  let samples = dataset.samples;

  // Shuffle first if requested (before stratified split)
  if (shuffle) {
    samples = shuffleArray(samples, rng);
  }

  const split = splitSamples(samples, options.testSize, stratify, rng);

  // Compute metadata for train set
  const trainLabels = new Set<string>();
  const trainLabelDist: Record<string, number> = {};
  for (const sample of split.train) {
    trainLabels.add(sample.label);
    trainLabelDist[sample.label] = (trainLabelDist[sample.label] ?? 0) + 1;
  }

  // Compute metadata for test set
  const testLabels = new Set<string>();
  const testLabelDist: Record<string, number> = {};
  for (const sample of split.test) {
    testLabels.add(sample.label);
    testLabelDist[sample.label] = (testLabelDist[sample.label] ?? 0) + 1;
  }

  const trainDataset: EvalDataset = {
    samples: split.train,
    metadata: {
      format: dataset.metadata.format,
      path: dataset.metadata.path,
      total_samples: split.train.length,
      labels: Array.from(trainLabels).sort(),
      label_distribution: trainLabelDist,
      has_confidence: dataset.metadata.has_confidence,
      loaded_at: new Date().toISOString(),
    },
  };

  const testDataset: EvalDataset = {
    samples: split.test,
    metadata: {
      format: dataset.metadata.format,
      path: dataset.metadata.path,
      total_samples: split.test.length,
      labels: Array.from(testLabels).sort(),
      label_distribution: testLabelDist,
      has_confidence: dataset.metadata.has_confidence,
      loaded_at: new Date().toISOString(),
    },
  };

  return { train: trainDataset, test: testDataset };
}

/**
 * K-fold cross-validation split
 *
 * @param dataset - The dataset to split
 * @param k - Number of folds (default: 5)
 * @param seed - Random seed for reproducibility
 * @returns Array of k folds
 */
export function kFoldSplit(dataset: EvalDataset, k = 5, seed = 42): EvalDataset[] {
  if (k < 2) {
    throw new Error('k must be at least 2');
  }
  if (k > dataset.samples.length) {
    throw new Error(
      `k (${k}) cannot be greater than number of samples (${dataset.samples.length})`,
    );
  }

  const rng = createRng(seed);
  const shuffled = shuffleArray(dataset.samples, rng);

  // Distribute samples across folds
  const folds: ClassificationResult[][] = Array.from({ length: k }, () => []);

  for (let i = 0; i < shuffled.length; i++) {
    folds[i % k]?.push(shuffled[i]!);
  }

  // Convert each fold to an EvalDataset
  return folds.map((foldSamples): EvalDataset => {
    const labels = new Set<string>();
    const labelDist: Record<string, number> = {};
    for (const sample of foldSamples) {
      labels.add(sample.label);
      labelDist[sample.label] = (labelDist[sample.label] ?? 0) + 1;
    }

    return {
      samples: foldSamples,
      metadata: {
        format: dataset.metadata.format,
        path: dataset.metadata.path,
        total_samples: foldSamples.length,
        labels: Array.from(labels).sort(),
        label_distribution: labelDist,
        has_confidence: dataset.metadata.has_confidence,
        loaded_at: new Date().toISOString(),
      },
    } as EvalDataset;
  });
}

/**
 * Generate train/test splits for each fold in K-fold cross-validation
 *
 * @param dataset - The dataset to split
 * @param k - Number of folds (default: 5)
 * @param seed - Random seed for reproducibility
 * @returns Array of {train, test} pairs
 */
export function kFoldSplits(
  dataset: EvalDataset,
  k = 5,
  seed = 42,
): { train: EvalDataset; test: EvalDataset }[] {
  const folds = kFoldSplit(dataset, k, seed);
  const splits: { train: EvalDataset; test: EvalDataset }[] = [];

  for (let i = 0; i < k; i++) {
    const testFold = folds[i]!;
    const trainFolds = folds.filter((_, j) => j !== i);

    // Combine all train folds - trainFolds is EvalDataset[], so we just need to flatten once
    const trainSamples = trainFolds.flatMap((f) => f.samples!);
    const trainLabels = new Set<string>();
    const trainLabelDist: Record<string, number> = {};
    for (const sample of trainSamples) {
      trainLabels.add(sample.label);
      trainLabelDist[sample.label] = (trainLabelDist[sample.label] ?? 0) + 1;
    }

    splits.push({
      train: {
        samples: trainSamples,
        metadata: {
          format: dataset.metadata.format,
          path: dataset.metadata.path,
          total_samples: trainSamples.length,
          labels: Array.from(trainLabels).sort(),
          label_distribution: trainLabelDist,
          has_confidence: dataset.metadata.has_confidence,
          loaded_at: new Date().toISOString(),
        },
      },
      test: testFold,
    });
  }

  return splits;
}
