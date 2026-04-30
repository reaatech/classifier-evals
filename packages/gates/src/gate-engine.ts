/**
 * Regression Gate Engine - evaluates quality gates for CI
 */

import type { ClassificationMetrics, GateResult, RegressionGate } from '@reaatech/classifier-evals';
import { evaluateBaselineComparison } from './baseline-comparison.js';
import { evaluateDistributionGate } from './distribution-gates.js';
import type { GateEvaluationContext } from './metric-lookup.js';
import { evaluateThresholdGate } from './threshold-gates.js';

/**
 * Gate type discriminator
 */
export type GateType = 'threshold' | 'baseline-comparison' | 'distribution';

/**
 * Configuration for gate evaluation
 */
export interface GateEngineConfig {
  baselinePath?: string;
  cacheResults?: boolean;
}

/**
 * Result of evaluating all gates
 */
export interface GateEvaluationResult {
  passed: boolean;
  gateResults: GateResult[];
  passedCount: number;
  failedCount: number;
  totalCount: number;
}

/**
 * Cache for gate results
 */
interface GateCache {
  key: string;
  result: GateResult;
  timestamp: number;
}

/**
 * Regression Gate Engine
 */
export class GateEngine {
  private config: GateEngineConfig;
  private cache: Map<string, GateCache> = new Map();
  private static readonly MAX_CACHE_SIZE = 100;
  private static readonly DEFAULT_CACHE_TTL_MS = 60000;

  constructor(config: GateEngineConfig = {}) {
    this.config = {
      cacheResults: config.cacheResults ?? true,
      baselinePath: config.baselinePath,
    };
  }

  /**
   * Evaluate all gates against metrics
   */
  evaluateGates(
    metrics: ClassificationMetrics,
    gates: RegressionGate[],
    context?: GateEvaluationContext,
  ): GateEvaluationResult {
    const gateResults: GateResult[] = [];

    for (const gate of gates) {
      const cacheKey = this.getCacheKey(gate, metrics);

      if (this.config.cacheResults === true) {
        const cached = this.cache.get(cacheKey);
        const cacheValid =
          cached !== undefined && Date.now() - cached.timestamp < GateEngine.DEFAULT_CACHE_TTL_MS;
        if (cached !== undefined && cacheValid) {
          gateResults.push(cached.result);
          continue;
        }
      }

      let result: GateResult;
      try {
        switch (gate.type) {
          case 'threshold':
            result = evaluateThresholdGate(metrics, gate, context);
            break;
          case 'baseline-comparison':
            result = evaluateBaselineComparison(metrics, gate, this.config.baselinePath, context);
            break;
          case 'distribution':
            result = evaluateDistributionGate(metrics, gate, context);
            break;
          default:
            result = {
              passed: false,
              gate: gate,
              message: `Unknown gate type: ${gate.type}`,
              failures: [],
            };
        }
      } catch (err) {
        result = {
          passed: false,
          gate,
          message: `Gate evaluation error: ${(err as Error).message}`,
          failures: [],
        };
      }

      gateResults.push(result);

      if (this.config.cacheResults === true) {
        if (this.cache.size >= GateEngine.MAX_CACHE_SIZE) {
          const oldestKey = this.cache.keys().next().value;
          if (oldestKey !== undefined) {
            this.cache.delete(oldestKey);
          }
        }
        this.cache.set(cacheKey, {
          key: cacheKey,
          result,
          timestamp: Date.now(),
        });
      }
    }

    const passedCount = gateResults.filter((g) => g.passed).length;
    const failedCount = gateResults.length - passedCount;

    return {
      passed: failedCount === 0,
      gateResults,
      passedCount,
      failedCount,
      totalCount: gateResults.length,
    };
  }

  /**
   * Generate a cache key for gate evaluation
   */
  private getCacheKey(gate: RegressionGate, metrics: ClassificationMetrics): string {
    const gateStr = JSON.stringify(gate);
    const metricsStr = JSON.stringify({
      accuracy: metrics.accuracy,
      f1_macro: metrics.f1_macro,
      precision_macro: metrics.precision_macro,
      recall_macro: metrics.recall_macro,
    });
    return `${gateStr}:${metricsStr}`;
  }

  /**
   * Clear the cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Format gate results for GitHub Actions
   */
  formatForGitHubActions(result: GateEvaluationResult): string {
    const lines: string[] = [];

    lines.push('::group::Gate Evaluation Results');
    lines.push(`Overall: ${result.passed ? 'PASSED' : 'FAILED'}`);
    lines.push(`Passed: ${result.passedCount}/${result.totalCount}`);
    lines.push('');

    for (const gateResult of result.gateResults) {
      const status = gateResult.passed ? '✅' : '❌';
      lines.push(`${status} ${gateResult.gate.name}`);
      if (gateResult.message !== undefined) {
        lines.push(`   ${gateResult.message}`);
      }
    }

    lines.push('::endgroup::');

    if (!result.passed) {
      lines.push(`::error::Regression gates failed: ${result.failedCount} gate(s) did not pass`);
    }

    return lines.join('\n');
  }

  /**
   * Format gate results as JUnit XML
   */
  formatAsJUnit(result: GateEvaluationResult): string {
    const timestamp = new Date().toISOString();

    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
    xml += `<testsuites name="regression-gates" tests="${result.totalCount}" failures="${result.failedCount}" time="0">\n`;
    xml += `  <testsuite name="gates" tests="${result.totalCount}" failures="${result.failedCount}" timestamp="${timestamp}">\n`;

    for (const gateResult of result.gateResults) {
      xml += `    <testcase name="${gateResult.gate.name}" classname="regression-gates">\n`;
      if (!gateResult.passed) {
        const msg = this.escapeXml(gateResult.message ?? 'Gate failed');
        xml += `      <failure message="${msg}"/>\n`;
      }
      xml += '    </testcase>\n';
    }

    xml += '  </testsuite>\n';
    xml += '</testsuites>\n';

    return xml;
  }

  /**
   * Escape XML special characters
   */
  private escapeXml(str: string): string {
    return str
      .split('&')
      .join('&#38;')
      .split('<')
      .join('&#60;')
      .split('>')
      .join('&#62;')
      .split('"')
      .join('&#34;')
      .split("'")
      .join('&#39;');
  }
}

/**
 * Create a new gate engine
 */
export function createGateEngine(config?: GateEngineConfig): GateEngine {
  return new GateEngine(config);
}
