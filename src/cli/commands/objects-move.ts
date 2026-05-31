import type { Command } from 'commander';
import { fetchObjects, fetchAllRelationships } from '../../core/api/objects.js';
import { moveObjects, createRelationship } from '../../core/api/write.js';
import { resolveRelationshipTypeId } from '../../core/domain/type-maps.js';
import { saveCorrelationTable, type CorrelationEntry } from '../../core/domain/correlation.js';
import { getUser } from '../../core/config.js';
import { logWrite } from '../../core/log.js';
import { handleError, requireToken } from '../errors.js';
import { requireWriteAccess } from '../write-guard.js';
import { checkTokenAge } from '../preflight.js';
import { resolveModel } from '../resolve-model.js';

const AUTO_ATTRS = new Set([
  'iServer365 Id', 'Created By', 'Date Created', 'Last Modified By', 'Date Last Modified',
  'Metamodel Item Id', 'Metamodel Item Name', 'Name', 'Description', 'Type',
]);

export function registerObjectsMoveCommand(program: Command): void {
  program
    .command('objects-move')
    .description('Move all objects from one model to another')
    .requiredOption('--source-id <guid>', 'Source model ID')
    .requiredOption('--target-id <guid>', 'Target model ID')
    .option('--dry-run', 'Show what would be moved without making changes')
    .option('--password <pw>', 'Write password (required unless --dry-run)')
    .option('--json', 'Output as JSON')
    .option('--force', 'Skip token age warning')
    .action(async (opts: { sourceId: string; targetId: string; dryRun?: boolean; password?: string; json?: boolean; force?: boolean }) => {
      const json = opts.json ?? false;
      const dryRun = opts.dryRun ?? false;

      if (!dryRun) {
        requireWriteAccess(opts.password);
      }

      const token = requireToken();

      if (!dryRun) {
        checkTokenAge(opts.force ?? false);
      }

      try {
        // Resolve model names for display
        process.stderr.write('Fetching source model...\n');
        const [sourceModel, targetModel] = await Promise.all([
          resolveModel(token, undefined, opts.sourceId),
          resolveModel(token, undefined, opts.targetId),
        ]);

        process.stderr.write('Fetching objects and relationships...\n');
        const [objects, relationships] = await Promise.all([
          fetchObjects(token, opts.sourceId),
          fetchAllRelationships(token, opts.sourceId),
        ]);

        const sourceObjectIds = new Set(objects.map(o => o.ObjectId));

        // Only intra-model relationships (both ends in source)
        const intraRels = relationships.filter(r =>
          r.LeadObject?.ObjectId && r.MemberObject?.ObjectId &&
          sourceObjectIds.has(r.LeadObject.ObjectId) &&
          sourceObjectIds.has(r.MemberObject.ObjectId),
        );

        if (dryRun) {
          if (json) {
            process.stdout.write(JSON.stringify({
              dryRun: true,
              source: { modelId: opts.sourceId, name: sourceModel.modelName },
              target: { modelId: opts.targetId, name: targetModel.modelName },
              objectCount: objects.length,
              relationshipCount: intraRels.length,
            }, null, 2) + '\n');
          } else {
            process.stdout.write('Dry run — no changes will be made\n\n');
            process.stdout.write(`Source: ${sourceModel.modelName} (${opts.sourceId})\n`);
            process.stdout.write(`Target: ${targetModel.modelName} (${opts.targetId})\n\n`);
            process.stdout.write(`Objects: ${objects.length}\n`);
            process.stdout.write(`Relationships: ${intraRels.length} (intra-model only)\n`);
          }
          return;
        }

        process.stderr.write(`Moving ${objects.length} objects to ${targetModel.modelName}...\n`);
        await moveObjects(token, objects.map(o => o.ObjectId), opts.targetId);

        logWrite({
          operation: 'move-objects',
          modelId: opts.sourceId,
          modelName: sourceModel.modelName,
          params: { sourceId: opts.sourceId, targetId: opts.targetId, targetName: targetModel.modelName, count: objects.length },
          success: true,
          user: getUser()?.name,
        });

        // Build object correlation entries (IDs preserved on move)
        const objEntries: CorrelationEntry[] = objects.map(o => ({
          type: 'object',
          name: o.Name,
          typeName: o.ObjectType.Name,
          oldId: o.ObjectId,
          newId: o.ObjectId, // IDs are preserved by the API
          status: 'identity',
        }));

        // Recreate intra-model relationships in target model
        process.stderr.write(`Recreating ${intraRels.length} relationships...\n`);
        let recreated = 0;
        const relEntries: CorrelationEntry[] = [];

        for (const rel of intraRels) {
          if (!rel.RelationshipType || !rel.LeadObject || !rel.MemberObject) continue;

          const copyAttrs = (rel.AttributeValues ?? [])
            .filter(a => !AUTO_ATTRS.has(a.AttributeName) && a.StringValue)
            .map(a => ({ attributeName: a.AttributeName, stringValue: a.StringValue! }));

          let relTypeId: string;
          try {
            relTypeId = resolveRelationshipTypeId(rel.RelationshipType.Name);
          } catch {
            relEntries.push({
              type: 'relationship',
              name: rel.RelationshipId,
              typeName: rel.RelationshipType.Name,
              oldId: rel.RelationshipId,
              newId: null,
              status: 'failed',
              error: `Unknown relationship type: ${rel.RelationshipType.Name}`,
            });
            continue;
          }

          try {
            const result = await createRelationship(
              token, opts.targetId, relTypeId,
              rel.LeadObject.ObjectId, rel.MemberObject.ObjectId,
              copyAttrs.length > 0 ? copyAttrs : undefined,
            );
            const newRelId = extractRelId(result);
            relEntries.push({
              type: 'relationship',
              name: rel.RelationshipId,
              typeName: rel.RelationshipType.Name,
              oldId: rel.RelationshipId,
              newId: newRelId ?? null,
              status: 'ok',
            });
            recreated++;
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            relEntries.push({
              type: 'relationship',
              name: rel.RelationshipId,
              typeName: rel.RelationshipType.Name,
              oldId: rel.RelationshipId,
              newId: null,
              status: 'failed',
              error: msg,
            });
            process.stderr.write(`  ✗ ${rel.RelationshipId}: ${msg}\n`);
          }
        }

        const failed = relEntries.filter(e => e.status === 'failed');

        // Save correlation table
        const table = {
          timestamp: new Date().toISOString(),
          operation: 'move' as const,
          source: { modelId: opts.sourceId, name: sourceModel.modelName },
          target: { modelId: opts.targetId, name: targetModel.modelName },
          entries: [...objEntries, ...relEntries],
        };
        const corrPath = saveCorrelationTable(table);

        if (json) {
          process.stdout.write(JSON.stringify({
            source: { modelId: opts.sourceId, name: sourceModel.modelName },
            target: { modelId: opts.targetId, name: targetModel.modelName },
            objectsMoved: objects.length,
            relationshipsAttempted: intraRels.length,
            relationshipsRecreated: recreated,
            relationshipsFailed: failed.length,
            correlationTable: corrPath,
          }, null, 2) + '\n');
        } else {
          process.stdout.write(`Moving ${objects.length} objects from ${sourceModel.modelName} → ${targetModel.modelName}\n\n`);
          process.stdout.write(`Objects: ${objects.length} moved\n`);
          process.stdout.write(`Relationships: ${intraRels.length} attempted, ${recreated} recreated, ${failed.length} failed\n`);
          for (const f of failed) {
            process.stdout.write(`  ✗ ${f.oldId}: ${f.error}\n`);
          }
          process.stdout.write(`\nCorrelation table: ${corrPath}\n`);
        }
      } catch (err) {
        handleError(err, json);
        process.exit(1);
      }
    });
}

function extractRelId(result: unknown): string | undefined {
  if (!result || typeof result !== 'object') return undefined;
  const r = result as Record<string, unknown>;
  const msg = r['successMessage'] as Record<string, unknown> | undefined;
  const def = msg?.['messageDefinition'] as Record<string, unknown> | undefined;
  if (def?.['relationshipId']) return String(def['relationshipId']);
  if (r['RelationshipId']) return String(r['RelationshipId']);
  if (r['relationshipId']) return String(r['relationshipId']);
  return undefined;
}
