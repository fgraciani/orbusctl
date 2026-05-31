import ExcelJS from 'exceljs';
import { join } from 'node:path';
import { fetchObjects, fetchObjectDetail, fetchAllRelationships, type OrbusObject, type ObjectDetail, type ExportRelationship } from '../api/objects.js';
import { fetchDrawings, fetchDocumentTypes, type Drawing, type DocumentType } from '../api/drawings.js';
import { getExportsDir } from '../config.js';

export interface ExcelExportResult {
  filePath: string;
  objectCount: number;
  relationshipCount: number;
  drawingCount: number;
}

export interface ExportProgress {
  phase: string;
  current?: number;
  total?: number;
}

const SYSTEM_ATTRS = new Set(['Name', 'Description', 'Type', 'Created By', 'Date Created', 'Last Modified By', 'Date Last Modified', 'Metamodel Item Id', 'Metamodel Item Name', 'iServer365 Id']);

const SYSTEM_REL_ATTRS = new Set([
  'Created By', 'Date Created', 'Date Last Modified', 'Last Modified By',
  'Lead Model Item Id', 'Lead Object', 'Member Model Item Id', 'Member Object',
  'Metamodel Item Id', 'Metamodel Item Name', 'Relationship', 'iServer365 Id',
]);

function styleHeader(ws: ExcelJS.Worksheet): void {
  const row = ws.getRow(1);
  row.font = { bold: true };
  row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2B5797' } };
  row.font = { bold: true, color: { argb: 'FFFFFFFF' } };
}

function stripHtml(str: string | null): string {
  if (!str) return '';
  return str.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim();
}

export async function performExcelExport(
  token: string,
  modelId: string,
  modelName: string,
  fetchDetails: boolean,
  onProgress?: (p: ExportProgress) => void,
): Promise<ExcelExportResult> {
  onProgress?.({ phase: 'Fetching objects...' });
  const objects = await fetchObjects(token, modelId);

  onProgress?.({ phase: 'Fetching relationships...' });
  const relationships = await fetchAllRelationships(token, modelId);

  onProgress?.({ phase: 'Fetching drawings...' });
  const [drawings, docTypes] = await Promise.all([
    fetchDrawings(token, modelId),
    fetchDocumentTypes(token),
  ]);
  const typeMap = new Map(docTypes.map(t => [t.DocumentTypeId, t.Name]));

  // Fetch object details if requested
  let details: Map<string, ObjectDetail> | null = null;
  if (fetchDetails && objects.length > 0) {
    details = new Map();
    for (let i = 0; i < objects.length; i++) {
      onProgress?.({ phase: 'Fetching object details...', current: i + 1, total: objects.length });
      try {
        const d = await fetchObjectDetail(token, objects[i].ObjectId);
        details.set(objects[i].ObjectId, d);
      } catch {}
    }
  }

  const wb = new ExcelJS.Workbook();

  // Objects sheet
  const wsObj = wb.addWorksheet('Objects');
  if (details) {
    // Collect all custom attribute names
    const attrNames = new Set<string>();
    for (const d of details.values()) {
      for (const a of d.AttributeValues) {
        if (!SYSTEM_ATTRS.has(a.AttributeName) && a.StringValue) attrNames.add(a.AttributeName);
      }
    }
    const sortedAttrs = [...attrNames].sort();

    wsObj.columns = [
      { header: 'Name', width: 30 },
      { header: 'iServer365 Id', width: 38 },
      { header: 'Type', width: 25 },
      { header: 'Description', width: 40 },
      { header: 'Status', width: 12 },
      { header: 'Version', width: 8 },
      { header: 'Created By', width: 25 },
      { header: 'Date Created', width: 20 },
      { header: 'Last Modified By', width: 25 },
      { header: 'Last Modified Date', width: 20 },
      ...sortedAttrs.map(n => ({ header: n, width: 20 })),
    ];

    for (const obj of objects.sort((a, b) => a.ObjectType.Name.localeCompare(b.ObjectType.Name) || a.Name.localeCompare(b.Name))) {
      const d = details.get(obj.ObjectId);
      const desc = d?.AttributeValues.find(a => a.AttributeName === 'Description')?.StringValue;
      const row: (string | number)[] = [
        obj.Name,
        obj.ObjectId,
        obj.ObjectType.Name,
        stripHtml(desc ?? null),
        d?.Detail.Status ?? '',
        d?.Detail.CurrentVersionNumber ?? '',
        d?.CreatedBy.Name ?? '',
        d?.DateCreated ?? '',
        d?.LastModifiedBy.Name ?? '',
        d?.LastModifiedDate ?? '',
      ];
      for (const attrName of sortedAttrs) {
        const val = d?.AttributeValues.find(a => a.AttributeName === attrName)?.StringValue;
        row.push(stripHtml(val ?? null));
      }
      wsObj.addRow(row);
    }
  } else {
    wsObj.columns = [
      { header: 'Name', width: 30 },
      { header: 'iServer365 Id', width: 38 },
      { header: 'Type', width: 25 },
    ];
    for (const obj of objects.sort((a, b) => a.Name.localeCompare(b.Name))) {
      wsObj.addRow([obj.Name, obj.ObjectId, obj.ObjectType.Name]);
    }
  }
  styleHeader(wsObj);

  // Relationships sheet — with attribute columns
  const relAttrNames = new Set<string>();
  for (const r of relationships) {
    for (const a of r.AttributeValues ?? []) {
      if (a.StringValue && !SYSTEM_REL_ATTRS.has(a.AttributeName)) relAttrNames.add(a.AttributeName);
    }
  }
  const sortedRelAttrs = [...relAttrNames].sort();

  const wsRel = wb.addWorksheet('Relationships');
  wsRel.columns = [
    { header: 'Type', width: 25 },
    { header: 'From', width: 30 },
    { header: 'From Type', width: 25 },
    { header: 'To', width: 30 },
    { header: 'To Type', width: 25 },
    { header: 'Created By', width: 25 },
    { header: 'Date Created', width: 20 },
    ...sortedRelAttrs.map(n => ({ header: n, width: 20 })),
  ];
  for (const r of relationships) {
    const row: (string | number)[] = [
      r.RelationshipType?.Name ?? '',
      r.LeadObject?.Name ?? '',
      r.LeadObject?.ObjectType?.Name ?? '',
      r.MemberObject?.Name ?? '',
      r.MemberObject?.ObjectType?.Name ?? '',
      r.CreatedBy.Name,
      r.DateCreated,
    ];
    for (const attrName of sortedRelAttrs) {
      const val = (r.AttributeValues ?? []).find(a => a.AttributeName === attrName)?.StringValue;
      row.push(stripHtml(val ?? null));
    }
    wsRel.addRow(row);
  }
  styleHeader(wsRel);

  // Drawings sheet
  const wsDraw = wb.addWorksheet('Drawings');
  wsDraw.columns = [
    { header: 'Name', width: 40 },
    { header: 'Type', width: 30 },
    { header: 'Accessibility', width: 15 },
  ];
  for (const d of drawings.sort((a, b) => a.FileName.localeCompare(b.FileName))) {
    wsDraw.addRow([d.FileName, typeMap.get(d.DocumentTypeId) ?? '', d.DocumentAccessibilityCategory ?? '']);
  }
  styleHeader(wsDraw);

  // Save
  onProgress?.({ phase: 'Writing file...' });
  const now = new Date();
  const datePart = now.toISOString().slice(0, 16).replace(/[T:]/g, '-');
  const safeName = modelName.replace(/[^a-zA-Z0-9]/g, '-').replace(/-+/g, '-');
  const fileName = `${datePart}-${safeName}.xlsx`;
  const filePath = join(getExportsDir(), fileName);
  await wb.xlsx.writeFile(filePath);

  return { filePath, objectCount: objects.length, relationshipCount: relationships.length, drawingCount: drawings.length };
}
