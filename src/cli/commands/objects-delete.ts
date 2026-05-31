import type { Command } from 'commander';
import { deleteObject } from '../../core/api/write.js';
import { fetchObjectNameAndType } from '../../core/api/objects.js';
import { getUser } from '../../core/config.js';
import { logWrite } from '../../core/log.js';
import { handleError, requireToken } from '../errors.js';
import { requireWriteAccess } from '../write-guard.js';
import { checkTokenAge } from '../preflight.js';

export function registerObjectsDeleteCommand(program: Command): void {
  program
    .command('objects-delete')
    .description('Delete an object by ID')
    .requiredOption('--object-id <guid>', 'Object ID to delete')
    .requiredOption('--password <pw>', 'Write password')
    .option('--json', 'Output as JSON')
    .option('--force', 'Skip token age warning')
    .action(async (opts: { objectId: string; password: string; json?: boolean; force?: boolean }) => {
      const json = opts.json ?? false;
      requireWriteAccess(opts.password);
      const token = requireToken();
      checkTokenAge(opts.force ?? false);

      try {
        const { name: objectName, typeName: objectType } = await fetchObjectNameAndType(token, opts.objectId);
        await deleteObject(token, opts.objectId);
        logWrite({ operation: 'delete-object', objectId: opts.objectId, objectName, objectType, params: {}, success: true, user: getUser()?.name });

        if (json) {
          process.stdout.write(JSON.stringify({ deleted: true, objectId: opts.objectId, name: objectName, type: objectType }, null, 2) + '\n');
        } else {
          process.stdout.write(`Deleted "${objectName}" (${objectType})\n`);
        }
      } catch (err) {
        logWrite({ operation: 'delete-object', objectId: opts.objectId, params: {}, success: false, error: err instanceof Error ? err.message : String(err), user: getUser()?.name });
        handleError(err, json);
        process.exit(1);
      }
    });
}
