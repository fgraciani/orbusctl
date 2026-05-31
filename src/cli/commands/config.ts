import type { Command } from 'commander';
import {
  getServer,
  getUser,
  hasToken,
  formatTokenAge,
  getSolutionFilter,
  getShowHiddenModels,
  getBannerColor,
  getExportsDir,
  getReportsDir,
} from '../../core/config.js';

function tildeHome(p: string): string {
  const home = process.env.HOME ?? '';
  return home && p.startsWith(home) ? '~' + p.slice(home.length) : p;
}

export function registerConfigCommand(program: Command): void {
  program
    .command('config')
    .description('Show current configuration')
    .option('--json', 'Output as JSON')
    .action((opts: { json?: boolean }) => {
      const server = getServer();
      const user = getUser();
      const tokenSaved = hasToken();
      const tokenAge = formatTokenAge();
      const solutionFilter = getSolutionFilter();
      const showHidden = getShowHiddenModels();
      const exportsDir = getExportsDir();
      const reportsDir = getReportsDir();

      if (opts.json) {
        const out: Record<string, unknown> = {
          server,
          user: user ?? null,
          tokenAge: tokenAge ?? null,
          solutionFilter: solutionFilter ?? null,
          showHiddenModels: showHidden,
          exportsDir,
          reportsDir,
        };
        process.stdout.write(JSON.stringify(out, null, 2) + '\n');
      } else {
        const lw = 18;
        const label = (l: string) => (l + ':').padEnd(lw);

        let tokenDisplay: string;
        if (!tokenSaved) {
          tokenDisplay = process.env.ORBUS_TOKEN ? 'set via ORBUS_TOKEN env var' : 'not set';
        } else {
          tokenDisplay = tokenAge
            ? tokenAge === 'just now' ? 'saved (just now)' : `saved (${tokenAge} ago)`
            : 'saved';
        }

        process.stdout.write(label('Server') + server + '\n');

        if (user) {
          process.stdout.write(label('User') + `${user.name} (${user.accountName})` + '\n');
        }

        process.stdout.write(label('Token') + tokenDisplay + '\n');
        process.stdout.write(label('Solution filter') + (solutionFilter ?? '(none)') + '\n');
        process.stdout.write(label('Show hidden') + (showHidden ? 'yes' : 'no') + '\n');
        process.stdout.write(label('Exports dir') + tildeHome(exportsDir) + '\n');
        process.stdout.write(label('Reports dir') + tildeHome(reportsDir) + '\n');
      }
    });
}
