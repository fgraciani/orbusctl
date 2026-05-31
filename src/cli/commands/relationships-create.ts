import type { Command } from 'commander';
import { createRelationship } from '../../core/api/write.js';
import { resolveRelationshipTypeId } from '../../core/domain/type-maps.js';
import { getUser } from '../../core/config.js';
import { logWrite } from '../../core/log.js';
import { handleError, requireToken } from '../errors.js';
import { requireWriteAccess } from '../write-guard.js';
import { checkTokenAge } from '../preflight.js';

function extractRelationshipId(result: unknown): string | undefined {
  if (!result || typeof result !== 'object') return undefined;
  const r = result as Record<string, unknown>;
  const msg = r['successMessage'] as Record<string, unknown> | undefined;
  const def = msg?.['messageDefinition'] as Record<string, unknown> | undefined;
  if (def?.['relationshipId']) return String(def['relationshipId']);
  if (r['RelationshipId']) return String(r['RelationshipId']);
  if (r['relationshipId']) return String(r['relationshipId']);
  return undefined;
}

export function registerRelationshipsCreateCommand(program: Command): void {
  program
    .command('relationships-create')
    .description('Create a relationship between two objects')
    .requiredOption('--model-id <guid>', 'Model ID')
    .requiredOption('--lead-id <guid>', 'Lead object ID')
    .requiredOption('--member-id <guid>', 'Member object ID')
    .requiredOption('--type <type>', 'Relationship type (e.g. "Association", "ArchiMate: Serving")')
    .requiredOption('--password <pw>', 'Write password')
    .option('--json', 'Output as JSON')
    .option('--force', 'Skip token age warning')
    .action(async (opts: { modelId: string; leadId: string; memberId: string; type: string; password: string; json?: boolean; force?: boolean }) => {
      const json = opts.json ?? false;
      requireWriteAccess(opts.password);
      const token = requireToken();
      checkTokenAge(opts.force ?? false);

      let relTypeId: string;
      try {
        relTypeId = resolveRelationshipTypeId(opts.type);
      } catch (err) {
        handleError(err, json);
        process.exit(1);
      }

      try {
        const result = await createRelationship(token, opts.modelId, relTypeId, opts.leadId, opts.memberId);
        const relationshipId = extractRelationshipId(result);
        const user = getUser()?.name;

        logWrite({ operation: 'create-relationship', modelId: opts.modelId, relationshipId, objectType: opts.type, params: { type: opts.type, leadId: opts.leadId, memberId: opts.memberId }, success: true, user });

        if (json) {
          process.stdout.write(JSON.stringify({ relationshipId: relationshipId ?? null, type: opts.type, modelId: opts.modelId, leadId: opts.leadId, memberId: opts.memberId }, null, 2) + '\n');
        } else {
          process.stdout.write(`Created ${opts.type} relationship\n`);
          process.stdout.write(`  Lead:   ${opts.leadId}\n`);
          process.stdout.write(`  Member: ${opts.memberId}\n`);
          if (relationshipId) process.stdout.write(`  RelationshipId: ${relationshipId}\n`);
        }
      } catch (err) {
        logWrite({ operation: 'create-relationship', modelId: opts.modelId, objectType: opts.type, params: { type: opts.type, leadId: opts.leadId, memberId: opts.memberId }, success: false, error: err instanceof Error ? err.message : String(err), user: getUser()?.name });
        handleError(err, json);
        process.exit(1);
      }
    });
}
