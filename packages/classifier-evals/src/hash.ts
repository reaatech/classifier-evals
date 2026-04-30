/**
 * Hash utilities for anonymizing data
 * Used for PII protection and deterministic identifiers
 */

import { createHash } from 'node:crypto';

/**
 * Creates a SHA-256 hash of the input string
 * Used for anonymizing sensitive data in logs and exports
 */
export function hashString(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

/**
 * Creates a short hash (first 8 characters) for display purposes
 */
export function shortHash(input: string): string {
  return hashString(input).substring(0, 8);
}

/**
 * Hashes an array of strings and returns sorted unique hashes
 * Useful for creating deterministic identifiers from sets of labels
 */
export function hashSet(items: string[]): string[] {
  return [...new Set(items.map(hashString))].sort();
}
