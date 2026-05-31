import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { Command } from 'commander';
import { performTemplateExport } from '../../core/export/template.js';
import { getTemplatesDir, getExportsDir } from '../../core/config.js';
import { handleError, requireToken } from '../errors.js';
import { resolveModel } from '../resolve-model.js';
import { checkTokenAge } from '../preflight.js';

function collect(val: string, prev: string[]): string[] {
  return [...prev, val];
}

function resolveTemplatePath(template: string): string {
  if (template.includes('/') || template.endsWith('.md')) {
    if (!existsSync(template)) {
      process.stderr.write(`Error: Template file not found: ${template}\n`);
      process.exit(1);
    }
    return template;
  }
  const path = join(getTemplatesDir(), `${template}.md`);
  if (!existsSync(path)) {
    process.stderr.write(`Error: Template "${template}" not found in ${getTemplatesDir()}\n`);
    process.exit(1);
  }
  return path;
}

export function registerDocCommand(program: Command): void {
  const doc = program.command('doc').description('Document generation and management');

  doc
    .command('generate')
    .description('Generate a document from a template and Orbus model')
    .option('--model <name>', 'Model name (fuzzy match)')
    .option('--model-id <guid>', 'Model ID (exact)')
    .requiredOption('--template <name-or-path>', 'Template name (from ~/.orbusctl/templates/) or file path')
    .option('--output <dir>', 'Output directory (default: ~/.orbusctl/exports/)')
    .option('--var <pair>', 'Variable as key=value (repeatable)', collect, [] as string[])
    .option('--json', 'Output as JSON')
    .option('--force', 'Skip token age warning')
    .action(async (opts: { model?: string; modelId?: string; template: string; output?: string; var: string[]; json?: boolean; force?: boolean }) => {
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
      checkTokenAge(opts.force ?? false);

      try {
        const { modelId, modelName } = await resolveModel(token, opts.model, opts.modelId);

        const templatePath = resolveTemplatePath(opts.template);
        const outputDir = opts.output ?? getExportsDir();

        const variables: Record<string, string> = {};
        for (const pair of opts.var ?? []) {
          const eq = pair.indexOf('=');
          if (eq < 1) {
            process.stderr.write(`Error: Invalid --var value "${pair}": expected key=value\n`);
            process.exit(1);
          }
          variables[pair.slice(0, eq)] = pair.slice(eq + 1);
        }

        process.stderr.write(`Generating ${opts.template} for ${modelName}...\n`);

        const result = await performTemplateExport(token, modelId, modelName, templatePath, outputDir, variables, (p) => {
          const count = p.current !== undefined && p.total !== undefined ? ` (${p.current}/${p.total})` : '';
          process.stderr.write(`  ${p.phase}${count}\n`);
        });

        if (json) {
          process.stdout.write(JSON.stringify({ filePath: result.filePath, objectCount: result.objectCount, relationshipCount: result.relationshipCount }, null, 2) + '\n');
        } else {
          process.stdout.write(`Generated ${opts.template} for ${modelName}\n`);
          process.stdout.write(`  Objects: ${result.objectCount}  Relationships: ${result.relationshipCount}\n`);
          process.stdout.write(`  Saved to: ${result.filePath}\n`);
        }
      } catch (err) {
        handleError(err, json);
        process.exit(1);
      }
    });
}
