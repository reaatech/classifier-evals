/**
 * Prompt templates for LLM-as-judge
 */

import {
  type ClassificationResult,
  redactPII,
  sanitizeForPrompt,
} from '@reaatech/classifier-evals';

function safeText(text: string): string {
  return sanitizeForPrompt(redactPII(text));
}

/**
 * Available prompt template types
 */
export type PromptTemplateType =
  | 'classification-eval'
  | 'ambiguity-detection'
  | 'error-categorization'
  | 'multi-turn-eval'
  | (string & {});

/**
 * Prompt template definition
 */
export interface PromptTemplate {
  type: PromptTemplateType;
  systemPrompt: string;
  userPrompt: (sample: ClassificationResult) => string;
}

/**
 * Classification evaluation prompt
 * Evaluates whether a prediction matches the ground truth
 */
const classificationEvalTemplate: PromptTemplate = {
  type: 'classification-eval',
  systemPrompt: `You are an expert evaluator for intent classification systems.
Your task is to determine if the model's prediction matches the ground truth label.
Consider semantic equivalence - the prediction may use different wording but still be correct.

Respond with a JSON object containing:
- "correct": boolean - whether the prediction is correct
- "confidence": number (0-1) - your confidence in this assessment
- "reasoning": string - brief explanation`,

  userPrompt: (sample: ClassificationResult) => `Evaluate this classification:

Text: "${safeText(sample.text)}"
Ground Truth Label: ${sample.label}
Predicted Label: ${sample.predicted_label}
Model Confidence: ${sample.confidence ?? 'N/A'}

Is this prediction correct?`,
};

/**
 * Ambiguity detection prompt
 * Determines if a sample is ambiguous and could reasonably be labeled differently
 */
const ambiguityDetectionTemplate: PromptTemplate = {
  type: 'ambiguity-detection',
  systemPrompt: `You are an expert at detecting ambiguity in intent classification.
Your task is to determine if a given text could reasonably be labeled with multiple intents.

Respond with a JSON object containing:
- "ambiguous": boolean - whether the sample is ambiguous
- "confidence": number (0-1) - your confidence in this assessment
- "alternative_labels": string[] - other labels that could apply
- "reasoning": string - brief explanation
- "correct": boolean - whether the prediction matches the ground truth`,

  userPrompt: (sample: ClassificationResult) => `Analyze this classification for ambiguity:

Text: "${safeText(sample.text)}"
Ground Truth Label: ${sample.label}
Predicted Label: ${sample.predicted_label}

Could this text reasonably be labeled with a different intent? What other labels might apply?`,
};

/**
 * Error categorization prompt
 * Categorizes the type of classification error
 */
const errorCategorizationTemplate: PromptTemplate = {
  type: 'error-categorization',
  systemPrompt: `You are an expert at categorizing classification errors.
Your task is to identify the type of error that occurred.

Error types:
- "false_positive": Model predicted a label that doesn't apply
- "false_negative": Model failed to predict the correct label
- "label_noise": The ground truth label may be incorrect
- "genuine_ambiguity": The text is genuinely ambiguous
- "semantic_overlap": The labels have overlapping meanings
- "correct": The prediction is correct

Respond with a JSON object containing:
- "error_type": string - the error category
- "correct": boolean - whether the prediction matches the ground truth
- "confidence": number (0-1) - your confidence
- "reasoning": string - brief explanation`,

  userPrompt: (sample: ClassificationResult) => `Categorize this classification result:

Text: "${safeText(sample.text)}"
Ground Truth Label: ${sample.label}
Predicted Label: ${sample.predicted_label}
Model Confidence: ${sample.confidence ?? 'N/A'}

What type of error (if any) occurred here?`,
};

/**
 * Multi-turn evaluation prompt
 * Evaluates classification across a conversation context
 */
const multiTurnEvalTemplate: PromptTemplate = {
  type: 'multi-turn-eval',
  systemPrompt: `You are an expert at evaluating intent classification in multi-turn conversations.
Your task is to determine if the classification is correct given the full conversation context.

Consider:
- The full conversation history
- Whether the intent may have shifted during the conversation
- Whether the classification captures the user's current intent

Respond with a JSON object containing:
- "correct": boolean - whether the classification is appropriate
- "confidence": number (0-1) - your confidence
- "context_matters": boolean - whether the conversation context affected the evaluation
- "reasoning": string - brief explanation`,

  userPrompt: (sample: ClassificationResult & { conversation_context?: string }) => {
    let prompt = '';
    if (sample.conversation_context !== undefined && sample.conversation_context !== '') {
      prompt += `Conversation Context:
${sample.conversation_context}

`;
    }
    prompt += `Evaluate this classification:

Text: "${safeText(sample.text)}"
Ground Truth Label: ${sample.label}
Predicted Label: ${sample.predicted_label}

Is this classification appropriate given the context?`;
    return prompt;
  },
};

const templates: Record<string, PromptTemplate> = {
  'classification-eval': classificationEvalTemplate,
  'ambiguity-detection': ambiguityDetectionTemplate,
  'error-categorization': errorCategorizationTemplate,
  'multi-turn-eval': multiTurnEvalTemplate,
};

/**
 * Get a prompt template by type
 */
export function getPromptTemplate(type: PromptTemplateType): PromptTemplate {
  return templates[type] ?? classificationEvalTemplate;
}

/**
 * Register a custom prompt template
 */
export function registerCustomTemplate(name: string, template: PromptTemplate): void {
  templates[name] = template;
}

/**
 * Format a prompt for a sample using a template
 */
export function formatPrompt(
  template: PromptTemplate,
  sample: ClassificationResult,
): { system: string; user: string } {
  return {
    system: template.systemPrompt,
    user: template.userPrompt(sample),
  };
}
