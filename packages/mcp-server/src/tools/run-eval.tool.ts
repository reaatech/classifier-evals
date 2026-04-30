/**
 * run_eval MCP tool implementation
 */
import { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { loadDataset } from '@reaatech/classifier-evals-dataset';
import { logger } from '@reaatech/classifier-evals';
import type { ClassificationResult } from '@reaatech/classifier-evals';
import { createEvalRunFromSamples } from '@reaatech/classifier-evals-metrics';

export async function runEvalTool(args: Record<string, unknown>): Promise<CallToolResult> {
  const datasetPath = args.dataset_path as string;

  if (!datasetPath) {
    return {
      content: [{ type: 'text', text: 'Error: dataset_path is required' }],
      isError: true,
    };
  }

  try {
    const dataset = await loadDataset(datasetPath);
    const providedPredictions = Array.isArray(args.predictions)
      ? (args.predictions as ClassificationResult[])
      : undefined;
    const samples = providedPredictions ?? dataset.samples;
    const evalRun = createEvalRunFromSamples({
      datasetPath,
      samples,
    });

    logger.info(
      {
        dataset: datasetPath,
        samples: evalRun.total_samples,
        accuracy: evalRun.metrics.accuracy,
      },
      'Evaluation completed',
    );

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(evalRun, null, 2),
        },
      ],
    };
  } catch (error) {
    logger.error({ error, dataset: datasetPath }, 'Evaluation failed');
    return {
      content: [{ type: 'text', text: `Evaluation failed: ${(error as Error).message}` }],
      isError: true,
    };
  }
}
