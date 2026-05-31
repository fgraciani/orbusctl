import type { Command } from 'commander';
import { deleteRelationship } from '../../core/api/write.js';
import { odata, getBaseUrl } from '../../core/api/client.js';
import { getUser } from '../../core/config.js';
import { logWrite } from '../../core/log.js';
import { handleError, requireToken } from '../errors.js';
import { requireWriteAccess } from '../write-guard.js';
import { checkTokenAge } from '../preflight.js';

export function registerRelationshipsDeleteCommand(program: Command): void {
  program
    .command('relationships-delete')
    .description('Delete a relationship by ID')
    .requiredOption('--relationship-id <guid>', 'Relationship ID to delete')
    .requiredOption('--password <pw>', 'Write password')
    .option('--json', 'Output as JSON')
    .option('--force', 'Skip token age warning')
    .action(async (opts: { relationshipId: string; password: string; json?: boolean; force?: boolean }) => {
      const json = opts.json ?? false;
      requireWriteAccess(opts.password);
      const token = requireToken();
      checkTokenAge(opts.force ?? false);

      try {
        let objectType = '';
        let objectName = '';
        try {
          const rel = await odata<{ RelationshipType?: { Name: string }; LeadObject?: { Name: string }; MemberObject?: { Name: string } }>(
            token,
            `${getBaseUrl()}/odata/Relationships(${opts.relationshipId})?$expand=RelationshipType($select=Name),LeadObject($select=Name),MemberObject($select=Name)`,
          );
          objectType = rel.RelationshipType?.Name?.replace('ArchiMate: ', '') ?? '';
          objectName = rel.LeadObject?.Name && rel.MemberObject?.Name
            ? `${rel.LeadObject.Name} → ${rel.MemberObject.Name}`
            : '';
        } catch {}

        await deleteRelationship(token, opts.relationshipId);
        logWrite({ operation: 'delete-relationship', relationshipId: opts.relationshipId, objectName, objectType, params: {}, success: true, user: getUser()?.name });

        if (json) {
          process.stdout.write(JSON.stringify({ deleted: true, relationshipId: opts.relationshipId, type: objectType, name: objectName }, null, 2) + '\n');
        } else {
          const desc = objectName ? `"${objectName}" (${objectType})` : opts.relationshipId;
          process.stdout.write(`Deleted relationship ${desc}\n`);
        }
      } catch (err) {
        logWrite({ operation: 'delete-relationship', relationshipId: opts.relationshipId, params: {}, success: false, error: err instanceof Error ? err.message : String(err), user: getUser()?.name });
        handleError(err, json);
        process.exit(1);
      }
    });
}
