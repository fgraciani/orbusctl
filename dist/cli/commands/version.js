import { VERSION } from '../../version.js';
export function registerVersionCommand(program) {
    program
        .command('version')
        .description('Show version')
        .option('--json', 'Output as JSON')
        .action((opts) => {
        if (opts.json) {
            process.stdout.write(JSON.stringify({ version: VERSION }, null, 2) + '\n');
        }
        else {
            process.stdout.write(`orbusctl ${VERSION}\n`);
        }
    });
}
