import { fetchModels, fetchModelDetailCounts } from '../../core/api/models.js';
import { getShowHiddenModels, getSolutionFilter } from '../../core/config.js';
import { buildTree, flattenTree } from '../../core/domain/tree.js';
import { treePrefix } from '../output.js';
import { handleError, requireToken } from '../errors.js';
export function registerModelsCommand(program) {
    program
        .command('models')
        .description('List models')
        .option('--detail', 'Include object/relationship/drawing counts')
        .option('--json', 'Output as JSON')
        .action(async (opts) => {
        const json = opts.json ?? false;
        const token = requireToken();
        try {
            const models = await fetchModels(token, getSolutionFilter());
            const showHidden = getShowHiddenModels();
            const visible = showHidden ? models : models.filter(m => !m.IsHidden);
            const flat = flattenTree(buildTree(visible));
            let counts;
            if (opts.detail) {
                counts = await fetchModelDetailCounts(token, visible.map(m => m.ModelId));
            }
            if (json) {
                const data = flat.map(({ model, depth, isLast: _isLast, ancestors: _ancestors }) => {
                    const entry = { name: model.Name, modelId: model.ModelId, depth, isHidden: model.IsHidden };
                    if (counts) {
                        const c = counts.get(model.ModelId);
                        if (c) {
                            entry.objects = c.objects;
                            entry.relationships = c.relationships;
                            entry.drawings = c.drawings;
                        }
                    }
                    return entry;
                });
                process.stdout.write(JSON.stringify(data, null, 2) + '\n');
            }
            else {
                for (const { model, depth, isLast, ancestors } of flat) {
                    const prefix = treePrefix(depth, isLast, ancestors);
                    let line = prefix + model.Name;
                    if (counts) {
                        const c = counts.get(model.ModelId);
                        if (c)
                            line += ` (${c.objects} obj, ${c.relationships} rel, ${c.drawings} drw)`;
                    }
                    process.stdout.write(line + '\n');
                }
            }
        }
        catch (err) {
            handleError(err, json);
            process.exit(1);
        }
    });
}
