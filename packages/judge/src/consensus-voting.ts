/**
 * Consensus Voting for Multi-Judge LLM Evaluation
 * Implements majority voting, weighted voting, and disagreement detection
 */

import type { ClassificationResult, JudgedResult } from '@reaatech/classifier-evals';

/**
 * A single judge's evaluation result
 */
export interface JudgeVote {
  judgeId: string;
  result: JudgedResult;
  weight?: number;
  model: string;
  cost: number;
}

/**
 * Consensus result from multiple judges
 */
export interface ConsensusResult {
  sample: ClassificationResult;
  votes: JudgeVote[];
  consensusCorrect: boolean;
  consensusConfidence: number;
  agreementRate: number;
  isDisagreement: boolean;
  finalReasoning?: string;
  totalCost: number;
}

/**
 * Configuration for consensus voting
 */
export interface ConsensusConfig {
  /** Minimum number of judges required */
  minJudges: number;
  /** Voting strategy */
  strategy: 'majority' | 'weighted' | 'unanimous';
  /** Threshold for agreement (0-1) */
  agreementThreshold: number;
  /** Whether to use weighted voting by judge reliability */
  useWeightedVoting: boolean;
  /** Judge reliability scores (judgeId -> reliability) */
  judgeReliabilities?: Map<string, number>;
}

/**
 * Default consensus configuration
 */
export const DEFAULT_CONSENSUS_CONFIG: ConsensusConfig = {
  minJudges: 3,
  strategy: 'majority',
  agreementThreshold: 0.67,
  useWeightedVoting: false,
};

/**
 * Calculate weighted vote for a single judge
 * Correctness signal is kept separate from confidence/reliability
 */
function calculateWeightedVote(vote: JudgeVote, reliability?: number): number {
  const weight = vote.weight ?? 1.0;
  const judgeReliability = reliability ?? 1.0;
  const isCorrect = vote.result.judge_correct === true ? 1 : 0;
  const confidence = vote.result.judge_confidence ?? 0.5;

  // Weighted score: (weight * reliability) * (0.5 + 0.5 * correctness) * confidence
  // This separates the correctness signal from the confidence/reliability factors
  // Correct votes get base weight of 1.0, incorrect votes get 0.5
  const correctnessSignal = isCorrect === 1 ? 1.0 : 0.5;
  return weight * judgeReliability * confidence * correctnessSignal;
}

/**
 * Perform majority voting across multiple judges
 */
function majorityVote(votes: JudgeVote[]): { correct: boolean; confidence: number } {
  const correctVotes = votes.filter((v) => v.result.judge_correct === true).length;
  const totalVotes = votes.length;
  const correctRate = correctVotes / totalVotes;

  return {
    correct: correctRate >= 0.5,
    confidence: Math.max(correctRate, 1 - correctRate),
  };
}

/**
 * Perform weighted voting across multiple judges
 */
function weightedVote(
  votes: JudgeVote[],
  reliabilities: Map<string, number>,
): { correct: boolean; confidence: number } {
  let totalWeight = 0;
  let correctWeight = 0;

  for (const vote of votes) {
    const reliability = reliabilities.get(vote.judgeId) ?? 1.0;
    const weight = calculateWeightedVote(vote, reliability);
    totalWeight += weight;
    if (vote.result.judge_correct === true) {
      correctWeight += weight;
    }
  }

  const correctRate = totalWeight > 0 ? correctWeight / totalWeight : 0.5;

  return {
    correct: correctRate >= 0.5,
    confidence: Math.max(correctRate, 1 - correctRate),
  };
}

/**
 * Perform unanimous voting (all judges must agree)
 */
function unanimousVote(votes: JudgeVote[]): { correct: boolean; confidence: number } {
  const allCorrect = votes.every((v) => v.result.judge_correct === true);
  const allIncorrect = votes.every((v) => v.result.judge_correct === false);

  return {
    correct: allCorrect,
    confidence: allCorrect || allIncorrect ? 1.0 : 0.0,
  };
}

/**
 * Calculate agreement rate among judges
 */
function calculateAgreementRate(votes: JudgeVote[]): number {
  if (votes.length < 2) {
    return 1.0;
  }

  const correctCount = votes.filter((v) => v.result.judge_correct === true).length;
  const incorrectCount = votes.length - correctCount;

  // Agreement rate is the proportion of pairs that agree
  const totalPairs = (votes.length * (votes.length - 1)) / 2;
  const agreeingPairs =
    (correctCount * (correctCount - 1)) / 2 + (incorrectCount * (incorrectCount - 1)) / 2;

  return totalPairs > 0 ? agreeingPairs / totalPairs : 0;
}

/**
 * Generate consensus reasoning from multiple judge reasonings
 */
function generateConsensusReasoning(votes: JudgeVote[]): string {
  const reasonings = votes
    .map((v) => v.result.judge_reasoning)
    .filter((r): r is string => r !== undefined && r !== '');

  if (reasonings.length === 0) {
    return '';
  }

  // Take the most common reasoning pattern
  const reasoningCounts = new Map<string, number>();
  for (const reasoning of reasonings) {
    const normalized = reasoning.toLowerCase().trim();
    reasoningCounts.set(normalized, (reasoningCounts.get(normalized) ?? 0) + 1);
  }

  const sortedReasonings = Array.from(reasoningCounts.entries()).sort((a, b) => b[1] - a[1]);

  return sortedReasonings.map(([r]) => r).join('; ');
}

/**
 * Execute consensus voting for a single sample
 */
export function executeConsensusVoting(
  sample: ClassificationResult,
  votes: JudgeVote[],
  config: ConsensusConfig = DEFAULT_CONSENSUS_CONFIG,
): ConsensusResult {
  if (votes.length < config.minJudges) {
    throw new Error(`Insufficient judges: ${votes.length} < ${config.minJudges}`);
  }

  // Calculate agreement rate
  const agreementRate = calculateAgreementRate(votes);
  const isDisagreement = agreementRate < config.agreementThreshold;

  // Perform voting based on strategy
  let votingResult: { correct: boolean; confidence: number };

  switch (config.strategy) {
    case 'majority':
      votingResult = majorityVote(votes);
      break;
    case 'weighted':
      votingResult = weightedVote(votes, config.judgeReliabilities ?? new Map());
      break;
    case 'unanimous':
      votingResult = unanimousVote(votes);
      break;
    default:
      votingResult = majorityVote(votes);
  }

  // Calculate total cost
  const totalCost = votes.reduce((sum, v) => sum + v.cost, 0);

  // Generate consensus reasoning
  const consensusReasoning = generateConsensusReasoning(votes);

  return {
    sample,
    votes,
    consensusCorrect: votingResult.correct,
    consensusConfidence: votingResult.confidence,
    agreementRate,
    isDisagreement,
    finalReasoning: consensusReasoning,
    totalCost,
  };
}

/**
 * Execute consensus voting for multiple samples
 */
export function executeBatchConsensusVoting(
  samplesWithVotes: Array<{
    sample: ClassificationResult;
    votes: JudgeVote[];
  }>,
  config: ConsensusConfig = DEFAULT_CONSENSUS_CONFIG,
): ConsensusResult[] {
  return samplesWithVotes.map(({ sample, votes }) => executeConsensusVoting(sample, votes, config));
}

/**
 * Analyze disagreement patterns across multiple consensus results
 */
export function analyzeDisagreements(consensusResults: ConsensusResult[]): {
  totalSamples: number;
  disagreementCount: number;
  disagreementRate: number;
  avgAgreementRate: number;
  mostDisputedSamples: Array<{
    sample: ClassificationResult;
    agreementRate: number;
    votes: JudgeVote[];
  }>;
} {
  const disagreementCount = consensusResults.filter((r) => r.isDisagreement).length;
  const avgAgreementRate =
    consensusResults.reduce((sum, r) => sum + r.agreementRate, 0) / consensusResults.length;

  // Find most disputed samples (lowest agreement rate)
  const mostDisputed = [...consensusResults]
    .sort((a, b) => a.agreementRate - b.agreementRate)
    .slice(0, 10)
    .map((r) => ({
      sample: r.sample,
      agreementRate: r.agreementRate,
      votes: r.votes,
    }));

  return {
    totalSamples: consensusResults.length,
    disagreementCount,
    disagreementRate: disagreementCount / consensusResults.length,
    avgAgreementRate,
    mostDisputedSamples: mostDisputed,
  };
}

/**
 * Optimize judge count for cost vs accuracy tradeoff
 */
export function optimizeJudgeCount(
  historicalResults: ConsensusResult[],
  targetAgreementRate = 0.8,
  maxJudges = 10,
): { optimalJudges: number; estimatedAccuracy: number; estimatedCost: number } {
  // Analyze how agreement rate changes with judge count
  const agreementByCount = new Map<number, number[]>();

  for (const result of historicalResults) {
    const count = result.votes.length;
    if (!agreementByCount.has(count)) {
      agreementByCount.set(count, []);
    }
    agreementByCount.get(count)?.push(result.agreementRate);
  }

  // Find minimum judges that achieve target agreement rate
  let optimalJudges = maxJudges;
  let estimatedAccuracy = 0;

  for (const [count, rates] of agreementByCount.entries()) {
    const avgRate = rates.reduce((a, b) => a + b, 0) / rates.length;
    if (avgRate >= targetAgreementRate && count < optimalJudges) {
      optimalJudges = count;
      estimatedAccuracy = avgRate;
    }
  }

  // Estimate cost based on average cost per judge
  const avgCostPerJudge =
    historicalResults.reduce((sum, r) => sum + r.totalCost / r.votes.length, 0) /
    historicalResults.length;

  const estimatedCost = optimalJudges * avgCostPerJudge;

  return {
    optimalJudges,
    estimatedAccuracy,
    estimatedCost,
  };
}
