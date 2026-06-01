import { fetchModels } from '../../core/api/models.js';
import { getTimePeriodRange, scanActivity, summarizeReport } from '../../core/domain/activity.js';
import { getSolutionFilter, getShowHiddenModels } from '../../core/config.js';
import { handleError, requireToken } from '../errors.js';
import { checkTokenAge } from '../preflight.js';
function fmtDate(d) {
    return d.toISOString().slice(0, 10);
}
export function registerActivityCommand(program) {
    program
        .command('activity')
        .description('Show recent activity across models')
        .option('--period <period>', 'Time period: 24h, 7d, past-week, 30d, past-month (default: 7d)', '7d')
        .option('--json', 'Output as JSON')
        .option('--force', 'Skip token age warning')
        .action(async (opts) => {
        const json = opts.json ?? false;
        const validPeriods = ['24h', '7d', 'past-week', '30d', 'past-month'];
        if (!validPeriods.includes(opts.period)) {
            process.stderr.write(`Error: --period must be one of: ${validPeriods.join(', ')}\n`);
            process.exit(1);
        }
        const period = opts.period;
        const token = requireToken();
        checkTokenAge(opts.force ?? false);
        try {
            const allModels = await fetchModels(token, getSolutionFilter());
            const showHidden = getShowHiddenModels();
            const models = showHidden ? allModels : allModels.filter(m => !m.IsHidden);
            const { since, until, label } = getTimePeriodRange(period);
            const report = await scanActivity(token, models, since, until, label, (p) => {
                process.stderr.write(`Scanning ${p.modelName}... (${p.current}/${p.total})\n`);
            });
            const summary = summarizeReport(report);
            if (json) {
                process.stdout.write(JSON.stringify({
                    label,
                    since: since.toISOString(),
                    until: until.toISOString(),
                    ...summary,
                }, null, 2) + '\n');
            }
            else {
                process.stdout.write(`Activity: ${label} (${fmtDate(since)} – ${fmtDate(until)})\n`);
                if (summary.models.length === 0) {
                    process.stdout.write('\nNo activity found in this period.\n');
                    return;
                }
                for (const model of summary.models) {
                    process.stdout.write(`\n${model.modelName}\n`);
                    const userW = Math.max(...model.users.map(u => u.userName.length));
                    for (const user of model.users) {
                        const name = user.userName.padEnd(userW + 2);
                        const created = String(user.created.length).padStart(4) + ' created';
                        const modified = String(user.modified.length).padStart(4) + ' modified';
                        const rels = String(user.relsCreated).padStart(4) + ' relationships';
                        process.stdout.write(`  ${name}${created}  ${modified}  ${rels}\n`);
                    }
                }
                const modelCount = summary.models.length;
                process.stdout.write(`\nTotal: ${summary.totalCreated} created, ${summary.totalModified} modified, ${summary.totalRels} relationships across ${modelCount} model${modelCount !== 1 ? 's' : ''}\n`);
            }
        }
        catch (err) {
            handleError(err, json);
            process.exit(1);
        }
    });
}
