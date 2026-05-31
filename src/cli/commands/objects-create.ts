import type { Command } from 'commander';
import { createObject } from '../../core/api/write.js';
import { resolveObjectTypeId } from '../../core/domain/type-maps.js';
import { getUser } from '../../core/config.js';
import { logWrite } from '../../core/log.js';
import { handleError, requireToken } from '../errors.js';
import { requireWriteAccess } from '../write-guard.js';
import { checkTokenAge } from '../preflight.js';

function extractObjectId(result: unknown): string | undefined {
  if (!result || typeof result !== 'object') return undefined;
  const r = result as Record<string, unknown>;
  const msg = r['successMessage'] as Record<string, unknown> | undefined;
  const def = msg?.['messageDefinition'] as Record<string, unknown> | undefined;
  if (def?.['objectId']) return String(def['objectId']);
  if (r['ObjectId']) return String(r['ObjectId']);
  if (r['objectId']) return String(r['objectId']);
  return undefined;
}

export function registerObjectsCreateCommand(program: Command): void {
  program
    .command('objects-create')
    .description('Create an object in a model')
    .requiredOption('--model-id <guid>', 'Target model ID')
    .requiredOption('--name <name>', 'Object name')
    .requiredOption('--type <type>', 'Object type (e.g. "Business Process")')
    .requiredOption('--password <pw>', 'Write password')
    .option('--json', 'Output as JSON')
    .option('--force', 'Skip token age warning')
    .action(async (opts: { modelId: string; name: string; type: string; password: string; json?: boolean; force?: boolean }) => {
      const json = opts.json ?? false;
      requireWriteAccess(opts.password);
      const token = requireToken();
      checkTokenAge(opts.force ?? false);

      let objectTypeId: string;
      try {
        objectTypeId = resolveObjectTypeId(opts.type);
      } catch (err) {
        handleError(err, json);
        process.exit(1);
      }

      try {
        const result = await createObject(token, opts.modelId, objectTypeId, opts.name);
        const objectId = extractObjectId(result);
        const user = getUser()?.name;

        logWrite({ operation: 'create-object', modelId: opts.modelId, objectId, objectName: opts.name, objectType: opts.type, params: { name: opts.name, type: opts.type }, success: true, user });

        if (json) {
          process.stdout.write(JSON.stringify({ objectId: objectId ?? null, name: opts.name, type: opts.type, modelId: opts.modelId }, null, 2) + '\n');
        } else {
          process.stdout.write(`Created "${opts.name}" (${opts.type})\n`);
          if (objectId) process.stdout.write(`  ObjectId: ${objectId}\n`);
        }
      } catch (err) {
        logWrite({ operation: 'create-object', modelId: opts.modelId, objectName: opts.name, objectType: opts.type, params: { name: opts.name, type: opts.type }, success: false, error: err instanceof Error ? err.message : String(err), user: getUser()?.name });
        handleError(err, json);
        process.exit(1);
      }
    });
}
