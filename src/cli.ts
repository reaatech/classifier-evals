#!/usr/bin/env node
/**
 * CLI entry point for classifier-evals
 */

import { Command } from 'commander';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const pkg = require('../../package.json');
import { evalCommand } from './cli/commands/eval.command.js';
import { compareCommand } from './cli/commands/compare.command.js';
import { gatesCommand } from './cli/commands/gates.command.js';
import { judgeCommand } from './cli/commands/judge.command.js';
import { exportCommand } from './cli/commands/export.command.js';

process.on('unhandledRejection', (reason) => {
  console.error('Fatal error:', reason instanceof Error ? reason.message : reason);
  process.exit(1);
});

process.on('uncaughtException', (err) => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});

const program = new Command();

program
  .name('classifier-evals')
  .description(pkg.description)
  .version(pkg.version);

// Register commands
evalCommand(program);
compareCommand(program);
gatesCommand(program);
judgeCommand(program);
exportCommand(program);

program.parse();
