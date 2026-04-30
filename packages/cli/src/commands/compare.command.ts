/**
 * Compare command - compare two model evaluations
 */

import { Command } from 'commander';
import { writeFileSync } from 'fs';
import { comparePersistedEvalRuns, summarizeComparison } from '@reaatech/classifier-evals-metrics';
import { loadEvalRunFromFile } from '@reaatech/classifier-evals';

interface CompareCommandOptions {
  baseline: string;
  candidate: string;
  output?: string;
}

export function compareCommand(program: Command): void {
  program
    .command('compare')
    .description('Compare two model evaluation results')
    .requiredOption('-b, --baseline <path>', 'Path to baseline results file')
    .requiredOption('-c, --candidate <path>', 'Path to candidate results file')
    .option('-o, --output <path>', 'Output file path')
    .action(async (options: CompareCommandOptions) => {
      try {
        console.error('Comparing model results...');
        console.error(`  Baseline: ${options.baseline}`);
        console.error(`  Candidate: ${options.candidate}`);

        const baselineRun = loadEvalRunFromFile(options.baseline);
        const candidateRun = loadEvalRunFromFile(options.candidate);
        const comparison = comparePersistedEvalRuns(baselineRun, candidateRun);
        const summary = summarizeComparison(comparison);

        console.error('\nComparison Results:');
        console.error(`  Baseline Accuracy: ${(comparison.baseline_accuracy * 100).toFixed(2)}%`);
        console.error(`  Candidate Accuracy: ${(comparison.candidate_accuracy * 100).toFixed(2)}%`);
        console.error(`  Improvement: ${(comparison.accuracy_difference * 100).toFixed(2)}%`);
        console.error(`  Summary: ${summary}`);

        if (options.output !== undefined) {
          writeFileSync(options.output, JSON.stringify({ comparison, summary }, null, 2));
          console.error(`\nComparison written to: ${options.output}`);
        } else {
          process.stdout.write(JSON.stringify({ comparison, summary }, null, 2) + '\n');
        }

        process.exit(0);
      } catch (error) {
        console.error('Error:', error instanceof Error ? error.message : error);
        process.exit(1);
      }
    });
}
