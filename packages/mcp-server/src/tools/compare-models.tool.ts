/**
 * compare_models MCP tool implementation
 */
import { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import {
  comparePersistedEvalRuns,
  compareModels,
  summarizeComparison,
} from '@reaatech/classifier-evals-metrics';
import { logger } from '@reaatech/classifier-evals';
import type { ClassificationResult, EvalRun } from '@reaatech/classifier-evals';
import { loadEvalRunFromFile } from '@reaatech/classifier-evals';

export async function compareModelsTool(args: Record<string, unknown>): Promise<CallToolResult> {
  const baselineResultsArg = args.baseline_results ?? args.baseline_predictions;
  const candidateResultsArg = args.candidate_results ?? args.candidate_predictions;
  const significanceLevel =
    typeof args.significance_level === 'number' ? args.significance_level : 0.05;

  if (baselineResultsArg === undefined || candidateResultsArg === undefined) {
    return {
      content: [
        { type: 'text', text: 'Error: baseline_results and candidate_results are required' },
      ],
      isError: true,
    };
  }

  try {
    const comparison =
      typeof baselineResultsArg === 'string' && typeof candidateResultsArg === 'string'
        ? comparePersistedEvalRuns(
            loadEvalRunFromFile(baselineResultsArg),
            loadEvalRunFromFile(candidateResultsArg),
            significanceLevel,
          )
        : compareModels(
            baselineResultsArg as ClassificationResult[],
            candidateResultsArg as ClassificationResult[],
            significanceLevel,
          );
    const summary = summarizeComparison(comparison);

    logger.info(
      {
        baseline: baselineResultsArg as string | ClassificationResult[] | EvalRun,
        candidate: candidateResultsArg as string | ClassificationResult[] | EvalRun,
        accuracyDifference: comparison.accuracy_difference,
      },
      'Model comparison completed',
    );

    return {
      content: [
        {
          type: 'text',
          text: summary,
        },
      ],
    };
  } catch (error) {
    logger.error({ error }, 'Model comparison failed');
    return {
      content: [{ type: 'text', text: `Model comparison failed: ${(error as Error).message}` }],
      isError: true,
    };
  }
}
