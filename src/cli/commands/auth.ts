import type { Command } from 'commander';
import { fetchMe } from '../../core/api/me.js';
import { saveAuth } from '../../core/config.js';
import { formatOutput } from '../output.js';
import { handleError } from '../errors.js';

export function registerAuthCommand(program: Command): void {
  program
    .command('auth')
    .description('Save authentication token')
    .requiredOption('--token <token>', 'Bearer token')
    .option('--json', 'Output as JSON')
    .action(async (opts: { token: string; json?: boolean }) => {
      const json = opts.json ?? false;
      try {
        const me = await fetchMe(opts.token);
        saveAuth(opts.token, {
          name: me.Name,
          accountName: me.AccountName,
          emailAddress: me.EmailAddress,
        });
        const data = { status: 'ok', user: me.Name, account: me.AccountName, email: me.EmailAddress };
        formatOutput(data, json, (d) => {
          process.stdout.write(`Authenticated as ${d.user} (${d.account})\n`);
        });
      } catch (err) {
        handleError(err, json);
        process.exit(1);
      }
    });
}
