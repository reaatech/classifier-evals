/**
 * PII redaction utilities for privacy-preserving logs and exports
 */

const PII_PATTERNS: { name: string; regex: RegExp; replacement: string }[] = [
  // Order matters: longer/more-specific patterns first to avoid partial matches
  {
    name: 'credit_card',
    regex: /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g,
    replacement: '[CARD_REDACTED]',
  },
  {
    name: 'email',
    regex: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
    replacement: '[EMAIL_REDACTED]',
  },
  {
    name: 'phone',
    regex: /(\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g,
    replacement: '[PHONE_REDACTED]',
  },
  { name: 'ssn', regex: /\b\d{3}-\d{2}-\d{4}\b/g, replacement: '[SSN_REDACTED]' },
  {
    name: 'ip_address',
    regex: /\b(?:(?:25[0-5]|2[0-4]\d|1\d{2}|[1-9]?\d)\.){3}(?:25[0-5]|2[0-4]\d|1\d{2}|[1-9]?\d)\b/g,
    replacement: '[IP_REDACTED]',
  },
];

/**
 * Redacts PII from text content
 */
export function redactPII(text: string): string {
  let result = text;
  for (const pattern of PII_PATTERNS) {
    result = result.replace(pattern.regex, pattern.replacement);
  }
  return result;
}

/**
 * Sanitize text for embedding in LLM prompts to prevent prompt injection.
 * Strips instruction-like patterns and normalizes whitespace.
 */
export function sanitizeForPrompt(text: string): string {
  return text
    .replace(
      /\b(ignore|disregard|forget|override)\s+(all\s+)?(previous|above|earlier)\s+(instructions?|directions?|prompts?)/gi,
      '[INSTRUCTION_REMOVED]',
    )
    .replace(/\b(return|respond|reply)\s+(with|only|just)\s*\{/gi, '[INSTRUCTION_REMOVED]')
    .replace(/\bsystem\s*:\s*/gi, '[PREFIX_REMOVED]')
    .replace(/\bassistant\s*:\s*/gi, '[PREFIX_REMOVED]')
    .replace(/\buser\s*:\s*/gi, '[PREFIX_REMOVED]');
}

/**
 * Redacts PII from an object by converting to string and back
 */
export function redactObjectPII<T extends Record<string, unknown>>(obj: T): T {
  try {
    const str = JSON.stringify(obj);
    const redacted = redactPII(str);
    return JSON.parse(redacted) as T;
  } catch {
    return obj;
  }
}
