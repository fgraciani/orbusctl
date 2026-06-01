import { updateObjectFlat, updateObjectAttributes } from '../../core/api/write.js';
import { parseSetFlags, buildMixedAttributeValues } from '../../core/domain/attribute-builder.js';
import { getUser } from '../../core/config.js';
import { logWrite } from '../../core/log.js';
import { handleError, requireToken } from '../errors.js';
import { requireWriteAccess } from '../write-guard.js';
import { checkTokenAge } from '../preflight.js';
function collect(val, prev) {
    return [...prev, val];
}
export function registerObjectsUpdateCommand(program) {
    program
        .command('objects-update')
        .description('Update attributes of an object')
        .requiredOption('--object-id <guid>', 'Object ID to update')
        .option('--set <pair>', 'Text attribute as Key=Value (repeatable)', collect, [])
        .option('--set-choice <pair>', 'Choice attribute as Name=Val1,Val2 (repeatable) — note: most choice attributes (RASCI, Access Operator) are on relationships, not objects', collect, [])
        .requiredOption('--password <pw>', 'Write password')
        .option('--json', 'Output as JSON')
        .option('--force', 'Skip token age warning')
        .action(async (opts) => {
        const json = opts.json ?? false;
        const sets = opts.set ?? [];
        const setChoices = opts.setChoice ?? [];
        if (sets.length === 0 && setChoices.length === 0) {
            process.stderr.write('Error: At least one of --set or --set-choice is required.\n');
            process.exit(1);
        }
        requireWriteAccess(opts.password);
        const token = requireToken();
        checkTokenAge(opts.force ?? false);
        let attributes;
        let attributeValues;
        try {
            if (setChoices.length > 0) {
                attributeValues = buildMixedAttributeValues(sets, setChoices);
            }
            else {
                attributes = parseSetFlags(sets);
            }
        }
        catch (err) {
            handleError(err, json);
            process.exit(1);
        }
        try {
            if (attributeValues) {
                await updateObjectAttributes(token, opts.objectId, attributeValues);
            }
            else {
                await updateObjectFlat(token, opts.objectId, attributes);
            }
            logWrite({ operation: 'update-object', objectId: opts.objectId, params: { set: sets, setChoice: setChoices }, success: true, user: getUser()?.name });
            if (json) {
                process.stdout.write(JSON.stringify({ objectId: opts.objectId, attributes: attributes ?? attributeValues }, null, 2) + '\n');
            }
            else {
                process.stdout.write(`Updated object ${opts.objectId}\n`);
                for (const pair of sets) {
                    const eq = pair.indexOf('=');
                    process.stdout.write(`  ${pair.slice(0, eq)} = "${pair.slice(eq + 1)}"\n`);
                }
                for (const pair of setChoices) {
                    const eq = pair.indexOf('=');
                    process.stdout.write(`  ${pair.slice(0, eq)} = ${pair.slice(eq + 1)}\n`);
                }
            }
        }
        catch (err) {
            logWrite({ operation: 'update-object', objectId: opts.objectId, params: { set: sets, setChoice: setChoices }, success: false, error: err instanceof Error ? err.message : String(err), user: getUser()?.name });
            handleError(err, json);
            process.exit(1);
        }
    });
}
