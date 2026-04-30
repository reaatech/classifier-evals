import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  loadRegressionGatesFromFile,
  normalizeRegressionGate,
} from '@reaatech/classifier-evals-gates';
import { createEvalRunFromSamples } from '@reaatech/classifier-evals-metrics';
import { describe, expect, it } from 'vitest';
import { hashSet, hashString, shortHash } from '../hash.js';
import { redactObjectPII, redactPII } from '../pii-redaction.js';

describe('utility helpers', () => {
  it('hashes strings and sets deterministically', () => {
    expect(hashString('abc')).toHaveLength(64);
    expect(shortHash('abc')).toHaveLength(8);
    expect(hashSet(['beta', 'alpha', 'alpha'])).toHaveLength(2);
  });

  it('redacts pii from text and objects', () => {
    const text = 'Email me at test@example.com or call 415-555-1212';
    expect(redactPII(text)).toContain('[EMAIL_REDACTED]');
    expect(redactPII(text)).toContain('[PHONE_REDACTED]');

    const redacted = redactObjectPII({
      contact: 'test@example.com',
      nested: { ip: '127.0.0.1' },
    });
    expect(JSON.stringify(redacted)).toContain('[EMAIL_REDACTED]');
    expect(JSON.stringify(redacted)).toContain('[IP_REDACTED]');
  });

  it('builds eval runs and normalizes regression gates', () => {
    const evalRun = createEvalRunFromSamples({
      datasetPath: '/tmp/samples.jsonl',
      samples: [
        { text: 'hello', label: 'greet', predicted_label: 'greet', confidence: 0.9 },
        { text: 'bye', label: 'farewell', predicted_label: 'unknown', confidence: 0.2 },
      ],
    });

    expect(evalRun.dataset_name).toBe('samples.jsonl');
    expect((evalRun.metadata?.distribution_metrics as { unknown_rate: number }).unknown_rate).toBe(
      0.5,
    );

    const gate = normalizeRegressionGate({
      name: 'baseline',
      type: 'baseline-comparison',
      baseline: 'baseline.json',
      metric: 'accuracy',
    });
    expect(gate.baseline_path).toBe('baseline.json');
  });

  it('normalizes regression gate with == operator and description', () => {
    const gate = normalizeRegressionGate({
      name: 'eq-gate',
      type: 'threshold',
      metric: 'accuracy',
      operator: '==',
      threshold: 0.9,
      description: 'Ensure accuracy is exactly 90%',
    });
    expect(gate.operator).toBe('==');
    expect(gate.description).toBe('Ensure accuracy is exactly 90%');
  });

  it('normalizes regression gate with invalid operator', () => {
    const gate = normalizeRegressionGate({
      name: 'bad-op',
      type: 'threshold',
      metric: 'accuracy',
      operator: '!=',
    });
    expect(gate.operator).toBeUndefined();
  });

  it('normalizes regression gate with baseline_path directly', () => {
    const gate = normalizeRegressionGate({
      name: 'path-gate',
      type: 'baseline-comparison',
      baseline_path: '/tmp/baseline.json',
      metric: 'accuracy',
    });
    expect(gate.baseline_path).toBe('/tmp/baseline.json');
  });

  it('builds eval run with judgeCost and gate results', () => {
    const evalRun = createEvalRunFromSamples({
      samples: [{ text: 'hello', label: 'greet', predicted_label: 'greet', confidence: 0.9 }],
      judgeCost: 0.05,
      gateResults: [
        {
          gate: {
            name: 'acc',
            type: 'threshold',
            metric: 'accuracy',
            operator: '>=',
            threshold: 0.8,
          },
          passed: true,
          message: 'ok',
          failures: [],
        },
        {
          gate: {
            name: 'f1',
            type: 'threshold',
            metric: 'f1_macro',
            operator: '>=',
            threshold: 0.8,
          },
          passed: false,
          message: 'low',
          failures: [],
        },
      ],
    });
    expect(evalRun.judge_cost).toBe(0.05);
    expect(evalRun.all_gates_passed).toBe(false);
    expect(evalRun.gate_results).toHaveLength(2);
  });

  it('loads regression gates from YAML with top-level array', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gates-'));
    const filePath = path.join(tempDir, 'gates.yaml');
    fs.writeFileSync(
      filePath,
      [
        '- name: accuracy-gate',
        '  type: threshold',
        '  metric: accuracy',
        '  operator: ">="',
        '  threshold: 0.85',
      ].join('\n'),
    );

    const gates = loadRegressionGatesFromFile(filePath);
    expect(gates).toHaveLength(1);
    expect(gates[0]?.name).toBe('accuracy-gate');
  });

  it('loads regression gates from YAML with gates key', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gates-'));
    const filePath = path.join(tempDir, 'gates.yaml');
    fs.writeFileSync(
      filePath,
      [
        'gates:',
        '  - name: f1-gate',
        '    type: threshold',
        '    metric: f1_macro',
        '    operator: ">="',
        '    threshold: 0.8',
      ].join('\n'),
    );

    const gates = loadRegressionGatesFromFile(filePath);
    expect(gates).toHaveLength(1);
    expect(gates[0]?.name).toBe('f1-gate');
  });

  it('throws for invalid YAML content without gates array', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gates-'));
    const filePath = path.join(tempDir, 'gates.yaml');
    fs.writeFileSync(filePath, 'just: a-string');

    expect(() => loadRegressionGatesFromFile(filePath)).toThrow('No valid gates array found');
  });

  it('handles datasetName fallback when datasetPath is empty', () => {
    const evalRun = createEvalRunFromSamples({
      datasetPath: '',
      samples: [{ text: 'hello', label: 'greet', predicted_label: 'greet', confidence: 0.9 }],
    });
    expect(evalRun.dataset_name).toBeUndefined();
  });
});
