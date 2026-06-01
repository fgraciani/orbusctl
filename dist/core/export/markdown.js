import { join } from 'node:path';
import { writeFileSync } from 'node:fs';
import { fetchObjects, fetchObjectDetail, fetchAllRelationships } from '../api/objects.js';
import { fetchDrawings, fetchDocumentTypes } from '../api/drawings.js';
import { getExportsDir } from '../config.js';
import { VERSION } from '../../version.js';
function stripHtml(str) {
    if (!str)
        return '';
    return str.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim();
}
function cell(s) {
    return s.replace(/\|/g, '/').replace(/\n/g, ' ').slice(0, 200);
}
function truncate(s, max) {
    if (s.length <= max)
        return s;
    return s.slice(0, max) + ' [...]';
}
function fmtDate(iso) {
    return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}
function stripArchiMate(name) {
    return name.replace(/^ArchiMate:\s*/, '');
}
export async function performMarkdownExport(token, modelId, modelName, onProgress) {
    onProgress?.({ phase: 'Fetching objects...' });
    const objects = await fetchObjects(token, modelId);
    onProgress?.({ phase: 'Fetching relationships...' });
    const relationships = await fetchAllRelationships(token, modelId);
    onProgress?.({ phase: 'Fetching object details...' });
    const detailsById = new Map();
    for (let i = 0; i < objects.length; i++) {
        onProgress?.({ phase: 'Fetching object details...', current: i + 1, total: objects.length });
        const detail = await fetchObjectDetail(token, objects[i].ObjectId);
        detailsById.set(objects[i].ObjectId, detail);
    }
    onProgress?.({ phase: 'Fetching drawings...' });
    const [drawings, docTypes] = await Promise.all([
        fetchDrawings(token, modelId),
        fetchDocumentTypes(token),
    ]);
    const typeMap = new Map(docTypes.map(t => [t.DocumentTypeId, t.Name]));
    const lines = [];
    const now = new Date();
    // Frontmatter
    lines.push('---');
    lines.push(`model: "${modelName}"`);
    lines.push(`modelId: "${modelId}"`);
    lines.push(`date: "${now.toISOString()}"`);
    lines.push(`generator: orbusctl v${VERSION}`);
    lines.push('---');
    lines.push('');
    lines.push(`# ${modelName}`);
    lines.push('');
    lines.push(`Exported on ${fmtDate(now.toISOString())}`);
    lines.push('');
    // Drawings table
    if (drawings.length > 0) {
        lines.push('## Drawings');
        lines.push('');
        lines.push('| Name | Type | Accessibility |');
        lines.push('| --- | --- | --- |');
        for (const d of drawings.sort((a, b) => a.FileName.localeCompare(b.FileName))) {
            lines.push(`| ${cell(d.FileName)} | ${cell(typeMap.get(d.DocumentTypeId) ?? '')} | ${d.DocumentAccessibilityCategory ?? ''} |`);
        }
        lines.push('');
    }
    // Statistics
    const typeCounts = new Map();
    for (const obj of objects) {
        typeCounts.set(obj.ObjectType.Name, (typeCounts.get(obj.ObjectType.Name) ?? 0) + 1);
    }
    const relTypeCounts = new Map();
    for (const r of relationships) {
        const t = r.RelationshipType?.Name ?? 'Unknown';
        relTypeCounts.set(t, (relTypeCounts.get(t) ?? 0) + 1);
    }
    lines.push('## Statistics');
    lines.push('');
    lines.push(`**Objects:** ${objects.length}`);
    lines.push('');
    if (typeCounts.size > 0) {
        lines.push('| Type | Count |');
        lines.push('| --- | --- |');
        for (const [type, count] of [...typeCounts.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
            lines.push(`| ${type} | ${count} |`);
        }
        lines.push('');
    }
    lines.push(`**Relationships:** ${relationships.length}`);
    lines.push('');
    if (relTypeCounts.size > 0) {
        lines.push('| Type | Count |');
        lines.push('| --- | --- |');
        for (const [type, count] of [...relTypeCounts.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
            lines.push(`| ${stripArchiMate(type)} | ${count} |`);
        }
        lines.push('');
    }
    // Object catalog
    lines.push('## Objects');
    lines.push('');
    for (const obj of objects.sort((a, b) => a.ObjectType.Name.localeCompare(b.ObjectType.Name) || a.Name.localeCompare(b.Name))) {
        lines.push(`### ${obj.Name}`);
        lines.push('');
        lines.push(`**Type:** ${obj.ObjectType.Name} · **Modified:** ${fmtDate(obj.LastModifiedDate)}`);
        const detail = detailsById.get(obj.ObjectId);
        const desc = detail?.AttributeValues.find(a => a.AttributeName === 'Description')?.StringValue;
        if (desc) {
            const cleaned = stripHtml(desc);
            if (cleaned)
                lines.push(`\n${cleaned}`);
        }
        lines.push('');
    }
    // Relationships
    lines.push('## Relationships');
    lines.push('');
    lines.push('| Type | From | To | Created By | Date |');
    lines.push('| --- | --- | --- | --- | --- |');
    for (const r of relationships) {
        lines.push(`| ${stripArchiMate(r.RelationshipType?.Name ?? '')} | ${cell(r.LeadObject?.Name ?? '')} | ${cell(r.MemberObject?.Name ?? '')} | ${cell(r.CreatedBy.Name)} | ${fmtDate(r.DateCreated)} |`);
    }
    lines.push('');
    // Write file
    onProgress?.({ phase: 'Writing file...' });
    const datePart = now.toISOString().slice(0, 16).replace(/[T:]/g, '-');
    const safeName = modelName.replace(/[^a-zA-Z0-9]/g, '-').replace(/-+/g, '-');
    const fileName = `${datePart}-${safeName}.md`;
    const filePath = join(getExportsDir(), fileName);
    writeFileSync(filePath, lines.join('\n'));
    return { filePath, objectCount: objects.length, relationshipCount: relationships.length, drawingCount: drawings.length };
}
