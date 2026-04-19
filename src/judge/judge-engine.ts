/**
 * LLM Judge Engine - orchestrates LLM-based evaluation
 */

import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { ClassificationResult, JudgedResult } from '../types/index.js';
import { getPromptTemplate, formatPrompt, PromptTemplateType } from './prompt-templates.js';
import { CostTracker, createCostTracker, BudgetConfig } from './cost-tracker.js';

/**
 * Result from LLM judge evaluation
 */
export interface LLMJudgeResult {
  correct: boolean;
  confidence: number;
  reasoning?: string;
}

/**
 * Configuration for the judge engine
 */
export interface JudgeEngineConfig {
  /** LLM model to use */
  model: string;
  /** Prompt template type */
  templateType?: PromptTemplateType;
  /** Maximum concurrent requests */
  maxConcurrency?: number;
  /** Retry count for failed requests */
  retryCount?: number;
  /** Timeout per request in ms */
  timeoutMs?: number;
  /** Budget configuration */
  budget?: BudgetConfig;
  /** Custom judge function (for testing or custom implementations) */
  customJudge?: (prompt: { system: string; user: string }) => Promise<JudgedResult>;
}

/**
 * Result of a judge evaluation for a single sample
 */
export interface SampleJudgeResult {
  sample: ClassificationResult;
  result: JudgedResult;
  tokensUsed: { input: number; output: number };
}

/**
 * Aggregate results from judging multiple samples
 */
export interface JudgeAggregateResult {
  results: SampleJudgeResult[];
  totalCost: number;
  totalTokens: { input: number; output: number };
  samplesProcessed: number;
  agreementRate: number;
  budgetExceeded: boolean;
  failedCount?: number;
}

/**
 * LLM Judge Engine
 */
export class JudgeEngine {
  private config: JudgeEngineConfig;
  private costTracker: CostTracker;
  private templateType: PromptTemplateType;
  private openaiClient?: OpenAI;
  private anthropicClient?: Anthropic;

  constructor(config: JudgeEngineConfig) {
    this.config = {
      maxConcurrency: config.maxConcurrency ?? 5,
      retryCount: config.retryCount ?? 3,
      timeoutMs: config.timeoutMs ?? 30000,
      ...config,
    };
    this.costTracker = createCostTracker(config.budget);
    this.templateType = config.templateType ?? 'classification-eval';

    const openAIKey = process.env.OPENAI_API_KEY;
    if (openAIKey !== undefined && openAIKey !== '') {
      this.openaiClient = new OpenAI({ apiKey: openAIKey });
    }

    const anthropicKey = process.env.ANTHROPIC_API_KEY;
    if (anthropicKey !== undefined && anthropicKey !== '') {
      this.anthropicClient = new Anthropic({ apiKey: anthropicKey });
    }
  }

  private createPrompt(sample: ClassificationResult): {
    system: string;
    user: string;
  } {
    const template = getPromptTemplate(this.templateType);
    return formatPrompt(template, sample);
  }

  private estimateTokensForPrompt(prompt: {
    system: string;
    user: string;
  }): { input: number; output: number } {
    const estimatedInput = Math.max(
      Math.ceil((prompt.system.length + prompt.user.length) / 4),
      1
    );

    return {
      input: estimatedInput,
      output: 256,
    };
  }

  /**
   * Check whether a sample can be evaluated without exceeding the configured budget.
   */
  canEvaluateSample(sample: ClassificationResult): boolean {
    const prompt = this.createPrompt(sample);
    const estimate = this.estimateTokensForPrompt(prompt);
    const allowed = this.costTracker.canAfford(
      this.config.model,
      estimate.input,
      estimate.output
    );

    if (!allowed) {
      this.costTracker.markBudgetExceeded();
    }

    return allowed;
  }

  /**
   * Evaluate a single sample
   */
  async evaluateSample(sample: ClassificationResult): Promise<SampleJudgeResult> {
    const prompt = this.createPrompt(sample);

    if (!this.canEvaluateSample(sample)) {
      throw new Error('Budget exceeded before sample evaluation');
    }

    let result: JudgedResult;
    let tokensUsed = { input: 0, output: 0 };

    if (this.config.customJudge) {
      result = await this.config.customJudge(prompt);
      tokensUsed = { input: prompt.system.length + prompt.user.length, output: 100 };
    } else {
      const response = await this.callLLM(prompt, sample);
      result = response.result;
      tokensUsed = response.tokensUsed;
    }

    // Track cost
    this.costTracker.addCost(
      this.config.model,
      tokensUsed.input,
      tokensUsed.output,
      (result.judge_correct ?? false) ? 'correct' : 'incorrect'
    );

    return {
      sample,
      result,
      tokensUsed,
    };
  }

  /**
   * Evaluate multiple samples in batches
   */
  async evaluateBatch(samples: ClassificationResult[]): Promise<JudgeAggregateResult> {
    const results: SampleJudgeResult[] = [];
    let failedCount = 0;
    const maxConcurrency = this.config.maxConcurrency ?? 1;
    let nextIndex = 0;

    await new Promise<void>((resolve) => {
      let active = 0;

      const maybeResolve = (): void => {
        if (
          active === 0 &&
          (nextIndex >= samples.length || this.costTracker.isBudgetExceeded())
        ) {
          resolve();
        }
      };

      const launchNext = (): void => {
        while (
          active < maxConcurrency &&
          nextIndex < samples.length &&
          !this.costTracker.isBudgetExceeded()
        ) {
          const sample = samples[nextIndex]!;

          if (!this.canEvaluateSample(sample)) {
            break;
          }

          nextIndex++;
          active++;

          this.evaluateSample(sample)
            .then((value) => {
              results.push(value);
            })
            .catch((reason: unknown) => {
              const message =
                reason instanceof Error ? reason.message : String(reason);
              if (message === 'Budget exceeded before sample evaluation') {
                return;
              }
              failedCount++;
              console.error('Judge evaluation failed:', reason);
            })
            .finally(() => {
              active--;
              launchNext();
              maybeResolve();
            });
        }

        maybeResolve();
      };

      launchNext();
    });

    const costBreakdown = this.costTracker.getBreakdown();
    const correctCount = results.filter(r => r.result.judge_correct ?? false).length;

    return {
      results,
      totalCost: costBreakdown.totalCost,
      totalTokens: {
        input: costBreakdown.inputTokens,
        output: costBreakdown.outputTokens,
      },
      samplesProcessed: results.length,
      agreementRate: results.length > 0 ? correctCount / results.length : 0,
      budgetExceeded: this.costTracker.isBudgetExceeded(),
      failedCount: failedCount > 0 ? failedCount : undefined,
    };
  }

  /**
   * Call the configured LLM provider, falling back to heuristic evaluation
   * when API credentials are unavailable.
   */
  private async callLLM(
    prompt: { system: string; user: string },
    sample: ClassificationResult
  ): Promise<{ result: JudgedResult; tokensUsed: { input: number; output: number } }> {
    const model = this.config.model.toLowerCase();
    const retryCount = this.config.retryCount ?? 3;
    const timeoutMs = this.config.timeoutMs ?? 30000;

    for (let attempt = 0; attempt <= retryCount; attempt++) {
      try {
        if (model.startsWith('gpt') && this.openaiClient) {
          return await this.callOpenAIWithTimeout(prompt, sample, timeoutMs);
        }

        if (model.startsWith('claude') && this.anthropicClient) {
          return await this.callAnthropicWithTimeout(prompt, sample, timeoutMs);
        }
      } catch (err: unknown) {
        const status = (err as { status?: number })?.status;
        if (typeof status === 'number' && status >= 400 && status < 500 && status !== 429) {
          break;
        }
        if (attempt === retryCount) {
          break;
        }
        const jitter = Math.random() * 500;
        const delay = Math.min(1000 * Math.pow(2, attempt) + jitter, 10000);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    console.error(`WARNING: All LLM retries failed, falling back to heuristic judge for sample`);
    return this.heuristicJudge(prompt, sample);
  }

  private async callOpenAIWithTimeout(
    prompt: { system: string; user: string },
    sample: ClassificationResult,
    timeoutMs: number
  ): Promise<{ result: JudgedResult; tokensUsed: { input: number; output: number } }> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const client = this.openaiClient!;
      const response = await client.chat.completions.create(
        {
          model: this.config.model,
          temperature: 0,
          messages: [
            { role: 'system', content: prompt.system },
            { role: 'user', content: `${prompt.user}\n\nReturn JSON only.` },
          ],
          response_format: { type: 'json_object' },
        },
        { signal: controller.signal as AbortSignal }
      );

      clearTimeout(timeout);
      const content = response.choices[0]?.message?.content ?? '{}';
      const parsed = JSON.parse(content) as {
        correct?: boolean;
        confidence?: number;
        reasoning?: string;
      };

      return {
        result: {
          text: sample.text,
          label: sample.label,
          predicted_label: sample.predicted_label,
          confidence: sample.confidence ?? 1,
          judge_correct: parsed.correct ?? sample.label === sample.predicted_label,
          judge_confidence: parsed.confidence ?? 0.5,
          judge_reasoning: parsed.reasoning ?? 'No reasoning provided',
          judge_model: this.config.model,
        },
        tokensUsed: {
          input: response.usage?.prompt_tokens ?? 0,
          output: response.usage?.completion_tokens ?? 0,
        },
      };
    } catch (error) {
      clearTimeout(timeout);
      throw error;
    }
  }

  private async callAnthropicWithTimeout(
    prompt: { system: string; user: string },
    sample: ClassificationResult,
    timeoutMs: number
  ): Promise<{ result: JudgedResult; tokensUsed: { input: number; output: number } }> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const client = this.anthropicClient!;
      const response = await client.messages.create(
        {
          model: this.config.model,
          max_tokens: 512,
          system: prompt.system,
          messages: [
            {
              role: 'user',
              content: `${prompt.user}\n\nReturn JSON only.`,
            },
          ],
        },
        { signal: controller.signal as AbortSignal }
      );

      clearTimeout(timeout);
      const textContent = response.content
        .filter((block) => block.type === 'text')
        .map((block) => block.text)
        .join('\n');
      const parsed = JSON.parse(textContent !== '' ? textContent : '{}') as {
        correct?: boolean;
        confidence?: number;
        reasoning?: string;
      };

      return {
        result: {
          text: sample.text,
          label: sample.label,
          predicted_label: sample.predicted_label,
          confidence: sample.confidence ?? 1,
          judge_correct: parsed.correct ?? sample.label === sample.predicted_label,
          judge_confidence: parsed.confidence ?? 0.5,
          judge_reasoning: parsed.reasoning ?? 'No reasoning provided',
          judge_model: this.config.model,
        },
        tokensUsed: {
          input: response.usage.input_tokens,
          output: response.usage.output_tokens,
        },
      };
    } catch (error) {
      clearTimeout(timeout);
      throw error;
    }
  }

  private heuristicJudge(
    prompt: { system: string; user: string },
    sample: ClassificationResult
  ): { result: JudgedResult; tokensUsed: { input: number; output: number } } {
    const isCorrect = sample.label === sample.predicted_label;

    return {
      result: {
        text: sample.text,
        label: sample.label,
        predicted_label: sample.predicted_label,
        confidence: sample.confidence ?? 1.0,
        judge_correct: isCorrect,
        judge_confidence: isCorrect ? 0.95 : 0.8,
        judge_reasoning: isCorrect
          ? 'Prediction matches ground truth label.'
          : `Predicted "${sample.predicted_label}" but ground truth is "${sample.label}".`,
        judge_model: `${this.config.model}-heuristic`,
        judge_method: 'heuristic',
      },
      tokensUsed: {
        input: prompt.system.length + prompt.user.length,
        output: 64,
      },
    };
  }

  /**
   * Get cost breakdown
   */
  getCostBreakdown(): ReturnType<CostTracker['getBreakdown']> {
    return this.costTracker.getBreakdown();
  }

  /**
   * Check if budget has been exceeded
   */
  isBudgetExceeded(): boolean {
    return this.costTracker.isBudgetExceeded();
  }
}

/**
 * Create a new judge engine
 */
export function createJudgeEngine(config: JudgeEngineConfig): JudgeEngine {
  return new JudgeEngine(config);
}
