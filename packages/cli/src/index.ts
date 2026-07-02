#!/usr/bin/env node

/**
 * @digitalchokro/cli — AskChokro Command Line Interface
 *
 * Commands:
 *   npx askchokro demo   — Spin up an instant local demo with SQLite + Ollama
 *
 * v0 stub — full implementation in Milestone 4.
 */

const HELP_TEXT = `
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

function main(): void {
  const args = process.argv.slice(2);
  const command = args[0];

  if (!command || command === '--help' || command === '-h') {
    console.log(HELP_TEXT);
    process.exit(0);
  }

  if (command === '--version' || command === '-v') {
    console.log('0.0.0');
    process.exit(0);
  }

  if (command === 'demo') {
    void import('./demo.js').then(({ runDemo }) => runDemo());
    return;
  }

  console.error(`Unknown command: ${command}`);
  console.log(HELP_TEXT);
  process.exit(1);
}

main();
