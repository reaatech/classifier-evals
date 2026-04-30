/**
 * Dataset validation for classifier evaluation
 * Validates schema, label distribution, duplicates, and data quality
 */

import {
  ClassificationResult,
  EvalDataset,
  ValidationError,
  ValidationWarning,
} from '@reaatech/classifier-evals';

/**
 * Validation result from dataset validation
 */
export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

/**
 * Validate that all required fields are present in each sample
 */
function validateSchema(samples: ClassificationResult[]): ValidationError[] {
  const errors: ValidationError[] = [];

  for (let i = 0; i < samples.length; i++) {
    const sample = samples[i]!;

    if (!sample.text || sample.text.trim().length === 0) {
      errors.push({
        type: 'empty_text',
        message: `Sample at index ${i} has empty text`,
        sample_index: i,
        field: 'text',
      });
    }

    if (!sample.label || sample.label.trim().length === 0) {
      errors.push({
        type: 'empty_label',
        message: `Sample at index ${i} has empty label`,
        sample_index: i,
        field: 'label',
      });
    }

    if (!sample.predicted_label || sample.predicted_label.trim().length === 0) {
      errors.push({
        type: 'empty_predicted_label',
        message: `Sample at index ${i} has empty predicted_label`,
        sample_index: i,
        field: 'predicted_label',
      });
    }

    if (sample.confidence !== undefined) {
      if (!Number.isFinite(sample.confidence) || sample.confidence < 0 || sample.confidence > 1) {
        errors.push({
          type: 'invalid_confidence',
          message: `Sample at index ${i} has confidence ${sample.confidence} (must be 0-1)`,
          sample_index: i,
          field: 'confidence',
        });
      }
    }
  }

  return errors;
}

/**
 * Check for duplicate samples (exact text match)
 */
function detectDuplicates(samples: ClassificationResult[]): ValidationWarning[] {
  const warnings: ValidationWarning[] = [];
  const seenTexts = new Map<string, number[]>();

  for (let i = 0; i < samples.length; i++) {
    const text = samples[i]!.text.trim().toLowerCase();
    const existing = seenTexts.get(text);
    if (existing) {
      existing.push(i);
    } else {
      seenTexts.set(text, [i]);
    }
  }

  for (const [text, indices] of seenTexts.entries()) {
    if (indices.length > 1) {
      warnings.push({
        type: 'duplicate_text',
        message: `Duplicate text found at indices ${indices.join(', ')}: "${text.substring(0, 50)}..."`,
        sample_index: indices[0],
      });
    }
  }

  return warnings;
}

/**
 * Analyze label distribution and detect imbalance
 */
function analyzeLabelDistribution(samples: ClassificationResult[]): ValidationWarning[] {
  const warnings: ValidationWarning[] = [];
  const labelCounts: Record<string, number> = {};

  for (const sample of samples) {
    labelCounts[sample.label] = (labelCounts[sample.label] ?? 0) + 1;
  }

  const labels = Object.keys(labelCounts);
  const counts = Object.values(labelCounts);
  const total = samples.length;

  if (labels.length === 0) {
    warnings.push({
      type: 'no_labels',
      message: 'Dataset has no labels',
    });
    return warnings;
  }

  // Check for severe class imbalance
  const maxCount = counts.reduce((a, b) => Math.max(a, b), 0);
  const minCount = counts.reduce((a, b) => Math.min(a, b), Infinity);
  const imbalanceRatio = maxCount / minCount;

  if (imbalanceRatio > 10) {
    warnings.push({
      type: 'severe_imbalance',
      message: `Severe class imbalance detected (ratio: ${imbalanceRatio.toFixed(1)}:1). Max: ${maxCount}, Min: ${minCount}`,
    });
  } else if (imbalanceRatio > 5) {
    warnings.push({
      type: 'moderate_imbalance',
      message: `Moderate class imbalance detected (ratio: ${imbalanceRatio.toFixed(1)}:1). Max: ${maxCount}, Min: ${minCount}`,
    });
  }

  // Check for single-sample classes
  const singleSampleClasses = labels.filter((l) => labelCounts[l] === 1);
  if (singleSampleClasses.length > 0) {
    warnings.push({
      type: 'single_sample_classes',
      message: `${singleSampleClasses.length} class(es) have only 1 sample: ${singleSampleClasses.join(', ')}`,
    });
  }

  // Check for too many classes relative to samples
  if (labels.length > total / 2) {
    warnings.push({
      type: 'too_many_classes',
      message: `Too many classes (${labels.length}) relative to samples (${total}). Consider consolidating.`,
    });
  }

  return warnings;
}

/**
 * Check for samples where prediction matches label (potential data leakage)
 */
function detectDataLeakage(samples: ClassificationResult[]): ValidationWarning[] {
  const warnings: ValidationWarning[] = [];
  const perfectMatches = samples.filter((s) => s.label === s.predicted_label).length;
  const perfectRate = perfectMatches / samples.length;

  if (perfectRate > 0.95 && samples.length > 10) {
    warnings.push({
      type: 'suspected_data_leakage',
      message: `Suspiciously high accuracy (${(perfectRate * 100).toFixed(1)}%). Possible data leakage.`,
    });
  }

  return warnings;
}

/**
 * Validate an evaluation dataset
 *
 * @param dataset - The dataset to validate
 * @returns Validation result with errors and warnings
 */
export function validateDataset(dataset: EvalDataset): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  // Schema validation
  errors.push(...validateSchema(dataset.samples));

  // If there are critical errors, return early
  if (errors.length > 0) {
    return {
      valid: false,
      errors,
      warnings,
    };
  }

  // Distribution analysis
  warnings.push(...analyzeLabelDistribution(dataset.samples));

  // Duplicate detection
  warnings.push(...detectDuplicates(dataset.samples));

  // Data leakage check
  warnings.push(...detectDataLeakage(dataset.samples));

  // Check confidence distribution if present
  if (dataset.metadata.has_confidence) {
    const lowConfidence = dataset.samples.filter((s) => s.confidence < 0.5).length;
    const lowConfidenceRate = lowConfidence / dataset.samples.length;

    if (lowConfidenceRate > 0.5) {
      warnings.push({
        type: 'low_confidence_majority',
        message: `${(lowConfidenceRate * 100).toFixed(1)}% of predictions have confidence < 0.5`,
      });
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validate an array of classification results (without full dataset metadata)
 */
export function validateSamples(samples: ClassificationResult[]): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  // Schema validation
  errors.push(...validateSchema(samples));

  if (errors.length > 0) {
    return {
      valid: false,
      errors,
      warnings,
    };
  }

  // Distribution analysis
  warnings.push(...analyzeLabelDistribution(samples));

  // Duplicate detection
  warnings.push(...detectDuplicates(samples));

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Get summary statistics for a dataset
 */
export function getDatasetSummary(dataset: EvalDataset): {
  totalSamples: number;
  numLabels: number;
  labelDistribution: Record<string, number>;
  accuracy: number;
  avgConfidence: number;
  hasConfidence: boolean;
} {
  const correctPredictions = dataset.samples.filter((s) => s.label === s.predicted_label).length;

  const avgConfidence =
    dataset.samples.reduce((sum, s) => sum + s.confidence, 0) / dataset.samples.length;

  return {
    totalSamples: dataset.samples.length,
    numLabels: dataset.metadata.labels.length,
    labelDistribution: dataset.metadata.label_distribution,
    accuracy: correctPredictions / dataset.samples.length,
    avgConfidence,
    hasConfidence: dataset.metadata.has_confidence,
  };
}
