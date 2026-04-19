import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  loadDataset,
  buildConfusionMatrix,
  calculateAllMetrics,
} from '../../src/index.js';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

describe('End-to-end evaluation pipeline', () => {
  let tempDir: string;
  let csvPath: string;
  let jsonlPath: string;

  beforeAll(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'classifier-evals-test-'));
    csvPath = path.join(tempDir, 'test.csv');
    jsonlPath = path.join(tempDir, 'test.jsonl');

    // Create test CSV
    const csvContent = `text,label,predicted_label,confidence
"Reset my password",password_reset,password_reset,0.95
"Cancel my subscription",cancel_subscription,cancel_subscription,0.88
"Where is my order",order_status,order_status,0.92
"I want a refund",refund_request,refund_request,0.85
"Change my email",account_update,account_update,0.78
"Speak to an agent",speak_to_agent,speak_to_agent,0.91
"Reset my password",password_reset,cancel_subscription,0.65
"Track my package",order_status,order_status,0.87
"Update payment method",payment_update,payment_update,0.82
"Delete my account",cancel_subscription,cancel_subscription,0.94`;
    fs.writeFileSync(csvPath, csvContent);

    // Create test JSONL
    const jsonlContent = [
      { text: 'Reset my password', label: 'password_reset', predicted_label: 'password_reset', confidence: 0.95 },
      { text: 'Cancel my subscription', label: 'cancel_subscription', predicted_label: 'cancel_subscription', confidence: 0.88 },
      { text: 'Where is my order', label: 'order_status', predicted_label: 'order_status', confidence: 0.92 },
      { text: 'I want a refund', label: 'refund_request', predicted_label: 'refund_request', confidence: 0.85 },
      { text: 'Change my email', label: 'account_update', predicted_label: 'account_update', confidence: 0.78 },
      { text: 'Speak to an agent', label: 'speak_to_agent', predicted_label: 'speak_to_agent', confidence: 0.91 },
      { text: 'Reset my password', label: 'password_reset', predicted_label: 'cancel_subscription', confidence: 0.65 },
      { text: 'Track my package', label: 'order_status', predicted_label: 'order_status', confidence: 0.87 },
      { text: 'Update payment method', label: 'payment_update', predicted_label: 'payment_update', confidence: 0.82 },
      { text: 'Delete my account', label: 'cancel_subscription', predicted_label: 'cancel_subscription', confidence: 0.94 },
    ].map(r => JSON.stringify(r)).join('\n');
    fs.writeFileSync(jsonlPath, jsonlContent);
  });

  afterAll(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('should load CSV dataset and calculate metrics', async () => {
    const dataset = await loadDataset(csvPath);

    expect(dataset).toBeDefined();
    expect(dataset.samples).toHaveLength(10);

    const metrics = calculateAllMetrics(dataset.samples);

    expect(metrics.accuracy).toBeGreaterThan(0);
    expect(metrics.accuracy).toBeLessThanOrEqual(1);
    // Verify macro metrics are calculated
    expect(metrics.precision_macro).toBeGreaterThan(0);
    expect(metrics.recall_macro).toBeGreaterThan(0);
    expect(metrics.f1_macro).toBeGreaterThan(0);
  });

  it('should load JSONL dataset and calculate metrics', async () => {
    const dataset = await loadDataset(jsonlPath);

    expect(dataset).toBeDefined();
    expect(dataset.samples).toHaveLength(10);

    const metrics = calculateAllMetrics(dataset.samples);

    expect(metrics.accuracy).toBeGreaterThan(0.8);
    expect(metrics.f1_macro).toBeGreaterThan(0);
  });

  it('should build confusion matrix from dataset', async () => {
    const dataset = await loadDataset(csvPath);
    const cm = buildConfusionMatrix(dataset.samples);

    expect(cm).toBeDefined();
    expect(cm.labels).toContain('password_reset');
    expect(cm.labels).toContain('cancel_subscription');
    expect(cm.labels).toContain('order_status');

    // Check that matrix is square
    expect(cm.matrix.length).toBe(cm.labels.length);
    for (const row of cm.matrix) {
      expect(row.length).toBe(cm.labels.length);
    }
  });

  it('should produce consistent results across multiple runs', async () => {
    const dataset1 = await loadDataset(csvPath);
    const dataset2 = await loadDataset(csvPath);

    const metrics1 = calculateAllMetrics(dataset1.samples);
    const metrics2 = calculateAllMetrics(dataset2.samples);

    expect(metrics1.accuracy).toBe(metrics2.accuracy);
    expect(metrics1.f1_macro).toBe(metrics2.f1_macro);
    expect(metrics1.precision_macro).toBe(metrics2.precision_macro);
  });

  it('should handle edge case with single sample', async () => {
    const singleSamplePath = path.join(tempDir, 'single.jsonl');
    fs.writeFileSync(singleSamplePath, JSON.stringify({
      text: 'Test',
      label: 'test_label',
      predicted_label: 'test_label',
      confidence: 0.9
    }));

    const dataset = await loadDataset(singleSamplePath);
    const metrics = calculateAllMetrics(dataset.samples);

    expect(metrics.accuracy).toBe(1);
    expect(metrics.f1_macro).toBe(1);
  });

  it('should detect misclassifications correctly', async () => {
    const dataset = await loadDataset(csvPath);
    const metrics = calculateAllMetrics(dataset.samples);

    // We have 1 misclassification out of 10 (90% accuracy)
    expect(metrics.accuracy).toBeCloseTo(0.9, 1);

    // Verify all metric categories are calculated
    expect(metrics.precision_macro).toBeGreaterThan(0);
    expect(metrics.recall_macro).toBeGreaterThan(0);
    expect(metrics.f1_macro).toBeGreaterThan(0);
    expect(metrics.matthews_correlation).toBeGreaterThan(0);
    expect(metrics.cohens_kappa).toBeGreaterThan(0);
  });
});
