/**
 * CI integration utilities for regression gates
 */
import { appendFileSync } from 'fs';
import { GateResult, EvalRun } from '../types/domain.js';

export interface CIOutput {
  exitCode: number;
  summary: string;
  details: string;
  annotations?: CIAnnotation[];
}

export interface CIAnnotation {
  path?: string;
  line?: number;
  column?: number;
  title: string;
  message: string;
  level: 'notice' | 'warning' | 'error';
}

/**
 * Generates GitHub Actions output format
 */
export function generateGitHubOutput(results: GateResult[]): CIOutput {
  const passed = results.every((r) => r.passed);
  const annotations: CIAnnotation[] = [];

  for (const result of results) {
    if (!result.passed) {
      annotations.push({
        title: `Gate Failed: ${result.gate.name}`,
        message: result.message ?? 'Gate threshold not met',
        level: 'error',
      });
    }
  }

  const summaryLines = results.map((r) => {
    const status = r.passed ? '✅' : '❌';
    return `${status} ${r.gate.name}: ${r.passed ? 'PASSED' : 'FAILED'}${r.message !== undefined ? ' - ' + r.message : ''}`;
  });

  const details = results
    .map((r) => {
      const status = r.passed ? 'PASSED' : 'FAILED';
      return `${r.gate.name}: ${status}\n  ${r.message ?? 'No issues detected'}`;
    })
    .join('\n\n');

  const summary = `${passed ? 'All gates passed' : 'Some gates failed'}\n\n${summaryLines.join('\n')}`;

  return {
    exitCode: passed ? 0 : 1,
    summary,
    details,
    annotations,
  };
}

/**
 * Escapes XML special characters
 */
function escapeXml(unsafe: string): string {
  const replacements: [RegExp, string][] = [
    [/&/g, '&amp;'],
    [/</g, '&lt;'],
    [/>/g, '&gt;'],
    [/"/g, '&quot;'],
    [/'/g, '&apos;'],
  ];
  let result = unsafe;
  for (const [pattern, replacement] of replacements) {
    result = result.replace(pattern, replacement);
  }
  return result;
}

/**
 * Generates JUnit XML format for CI systems
 */
export function generateJUnitXML(results: GateResult[], _evalResults?: EvalRun): string {
  const timestamp = new Date().toISOString();
  const testName = 'regression-gates';

  const testCases = results
    .map((r) => {
      const testCase = `    <testcase name="${r.gate.name}" classname="gates" time="0">`;
      if (!r.passed) {
        return `${testCase}
      <failure message="${escapeXml(r.message ?? 'Gate failed')}"/>
    </testcase>`;
      }
      return `${testCase}
    </testcase>`;
    })
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<testsuites name="classifier-evals" tests="${results.length}" failures="${results.filter((r) => !r.passed).length}" time="0">
  <testsuite name="${testName}" tests="${results.length}" failures="${results.filter((r) => !r.passed).length}" time="0" timestamp="${timestamp}">
${testCases}
  </testsuite>
</testsuites>`;
}

/**
 * Generates PR comment markdown
 */
export function generatePRComment(results: GateResult[], evalResults?: EvalRun): string {
  const passed = results.every((r) => r.passed);
  const emoji = passed ? '✅' : '❌';

  let comment = `# ${emoji} Regression Gates\n\n`;

  if (passed) {
    comment += 'All regression gates **passed**! The model is ready for deployment.\n\n';
  } else {
    comment += '⚠️ Some regression gates **failed**. Review the details below.\n\n';
  }

  comment += '## Gate Results\n\n';
  comment += '| Gate | Status | Details |\n';
  comment += '|------|--------|--------|\n';

  for (const result of results) {
    const status = result.passed ? '✅ Passed' : '❌ Failed';
    const reason = (result.message ?? '-').replace(/\|/g, '\\|');
    comment += `| ${result.gate.name} | ${status} | ${reason} |\n`;
  }

  if (evalResults) {
    comment += '\n## Summary Metrics\n\n';
    comment += `- **Accuracy**: ${(evalResults.metrics.accuracy * 100).toFixed(1)}%\n`;
    comment += `- **Macro F1**: ${(evalResults.metrics.f1_macro * 100).toFixed(1)}%\n`;
    comment += `- **Samples**: ${evalResults.total_samples}\n`;
  }

  return comment;
}

/**
 * Checks if running in GitHub Actions
 */
export function isGitHubActions(): boolean {
  return process.env.GITHUB_ACTIONS !== undefined && process.env.GITHUB_ACTIONS !== '';
}

/**
 * Sets GitHub Actions output
 */
export function setGitHubOutput(name: string, value: string): void {
  if (
    isGitHubActions() &&
    process.env.GITHUB_OUTPUT !== undefined &&
    process.env.GITHUB_OUTPUT !== ''
  ) {
    try {
      appendFileSync(process.env.GITHUB_OUTPUT, `${name}=${value}\n`);
    } catch {
      console.error(`Failed to write GitHub output: ${name}=${value}`);
    }
  }
}
