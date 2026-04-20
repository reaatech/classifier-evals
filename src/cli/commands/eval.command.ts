/**
 * Eval command - run evaluation on a dataset
 */

import { Command } from 'commander';
import { loadDataset } from '../../dataset/loader.js';
import { exportToJson, exportToHtml } from '../../exporters/index.js';
import { createEvalRunFromSamples } from '../../utils/eval-run.js';
import * as fs from 'fs';

interface EvalCommandOptions {
  dataset: string;
  format: 'json' | 'html';
  output?: string;
  includeConfusionMatrix: boolean;
  includePerClass: boolean;
}

export function evalCommand(program: Command): void {
  program
    .command('eval')
    .description('Run evaluation on a dataset')
    .requiredOption('-d, --dataset <path>', 'Path to dataset file (CSV, JSON, JSONL)')
    .option('-f, --format <format>', 'Output format (json, html)', 'json')
    .option('-o, --output <path>', 'Output file path')
    .option('--no-include-confusion-matrix', 'Exclude confusion matrix from output')
    .option('--no-include-per-class', 'Exclude per-class metrics from output')
    .action(async (options: EvalCommandOptions) => {
      try {
        if (options.format !== 'json' && options.format !== 'html') {
          throw new Error(`Invalid format "${options.format}". Supported: json, html`);
        }
        console.error(`Loading dataset from: ${options.dataset}`);

        // Load dataset
        const dataset = await loadDataset(options.dataset);
        console.error(`Loaded ${dataset.samples.length} samples`);
        console.error(`Labels: ${dataset.metadata.labels.join(', ')}`);

        const startedAt = new Date();
        const evalRun = createEvalRunFromSamples({
          datasetPath: options.dataset,
          samples: dataset.samples,
          startedAt,
          completedAt: new Date(),
        });
        const { confusion_matrix: cm, metrics } = evalRun;

        console.error(`\nConfusion Matrix (${cm.labels.length}x${cm.labels.length}):`);
        console.error(cm.matrix.map((row) => row.join('\t')).join('\n'));

        console.error(`\nOverall Metrics:`);
        console.error(`  Accuracy: ${(metrics.accuracy * 100).toFixed(2)}%`);
        console.error(`  Macro F1: ${(metrics.f1_macro * 100).toFixed(2)}%`);
        console.error(`  Precision (Macro): ${(metrics.precision_macro * 100).toFixed(2)}%`);
        console.error(`  Recall (Macro): ${(metrics.recall_macro * 100).toFixed(2)}%`);

        // Export results
        let output: string;
        if (options.format === 'html') {
          const result = exportToHtml(evalRun, {
            includeConfusionMatrix: options.includeConfusionMatrix,
            includePerClassMetrics: options.includePerClass,
          });
          output = result.html;
        } else {
          const result = exportToJson({
            evalRun,
            options: {
              includePerClass: options.includePerClass,
            },
          });
          output = result.json ?? '';
        }

        // Write to file or stdout
        if (options.output !== undefined) {
          fs.writeFileSync(options.output, output);
          console.error(`\nResults written to: ${options.output}`);
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
