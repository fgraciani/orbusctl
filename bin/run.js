#!/usr/bin/env -S node --disable-warning=MODULE_NOT_FOUND

async function main() {
  if (process.argv.length === 2) {
    // No subcommand given — run interactive mode
    const Index = require('../dist/commands/index').default
    await Index.run([])
  } else {
    // Subcommand given — let oclif route it
    const {execute} = require('@oclif/core')
    await execute({dir: __dirname})
  }
}

main().catch(console.error)
