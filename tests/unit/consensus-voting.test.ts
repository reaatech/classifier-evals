/**
 * Unit tests for consensus voting
 */

import { describe, it, expect } from 'vitest';
import {
  executeConsensusVoting,
  executeBatchConsensusVoting,
  analyzeDisagreements,
  optimizeJudgeCount,
  type JudgeVote,
  type ConsensusConfig,
} from '../../src/judge/consensus-voting.js';
import { ClassificationResult } from '../../src/types/index.js';

function createSample(text: string = 'test'): ClassificationResult {
  return {
    text,
    label: 'positive',
    predicted_label: 'positive',
    confidence: 0.9,
  };
}

function createVote(
  judgeId: string,
  isCorrect: boolean,
  confidence: number = 0.9,
  cost: number = 0.01,
  model: string = 'gpt-4',
): JudgeVote {
  return {
    judgeId,
    model,
    cost,
    result: {
      text: 'test',
      label: 'positive',
      predicted_label: 'positive',
      confidence: 0.9,
      judge_correct: isCorrect,
      judge_confidence: confidence,
      judge_reasoning: isCorrect ? 'Correct' : 'Incorrect',
    },
  };
}

describe('Consensus Voting', () => {
  describe('Majority voting', () => {
    it('should return correct when majority says correct', () => {
      const sample = createSample();
      const votes: JudgeVote[] = [
        createVote('j1', true),
        createVote('j2', true),
        createVote('j3', false),
      ];

      const config: ConsensusConfig = {
        minJudges: 3,
        strategy: 'majority',
        agreementThreshold: 0.67,
        useWeightedVoting: false,
      };

      const result = executeConsensusVoting(sample, votes, config);
      expect(result.consensusCorrect).toBe(true);
      expect(result.agreementRate).toBeLessThan(1);
    });

    it('should return incorrect when majority says incorrect', () => {
      const sample = createSample();
      const votes: JudgeVote[] = [
        createVote('j1', false),
        createVote('j2', false),
        createVote('j3', true),
      ];

      const config: ConsensusConfig = {
        minJudges: 3,
        strategy: 'majority',
        agreementThreshold: 0.67,
        useWeightedVoting: false,
      };

      const result = executeConsensusVoting(sample, votes, config);
      expect(result.consensusCorrect).toBe(false);
    });

    it('should detect disagreement when agreement is below threshold', () => {
      const sample = createSample();
      const votes: JudgeVote[] = [
        createVote('j1', true),
        createVote('j2', false),
        createVote('j3', false),
      ];

      const config: ConsensusConfig = {
        minJudges: 3,
        strategy: 'majority',
        agreementThreshold: 0.67,
        useWeightedVoting: false,
      };

      const result = executeConsensusVoting(sample, votes, config);
      expect(result.isDisagreement).toBe(true);
    });
  });

  describe('Unanimous voting', () => {
    it('should return correct only when all judges agree on correct', () => {
      const sample = createSample();
      const votes: JudgeVote[] = [
        createVote('j1', true),
        createVote('j2', true),
        createVote('j3', true),
      ];

      const config: ConsensusConfig = {
        minJudges: 3,
        strategy: 'unanimous',
        agreementThreshold: 0.67,
        useWeightedVoting: false,
      };

      const result = executeConsensusVoting(sample, votes, config);
      expect(result.consensusCorrect).toBe(true);
      expect(result.consensusConfidence).toBe(1);
    });

    it('should return incorrect when any judge disagrees', () => {
      const sample = createSample();
      const votes: JudgeVote[] = [
        createVote('j1', true),
        createVote('j2', false),
        createVote('j3', true),
      ];

      const config: ConsensusConfig = {
        minJudges: 3,
        strategy: 'unanimous',
        agreementThreshold: 0.67,
        useWeightedVoting: false,
      };

      const result = executeConsensusVoting(sample, votes, config);
      expect(result.consensusCorrect).toBe(false);
    });
  });

  describe('Weighted voting', () => {
    it('should weight votes by judge reliability', () => {
      const sample = createSample();
      const votes: JudgeVote[] = [
        createVote('j1', false, 0.9), // Low reliability judge says incorrect
        createVote('j2', true, 0.9), // High reliability judge says correct
        createVote('j3', false, 0.9), // Low reliability judge says incorrect
      ];

      const config: ConsensusConfig = {
        minJudges: 3,
        strategy: 'weighted',
        agreementThreshold: 0.67,
        useWeightedVoting: true,
        judgeReliabilities: new Map([
          ['j1', 0.5], // Low reliability
          ['j2', 1.0], // High reliability
          ['j3', 0.5], // Low reliability
        ]),
      };

      const result = executeConsensusVoting(sample, votes, config);
      // High reliability judge should outweigh the two low reliability judges
      expect(result.consensusCorrect).toBe(true);
    });
  });

  describe('Edge cases', () => {
    it('should throw when insufficient judges', () => {
      const sample = createSample();
      const votes: JudgeVote[] = [createVote('j1', true)];

      const config: ConsensusConfig = {
        minJudges: 3,
        strategy: 'majority',
        agreementThreshold: 0.67,
        useWeightedVoting: false,
      };

      expect(() => executeConsensusVoting(sample, votes, config)).toThrow('Insufficient judges');
    });

    it('should calculate total cost correctly', () => {
      const sample = createSample();
      const votes: JudgeVote[] = [
        createVote('j1', true, 0.9, 0.02),
        createVote('j2', true, 0.9, 0.03),
        createVote('j3', true, 0.9, 0.05),
      ];

      const config: ConsensusConfig = {
        minJudges: 3,
        strategy: 'majority',
        agreementThreshold: 0.67,
        useWeightedVoting: false,
      };

      const result = executeConsensusVoting(sample, votes, config);
      expect(result.totalCost).toBe(0.1);
    });
  });
});

describe('Batch Consensus Voting', () => {
  it('should process multiple samples', () => {
    const samples = [
      {
        sample: createSample('text1'),
        votes: [createVote('j1', true), createVote('j2', true), createVote('j3', true)],
      },
      {
        sample: createSample('text2'),
        votes: [createVote('j1', false), createVote('j2', false), createVote('j3', false)],
      },
    ];

    const config: ConsensusConfig = {
      minJudges: 3,
      strategy: 'majority',
      agreementThreshold: 0.67,
      useWeightedVoting: false,
    };

    const results = executeBatchConsensusVoting(samples, config);
    expect(results).toHaveLength(2);
    expect(results[0]?.consensusCorrect).toBe(true);
    expect(results[1]?.consensusCorrect).toBe(false);
  });
});

describe('Disagreement Analysis', () => {
  it('should calculate disagreement rate', () => {
    const sample = createSample();
    const votes1 = [createVote('j1', true), createVote('j2', true), createVote('j3', true)];
    const votes2 = [createVote('j1', true), createVote('j2', false), createVote('j3', false)];

    const config: ConsensusConfig = {
      minJudges: 3,
      strategy: 'majority',
      agreementThreshold: 0.67,
      useWeightedVoting: false,
    };

    const results = [
      executeConsensusVoting(sample, votes1, config),
      executeConsensusVoting(sample, votes2, config),
    ];

    const analysis = analyzeDisagreements(results);
    expect(analysis.disagreementCount).toBe(1);
    expect(analysis.disagreementRate).toBe(0.5);
  });

  it('should identify most disputed samples', () => {
    const sample = createSample();
    const votes = [createVote('j1', true), createVote('j2', false), createVote('j3', false)];

    const config: ConsensusConfig = {
      minJudges: 3,
      strategy: 'majority',
      agreementThreshold: 0.67,
      useWeightedVoting: false,
    };

    const result = executeConsensusVoting(sample, votes, config);
    const analysis = analyzeDisagreements([result]);

    expect(analysis.mostDisputedSamples).toHaveLength(1);
    expect(analysis.mostDisputedSamples[0]?.sample).toBe(sample);
  });
});

describe('Judge Count Optimization', () => {
  it('should find optimal judge count', () => {
    const sample = createSample();

    // Create historical results with varying judge counts
    const historicalResults = [
      {
        sample,
        votes: [createVote('j1', true), createVote('j2', true), createVote('j3', true)],
        consensusCorrect: true,
        consensusConfidence: 1,
        agreementRate: 1,
        isDisagreement: false,
        totalCost: 0.03,
      },
      {
        sample,
        votes: [
          createVote('j1', true),
          createVote('j2', true),
          createVote('j3', true),
          createVote('j4', true),
          createVote('j5', true),
        ],
        consensusCorrect: true,
        consensusConfidence: 1,
        agreementRate: 1,
        isDisagreement: false,
        totalCost: 0.05,
      },
    ];

    const optimization = optimizeJudgeCount(historicalResults, 0.8, 5);
    expect(optimization.optimalJudges).toBeLessThanOrEqual(5);
    expect(optimization.estimatedCost).toBeGreaterThan(0);
  });
});
