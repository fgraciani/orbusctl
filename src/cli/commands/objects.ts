import type { Command } from 'commander';
import { fetchObjects, fetchObjectDetail, fetchObjectRelationships } from '../../core/api/objects.js';
import { resolveMatch } from '../../core/domain/resolve.js';
import { handleError, requireToken } from '../errors.js';
import { resolveModel } from '../resolve-model.js';

function errExit(msg: string): never {
  process.stderr.write('Error: ' + msg + '\n');
  process.exit(1);
}

function shortDate(iso: string): string {
  return (iso ?? '').slice(0, 10);
}

function stripArchi(name: string): string {
  return name.replace('ArchiMate: ', '');
}

export function registerObjectsCommand(program: Command): void {
  program
    .command('objects')
    .description('List objects in a model or show object detail')
    .option('--model <name>', 'Model name (fuzzy match)')
    .option('--model-id <guid>', 'Model ID (exact)')
    .option('--object <name>', 'Object name (fuzzy match, triggers detail mode)')
    .option('--object-id <guid>', 'Object ID (exact, triggers detail mode)')
    .option('--json', 'Output as JSON')
    .action(async (opts: { model?: string; modelId?: string; object?: string; objectId?: string; json?: boolean }) => {
      const json = opts.json ?? false;

      if (!opts.model && !opts.modelId) {
        process.stderr.write('Error: --model or --model-id is required.\n');
        process.exit(1);
      }
      if (opts.model && opts.modelId) {
        process.stderr.write('Error: Use --model or --model-id, not both.\n');
        process.exit(1);
      }

      const token = requireToken();

      try {
        const { modelId } = await resolveModel(token, opts.model, opts.modelId);

        if (opts.objectId || opts.object) {
          let objectId: string;

          if (opts.objectId) {
            objectId = opts.objectId;
          } else {
            const objects = await fetchObjects(token, modelId);
            const found = resolveMatch(objects, opts.object!, o => o.Name, 'object', errExit);
            objectId = found.ObjectId;
          }

          const [detail, relationships] = await Promise.all([
            fetchObjectDetail(token, objectId),
            fetchObjectRelationships(token, objectId),
          ]);

          if (json) {
            process.stdout.write(JSON.stringify({ ...detail, relationships }, null, 2) + '\n');
          } else {
            const lw = 16;
            const label = (l: string) => ('  ' + l + ':').padEnd(lw);

            process.stdout.write(detail.Name + '\n');
            process.stdout.write(label('Type') + detail.ObjectType.Name + '\n');
            process.stdout.write(label('Model') + detail.Model.Name + '\n');
            process.stdout.write(label('Created') + shortDate(detail.DateCreated) + ' by ' + detail.CreatedBy.Name + '\n');
            process.stdout.write(label('Modified') + shortDate(detail.LastModifiedDate) + ' by ' + detail.LastModifiedBy.Name + '\n');
            process.stdout.write(label('Status') + detail.Detail.Status + '\n');
            process.stdout.write(label('Version') + String(detail.Detail.CurrentVersionNumber) + '\n');

            const attrs = detail.AttributeValues.filter(a => a.StringValue);
            if (attrs.length > 0) {
              process.stdout.write('\n  Attributes:\n');
              const attrW = Math.max(...attrs.map(a => a.AttributeName.length));
              for (const attr of attrs) {
                process.stdout.write('    ' + attr.AttributeName.padEnd(attrW + 4) + attr.StringValue + '\n');
              }
            }

            const sortedRels = [...relationships].sort((a, b) => {
              const dirComp = a.DirectionDescription.localeCompare(b.DirectionDescription);
              if (dirComp !== 0) return dirComp;
              return a.Relationship.RelationshipType.Name.localeCompare(b.Relationship.RelationshipType.Name);
            });

            if (sortedRels.length > 0) {
              process.stdout.write('\n  Relationships (' + sortedRels.length + '):\n');
              for (const rel of sortedRels) {
                const arrow = rel.DirectionDescription === 'Leads' ? '→' : '←';
                const typeName = stripArchi(rel.Relationship.RelationshipType.Name);
                const ri = rel.RelatedItem;
                process.stdout.write(`    ${rel.DirectionDescription} ${arrow} ${ri.Name} (${ri.ObjectType.Name}) via ${typeName}\n`);
              }
            }
          }
        } else {
          const objects = await fetchObjects(token, modelId);
          objects.sort((a, b) => {
            const t = a.ObjectType.Name.localeCompare(b.ObjectType.Name);
            return t !== 0 ? t : a.Name.localeCompare(b.Name);
          });

          if (json) {
            const data = objects.map(o => ({
              name: o.Name,
              objectId: o.ObjectId,
              type: o.ObjectType.Name,
              lastModifiedDate: o.LastModifiedDate,
              lastModifiedBy: o.LastModifiedBy.Name,
            }));
            process.stdout.write(JSON.stringify(data, null, 2) + '\n');
          } else {
            if (objects.length === 0) {
              process.stdout.write('No objects found.\n');
              return;
            }
            const typeW = Math.max(...objects.map(o => o.ObjectType.Name.length));
            const nameW = Math.max(...objects.map(o => o.Name.length));
            for (const o of objects) {
              const type = o.ObjectType.Name.padEnd(typeW + 4);
              const name = o.Name.padEnd(nameW + 4);
              const date = shortDate(o.LastModifiedDate).padEnd(12);
              process.stdout.write(type + name + date + o.LastModifiedBy.Name + '\n');
            }
          }
        }
      } catch (err) {
        handleError(err, json);
        process.exit(1);
      }
    });
}
