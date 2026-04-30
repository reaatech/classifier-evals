import * as fs from 'node:fs';
import {
  generateGitHubOutput,
  generateJUnitXML,
  generatePRComment,
  isGitHubActions,
  setGitHubOutput,
} from '../ci-integration.js';
import { describe, expect, it, vi } from 'vitest';
import type { GateResult } from '@reaatech/classifier-evals';
import {
  getEvalRunId,
  logDatasetLoad,
  logError,
  logEvalComplete,
  logEvalStart,
  logGateResult,
  logJudgeCost,
  logWarn,
  setEvalRunId,
} from '@reaatech/classifier-evals';
import {
  getMeter,
  initMetrics,
  recordAccuracy,
  recordEvalRun,
  recordF1Macro,
  recordGateResult,
  recordJudgeCall,
  recordJudgeCost,
  recordSamplesEvaluated,
  shutdownMetrics,
} from '@reaatech/classifier-evals';
import {
  endSpan,
  startDatasetLoadSpan,
  startEvalSpan,
  startGatesSpan,
  startJudgeSpan,
  startMetricsSpan,
  withSpan,
} from '@reaatech/classifier-evals';

describe('observability and CI helpers', () => {
  it('records logs, spans, and metrics without throwing', async () => {
    setEvalRunId('eval-1');
    expect(getEvalRunId()).toBe('eval-1');

    logEvalStart('dataset.csv', 10, 'gpt-4o');
    logDatasetLoad('jsonl', 'dataset.jsonl', 10);
    logGateResult('accuracy', true, 'passed');
    logJudgeCost('gpt-4o', 10, 0.12, 1);
    logEvalComplete(0.9, 0.88, 0.12, true);
    logWarn('warning');
    logError(new Error('boom'));

    initMetrics();
    recordEvalRun();
    recordSamplesEvaluated('dataset.csv', 10);
    recordJudgeCall('gpt-4o', 'success');
    recordJudgeCost('gpt-4o', 0.12);
    recordGateResult('accuracy', true);
    recordAccuracy('dataset.csv', 0.9);
    recordF1Macro('dataset.csv', 0.88);
    expect(getMeter()).toBeDefined();
    await shutdownMetrics();
  });

  it('formats CI output and span wrappers', async () => {
    vi.stubEnv('GITHUB_ACTIONS', '');
    const gateResults: GateResult[] = [
      {
        gate: {
          name: 'accuracy',
          type: 'threshold',
          metric: 'accuracy',
          operator: '>=',
          threshold: 0.8,
        },
        passed: false,
        message: 'too low',
        failures: [],
      },
    ];
    expect(generateGitHubOutput(gateResults).exitCode).toBe(1);
    expect(generateJUnitXML(gateResults)).toContain('<failure');
    expect(generatePRComment(gateResults)).toContain('Regression Gates');
    expect(isGitHubActions()).toBe(false);
    vi.unstubAllEnvs();

    const span = startEvalSpan('dataset.csv', 10, 'gpt-4o');
    endSpan(span);
    endSpan(startDatasetLoadSpan('jsonl', '/tmp/data'), new Error('load failed'));
    endSpan(startMetricsSpan(['accuracy']));
    endSpan(startJudgeSpan('gpt-4o', 5));
    endSpan(startGatesSpan(2));

    const resolved = await withSpan(startEvalSpan('dataset.csv', 1), async () => 'ok');
    expect(resolved).toBe('ok');
  });

  it('generates PR comment with eval results summary', () => {
    const gateResults: GateResult[] = [
      {
        gate: {
          name: 'accuracy',
          type: 'threshold',
          metric: 'accuracy',
          operator: '>=',
          threshold: 0.8,
        },
        passed: true,
        message: 'ok',
        failures: [],
      },
    ];

    const evalRun = {
      metrics: { accuracy: 0.92, f1_macro: 0.88 },
      total_samples: 100,
    } as Parameters<typeof generatePRComment>[1];

    const comment = generatePRComment(gateResults, evalRun);
    expect(comment).toContain('Summary Metrics');
    expect(comment).toContain('92.0%');
    expect(comment).toContain('88.0%');
    expect(comment).toContain('100');
  });

  it('detects GitHub Actions environment', () => {
    vi.stubEnv('GITHUB_ACTIONS', 'true');
    expect(isGitHubActions()).toBe(true);
    vi.unstubAllEnvs();
    vi.stubEnv('GITHUB_ACTIONS', '');
    expect(isGitHubActions()).toBe(false);
    vi.unstubAllEnvs();
  });

  it('setGitHubOutput writes to GITHUB_OUTPUT file in GitHub Actions', () => {
    vi.stubEnv('GITHUB_ACTIONS', 'true');
    const tmpFile = `/tmp/test-github-output-${Date.now()}`;
    vi.stubEnv('GITHUB_OUTPUT', tmpFile);
    setGitHubOutput('result', 'passed');
    const content = fs.readFileSync(tmpFile, 'utf-8');
    expect(content).toBe('result=passed\n');
    fs.unlinkSync(tmpFile);
    vi.unstubAllEnvs();
  });

  it('log functions handle errors gracefully', async () => {
    const loggerModule = await import('@reaatech/classifier-evals');
    const originalLogger = loggerModule.logger;
    const origInfo = originalLogger.info;
    const origWarn = originalLogger.warn;
    const origError = originalLogger.error;

    originalLogger.info = (() => {
      throw new Error('info fail');
    }) as (...args: unknown[]) => void;
    originalLogger.warn = (() => {
      throw new Error('warn fail');
    }) as (...args: unknown[]) => void;
    originalLogger.error = (() => {
      throw new Error('error fail');
    }) as (...args: unknown[]) => void;

    expect(() => logEvalStart('test.csv', 5)).not.toThrow();
    expect(() => logEvalComplete(0.9, 0.8)).not.toThrow();
    expect(() => logGateResult('test', true)).not.toThrow();
    expect(() => logJudgeCost('gpt-4o', 1, 0.01)).not.toThrow();
    expect(() => logDatasetLoad('csv', '/tmp/test', 10)).not.toThrow();
    expect(() => logError(new Error('test error'))).not.toThrow();
    expect(() => logWarn('test warning')).not.toThrow();

    originalLogger.info = origInfo;
    originalLogger.warn = origWarn;
    originalLogger.error = origError;
  });
});
