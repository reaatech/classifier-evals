/**
 * Gates command - check regression gates
 */

import { Command } from 'commander';
import { createGateEngine, GateEvaluationResult } from '@reaatech/classifier-evals-gates';
import * as fs from 'fs';
import { loadEvalRunFromFile } from '@reaatech/classifier-evals';
import { loadRegressionGatesFromFile } from '@reaatech/classifier-evals-gates';

interface GatesCommandOptions {
  results: string;
  gates: string;
  junitOutput?: string;
  githubActions: boolean;
}

export function gatesCommand(program: Command): void {
  program
    .command('gates')
    .description('Check regression gates against evaluation results')
    .requiredOption('-r, --results <path>', 'Path to evaluation results file')
    .requiredOption('-g, --gates <path>', 'Path to gates configuration file')
    .option('--junit-output <path>', 'Write JUnit XML to file')
    .option('--github-actions', 'Format output for GitHub Actions', false)
    .action(async (options: GatesCommandOptions) => {
      try {
        console.error('Checking regression gates...');
        console.error(`  Results: ${options.results}`);
        console.error(`  Gates: ${options.gates}`);

        const evalRun = loadEvalRunFromFile(options.results);
        const gates = loadRegressionGatesFromFile(options.gates);

        console.error(`\nFound ${gates.length} gates to evaluate`);

        // Create gate engine
        const engine = createGateEngine();

        // Evaluate gates
        const result = engine.evaluateGates(evalRun.metrics, gates, { evalRun });

        // Format output
        let output: string;
        if (options.githubActions === true) {
          output = engine.formatForGitHubActions(result);
        } else {
          output = formatGateResults(result);
        }

        console.error(`\n${output}`);

        // Write JUnit output if requested
        if (options.junitOutput !== undefined) {
          const junitXml = engine.formatAsJUnit(result);
          fs.writeFileSync(options.junitOutput, junitXml);
          console.error(`\nJUnit XML written to: ${options.junitOutput}`);
        }

        // Exit with appropriate code
        process.exit(result.passed ? 0 : 1);
      } catch (error) {
        console.error('Error:', error instanceof Error ? error.message : error);
        process.exit(1);
      }
    });
}

/**
 * Format gate results for console output
 */
function formatGateResults(result: GateEvaluationResult): string {
  const lines: string[] = [];

  const status = result.passed ? '✅ PASSED' : '❌ FAILED';
  lines.push(`\nGate Evaluation: ${status}`);
  lines.push(`Passed: ${result.passedCount}/${result.totalCount}`);
  lines.push('');

  for (const gateResult of result.gateResults) {
    const icon = gateResult.passed ? '✅' : '❌';
    lines.push(`  ${icon} ${gateResult.gate.name}`);
    if (gateResult.message !== undefined) {
      lines.push(`     ${gateResult.message}`);
    }
  }

  return lines.join('\n');
}
