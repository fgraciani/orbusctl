import type { Command } from 'commander';
import type { Drawing } from '../../core/api/drawings.js';
import { fetchDrawings, fetchDocumentTypes, resolveDrawingComponents } from '../../core/api/drawings.js';
import { resolveMatch } from '../../core/domain/resolve.js';
import { handleError, requireToken } from '../errors.js';
import { resolveModel } from '../resolve-model.js';

function errExit(msg: string): never {
  process.stderr.write('Error: ' + msg + '\n');
  process.exit(1);
}

export function registerDrawingsCommand(program: Command): void {
  program
    .command('drawings')
    .description('List drawings in a model or show drawing detail')
    .option('--model <name>', 'Model name (fuzzy match)')
    .option('--model-id <guid>', 'Model ID (exact)')
    .option('--drawing <name>', 'Drawing name (fuzzy match, triggers detail mode)')
    .option('--drawing-id <guid>', 'Drawing ID (exact, triggers detail mode)')
    .option('--json', 'Output as JSON')
    .action(async (opts: { model?: string; modelId?: string; drawing?: string; drawingId?: string; json?: boolean }) => {
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

        const [drawings, docTypes] = await Promise.all([
          fetchDrawings(token, modelId),
          fetchDocumentTypes(token),
        ]);

        const typeMap = new Map(docTypes.map(t => [t.DocumentTypeId, t.Name]));

        if (opts.drawingId || opts.drawing) {
          let drawing: Drawing;

          if (opts.drawingId) {
            const found = drawings.find(d => d.DocumentId === opts.drawingId);
            if (!found) return errExit(`No drawing found with ID "${opts.drawingId}".`);
            drawing = found;
          } else {
            drawing = resolveMatch(drawings, opts.drawing!, d => d.FileName, 'drawing', errExit);
          }

          const typeName = typeMap.get(drawing.DocumentTypeId) ?? 'Unknown';
          const components = await resolveDrawingComponents(token, drawing.DocumentId);

          const objects = components
            .filter(c => !c.isRelationship)
            .sort((a, b) => {
              const t = a.typeName.localeCompare(b.typeName);
              return t !== 0 ? t : a.name.localeCompare(b.name);
            });

          const relationships = components.filter(c => c.isRelationship);

          if (json) {
            process.stdout.write(JSON.stringify({
              documentId: drawing.DocumentId,
              fileName: drawing.FileName,
              typeName,
              components: components.map(c => ({
                objectId: c.objectId,
                name: c.name,
                typeName: c.typeName,
                isRelationship: c.isRelationship,
                ...(c.isRelationship ? { fromName: c.fromName, toName: c.toName } : {}),
              })),
            }, null, 2) + '\n');
          } else {
            process.stdout.write(drawing.FileName + '\n');

            if (objects.length > 0) {
              process.stdout.write(`\n  Objects (${objects.length}):\n`);
              const typeW = Math.max(...objects.map(o => o.typeName.length));
              for (const o of objects) {
                process.stdout.write('    ' + o.typeName.padEnd(typeW + 4) + o.name + '\n');
              }
            }

            if (relationships.length > 0) {
              process.stdout.write(`\n  Relationships (${relationships.length}):\n`);
              const kindW = Math.max(...relationships.map(r => (r.typeName ?? '').length));
              for (const r of relationships) {
                process.stdout.write('    ' + (r.typeName ?? '').padEnd(kindW + 4) + r.name + '\n');
              }
            }
          }
        } else {
          if (json) {
            const data = drawings.map(d => ({
              documentId: d.DocumentId,
              fileName: d.FileName,
              typeName: typeMap.get(d.DocumentTypeId) ?? 'Unknown',
            }));
            process.stdout.write(JSON.stringify(data, null, 2) + '\n');
          } else {
            if (drawings.length === 0) {
              process.stdout.write('No drawings found.\n');
              return;
            }
            const nameW = Math.max(...drawings.map(d => d.FileName.length));
            for (const d of drawings) {
              const name = d.FileName.padEnd(nameW + 4);
              const type = typeMap.get(d.DocumentTypeId) ?? 'Unknown';
              process.stdout.write(name + type + '\n');
            }
          }
        }
      } catch (err) {
        handleError(err, json);
        process.exit(1);
      }
    });
}
