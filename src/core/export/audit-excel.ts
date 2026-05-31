import ExcelJS from 'exceljs';
import { join } from 'node:path';
import type { AuditSummary } from '../domain/audit.js';
import { getExportsDir } from '../config.js';

export interface AuditExportResult {
  filePath: string;
  modelCount: number;
  issueCount: number;
}

export interface AuditExportProgress {
  phase: string;
  current?: number;
  total?: number;
}

const ISSUE_LABELS: Record<string, string> = {
  'empty-description': 'Empty description',
  'html-in-name': 'HTML in name',
  'html-in-description': 'HTML in description',
  'no-relationships': 'No relationships',
  'not-in-diagram': 'Not in any diagram',
};

function styleHeader(ws: ExcelJS.Worksheet): void {
  const row = ws.getRow(1);
  row.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2B5797' } };
}

function sheetName(name: string): string {
  return name.replace(/[\\/?*[\]:]/g, '-').slice(0, 31);
}

function addIssueSheet(wb: ExcelJS.Workbook, summary: AuditSummary): void {
  const ws = wb.addWorksheet(sheetName(summary.modelName));
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

export async function performAuditExcelExport(
  summaries: AuditSummary[],
  onProgress?: (p: AuditExportProgress) => void,
): Promise<AuditExportResult> {
  const wb = new ExcelJS.Workbook();

  if (summaries.length === 1) {
    onProgress?.({ phase: 'Writing sheet...' });
    addIssueSheet(wb, summaries[0]);
  } else {
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
      addIssueSheet(wb, summaries[i]);
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
