/**
 * Judge command - run LLM-as-judge on samples
 */

import { writeFileSync } from 'node:fs';
import type { ClassificationResult } from '@reaatech/classifier-evals';
import { loadDataset } from '@reaatech/classifier-evals-dataset';
import { createJudgeEngine } from '@reaatech/classifier-evals-judge';
import { executeBatchConsensusVoting } from '@reaatech/classifier-evals-judge';
import type { JudgeAggregateResult, JudgeEngine } from '@reaatech/classifier-evals-judge';
import { createEvalRunFromSamples } from '@reaatech/classifier-evals-metrics';
import type { Command } from 'commander';

interface JudgeCommandOptions {
  samples: string;
  model: string;
  budget: string;
  concurrency: string;
  consensusCount: string;
  output?: string;
}

interface ConsensusJudgeResult extends JudgeAggregateResult {
  consensusResults: ReturnType<typeof executeBatchConsensusVoting>;
}

let partialResults: { cost: number; processed: number } | null = null;

function cleanup(): void {
  if (partialResults !== null) {
    console.error(
      `\nInterrupted! Cost incurred: $${partialResults.cost.toFixed(4)} (${partialResults.processed} samples processed)`,
    );
  }
  process.exit(130);
}

export function judgeCommand(program: Command): void {
  program
    .command('judge')
    .description('Run LLM-as-judge on evaluation samples')
    .requiredOption('-s, --samples <path>', 'Path to samples file (CSV, JSON, JSONL)')
    .option('-m, --model <model>', 'LLM model to use', 'claude-sonnet')
    .option('-b, --budget <amount>', 'Maximum budget in USD', '10.00')
    .option('-c, --concurrency <count>', 'Maximum concurrent requests', '5')
    .option('--consensus-count <count>', 'Number of judge votes per sample', '1')
    .option('-o, --output <path>', 'Output file path')
    .action(async (options: JudgeCommandOptions) => {
      process.on('SIGINT', cleanup);
      process.on('SIGTERM', cleanup);

      try {
        const budget = Number.parseFloat(options.budget);
        const concurrency = Number.parseInt(options.concurrency, 10);
        const consensusCount = Number.parseInt(options.consensusCount, 10);

        if (Number.isNaN(budget) || budget <= 0) {
          throw new Error(`Invalid budget: "${options.budget}". Must be a positive number.`);
        }
        if (Number.isNaN(concurrency) || concurrency < 1) {
          throw new Error(
            `Invalid concurrency: "${options.concurrency}". Must be a positive integer.`,
          );
        }
        if (Number.isNaN(consensusCount) || consensusCount < 1) {
          throw new Error(
            `Invalid consensus count: "${options.consensusCount}". Must be a positive integer.`,
          );
        }

        console.error('Running LLM-as-judge...');
        console.error(`  Samples: ${options.samples}`);
        console.error(`  Model: ${options.model}`);
        console.error(`  Budget: $${options.budget}`);
        console.error(`  Concurrency: ${options.concurrency}`);
        console.error(`  Consensus Count: ${options.consensusCount}`);

        // Load samples
        const dataset = await loadDataset(options.samples);
        console.error(`\nLoaded ${dataset.samples.length} samples`);

        // Create judge engine with budget
        const judge = createJudgeEngine({
          model: options.model,
          maxConcurrency: concurrency,
          budget: {
            maxBudget: budget,
            alertThreshold: 80,
          },
        });

        // Run evaluation
        console.error('\nEvaluating samples...');
        const result =
          consensusCount > 1
            ? await evaluateWithConsensus(judge, dataset.samples, consensusCount)
            : await judge.evaluateBatch(dataset.samples);

        partialResults = { cost: result.totalCost, processed: result.samplesProcessed };

        const evalRun = createEvalRunFromSamples({
          datasetPath: options.samples,
          samples: dataset.samples,
          judgedResults: result.results.map((entry) => entry.result),
          judgeCost: result.totalCost,
        });

        // Display results
        console.error('\n--- Judge Results ---');
        console.error(`  Samples Processed: ${result.samplesProcessed}`);
        console.error(`  Agreement Rate: ${(result.agreementRate * 100).toFixed(2)}%`);
        console.error(`  Total Cost: $${result.totalCost.toFixed(4)}`);
        console.error(
          `  Average Cost/Sample: $${(result.totalCost / Math.max(result.samplesProcessed, 1)).toFixed(6)}`,
        );
        console.error(`  Budget Exceeded: ${result.budgetExceeded ? 'Yes' : 'No'}`);

        const output = JSON.stringify({ judge_result: result, eval_run: evalRun }, null, 2);

        if (options.output !== undefined) {
          writeFileSync(options.output, output);
          console.error(`\nResults written to: ${options.output}`);
        } else {
          process.stdout.write(`${output}\n`);
        }

        process.exit(0);
      } catch (error) {
        console.error('Error:', error instanceof Error ? error.message : error);
        process.exit(1);
      }
    });
}

async function evaluateWithConsensus(
  judge: JudgeEngine,
  samples: ClassificationResult[],
  consensusCount: number,
): Promise<ConsensusJudgeResult> {
  const samplesWithVotes = [];

  for (const sample of samples) {
    if (!judge.canEvaluateSample(sample)) {
      break;
    }

    const evaluations = [];
    for (let i = 0; i < consensusCount; i++) {
      if (!judge.canEvaluateSample(sample)) {
        break;
      }
      evaluations.push(await judge.evaluateSample(sample));
    }

    if (evaluations.length !== consensusCount) {
      break;
    }

    samplesWithVotes.push({
      sample,
      votes: evaluations.map((evaluation, index) => ({
        judgeId: `judge-${index + 1}`,
        model: evaluation.result.judge_model ?? 'judge',
        cost: 0,
        result: evaluation.result,
      })),
    });
  }

  const consensusResults = executeBatchConsensusVoting(samplesWithVotes);
  const breakdown = judge.getCostBreakdown();

  return {
    results: samplesWithVotes.flatMap((entry, sampleIndex) =>
      entry.votes.map((vote) => ({
        sample: samples[sampleIndex]!,
        result: vote.result,
        tokensUsed: { input: 0, output: 0 },
      })),
    ),
    totalCost: breakdown.totalCost,
    totalTokens: {
      input: breakdown.inputTokens,
      output: breakdown.outputTokens,
    },
    samplesProcessed: samplesWithVotes.length,
    agreementRate:
      consensusResults.reduce((sum, entry) => sum + entry.agreementRate, 0) /
      Math.max(consensusResults.length, 1),
    budgetExceeded: judge.isBudgetExceeded(),
    consensusResults,
  };
}
