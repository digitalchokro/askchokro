#!/usr/bin/env node

/**
 * @digitalchokro/cli — AskChokro Command Line Interface
 *
 * Commands:
 *   npx askchokro demo   — Spin up an instant local demo with SQLite + Ollama
 */

import { fileURLToPath } from 'node:url';

export const HELP_TEXT = `
AskChokro CLI — The AI Data Engine for Node.js

Usage:
  npx askchokro <command>

Commands:
  demo      Spin up an instant local demo (SQLite + Ollama, no setup required)
  --help    Show this help message
  --version Show version

Examples:
  npx askchokro demo
  npx askchokro --help

Documentation: https://github.com/digitalchokro/askchokro
`;

export function main(args: string[] = process.argv.slice(2)): void {
  const command = args[0];

  if (!command || command === '--help' || command === '-h') {
    console.log(HELP_TEXT);
    process.exit(0);
    return;
  }

  if (command === '--version' || command === '-v') {
    console.log('0.0.0');
    process.exit(0);
    return;
  }

  if (command === 'demo') {
    void import('./demo.js').then(({ runDemo }) => runDemo());
    return;
  }

  console.error(`Unknown command: ${command}`);
  console.log(HELP_TEXT);
  process.exit(1);
  return;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main();
}
