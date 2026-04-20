/**
 * LLM Judge tool for MCP server
 */

import { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { executeBatchConsensusVoting } from '../../judge/consensus-voting.js';
import { createJudgeEngine } from '../../judge/judge-engine.js';
import type { ClassificationResult } from '../../types/index.js';

export async function llmJudgeTool(args: Record<string, unknown>): Promise<CallToolResult> {
  const samples = args.samples as ClassificationResult[] | undefined;
  const judgeModel = args.judge_model as string | undefined;
  const budgetLimit = args.budget_limit as number | undefined;

  if (!Array.isArray(samples) || judgeModel === undefined || judgeModel === '') {
    return {
      content: [
        {
          type: 'text',
          text: 'Error: samples and judge_model are required',
        },
      ],
      isError: true,
    };
  }

  const consensusCount = typeof args.consensus_count === 'number' ? args.consensus_count : 1;
  const judge = createJudgeEngine({
    model: judgeModel,
    maxConcurrency: consensusCount,
    budget:
      budgetLimit !== undefined
        ? {
            maxBudget: budgetLimit,
            alertThreshold: 80,
          }
        : undefined,
  });
  const result =
    consensusCount > 1
      ? await evaluateConsensus(judge, samples, consensusCount)
      : await judge.evaluateBatch(samples);

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(result, null, 2),
      },
    ],
  };
}

async function evaluateConsensus(
  judge: ReturnType<typeof createJudgeEngine>,
  samples: ClassificationResult[],
  consensusCount: number,
): Promise<{
  consensus_results: ReturnType<typeof executeBatchConsensusVoting>;
  totalCost: number;
  totalTokens: { input: number; output: number };
  samplesProcessed: number;
  agreementRate: number;
  budgetExceeded: boolean;
}> {
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
    consensus_results: consensusResults,
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
  };
}
