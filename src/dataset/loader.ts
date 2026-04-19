/**
 * Multi-format dataset loader for classifier evaluation
 * Supports CSV, JSON, JSONL, and auto-detection of format
 */

import { readFile } from 'fs/promises';
import path from 'path';
import {
  ClassificationResult,
  ClassificationResultSchema,
  DatasetMetadata,
  EvalDataset,
} from '../types/index.js';

/**
 * Detect file format from extension
 */
function detectFormat(filePath: string): 'csv' | 'json' | 'jsonl' {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case '.csv':
      return 'csv';
    case '.json':
      return 'json';
    case '.jsonl':
      return 'jsonl';
    default:
      throw new Error(`Unsupported file extension: ${ext}. Supported: .csv, .json, .jsonl`);
  }
}

/**
 * Parse a single CSV field, handling quoted values per RFC 4180
 */
function parseCSVField(value: string): string {
  return value;
}

function parseCSVRecords(content: string): string[][] {
  const records: string[][] = [];
  let currentField = '';
  let currentRecord: string[] = [];
  let inQuotes = false;
  let i = 0;

  while (i < content.length) {
    const char = content[i];
    const nextChar = content[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentField += '"';
        i += 2;
        continue;
      }

      inQuotes = !inQuotes;
      i++;
      continue;
    }

    if (!inQuotes && char === ',') {
      currentRecord.push(currentField.trim());
      currentField = '';
      i++;
      continue;
    }

    if (!inQuotes && (char === '\n' || char === '\r')) {
      currentRecord.push(currentField.trim());
      currentField = '';

      const hasContent = currentRecord.some((field) => field !== '');
      if (hasContent) {
        records.push(currentRecord);
      }
      currentRecord = [];

      if (char === '\r' && nextChar === '\n') {
        i += 2;
      } else {
        i++;
      }
      continue;
    }

    currentField += char;
    i++;
  }

  currentRecord.push(currentField.trim());
  const hasTrailingContent = currentRecord.some((field) => field !== '');
  if (hasTrailingContent) {
    records.push(currentRecord);
  }

  return records;
}

/**
 * Parse CSV content into classification results (RFC 4180 compliant)
 */
function parseCSV(content: string): ClassificationResult[] {
  const records = parseCSVRecords(content);
  if (records.length < 2) {
    throw new Error('CSV file must have a header row and at least one data row');
  }

  const headers = (records[0] ?? []).map((h) => h.toLowerCase());

  const requiredColumns = ['text', 'label', 'predicted_label'];
  for (const col of requiredColumns) {
    if (!headers.includes(col)) {
      throw new Error(`Missing required column: ${col}`);
    }
  }

  const textIdx = headers.indexOf('text');
  const labelIdx = headers.indexOf('label');
  const predictedLabelIdx = headers.indexOf('predicted_label');
  const confidenceIdx = headers.indexOf('confidence');

  const results: ClassificationResult[] = [];

  for (let i = 1; i < records.length; i++) {
    const values = records[i] ?? [];

    const text = parseCSVField(values[textIdx!] ?? '');
    const label = parseCSVField(values[labelIdx!] ?? '');
    const predictedLabel = parseCSVField(values[predictedLabelIdx!] ?? '');
    const confidenceValue = confidenceIdx >= 0 ? values[confidenceIdx!] : undefined;
    const confidenceStr = confidenceValue !== undefined ? parseCSVField(confidenceValue) : undefined;
    const confidence =
      confidenceStr !== undefined && confidenceStr !== ''
        ? parseFloat(confidenceStr)
        : 1.0;

    if (!text || !label || !predictedLabel) {
      continue;
    }

    results.push({
      text,
      label,
      predicted_label: predictedLabel,
      confidence: isNaN(confidence) ? 1.0 : Math.max(0, Math.min(1, confidence)),
    });
  }

  return results;
}

/**
 * Parse JSON content into classification results
 */
function parseJSON(content: string): ClassificationResult[] {
  const parsed = JSON.parse(content);
  
  let items: Record<string, unknown>[];
  
  if (Array.isArray(parsed)) {
    items = parsed;
  } else if (typeof parsed === 'object' && parsed !== null) {
    // Look for common array fields
    const obj = parsed as Record<string, unknown>;
    if (Array.isArray(obj.samples)) {
      items = obj.samples;
    } else if (Array.isArray(obj.data)) {
      items = obj.data;
    } else if (Array.isArray(obj.results)) {
      items = obj.results;
    } else {
      throw new Error('JSON must be an array or contain a samples/data/results array field');
    }
  } else {
    throw new Error('Invalid JSON format: expected array or object with array field');
  }

  return items
    .filter(item => typeof item === 'object' && item !== null)
    .map(item => {
      const obj = item as Record<string, unknown>;
      const text = typeof obj.text === 'string' ? obj.text : '';
      const label = typeof obj.label === 'string' ? obj.label : '';
      const predictedLabel = typeof obj.predicted_label === 'string' ? obj.predicted_label : '';
      const confidence = typeof obj.confidence === 'number' 
        ? Math.max(0, Math.min(1, obj.confidence)) 
        : 1.0;

      if (!text || !label || !predictedLabel) {
        return null;
      }

      return {
        text,
        label,
        predicted_label: predictedLabel,
        confidence,
      } as ClassificationResult;
    })
    .filter((result): result is ClassificationResult => result !== null);
}

/**
 * Parse JSONL content into classification results
 */
function parseJSONL(content: string): ClassificationResult[] {
  const lines = content.trim().split('\n');
  const results: ClassificationResult[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }

    try {
      const obj = JSON.parse(trimmed) as Record<string, unknown>;
      const text = typeof obj.text === 'string' ? obj.text : '';
      const label = typeof obj.label === 'string' ? obj.label : '';
      const predictedLabel = typeof obj.predicted_label === 'string' ? obj.predicted_label : '';
      const confidence = typeof obj.confidence === 'number' 
        ? Math.max(0, Math.min(1, obj.confidence)) 
        : 1.0;

      if (!text || !label || !predictedLabel) {
        continue;
      }

      results.push({
        text,
        label,
        predicted_label: predictedLabel,
        confidence,
      });
    } catch {
      // Skip malformed lines
      continue;
    }
  }

  return results;
}

/**
 * Compute dataset metadata from loaded samples
 */
function computeMetadata(
  samples: ClassificationResult[],
  format: 'csv' | 'json' | 'jsonl',
  filePath?: string
): DatasetMetadata {
  const labels = new Set<string>();
  const labelDistribution: Record<string, number> = {};
  let hasConfidence = false;

  for (const sample of samples) {
    labels.add(sample.label);
    labelDistribution[sample.label] = (labelDistribution[sample.label] ?? 0) + 1;
    if (sample.confidence !== 1.0) {
      hasConfidence = true;
    }
  }

  return {
    format,
    path: filePath,
    total_samples: samples.length,
    labels: Array.from(labels).sort(),
    label_distribution: labelDistribution,
    has_confidence: hasConfidence,
    loaded_at: new Date().toISOString(),
  };
}

/**
 * Load a dataset from file
 * 
 * @param filePath - Path to the dataset file
 * @param format - Optional format override (auto-detected if not provided)
 * @returns Promise resolving to EvalDataset
 */
export async function loadDataset(
  filePath: string,
  format?: 'csv' | 'json' | 'jsonl'
): Promise<EvalDataset> {
  // Detect or validate format
  const detectedFormat = format ?? detectFormat(filePath);

  // Read file content
  let content: string;
  try {
    content = await readFile(filePath, 'utf-8');
  } catch (err) {
    throw new Error(`Failed to read dataset file "${filePath}": ${(err as Error).message}`);
  }

  // Parse based on format
  let samples: ClassificationResult[];
  switch (detectedFormat) {
    case 'csv':
      samples = parseCSV(content);
      break;
    case 'json':
      samples = parseJSON(content);
      break;
    case 'jsonl':
      samples = parseJSONL(content);
      break;
  }

  if (samples.length === 0) {
    throw new Error('No valid samples found in dataset');
  }

  // Validate each sample
  const validatedSamples = samples.map(sample => {
    const result = ClassificationResultSchema.safeParse(sample);
    if (!result.success) {
      throw new Error(`Invalid sample: ${result.error.message}`);
    }
    return result.data;
  });

  const metadata = computeMetadata(validatedSamples, detectedFormat, filePath);

  return {
    samples: validatedSamples,
    metadata,
  };
}

/**
 * Load dataset from raw content string
 * 
 * @param content - Raw file content
 * @param format - Format of the content
 * @returns Promise resolving to EvalDataset
 */
export async function loadDatasetFromContent(
  content: string,
  format: 'csv' | 'json' | 'jsonl'
): Promise<EvalDataset> {
  let samples: ClassificationResult[];

  switch (format) {
    case 'csv':
      samples = parseCSV(content);
      break;
    case 'json':
      samples = parseJSON(content);
      break;
    case 'jsonl':
      samples = parseJSONL(content);
      break;
  }
  if (samples === undefined) {
    throw new Error(`Unsupported format: ${format}`);
  }

  if (samples.length === 0) {
    throw new Error('No valid samples found in dataset');
  }

  const validatedSamples = samples.map(sample => {
    const result = ClassificationResultSchema.safeParse(sample);
    if (!result.success) {
      throw new Error(`Invalid sample: ${result.error.message}`);
    }
    return result.data;
  });

  const metadata = computeMetadata(validatedSamples, format);

  return {
    samples: validatedSamples,
    metadata,
  };
}
