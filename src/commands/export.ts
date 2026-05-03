import {existsSync, mkdirSync} from 'node:fs'
import {join} from 'node:path'

import {Command, Flags} from '@oclif/core'
import ExcelJS from 'exceljs'

import {type DrawingComponent, type Model, type ObjectDetail, fetchAllRelationships, fetchDocumentTypes, fetchDrawingComponents, fetchDrawings, fetchModels, fetchObjectDetail, fetchObjects} from '../api'
import {logError} from '../log'
import {getExportsDir, getShowHiddenModels, getSolutionFilter, getToken} from '../config'
import {resolveMatch} from '../utils/resolve'

const SYSTEM_ATTRS = new Set([
  'Created By',
  'Date Created',
  'Date Last Modified',
  'Description',
  'iServer365 Id',
  'Last Modified By',
  'Metamodel Item Id',
  'Metamodel Item Name',
  'Name',
])

const REL_SUPPRESS = new Set([
  ...SYSTEM_ATTRS,
  'Lead Object',          // = From
  'Lead Model Item Id',   // = From iServer365 Id
  'Member Object',        // = To
  'Member Model Item Id', // = To iServer365 Id
  'Relationship',         // = Relationship Type (short form)
])

function sanitizeName(name: string): string {
  return name.replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_+|_+$/g, '')
}

function formatTimestamp(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}-${p(d.getHours())}-${p(d.getMinutes())}`
}

function formatDate(s: string): string {
  const d = new Date(s)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`
}

function styleHeader(ws: ExcelJS.Worksheet): void {
  const row = ws.getRow(1)
  row.font = {bold: true}
  row.fill = {type: 'pattern', pattern: 'solid', fgColor: {argb: 'FFD9D9D9'}}
  row.commit()
}

// Excel sheet names: max 31 chars, cannot contain \ / ? * [ ] :
function makeDrawSheetName(drawingName: string, used: Set<string>): string {
  const safe = drawingName.replace(/[\\/?*[\]:]/g, '-').trim()
  const base = `DRAW - ${safe}`
  let candidate = base.slice(0, 31)
  if (!used.has(candidate)) { used.add(candidate); return candidate }
  for (let i = 2; ; i++) {
    const suffix = ` ${i}`
    candidate = base.slice(0, 31 - suffix.length) + suffix
    if (!used.has(candidate)) { used.add(candidate); return candidate }
  }
}

function getIserverId(detail: ObjectDetail): string {
  const attr = detail.AttributeValues.find((a) => a.AttributeName === 'iServer365 Id')
  return (attr?.StringValue ?? attr?.Value as string | undefined) ?? detail.ObjectId
}

function addObjectListSheet(
  wb: ExcelJS.Workbook,
  sheetName: string,
  rows: ObjectDetail[],
): void {
  const ws = wb.addWorksheet(sheetName)
  ws.columns = [
    {header: 'Name', key: 'Name', width: 40},
    {header: 'iServer365 Id', key: 'id', width: 38},
    {header: 'Type', key: 'type', width: 30},
  ]
  styleHeader(ws)
  const sorted = [...rows].sort((a, b) =>
    a.ObjectType.Name.localeCompare(b.ObjectType.Name) || a.Name.localeCompare(b.Name),
  )
  for (const obj of sorted) {
    ws.addRow({Name: obj.Name, id: getIserverId(obj), type: obj.ObjectType.Name})
  }
}

export interface ExportResult {
  drawings: number
  filePath: string
  objects: number
  relationships: number
}

export async function performExport(
  token: string,
  model: Model,
  details: boolean,
  outputDir: string,
  onProgress?: (current: number, total: number) => void,
): Promise<ExportResult> {
  const objects = await fetchObjects(token, model.ModelId)
  const relationships = await fetchAllRelationships(token, model.ModelId)

  const [docTypes, drawings] = await Promise.all([
    fetchDocumentTypes(token),
    fetchDrawings(token, model.ModelId),
  ])
  const typeMap = new Map(docTypes.map((t) => [t.DocumentTypeId, t.Name]))

  // Store full component arrays — counts are derived from .length
  const drawingComponentsMap = new Map<string, DrawingComponent[]>()
  await Promise.all(
    drawings.map(async (d) => {
      try {
        drawingComponentsMap.set(d.DocumentId, await fetchDrawingComponents(token, d.DocumentId))
      } catch (error) {
        logError({error: error instanceof Error ? error.message : String(error), stack: error instanceof Error ? error.stack : undefined, context: 'export drawing components'})
        drawingComponentsMap.set(d.DocumentId, [])
      }
    }),
  )

  const wb = new ExcelJS.Workbook()

  // --- Objects sheet ---
  const wsObjects = wb.addWorksheet('Objects')

  if (!details) {
    wsObjects.columns = [
      {header: 'Name', key: 'Name', width: 40},
      {header: 'iServer365 Id', key: 'iServer365 Id', width: 38},
      {header: 'Type', key: 'Type', width: 30},
    ]
    styleHeader(wsObjects)
    for (const obj of objects) {
      wsObjects.addRow({'Name': obj.Name, 'iServer365 Id': obj.ObjectId, 'Type': obj.ObjectType.Name})
    }
  } else {
    const FIXED_COLS = [
      'Name', 'iServer365 Id', 'Type', 'Description', 'Status', 'Version',
      'Created By', 'Date Created', 'Last Modified By', 'Last Modified Date',
      'Locked By', 'Locked On',
    ]
    const COL_WIDTHS: Record<string, number> = {
      'Name': 40, 'iServer365 Id': 38, 'Type': 30, 'Description': 50,
      'Status': 12, 'Version': 10, 'Created By': 25, 'Date Created': 18,
      'Last Modified By': 25, 'Last Modified Date': 18, 'Locked By': 25, 'Locked On': 18,
    }

    const objectDetails: ObjectDetail[] = []
    const allCustomAttrs = new Set<string>()
    for (let i = 0; i < objects.length; i++) {
      onProgress?.(i + 1, objects.length)
      const detail = await fetchObjectDetail(token, objects[i].ObjectId)
      objectDetails.push(detail)
      for (const attr of detail.AttributeValues) {
        if (!SYSTEM_ATTRS.has(attr.AttributeName)) allCustomAttrs.add(attr.AttributeName)
      }
    }

    const customCols = [...allCustomAttrs].sort()
    wsObjects.columns = [...FIXED_COLS, ...customCols].map((h) => ({header: h, key: h, width: COL_WIDTHS[h] ?? 25}))
    styleHeader(wsObjects)

    for (const detail of objectDetails) {
      const descAttr = detail.AttributeValues.find((a) => a.AttributeName === 'Description')
      const row: Record<string, string | number | null> = {
        'Name': detail.Name,
        'iServer365 Id': getIserverId(detail),
        'Type': detail.ObjectType.Name,
        'Description': descAttr?.StringValue ?? (descAttr?.Value as string | null) ?? '',
        'Status': detail.Detail.Status,
        'Version': detail.Detail.CurrentVersionNumber,
        'Created By': detail.CreatedBy.Name,
        'Date Created': formatDate(detail.DateCreated),
        'Last Modified By': detail.LastModifiedBy.Name,
        'Last Modified Date': formatDate(detail.LastModifiedDate),
        'Locked By': detail.LockedBy?.Name ?? '',
        'Locked On': detail.LockedOn ? formatDate(detail.LockedOn) : '',
      }
      for (const attrName of customCols) {
        const attr = detail.AttributeValues.find((a) => a.AttributeName === attrName)
        row[attrName] = attr ? (attr.StringValue ?? String(attr.Value ?? '')) : ''
      }
      wsObjects.addRow(row)
    }

    // --- Per-drawing sheets and audit data (full details mode only) ---
    const objectById = new Map(objectDetails.map((d) => [d.ObjectId, d]))

    // Seed with reserved sheet names so drawing names never collide with them
    const usedSheetNames = new Set(['Objects', 'Relationships', 'Drawings', 'Audit - No Diagram', 'Audit - No Relationship'])

    const objectsInDiagrams = new Set<string>()
    const objectsWithRelationship = new Set<string>()

    for (const rel of relationships) {
      if (rel.LeadObject?.ObjectId) objectsWithRelationship.add(rel.LeadObject.ObjectId)
      if (rel.MemberObject?.ObjectId) objectsWithRelationship.add(rel.MemberObject.ObjectId)
    }

    for (const d of [...drawings].sort((a, b) => a.FileName.localeCompare(b.FileName))) {
      const components = drawingComponentsMap.get(d.DocumentId) ?? []
      const objComponents = components.filter((c) => !c.isRelationship)

      for (const c of objComponents) {
        if (objectById.has(c.ModelItemId)) objectsInDiagrams.add(c.ModelItemId)
      }

      const knownObjComponents = objComponents.map((c) => objectById.get(c.ModelItemId)).filter((o): o is ObjectDetail => o !== undefined)
      if (knownObjComponents.length > 0) {
        addObjectListSheet(wb, makeDrawSheetName(d.FileName, usedSheetNames), knownObjComponents)
      }
    }

    // --- Audit sheets ---
    const noDiagram = objectDetails.filter((o) => !objectsInDiagrams.has(o.ObjectId))
    const noRelationship = objectDetails.filter((o) => !objectsWithRelationship.has(o.ObjectId))

    addObjectListSheet(wb, 'Audit - No Diagram', noDiagram)
    addObjectListSheet(wb, 'Audit - No Relationship', noRelationship)
  }

  // --- Relationships sheet ---
  const REL_FIXED_COLS = [
    'iServer365 Id', 'Relationship Type',
    'From', 'From iServer365 Id', 'From Type',
    'To', 'To iServer365 Id', 'To Type',
    'Created By', 'Date Created',
  ]
  const REL_COL_WIDTHS: Record<string, number> = {
    'iServer365 Id': 38, 'Relationship Type': 30,
    'From': 40, 'From iServer365 Id': 38, 'From Type': 30,
    'To': 40, 'To iServer365 Id': 38, 'To Type': 30,
    'Created By': 25, 'Date Created': 18,
  }

  const relCustomAttrs = new Set<string>()
  for (const rel of relationships) {
    for (const attr of rel.AttributeValues ?? []) {
      if (!REL_SUPPRESS.has(attr.AttributeName)) relCustomAttrs.add(attr.AttributeName)
    }
  }
  const relCustomCols = [...relCustomAttrs].sort()

  const wsRel = wb.addWorksheet('Relationships')
  wsRel.columns = [...REL_FIXED_COLS, ...relCustomCols].map((h) => ({
    header: h, key: h, width: REL_COL_WIDTHS[h] ?? 25,
  }))
  styleHeader(wsRel)

  for (const rel of relationships) {
    const idAttr = rel.AttributeValues?.find((a) => a.AttributeName === 'iServer365 Id')
    const row: Record<string, string | number | null> = {
      'iServer365 Id': idAttr?.StringValue ?? idAttr?.Value as string | undefined ?? rel.RelationshipId,
      'Relationship Type': rel.RelationshipType?.Name ?? '',
      'From': rel.LeadObject?.Name ?? '',
      'From iServer365 Id': rel.LeadObject?.ObjectId ?? '',
      'From Type': rel.LeadObject?.ObjectType?.Name ?? '',
      'To': rel.MemberObject?.Name ?? '',
      'To iServer365 Id': rel.MemberObject?.ObjectId ?? '',
      'To Type': rel.MemberObject?.ObjectType?.Name ?? '',
      'Created By': rel.CreatedBy?.Name ?? '',
      'Date Created': formatDate(rel.DateCreated),
    }
    for (const attrName of relCustomCols) {
      const attr = rel.AttributeValues?.find((a) => a.AttributeName === attrName)
      row[attrName] = attr ? (attr.StringValue ?? String(attr.Value ?? '')) : ''
    }
    wsRel.addRow(row)
  }

  // --- Drawings summary sheet ---
  const wsDrawings = wb.addWorksheet('Drawings')
  wsDrawings.columns = [
    {header: 'Name', key: 'name', width: 40},
    {header: 'Type', key: 'type', width: 25},
    {header: 'Accessibility', key: 'accessibility', width: 20},
    {header: 'Components', key: 'components', width: 12},
  ]
  styleHeader(wsDrawings)
  for (const d of [...drawings].sort((a, b) => a.FileName.localeCompare(b.FileName))) {
    wsDrawings.addRow({
      name: d.FileName,
      type: typeMap.get(d.DocumentTypeId) ?? 'Unknown',
      accessibility: d.DocumentAccessibilityCategory ?? '—',
      components: (drawingComponentsMap.get(d.DocumentId) ?? []).length,
    })
  }

  if (!existsSync(outputDir)) mkdirSync(outputDir, {recursive: true})

  const filePath = join(outputDir, `${formatTimestamp(new Date())}-${sanitizeName(model.Name)}.xlsx`)
  await wb.xlsx.writeFile(filePath)
  return {drawings: drawings.length, filePath, objects: objects.length, relationships: relationships.length}
}

export default class Export extends Command {
  static description = 'Export model content (objects, relationships, drawings) to Excel'

  static enableJsonFlag = true

  static flags = {
    details: Flags.boolean({
      allowNo: true,
      default: true,
      description: 'Fetch full object attributes (use --no-details for fast name/id/type only)',
    }),
    model: Flags.string({char: 'm', description: 'Model name (or partial match)', required: true}),
    output: Flags.string({char: 'o', description: 'Output directory (default: ~/.orbusctl/exports/)'}),
  }

  async run(): Promise<Record<string, unknown>> {
    const {flags} = await this.parse(Export)
    const token = getToken()
    if (!token) this.error('No token configured. Run "orbusctl auth" first.')

    const filter = getSolutionFilter()
    const allModels = await fetchModels(token, filter)
    const showHidden = getShowHiddenModels()
    const models = showHidden ? allModels : allModels.filter((m) => !m.IsHidden)

    const match = resolveMatch(models, flags.model, (m) => m.Name, 'model', (msg) => this.error(msg))

    this.log(`Exporting "${match.Name}"...`)
    this.log('Fetching objects, relationships, and drawings...')

    const result = await performExport(
      token,
      match,
      flags.details,
      flags.output ?? getExportsDir(),
      (current, total) => process.stderr.write(`\r  Fetching object details (${current}/${total})...`),
    )

    if (flags.details) process.stderr.write('\n')
    this.log(`  ${result.objects} object(s), ${result.relationships} relationship(s), ${result.drawings} drawing(s).`)
    this.log()
    this.log(`Saved to ${result.filePath}`)

    return {
      drawings: result.drawings,
      file: result.filePath,
      model: {modelId: match.ModelId, name: match.Name},
      objects: result.objects,
      relationships: result.relationships,
    }
  }
}
