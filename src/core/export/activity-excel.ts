import ExcelJS from 'exceljs';
import { join } from 'node:path';
import type { ModelActivity } from '../domain/activity.js';
import { getExportsDir } from '../config.js';

export interface ActivityExportResult {
  filePath: string;
  modelCount: number;
  entryCount: number;
}

export interface ActivityExportProgress {
  phase: string;
  current?: number;
  total?: number;
}

export interface ActivityReport {
  models: ModelActivity[];
  label: string;
  since: Date;
  until: Date;
  totalCreated: number;
  totalModified: number;
  totalObjects: number;
  totalRels: number;
}

function styleHeader(ws: ExcelJS.Worksheet): void {
  const row = ws.getRow(1);
  row.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2B5797' } };
}

function sheetName(name: string): string {
  return name.replace(/[\\/?*[\]:]/g, '-').slice(0, 31);
}

function uniqueUsers(model: ModelActivity): string {
  return [...new Set(model.users.map(u => u.userName))].join(', ');
}

export async function performActivityExcelExport(
  report: ActivityReport,
  onProgress?: (p: ActivityExportProgress) => void,
): Promise<ActivityExportResult> {
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

  for (let i = 0; i < report.models.length; i++) {
    const m = report.models[i];
    onProgress?.({ phase: 'Writing details...', current: i + 1, total: report.models.length });

    const ws = wb.addWorksheet(sheetName(m.modelName));
    ws.columns = [
      { header: 'Action', width: 10 },
      { header: 'Name', width: 35 },
      { header: 'Type', width: 25 },
      { header: 'User', width: 25 },
      { header: 'Date', width: 22 },
    ];

    const objectRows: [string, string, string, string, string][] = [];
    const relRows: [string, string, string, string, string][] = [];

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
