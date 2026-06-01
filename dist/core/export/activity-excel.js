import ExcelJS from 'exceljs';
import { join } from 'node:path';
import { getExportsDir } from '../config.js';
function styleHeader(ws) {
    const row = ws.getRow(1);
    row.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2B5797' } };
}
function buildSheetNameMap(names) {
    const MAX = 31;
    function sanitizeAndFit(name) {
        const s = name.replace(/[\\/?*[\]:]/g, '-');
        if (s.length <= MAX)
            return s;
        const tail = 12;
        return s.slice(0, MAX - tail - 1) + '…' + s.slice(-tail);
    }
    const seen = new Map();
    const pairs = names.map(n => {
        const c = sanitizeAndFit(n);
        seen.set(c, (seen.get(c) ?? 0) + 1);
        return [n, c];
    });
    const counters = new Map();
    const result = new Map();
    for (const [name, candidate] of pairs) {
        if ((seen.get(candidate) ?? 0) > 1) {
            const idx = (counters.get(candidate) ?? 0) + 1;
            counters.set(candidate, idx);
            const suffix = `~${idx}`;
            result.set(name, candidate.slice(0, MAX - suffix.length) + suffix);
        }
        else {
            result.set(name, candidate);
        }
    }
    return result;
}
function uniqueUsers(model) {
    return [...new Set(model.users.map(u => u.userName))].join(', ');
}
export async function performActivityExcelExport(report, onProgress) {
    const wb = new ExcelJS.Workbook();
    onProgress?.({ phase: 'Building summary...' });
    const wsSummary = wb.addWorksheet('Summary');
    wsSummary.columns = [
        { header: 'Model', width: 35 },
        { header: 'Objects Created', width: 16 },
        { header: 'Objects Modified', width: 17 },
        { header: 'Relationships Created', width: 22 },
        { header: 'Users', width: 40 },
    ];
    const sortedModels = [...report.models].sort((a, b) => a.modelName.localeCompare(b.modelName));
    for (const m of sortedModels) {
        const created = m.users.reduce((n, u) => n + u.created.length, 0);
        const modified = m.users.reduce((n, u) => n + u.modified.length, 0);
        const rels = m.users.reduce((n, u) => n + u.relsCreated, 0);
        wsSummary.addRow([m.modelName, created, modified, rels, uniqueUsers(m)]);
    }
    styleHeader(wsSummary);
    let entryCount = 0;
    const sheetNames = buildSheetNameMap(report.models.map(m => m.modelName));
    for (let i = 0; i < report.models.length; i++) {
        const m = report.models[i];
        onProgress?.({ phase: 'Writing details...', current: i + 1, total: report.models.length });
        const ws = wb.addWorksheet(sheetNames.get(m.modelName));
        ws.columns = [
            { header: 'Action', width: 10 },
            { header: 'Name', width: 35 },
            { header: 'Type', width: 25 },
            { header: 'User', width: 25 },
            { header: 'Date', width: 22 },
        ];
        const objectRows = [];
        const relRows = [];
        for (const u of m.users) {
            for (const obj of u.created) {
                objectRows.push(['Created', obj.Name, obj.ObjectType.Name, u.userName, obj.DateCreated]);
            }
            for (const obj of u.modified) {
                objectRows.push(['Modified', obj.Name, obj.ObjectType.Name, u.userName, obj.LastModifiedDate]);
            }
            for (const rel of u.relationships) {
                relRows.push(['Created', rel.RelationshipId, 'Relationship', u.userName, rel.DateCreated]);
            }
        }
        objectRows.sort((a, b) => a[2].localeCompare(b[2]) || a[1].localeCompare(b[1]));
        relRows.sort((a, b) => b[4].localeCompare(a[4]));
        for (const row of [...objectRows, ...relRows]) {
            ws.addRow(row);
            entryCount++;
        }
        styleHeader(ws);
    }
    onProgress?.({ phase: 'Writing file...' });
    const now = new Date();
    const datePart = now.toISOString().slice(0, 16).replace(/[T:]/g, '-');
    const safeLabel = report.label.replace(/[^a-zA-Z0-9]/g, '-').replace(/-+/g, '-');
    const filePath = join(getExportsDir(), `${datePart}-activity-${safeLabel}.xlsx`);
    await wb.xlsx.writeFile(filePath);
    return { filePath, modelCount: report.models.length, entryCount };
}
