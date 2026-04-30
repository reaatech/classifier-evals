import { readFileSync } from 'node:fs';
import type { EvalRun } from './domain.js';

export function loadEvalRunFromFile(filePath: string): EvalRun {
  try {
    return JSON.parse(readFileSync(filePath, 'utf8')) as EvalRun;
  } catch (err) {
    throw new Error(`Failed to load eval run from file: ${filePath}: ${(err as Error).message}`, {
      cause: err,
    });
  }
}
