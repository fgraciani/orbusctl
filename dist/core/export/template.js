import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fetchObjects, fetchObjectDetail, fetchAllRelationships } from '../api/objects.js';
import { getUser, getTemplatesDir } from '../config.js';
import { VERSION } from '../../version.js';
import { parseAttrs, processTag, normalizeName } from './template-tables.js';
const BEGIN_RE = /^<!--\s*ORBUS:BEGIN\s+(.+?)\s*-->$/;
const END_RE = /^<!--\s*ORBUS:END\s*-->$/;
const LEGACY_RE = /^<!--\s*(ORBUS-TABLE|ORBUS-DIAGRAM):\s*(.+?)\s*-->$/;
function parseFrontmatter(content) {
    const templateFields = {};
    if (!content.startsWith('---'))
        return { body: content, templateFields };
    const endIdx = content.indexOf('\n---', 3);
    if (endIdx === -1)
        return { body: content, templateFields };
    const fm = content.slice(3, endIdx).trim();
    const body = content.slice(endIdx + 4).trimStart();
    for (const line of fm.split('\n')) {
        const colonIdx = line.indexOf(':');
        if (colonIdx === -1)
            continue;
        const key = line.slice(0, colonIdx).trim();
        if (!key.startsWith('template-'))
            continue;
        let value = line.slice(colonIdx + 1).trim();
        if (value.startsWith('"') && value.endsWith('"'))
            value = value.slice(1, -1);
        templateFields[key] = value;
    }
    return { body, templateFields };
}
function parseScopeOverrides(templateFields) {
    const scope = new Map();
    const PREFIX = 'template-scope-';
    for (const [key, value] of Object.entries(templateFields)) {
        if (!key.startsWith(PREFIX))
            continue;
        const processName = key.slice(PREFIX.length);
        scope.set(processName, value.split(',').map((s) => s.trim()).filter(Boolean));
    }
    return scope;
}
function interpolateVariables(text, variables) {
    return text.replace(/\{\{(\w+)\}\}/g, (match, key) => variables[key] ?? match);
}
function sanitizeName(name) {
    return name.replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}
function formatTimestamp(d) {
    const p = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}-${p(d.getHours())}-${p(d.getMinutes())}`;
}
export function parseTemplateVariables(templatePath) {
    const content = readFileSync(templatePath, 'utf-8');
    const { templateFields } = parseFrontmatter(content);
    const vars = [];
    const PREFIX = 'template-var-';
    for (const [key, value] of Object.entries(templateFields)) {
        if (!key.startsWith(PREFIX))
            continue;
        const parts = value.split('|');
        const prompt = parts[0].trim() || key.slice(PREFIX.length);
        const objectType = parts[1]?.trim() || undefined;
        vars.push({ name: key.slice(PREFIX.length), prompt, objectType });
    }
    return vars;
}
export function listTemplates() {
    const dir = getTemplatesDir();
    if (!existsSync(dir))
        return [];
    const files = readdirSync(dir).filter(f => f.endsWith('.md')).sort();
    return files.map(f => ({ name: f.replace(/\.md$/, ''), path: join(dir, f) }));
}
export async function performTemplateExport(token, modelId, modelName, templatePath, outputDir, variables, onProgress) {
    const templateContent = readFileSync(templatePath, 'utf-8');
    const { body, templateFields } = parseFrontmatter(templateContent);
    // Inject auto variables
    const vars = { model_name: modelName, model_id: modelId, ...variables };
    onProgress?.({ phase: 'Fetching objects...' });
    const [objects, relationships] = await Promise.all([
        fetchObjects(token, modelId),
        fetchAllRelationships(token, modelId),
    ]);
    const objectsById = new Map();
    for (let i = 0; i < objects.length; i++) {
        onProgress?.({ phase: 'Fetching object details...', current: i + 1, total: objects.length });
        try {
            const detail = await fetchObjectDetail(token, objects[i].ObjectId);
            const descAttr = detail.AttributeValues.find((a) => a.AttributeName === 'Description');
            const description = descAttr?.StringValue ?? descAttr?.Value ?? '';
            objectsById.set(detail.ObjectId, {
                description,
                id: detail.ObjectId,
                name: normalizeName(detail.Name),
                type: detail.ObjectType.Name,
            });
        }
        catch {
            // Skip objects that fail to fetch details
            objectsById.set(objects[i].ObjectId, {
                description: '',
                id: objects[i].ObjectId,
                name: normalizeName(objects[i].Name),
                type: objects[i].ObjectType.Name,
            });
        }
    }
    onProgress?.({ phase: 'Processing template...' });
    const scopeOverride = parseScopeOverrides(templateFields);
    const assetAbsDir = join(outputDir, 'assets');
    const assetRelPath = relative(outputDir, assetAbsDir).replace(/\\/g, '/');
    // Interpolate variables in the body
    const interpolatedBody = interpolateVariables(body, vars);
    const bodyLines = interpolatedBody.split(/\r?\n/);
    const outputLines = [];
    for (let i = 0; i < bodyLines.length; i++) {
        const trimmed = bodyLines[i].trim();
        // New BEGIN/END format
        const beginMatch = BEGIN_RE.exec(trimmed);
        if (beginMatch) {
            const attrStr = beginMatch[1];
            const attrs = parseAttrs(attrStr);
            const tagType = attrs['type'] === 'diagram' ? 'ORBUS-DIAGRAM' : 'ORBUS-TABLE';
            const content = processTag(tagType, attrStr, relationships, objectsById, scopeOverride, assetRelPath, assetAbsDir);
            outputLines.push(bodyLines[i]); // preserve BEGIN marker
            outputLines.push(content);
            // Skip existing content until END marker
            while (i + 1 < bodyLines.length && !END_RE.test(bodyLines[i + 1].trim()))
                i++;
            if (i + 1 < bodyLines.length) {
                i++;
                outputLines.push(bodyLines[i]);
            } // preserve END marker
            continue;
        }
        // Legacy one-line format → convert to BEGIN/END
        const legacyMatch = LEGACY_RE.exec(trimmed);
        if (legacyMatch) {
            const tagType = legacyMatch[1];
            const attrStr = legacyMatch[2];
            const content = processTag(tagType, attrStr, relationships, objectsById, scopeOverride, assetRelPath, assetAbsDir);
            const beginTag = tagType === 'ORBUS-DIAGRAM'
                ? `<!-- ORBUS:BEGIN type="diagram" ${attrStr} -->`
                : `<!-- ORBUS:BEGIN ${attrStr} -->`;
            outputLines.push(beginTag);
            outputLines.push(content);
            outputLines.push('<!-- ORBUS:END -->');
            continue;
        }
        outputLines.push(bodyLines[i]);
    }
    const user = getUser();
    const now = new Date();
    const templateName = templatePath.split('/').pop()?.replace(/\.md$/, '') ?? 'template';
    const fmLines = [
        '---',
        `model: "${modelName}"`,
        `model-id: ${modelId}`,
        `generated-by: "${user?.name ?? 'unknown'}"`,
        `generated-at: ${now.toISOString()}`,
        `template: ${templateName}`,
        `orbusctl-version: ${VERSION}`,
        `format: template`,
    ];
    for (const [key, value] of Object.entries(templateFields)) {
        fmLines.push(`${key}: "${value}"`);
    }
    fmLines.push('---', '');
    if (!existsSync(outputDir))
        mkdirSync(outputDir, { recursive: true });
    const filePath = join(outputDir, `${sanitizeName(modelName)}_${formatTimestamp(now)}.md`);
    writeFileSync(filePath, fmLines.join('\n') + outputLines.join('\n'), 'utf-8');
    return { filePath, objectCount: objects.length, relationshipCount: relationships.length };
}
