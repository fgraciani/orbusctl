#!/usr/bin/env node

import { VERSION } from './version.js';
import { COMMAND_LIST } from './cli/commands.js';

const args = process.argv.slice(2);
const firstNonFlag = args.find(a => !a.startsWith('-'));

if (!firstNonFlag) {
  if (args.includes('--version') || args.includes('-V')) {
    process.stdout.write(`${VERSION}\n`);
    process.exit(0);
  }
  if (args.includes('--help') || args.includes('-h')) {
    const maxLen = Math.max(...COMMAND_LIST.map(c => c.name.length));
    const cmds = COMMAND_LIST.map(c => `  ${c.name.padEnd(maxLen + 2)}${c.description}`).join('\n');
    process.stdout.write([
      'Usage: orbusctl [command] [options]',
      '',
      'Run with no arguments to launch the interactive TUI.',
      '',
      'Commands:',
      cmds,
      '',
      'Options:',
      '  -V, --version  Show version',
      '  -h, --help     Show help',
      '',
      'Run orbusctl <command> --help for command-specific help.',
      '',
    ].join('\n'));
    process.exit(0);
  }
}

if (firstNonFlag) {
  const { run } = await import('./cli/index.js');
  await run();
} else {
  await import('./tui.js');
}
