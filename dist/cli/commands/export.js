import { performExcelExport } from '../../core/export/excel.js';
import { performMarkdownExport } from '../../core/export/markdown.js';
import { handleError, requireToken } from '../errors.js';
import { resolveModel } from '../resolve-model.js';
import { checkTokenAge } from '../preflight.js';
export function registerExportCommand(program) {
    program
        .command('export')
        .description('Export a model to Excel or Markdown')
        .option('--model <name>', 'Model name (fuzzy match)')
        .option('--model-id <guid>', 'Model ID (exact)')
        .option('--format <format>', 'Output format: excel or markdown (default: excel)', 'excel')
        .option('--no-details', 'Skip fetching object details (Excel only, faster)')
        .option('--json', 'Output as JSON')
        .option('--force', 'Skip token age warning')
        .action(async (opts) => {
        const json = opts.json ?? false;
        if (!opts.model && !opts.modelId) {
            process.stderr.write('Error: --model or --model-id is required.\n');
            process.exit(1);
        }
        if (opts.model && opts.modelId) {
            process.stderr.write('Error: Use --model or --model-id, not both.\n');
            process.exit(1);
        }
        if (opts.format !== 'excel' && opts.format !== 'markdown') {
            process.stderr.write('Error: --format must be excel or markdown.\n');
            process.exit(1);
        }
        const token = requireToken();
        checkTokenAge(opts.force ?? false);
        try {
            const { modelId, modelName } = await resolveModel(token, opts.model, opts.modelId);
            process.stderr.write(`Exporting ${modelName}...\n`);
            let result;
            if (opts.format === 'markdown') {
                result = await performMarkdownExport(token, modelId, modelName, (p) => {
                    process.stderr.write(`  ${p.phase}\n`);
                });
            }
            else {
                result = await performExcelExport(token, modelId, modelName, opts.details, (p) => {
                    const count = p.current !== undefined && p.total !== undefined ? ` (${p.current}/${p.total})` : '';
                    process.stderr.write(`  ${p.phase}${count}\n`);
                });
            }
            if (json) {
                process.stdout.write(JSON.stringify({
                    filePath: result.filePath,
                    objectCount: result.objectCount,
                    relationshipCount: result.relationshipCount,
                    drawingCount: result.drawingCount,
                }, null, 2) + '\n');
            }
            else {
                process.stdout.write(`Exported to ${result.filePath}\n`);
                process.stdout.write(`  Objects: ${result.objectCount}  Relationships: ${result.relationshipCount}  Drawings: ${result.drawingCount}\n`);
            }
        }
        catch (err) {
            handleError(err, json);
            process.exit(1);
        }
    });
}
