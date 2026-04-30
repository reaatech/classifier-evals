import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import type { ClassificationResult, RegressionGate } from '@reaatech/classifier-evals';
import { loadDataset } from '@reaatech/classifier-evals-dataset';
import { createGateEngine } from '@reaatech/classifier-evals-gates';
import { buildConfusionMatrix } from '@reaatech/classifier-evals-metrics';
import { calculateAllMetrics } from '@reaatech/classifier-evals-metrics';
import { createEvalRunFromSamples } from '@reaatech/classifier-evals-metrics';
import { afterEach, describe, expect, it } from 'vitest';

const tempDirs: string[] = [];

function createTempDir(): string {
  const tempDir = mkdtempSync(path.join(os.tmpdir(), 'classifier-evals-perf-'));
  tempDirs.push(tempDir);
  return tempDir;
}

function generateSamples(
  count: number,
  errorEvery: number,
  unknownEvery: number,
): ClassificationResult[] {
  const labels = ['billing', 'shipping', 'returns', 'account'];

  return Array.from({ length: count }, (_, index) => {
    const label = labels[index % labels.length]!;
    let predictedLabel = label;

    if (index % errorEvery === 0) {
      predictedLabel = labels[(index + 1) % labels.length]!;
    }

    if (index % unknownEvery === 0) {
      predictedLabel = 'unknown';
    }

    return {
      text: `Synthetic sample ${index} for ${label}`,
      label,
      predicted_label: predictedLabel,
      confidence: predictedLabel === label ? 0.96 : 0.41,
      metadata: {
        source: 'performance-test',
        batch: Math.floor(index / 100),
      },
    };
  });
}

function writeJsonlDataset(filePath: string, samples: ClassificationResult[]): void {
  const content = samples.map((sample) => JSON.stringify(sample)).join('\n');
  writeFileSync(filePath, `${content}\n`, 'utf8');
}

function createGateSet(baselinePath: string): RegressionGate[] {
  return [
    {
      name: 'accuracy-threshold',
      type: 'threshold',
      metric: 'accuracy',
      operator: '>=',
      threshold: 0.85,
    },
    {
      name: 'unknown-rate',
      type: 'distribution',
      metric: 'unknown_rate',
      operator: '<=',
      threshold: 0.03,
    },
    {
      name: 'accuracy-baseline',
      type: 'baseline-comparison',
      metric: 'accuracy',
      baseline_path: baselinePath,
    },
  ];
}

function measureCorePipeline(
  samples: ClassificationResult[],
  baselinePath: string,
): { runtimeMs: number; accuracy: number; totalSamples: number } {
  const start = performance.now();
  const evalRun = createEvalRunFromSamples({ samples });
  const engine = createGateEngine({ cacheResults: false });
  const gateResult = engine.evaluateGates(evalRun.metrics, createGateSet(baselinePath), {
    evalRun,
  });
  const runtimeMs = performance.now() - start;

  expect(gateResult.passed).toBe(true);

  return {
    runtimeMs,
    accuracy: evalRun.metrics.accuracy,
    totalSamples: evalRun.metrics.total_samples,
  };
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const tempDir = tempDirs.pop();
    if (tempDir !== undefined) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  }
});

describe('evaluation performance', () => {
  it('processes a 10k+ dataset through load, metrics, and gates within a conservative budget', async () => {
    const tempDir = createTempDir();
    const datasetPath = path.join(tempDir, 'large-dataset.jsonl');
    const baselinePath = path.join(tempDir, 'baseline.json');
    const candidateSamples = generateSamples(12000, 10, 40);
    const baselineSamples = generateSamples(12000, 8, 40);

    writeJsonlDataset(datasetPath, candidateSamples);
    writeFileSync(
      baselinePath,
      JSON.stringify(createEvalRunFromSamples({ samples: baselineSamples }), null, 2),
      'utf8',
    );

    const overallStart = performance.now();

    const loadStart = performance.now();
    const dataset = await loadDataset(datasetPath, 'jsonl');
    const loadRuntimeMs = performance.now() - loadStart;

    const metricsStart = performance.now();
    const confusionMatrix = buildConfusionMatrix(dataset.samples);
    const metrics = calculateAllMetrics(dataset.samples);
    const evalRun = createEvalRunFromSamples({
      datasetPath,
      samples: dataset.samples,
    });
    const metricsRuntimeMs = performance.now() - metricsStart;

    const gatesStart = performance.now();
    const engine = createGateEngine({ cacheResults: false });
    const gateResult = engine.evaluateGates(metrics, createGateSet(baselinePath), { evalRun });
    const gatesRuntimeMs = performance.now() - gatesStart;
    const totalRuntimeMs = performance.now() - overallStart;

    expect(dataset.samples).toHaveLength(12000);
    expect(confusionMatrix.labels).toContain('unknown');
    expect(metrics.total_samples).toBe(12000);
    expect(metrics.accuracy).toBeCloseTo(0.9, 5);
    expect(gateResult.passed).toBe(true);
    expect(loadRuntimeMs).toBeLessThan(5000);
    expect(metricsRuntimeMs).toBeLessThan(10000);
    expect(gatesRuntimeMs).toBeLessThan(2000);
    expect(totalRuntimeMs).toBeLessThan(15000);
  }, 30000);

  it('keeps core compute and gate runtime well below quadratic growth as sample volume increases', () => {
    const tempDir = createTempDir();
    const smallBaselinePath = path.join(tempDir, 'baseline-small.json');
    const largeBaselinePath = path.join(tempDir, 'baseline-large.json');
    const smallSamples = generateSamples(10000, 10, 40);
    const largeSamples = generateSamples(25000, 10, 40);

    writeFileSync(
      smallBaselinePath,
      JSON.stringify(createEvalRunFromSamples({ samples: generateSamples(10000, 8, 40) }), null, 2),
      'utf8',
    );
    writeFileSync(
      largeBaselinePath,
      JSON.stringify(createEvalRunFromSamples({ samples: generateSamples(25000, 8, 40) }), null, 2),
      'utf8',
    );

    const smallRun = measureCorePipeline(smallSamples, smallBaselinePath);
    const largeRun = measureCorePipeline(largeSamples, largeBaselinePath);
    const growthRatio = largeRun.runtimeMs / Math.max(smallRun.runtimeMs, 1);

    expect(smallRun.totalSamples).toBe(10000);
    expect(largeRun.totalSamples).toBe(25000);
    expect(smallRun.accuracy).toBeCloseTo(0.9, 5);
    expect(largeRun.accuracy).toBeCloseTo(0.9, 5);
    expect(largeRun.runtimeMs).toBeLessThan(20000);
    expect(growthRatio).toBeLessThan(5);
  }, 30000);
});
