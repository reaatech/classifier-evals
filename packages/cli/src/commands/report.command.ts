/**
 * Report command - generate reports from evaluation results
 */

import { Command } from 'commander';
import { exportToJson } from '@reaatech/classifier-evals-exporters';
import { exportToHtml } from '@reaatech/classifier-evals-exporters';
import { exportToLangfuse } from '@reaatech/classifier-evals-exporters';
import { exportToPhoenix } from '@reaatech/classifier-evals-exporters';
import * as fs from 'fs';
import type { EvalRun } from '@reaatech/classifier-evals';

interface ReportCommandOptions {
  results: string;
  format: 'json' | 'html' | 'phoenix' | 'langfuse';
  output?: string;
  endpoint?: string;
  datasetName?: string;
  traceName?: string;
  sessionId?: string;
  includeConfusionMatrix: boolean;
  includePerClass: boolean;
}

export function reportCommand(program: Command): void {
  program
    .command('export')
    .alias('report')
    .description('Generate or export reports from evaluation results')
    .requiredOption('-r, --results <path>', 'Path to evaluation results file')
    .option('-f, --format <format>', 'Output format (json, html, phoenix, langfuse)', 'html')
    .option('-o, --output <path>', 'Output file path')
    .option('--endpoint <url>', 'Exporter endpoint for Phoenix')
    .option('--dataset-name <name>', 'Dataset name for Phoenix exports')
    .option('--trace-name <name>', 'Trace name for Langfuse exports')
    .option('--session-id <id>', 'Session id for Langfuse exports')
    .option('--include-confusion-matrix', 'Include confusion matrix', true)
    .option('--include-per-class', 'Include per-class metrics', true)
    .action(async (options: ReportCommandOptions) => {
      try {
        console.error('Generating report...');
        console.error(`  Results: ${options.results}`);
        console.error(`  Format: ${options.format}`);
        console.error(`  Output: ${options.output ?? 'stdout'}`);

        // Load results
        let evalRun: EvalRun;
        try {
          const resultsJson = fs.readFileSync(options.results, 'utf-8');
          evalRun = JSON.parse(resultsJson) as EvalRun;
        } catch (err) {
          throw new Error(
            `Failed to parse results file "${options.results}": ${(err as Error).message}`,
            { cause: err },
          );
        }

        // Generate report
        let output: string;
        if (options.format === 'html') {
          const result = exportToHtml(evalRun, {
            includeConfusionMatrix: options.includeConfusionMatrix,
            includePerClassMetrics: options.includePerClass,
          });
          output = result.html ?? '';
        } else if (options.format === 'phoenix') {
          const result = await exportToPhoenix({
            evalRun,
            options: {
              endpoint: options.endpoint,
              datasetName: options.datasetName,
            },
          });
          output = JSON.stringify(result, null, 2);
        } else if (options.format === 'langfuse') {
          const result = await exportToLangfuse({
            evalRun,
            options: {
              traceName: options.traceName,
              sessionId: options.sessionId,
            },
          });
          output = JSON.stringify(result, null, 2);
        } else {
          const result = exportToJson({ evalRun });
          output = result.json ?? '';
        }

        // Write output
        if (options.output !== undefined) {
          fs.writeFileSync(options.output, output);
          console.error(`\nReport generated: ${options.output}`);
        } else {
          process.stdout.write(output + '\n');
        }

        process.exit(0);
      } catch (error) {
        console.error('Error:', error instanceof Error ? error.message : error);
        process.exit(1);
      }
    });
}
