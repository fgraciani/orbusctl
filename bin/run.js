#!/usr/bin/env -S node --disable-warning=MODULE_NOT_FOUND

const {setLogContext, logError} = require('../dist/log')
const {getLocalVersion} = require('../dist/update')

const isInteractive = process.argv.length === 2 || process.argv.includes('--colors')
const command = isInteractive ? 'index' : process.argv.slice(2).filter(a => !a.startsWith('-')).slice(0, 2).join(' ')

setLogContext({
  command,
  mode: isInteractive ? 'interactive' : 'command',
  tty: !!process.stdout.isTTY,
  version: getLocalVersion(),
})

async function main() {
  if (isInteractive) {
    // No subcommand given — run interactive mode
    const Index = require('../dist/commands/index').default
    await Index.run([])
  } else {
    // Subcommand given — let oclif route it
    const {execute} = require('@oclif/core')
    await execute({dir: __dirname})
  }
}

main().catch((err) => {
  logError({error: err?.message ?? String(err), stack: err?.stack, context: 'top-level'})
  console.error(err)
})
