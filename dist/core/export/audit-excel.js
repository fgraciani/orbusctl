import ExcelJS from 'exceljs';
import { join } from 'node:path';
import { getExportsDir } from '../config.js';
const ISSUE_LABELS = {
    'empty-description': 'Empty description',
    'html-in-name': 'HTML in name',
    'html-in-description': 'HTML in description',
    'no-relationships': 'No relationships',
    'not-in-diagram': 'Not in any diagram',
};
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
function addIssueSheet(wb, summary, tabName) {
    const ws = wb.addWorksheet(tabName);
    ws.columns = [
        { header: 'Object Name', width: 35 },
        { header: 'Object Type', width: 25 },
        { header: 'Issue Type', width: 25 },
        { header: 'Detail', width: 30 },
        { header: 'Last Modified By', width: 25 },
        { header: 'Last Modified Date', width: 20 },
    ];
    for (const issue of summary.issues.sort((a, b) => a.issueType.localeCompare(b.issueType) || a.objectName.localeCompare(b.objectName))) {
        ws.addRow([
            issue.objectName,
            issue.objectType,
            ISSUE_LABELS[issue.issueType] ?? issue.issueType,
            issue.detail,
            issue.lastModifiedBy,
            issue.lastModifiedDate,
        ]);
    }
    styleHeader(ws);
}
export async function performAuditExcelExport(summaries, onProgress) {
    const wb = new ExcelJS.Workbook();
    const sheetNames = buildSheetNameMap(summaries.map(s => s.modelName));
    if (summaries.length === 1) {
        onProgress?.({ phase: 'Writing sheet...' });
        addIssueSheet(wb, summaries[0], sheetNames.get(summaries[0].modelName));
    }
    else {
        onProgress?.({ phase: 'Building summary...' });
        const wsSummary = wb.addWorksheet('Summary');
        wsSummary.columns = [
            { header: 'Model', width: 35 },
            { header: 'Total Objects', width: 14 },
            { header: 'Total Relationships', width: 20 },
            { header: 'Total Drawings', width: 15 },
            { header: 'Total Issues', width: 13 },
            { header: 'Empty Description', width: 18 },
            { header: 'HTML in Name', width: 14 },
            { header: 'HTML in Description', width: 20 },
            { header: 'No Relationships', width: 17 },
            { header: 'Not in Diagram', width: 15 },
        ];
        for (const s of summaries.sort((a, b) => a.modelName.localeCompare(b.modelName))) {
            wsSummary.addRow([
                s.modelName,
                s.totalObjects,
                s.totalRelationships,
                s.totalDrawings,
                s.totalIssues,
                s.issuesByType['empty-description'] ?? 0,
                s.issuesByType['html-in-name'] ?? 0,
                s.issuesByType['html-in-description'] ?? 0,
                s.issuesByType['no-relationships'] ?? 0,
                s.issuesByType['not-in-diagram'] ?? 0,
            ]);
        }
        styleHeader(wsSummary);
        for (let i = 0; i < summaries.length; i++) {
            onProgress?.({ phase: `Writing ${summaries[i].modelName}...`, current: i + 1, total: summaries.length });
            addIssueSheet(wb, summaries[i], sheetNames.get(summaries[i].modelName));
        }
    }
    onProgress?.({ phase: 'Writing file...' });
    const now = new Date();
    const datePart = now.toISOString().slice(0, 16).replace(/[T:]/g, '-');
    const safeName = summaries.length === 1
        ? summaries[0].modelName.replace(/[^a-zA-Z0-9]/g, '-').replace(/-+/g, '-')
        : 'all';
    const filePath = join(getExportsDir(), `${datePart}-audit-${safeName}.xlsx`);
    await wb.xlsx.writeFile(filePath);
    const issueCount = summaries.reduce((n, s) => n + s.totalIssues, 0);
    return { filePath, modelCount: summaries.length, issueCount };
}
