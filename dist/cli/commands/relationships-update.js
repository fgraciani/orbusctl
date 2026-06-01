import { updateRelationshipFlat, updateRelationshipAttributes } from '../../core/api/write.js';
import { parseSetFlags, buildMixedAttributeValues } from '../../core/domain/attribute-builder.js';
import { getUser } from '../../core/config.js';
import { logWrite } from '../../core/log.js';
import { handleError, requireToken } from '../errors.js';
import { requireWriteAccess } from '../write-guard.js';
import { checkTokenAge } from '../preflight.js';
function collect(val, prev) {
    return [...prev, val];
}
export function registerRelationshipsUpdateCommand(program) {
    program
        .command('relationships-update')
        .description('Update attributes of a relationship')
        .requiredOption('--relationship-id <guid>', 'Relationship ID to update')
        .option('--set <pair>', 'Text attribute as Key=Value (repeatable)', collect, [])
        .option('--set-choice <pair>', 'Choice attribute as Name=Val1,Val2 (repeatable)', collect, [])
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
                await updateRelationshipAttributes(token, opts.relationshipId, attributeValues);
            }
            else {
                await updateRelationshipFlat(token, opts.relationshipId, attributes);
            }
            logWrite({ operation: 'update-relationship', relationshipId: opts.relationshipId, params: { set: sets, setChoice: setChoices }, success: true, user: getUser()?.name });
            if (json) {
                process.stdout.write(JSON.stringify({ relationshipId: opts.relationshipId, attributes: attributes ?? attributeValues }, null, 2) + '\n');
            }
            else {
                process.stdout.write(`Updated relationship ${opts.relationshipId}\n`);
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
            logWrite({ operation: 'update-relationship', relationshipId: opts.relationshipId, params: { set: sets, setChoice: setChoices }, success: false, error: err instanceof Error ? err.message : String(err), user: getUser()?.name });
            handleError(err, json);
            process.exit(1);
        }
    });
}
