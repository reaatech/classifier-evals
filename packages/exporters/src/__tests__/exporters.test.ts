import { describe, it, expect, vi } from 'vitest';
import {
  exportToJson,
  exportToHtml,
  exportToPhoenix,
  exportToLangfuse,
  type JsonExportInput,
  type PhoenixExportInput,
  type LangfuseExportInput,
} from '../index.js';
import type { EvalRun } from '@reaatech/classifier-evals';

// Helper to create a minimal valid EvalRun
function createMinimalEvalRun(overrides?: Partial<EvalRun>): EvalRun {
  return {
    run_id: 'test-run-1',
    dataset_name: 'test-dataset',
    dataset_path: '/tmp/test.csv',
    total_samples: 100,
    duration_ms: 500,
    started_at: '2026-04-16T00:00:00Z',
    completed_at: '2026-04-16T00:00:01Z',
    metrics: {
      accuracy: 0.85,
      precision_macro: 0.84,
      recall_macro: 0.85,
      f1_macro: 0.84,
      precision_micro: 0.85,
      recall_micro: 0.85,
      f1_micro: 0.85,
      precision_weighted: 0.84,
      recall_weighted: 0.85,
      f1_weighted: 0.84,
      matthews_correlation: 0.7,
      cohens_kappa: 0.68,
      total_samples: 100,
      correct_predictions: 85,
    },
    confusion_matrix: {
      labels: ['class_a', 'class_b'],
      matrix: [
        [40, 10],
        [5, 45],
      ],
      per_class: [
        {
          label: 'class_a',
          true_positives: 40,
          false_positives: 5,
          false_negatives: 10,
          true_negatives: 45,
          precision: 0.89,
          recall: 0.8,
          f1: 0.84,
          support: 50,
        },
        {
          label: 'class_b',
          true_positives: 45,
          false_positives: 10,
          false_negatives: 5,
          true_negatives: 40,
          precision: 0.82,
          recall: 0.9,
          f1: 0.86,
          support: 50,
        },
      ],
    },
    ...overrides,
  };
}

describe('Exporters', () => {
  describe('exportToJson', () => {
    it('exports basic eval run to JSON', () => {
      const evalRun = createMinimalEvalRun();
      const input: JsonExportInput = { evalRun };
      const result = exportToJson(input);

      expect(result.success).toBe(true);
      expect(result.target_type).toBe('json');
      expect(result.json).toBeDefined();

      const parsed = JSON.parse(result.json!);
      expect(parsed.run_id).toBe('test-run-1');
      expect(parsed.total_samples).toBe(100);
      expect(parsed.metrics.accuracy).toBe(0.85);
      expect(parsed.confusion_matrix).toBeDefined();
    });

    it('includes gate results when present', () => {
      const evalRun = createMinimalEvalRun({
        gate_results: [
          { name: 'accuracy-gate', passed: true },
          { name: 'f1-gate', passed: true },
        ],
        all_gates_passed: true,
      });
      const input: JsonExportInput = { evalRun };
      const result = exportToJson(input);

      const parsed = JSON.parse(result.json!);
      expect(parsed.gate_results).toBeDefined();
      expect(parsed.all_gates_passed).toBe(true);
    });

    it('includes judge summary when judged_results present', () => {
      const evalRun = createMinimalEvalRun({
        judged_results: [{ text: 'sample', label: 'a', predicted_label: 'a', confidence: 0.9 }],
        judge_cost: 0.05,
        metadata: {
          distribution_metrics: {
            unknown_rate: 0.1,
          },
        },
      });
      const input: JsonExportInput = { evalRun };
      const result = exportToJson(input);

      const parsed = JSON.parse(result.json!);
      expect(parsed.judged_results).toBeDefined();
      expect(parsed.metadata.distribution_metrics.unknown_rate).toBe(0.1);
    });

    it('adds the sample inclusion note when includeSamples is requested', () => {
      const evalRun = createMinimalEvalRun();
      const result = exportToJson({
        evalRun,
        options: { includeSamples: true },
      });

      const parsed = JSON.parse(result.json!);
      expect(parsed.include_samples_note).toContain('not included');
    });
  });

  describe('exportToHtml', () => {
    it('exports eval run to HTML', () => {
      const evalRun = createMinimalEvalRun();
      const result = exportToHtml(evalRun);

      expect(result.success).toBe(true);
      expect(result.target_type).toBe('html');
      expect(result.html).toBeDefined();
      expect(result.html).toContain('<!DOCTYPE html>');
      expect(result.html).toContain('Evaluation Report');
    });

    it('includes confusion matrix in HTML', () => {
      const evalRun = createMinimalEvalRun();
      const result = exportToHtml(evalRun);

      expect(result.html).toContain('Confusion Matrix');
      expect(result.html).toContain('class_a');
      expect(result.html).toContain('class_b');
    });

    it('escapes HTML content in titles, labels, and gate messages', () => {
      const evalRun = createMinimalEvalRun({
        confusion_matrix: {
          labels: ['<script>alert(1)</script>', 'safe'],
          matrix: [
            [3, 0],
            [0, 2],
          ],
          per_class: [
            {
              label: '<script>alert(1)</script>',
              true_positives: 3,
              false_positives: 0,
              false_negatives: 0,
              true_negatives: 2,
              precision: 1,
              recall: 1,
              f1: 1,
              support: 3,
            },
            {
              label: 'safe',
              true_positives: 2,
              false_positives: 0,
              false_negatives: 0,
              true_negatives: 3,
              precision: 1,
              recall: 1,
              f1: 1,
              support: 2,
            },
          ],
        },
        gate_results: [{ name: 'gate<1>', passed: false, message: 'bad <b>message</b>' }],
        judged_results: [
          {
            text: 'sample',
            label: 'safe',
            predicted_label: 'safe',
            confidence: 0.9,
            judge_correct: true,
            judge_confidence: 0.9,
            judge_cost: 0.01,
          },
        ],
      });

      const result = exportToHtml(evalRun, {
        title: '<Unsafe Title>',
        includeBaselineComparison: true,
      });

      expect(result.html).toContain('&lt;Unsafe Title&gt;');
      expect(result.html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
      expect(result.html).toContain('bad &lt;b&gt;message&lt;/b&gt;');
      expect(result.html).not.toContain('<script>alert(1)</script>');
    });
  });

  describe('exportToPhoenix', () => {
    it('exports to Phoenix format with mock', async () => {
      const evalRun = createMinimalEvalRun();
      const input: PhoenixExportInput = {
        evalRun,
        options: { endpoint: 'http://localhost:6006' },
      };

      const mockResponse = new Response('{}', { status: 200 });
      const mockFetch = vi.fn().mockResolvedValue(mockResponse);
      const originalFetch = global.fetch;
      global.fetch = mockFetch;

      const result = await exportToPhoenix(input);
      expect(result.success).toBe(true);
      expect(result.target_type).toBe('phoenix');

      global.fetch = originalFetch;
    });

    it('returns failure when Phoenix endpoint is unreachable', async () => {
      const evalRun = createMinimalEvalRun();
      const input: PhoenixExportInput = {
        evalRun,
        options: { endpoint: 'http://localhost:6006' },
      };
      const result = await exportToPhoenix(input);
      expect(result.success).toBe(false);
    });
  });

  describe('exportToLangfuse', () => {
    it('exports to Langfuse format with mock', async () => {
      const evalRun = createMinimalEvalRun();
      const input: LangfuseExportInput = {
        evalRun,
        options: {
          publicKey: 'pk_test',
          secretKey: 'sk_test',
        },
      };

      const mockResponse = new Response('{}', { status: 200 });
      const mockFetch = vi.fn().mockResolvedValue(mockResponse);
      const originalFetch = global.fetch;
      global.fetch = mockFetch;

      const result = await exportToLangfuse(input);
      expect(result.success).toBe(true);
      expect(result.target_type).toBe('langfuse');

      global.fetch = originalFetch;
    });

    it('skips export when publicKey is empty string', async () => {
      const evalRun = createMinimalEvalRun();
      const input: LangfuseExportInput = {
        evalRun,
        options: {
          publicKey: '',
          secretKey: 'sk_test',
        },
      };
      const result = await exportToLangfuse(input);
      expect(result.success).toBe(false);
      expect(result.target_type).toBe('langfuse');
    });

    it('skips export when secretKey is empty string', async () => {
      const evalRun = createMinimalEvalRun();
      const input: LangfuseExportInput = {
        evalRun,
        options: {
          publicKey: 'pk_test',
          secretKey: '',
        },
      };
      const result = await exportToLangfuse(input);
      expect(result.success).toBe(false);
    });

    it('skips export when keys are undefined', async () => {
      const evalRun = createMinimalEvalRun();
      const input: LangfuseExportInput = {
        evalRun,
        options: {},
      };
      const result = await exportToLangfuse(input);
      expect(result.success).toBe(false);
    });

    it('returns failure on error', async () => {
      const evalRun = createMinimalEvalRun();
      Object.defineProperty(evalRun, 'metrics', {
        get() {
          throw new Error('boom');
        },
        configurable: true,
      });
      const input: LangfuseExportInput = {
        evalRun,
        options: { publicKey: 'pk', secretKey: 'sk' },
      };
      const result = await exportToLangfuse(input);
      expect(result.success).toBe(false);
      expect(result.error).toBe('boom');
    });

    it('handles non-ok response from Langfuse API', async () => {
      const evalRun = createMinimalEvalRun();
      const input: LangfuseExportInput = {
        evalRun,
        options: { publicKey: 'pk', secretKey: 'sk' },
      };

      const mockResponse = new Response('error details', {
        status: 500,
        statusText: 'Internal Server Error',
      });
      const mockFetch = vi.fn().mockResolvedValue(mockResponse);
      const originalFetch = global.fetch;
      global.fetch = mockFetch;

      const result = await exportToLangfuse(input);
      expect(result.success).toBe(false);
      expect(result.error).toContain('500');
      expect(result.error).toContain('error details');

      global.fetch = originalFetch;
    });

    it('handles non-ok response with unreadable body', async () => {
      const evalRun = createMinimalEvalRun();
      const input: LangfuseExportInput = {
        evalRun,
        options: { publicKey: 'pk', secretKey: 'sk' },
      };

      const mockResponse = new Response(null, { status: 403, statusText: 'Forbidden' });
      Object.defineProperty(mockResponse, 'text', {
        value: () => Promise.reject(new Error('cannot read')),
      });
      const mockFetch = vi.fn().mockResolvedValue(mockResponse);
      const originalFetch = global.fetch;
      global.fetch = mockFetch;

      const result = await exportToLangfuse(input);
      expect(result.success).toBe(false);
      expect(result.error).toContain('403');
      expect(result.error).not.toContain('cannot read');

      global.fetch = originalFetch;
    });

    it('successful export includes all eval run data', async () => {
      const evalRun = createMinimalEvalRun({
        gate_results: [{ name: 'test', passed: true }],
        all_gates_passed: true,
      });
      const input: LangfuseExportInput = {
        evalRun,
        options: {
          publicKey: 'pk_test',
          secretKey: 'sk_test',
          traceName: 'custom-trace',
          sessionId: 'session-123',
        },
      };

      const mockResponse = new Response('{}', { status: 200 });
      const mockFetch = vi.fn().mockResolvedValue(mockResponse);
      const originalFetch = global.fetch;
      global.fetch = mockFetch;

      const result = await exportToLangfuse(input);
      expect(result.success).toBe(true);
      expect(mockFetch).toHaveBeenCalled();
      const fetchCall = mockFetch.mock.calls[0]!;
      const body = JSON.parse(fetchCall[1]!.body as string);
      expect(body.batch[0].body.name).toBe('custom-trace');
      expect(body.batch[0].body.sessionId).toBe('session-123');

      global.fetch = originalFetch;
    });
  });

  describe('exportToPhoenix - error handling', () => {
    it('returns failure on error', async () => {
      const evalRun = createMinimalEvalRun();
      Object.defineProperty(evalRun, 'confusion_matrix', {
        get() {
          throw new Error('phoenix-boom');
        },
        configurable: true,
      });
      const input: PhoenixExportInput = { evalRun };
      const result = await exportToPhoenix(input);
      expect(result.success).toBe(false);
      expect(result.error).toBe('phoenix-boom');
    });
  });

  describe('exportToHtml - error handling', () => {
    it('returns failure on error', () => {
      const evalRun = createMinimalEvalRun();
      Object.defineProperty(evalRun, 'confusion_matrix', {
        get() {
          throw new Error('html-boom');
        },
        configurable: true,
      });
      const result = exportToHtml(evalRun);
      expect(result.success).toBe(false);
      expect(result.error).toBe('html-boom');
      expect(result.html).toBe('');
    });
  });

  describe('exportToJson - error handling', () => {
    it('returns failure on error', () => {
      const evalRun = createMinimalEvalRun();
      Object.defineProperty(evalRun, 'metrics', {
        get() {
          throw new Error('json-boom');
        },
        configurable: true,
      });
      const input: JsonExportInput = { evalRun };
      const result = exportToJson(input);
      expect(result.success).toBe(false);
      expect(result.error).toBe('json-boom');
    });
  });
});
