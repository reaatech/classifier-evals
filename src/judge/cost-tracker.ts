/**
 * Cost tracking for LLM-as-judge operations
 */

/**
 * Pricing configuration for a model (per 1M tokens)
 */
export interface ModelPricing {
  inputPricePerM: number;
  outputPricePerM: number;
}

/**
 * Known model pricing (USD per 1M tokens)
 */
export const MODEL_PRICING: Record<string, ModelPricing> = {
  'gpt-4': { inputPricePerM: 30, outputPricePerM: 60 },
  'gpt-4-turbo': { inputPricePerM: 10, outputPricePerM: 30 },
  'gpt-4o': { inputPricePerM: 5, outputPricePerM: 15 },
  'gpt-3.5-turbo': { inputPricePerM: 0.5, outputPricePerM: 1.5 },
  'claude-opus': { inputPricePerM: 15, outputPricePerM: 75 },
  'claude-sonnet': { inputPricePerM: 3, outputPricePerM: 15 },
  'claude-haiku': { inputPricePerM: 0.25, outputPricePerM: 1.25 },
  'gemini-pro': { inputPricePerM: 0.5, outputPricePerM: 1.5 },
};

/**
 * Cost breakdown by category
 */
export interface CostBreakdown {
  totalCost: number;
  inputTokens: number;
  outputTokens: number;
  samplesProcessed: number;
  avgCostPerSample: number;
  byCategory: Record<string, { cost: number; samples: number }>;
}

/**
 * Budget configuration
 */
export interface BudgetConfig {
  /** Maximum total budget in USD */
  maxBudget: number;
  /** Alert when budget reaches this percentage */
  alertThreshold: number;
  /** Maximum cost per sample */
  maxCostPerSample?: number;
}

/**
 * Cost tracker for LLM judge operations
 */
export class CostTracker {
  private totalInputTokens = 0;
  private totalOutputTokens = 0;
  private totalCost = 0;
  private samplesProcessed = 0;
  private categoryCosts: Record<string, { cost: number; samples: number }> = {};
  private budgetConfig?: BudgetConfig;
  private budgetExceeded = false;
  private alertTriggered = false;

  constructor(budgetConfig?: BudgetConfig) {
    this.budgetConfig = budgetConfig;
  }

  /**
   * Add cost for a single API call
   */
  addCost(model: string, inputTokens: number, outputTokens: number, category?: string): void {
    const pricing = MODEL_PRICING[model] ?? { inputPricePerM: 1, outputPricePerM: 2 };

    const inputCost = (inputTokens / 1_000_000) * pricing.inputPricePerM;
    const outputCost = (outputTokens / 1_000_000) * pricing.outputPricePerM;
    const totalCallCost = inputCost + outputCost;

    this.totalInputTokens += inputTokens;
    this.totalOutputTokens += outputTokens;
    this.totalCost += totalCallCost;
    this.samplesProcessed++;

    if (
      this.budgetConfig?.maxCostPerSample !== undefined &&
      totalCallCost > this.budgetConfig.maxCostPerSample
    ) {
      this.budgetExceeded = true;
    }

    const cat = category ?? 'default';
    if (!this.categoryCosts[cat]) {
      this.categoryCosts[cat] = { cost: 0, samples: 0 };
    }
    this.categoryCosts[cat].cost += totalCallCost;
    this.categoryCosts[cat].samples++;

    this.checkBudget();
  }

  /**
   * Estimate cost before running
   */
  estimateCost(
    model: string,
    estimatedInputTokens: number,
    estimatedOutputTokens: number,
    numSamples: number,
  ): number {
    const pricing = MODEL_PRICING[model] ?? { inputPricePerM: 1, outputPricePerM: 2 };
    const perSampleCost =
      (estimatedInputTokens / 1_000_000) * pricing.inputPricePerM +
      (estimatedOutputTokens / 1_000_000) * pricing.outputPricePerM;
    return perSampleCost * numSamples;
  }

  /**
   * Check whether an estimated request can fit within the remaining budget.
   */
  canAfford(model: string, estimatedInputTokens: number, estimatedOutputTokens: number): boolean {
    if (!this.budgetConfig) {
      return true;
    }

    const estimatedCost = this.estimateCost(model, estimatedInputTokens, estimatedOutputTokens, 1);

    if (
      this.budgetConfig.maxCostPerSample !== undefined &&
      estimatedCost > this.budgetConfig.maxCostPerSample
    ) {
      return false;
    }

    return this.totalCost + estimatedCost <= this.budgetConfig.maxBudget;
  }

  /**
   * Mark the budget as exceeded when a pre-flight estimate determines
   * the next request would exceed configured limits.
   */
  markBudgetExceeded(): void {
    this.budgetExceeded = true;
  }

  /**
   * Check if budget is exceeded
   */
  private checkBudget(): void {
    if (!this.budgetConfig) {
      return;
    }

    const { maxBudget, alertThreshold } = this.budgetConfig;
    const budgetRatio = this.totalCost / maxBudget;

    if (budgetRatio >= 1 && !this.budgetExceeded) {
      this.budgetExceeded = true;
    }

    if (budgetRatio >= alertThreshold / 100 && !this.alertTriggered) {
      this.alertTriggered = true;
    }
  }

  /**
   * Check if budget has been exceeded
   */
  isBudgetExceeded(): boolean {
    return this.budgetExceeded;
  }

  /**
   * Check if budget alert threshold has been reached
   */
  isAlertTriggered(): boolean {
    return this.alertTriggered;
  }

  /**
   * Get current cost breakdown
   */
  getBreakdown(): CostBreakdown {
    return {
      totalCost: this.totalCost,
      inputTokens: this.totalInputTokens,
      outputTokens: this.totalOutputTokens,
      samplesProcessed: this.samplesProcessed,
      avgCostPerSample: this.samplesProcessed > 0 ? this.totalCost / this.samplesProcessed : 0,
      byCategory: { ...this.categoryCosts },
    };
  }

  /**
   * Reset tracker
   */
  reset(): void {
    this.totalInputTokens = 0;
    this.totalOutputTokens = 0;
    this.totalCost = 0;
    this.samplesProcessed = 0;
    this.categoryCosts = {};
    this.budgetExceeded = false;
    this.alertTriggered = false;
  }
}

/**
 * Create a new cost tracker
 */
export function createCostTracker(budgetConfig?: BudgetConfig): CostTracker {
  return new CostTracker(budgetConfig);
}
