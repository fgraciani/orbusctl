import {existsSync, mkdirSync, writeFileSync} from 'node:fs'
import {join} from 'node:path'

import {type DrawingComponent, type ExportRelationship, type Model, type ObjectDetail, fetchAllRelationships, fetchDocumentTypes, fetchDrawingComponents, fetchDrawings, fetchObjectDetail, fetchObjects} from './api'
import {getUser} from './config'
import {logError} from './log'
import {getLocalVersion} from './update'

export interface MarkdownExportResult {
  drawings: number
  filePath: string
  objects: number
  relationships: number
}

function sanitizeName(name: string): string {
  return name.replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_+|_+$/g, '')
}

function formatTimestamp(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}-${p(d.getHours())}-${p(d.getMinutes())}`
}

function cell(s: string): string {
  const sanitized = s.replace(/\|/g, '/').replace(/[\r\n]+/g, ' ').trim()
  if (sanitized.length <= 200) return sanitized
  return sanitized.slice(0, 200) + ' [...]'
}

function headerCell(s: string): string {
  const sanitized = s.replace(/\|/g, '/')
  return sanitized.length > 25 ? sanitized.slice(0, 22) + '...' : sanitized
}

function stripArchiMate(typeName: string): string {
  return typeName.startsWith('ArchiMate: ') ? typeName.slice(11) : typeName
}

export async function performMarkdownExport(
  token: string,
  model: Model,
  outputDir: string,
  onProgress?: (current: number, total: number) => void,
): Promise<MarkdownExportResult> {
  const [objects, relationships, drawings, docTypes] = await Promise.all([
    fetchObjects(token, model.ModelId),
    fetchAllRelationships(token, model.ModelId),
    fetchDrawings(token, model.ModelId),
    fetchDocumentTypes(token),
  ])

  const typeMap = new Map(docTypes.map((t) => [t.DocumentTypeId, t.Name]))
  const relMap = new Map<string, ExportRelationship>(relationships.map((r) => [r.RelationshipId, r]))

  const objectDetails: ObjectDetail[] = []
  for (let i = 0; i < objects.length; i++) {
    onProgress?.(i + 1, objects.length)
    objectDetails.push(await fetchObjectDetail(token, objects[i].ObjectId))
  }

  process.stderr.write('\n  Enriching diagram components...\n')

  interface ObjInfo { description: string; name: string; type: string }
  const objectMap = new Map<string, ObjInfo>(
    objectDetails.map((d) => {
      const descAttr = d.AttributeValues.find((a) => a.AttributeName === 'Description')
      const description = descAttr?.StringValue ?? (descAttr?.Value as string | undefined) ?? ''
      return [d.ObjectId, {description, name: d.Name, type: d.ObjectType.Name}]
    }),
  )

  const drawingComponentsMap = new Map<string, DrawingComponent[]>()
  await Promise.all(
    drawings.map(async (d) => {
      try {
        drawingComponentsMap.set(d.DocumentId, await fetchDrawingComponents(token, d.DocumentId))
      } catch (error) {
        logError({context: 'markdown-export drawing components', error: error instanceof Error ? error.message : String(error), stack: error instanceof Error ? error.stack : undefined})
        drawingComponentsMap.set(d.DocumentId, [])
      }
    }),
  )

  const user = getUser()
  const version = getLocalVersion()
  const now = new Date()
  const sortedDrawings = [...drawings].sort((a, b) => a.FileName.localeCompare(b.FileName))
  const sortedObjectDetails = [...objectDetails].sort(
    (a, b) => a.ObjectType.Name.localeCompare(b.ObjectType.Name) || a.Name.localeCompare(b.Name),
  )

  const lines: string[] = []

  // Frontmatter
  lines.push('---')
  lines.push(`model: "${model.Name}"`)
  lines.push(`model-id: ${model.ModelId}`)
  lines.push(`exported-by: ${user?.name ?? 'unknown'}`)
  lines.push(`exported-at: ${now.toISOString()}`)
  lines.push(`orbusctl-version: ${version}`)
  lines.push(`format: vanilla`)
  lines.push('---')
  lines.push('')

  lines.push(`# ${model.Name}`)
  lines.push('')

  if (model.Description) {
    lines.push(model.Description)
    lines.push('')
  }

  // Model Information
  lines.push('## Model Information')
  lines.push('')
  lines.push('| Field | Value |')
  lines.push('|---|---|')
  lines.push(`| Model ID | ${model.ModelId} |`)
  lines.push(`| Baseline Model | ${model.BaselineModelId ?? 'None'} |`)
  lines.push(`| Hidden | ${model.IsHidden ? 'Yes' : 'No'} |`)
  lines.push('')

  // Diagrams
  lines.push('## Diagrams')
  lines.push('')
  if (drawings.length === 0) {
    lines.push('*No diagrams in this model.*')
  } else {
    lines.push('| Name | Type | Accessibility | Components |')
    lines.push('|---|---|---|---|')
    for (const d of sortedDrawings) {
      const typeName = typeMap.get(d.DocumentTypeId) ?? 'Unknown'
      const accessibility = d.DocumentAccessibilityCategory ?? '—'
      const componentCount = (drawingComponentsMap.get(d.DocumentId) ?? []).length
      lines.push(`| ${cell(d.FileName)} | ${cell(typeName)} | ${cell(accessibility)} | ${componentCount} |`)
    }
  }
  lines.push('')

  // Statistics — Objects
  const objTypeCounts = new Map<string, number>()
  for (const detail of objectDetails) {
    const t = detail.ObjectType.Name
    objTypeCounts.set(t, (objTypeCounts.get(t) ?? 0) + 1)
  }

  lines.push('## Statistics')
  lines.push('')
  lines.push(`### Objects (${objects.length} total)`)
  lines.push('')
  lines.push('| Type | Count |')
  lines.push('|---|---|')
  for (const [type, count] of [...objTypeCounts.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    lines.push(`| ${cell(type)} | ${count} |`)
  }
  lines.push('')

  // Statistics — Relationships
  const relTypeCounts = new Map<string, number>()
  for (const rel of relationships) {
    const display = stripArchiMate(rel.RelationshipType?.Name ?? 'Unknown')
    relTypeCounts.set(display, (relTypeCounts.get(display) ?? 0) + 1)
  }

  lines.push(`### Relationships (${relationships.length} total)`)
  lines.push('')
  lines.push('| Type | Count |')
  lines.push('|---|---|')
  for (const [type, count] of [...relTypeCounts.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    lines.push(`| ${cell(type)} | ${count} |`)
  }
  lines.push('')

  // Objects catalogue
  lines.push('## Objects')
  lines.push('')
  lines.push('| Name | Type | Description |')
  lines.push('|---|---|---|')
  for (const detail of sortedObjectDetails) {
    const info = objectMap.get(detail.ObjectId)
    lines.push(`| ${cell(detail.Name)} | ${cell(detail.ObjectType.Name)} | ${cell(info?.description ?? '')} |`)
  }
  lines.push('')

  // Diagram Detail
  lines.push('## Diagram Detail')
  lines.push('')

  for (const drawing of sortedDrawings) {
    const components = drawingComponentsMap.get(drawing.DocumentId) ?? []
    if (components.length === 0) continue

    const typeName = typeMap.get(drawing.DocumentTypeId) ?? 'Unknown'
    const accessibility = drawing.DocumentAccessibilityCategory ?? 'N/A'

    lines.push(`### ${drawing.FileName}`)
    lines.push('')
    lines.push(`**Type:** ${typeName} | **Accessibility:** ${accessibility}`)
    lines.push('')

    const objComponents = components.filter((c) => !c.isRelationship)
    lines.push('#### Objects')
    lines.push('')
    lines.push('| Name | Type | Description |')
    lines.push('|---|---|---|')

    const sortedObjComponents = [...objComponents].sort((a, b) => {
      const aInfo = objectMap.get(a.ModelItemId)
      const bInfo = objectMap.get(b.ModelItemId)
      const typeComp = (aInfo?.type ?? '').localeCompare(bInfo?.type ?? '')
      if (typeComp !== 0) return typeComp
      return (aInfo?.name ?? a.ModelItemId).localeCompare(bInfo?.name ?? b.ModelItemId)
    })

    for (const c of sortedObjComponents) {
      const info = objectMap.get(c.ModelItemId)
      if (info) {
        lines.push(`| ${cell(info.name)} | ${cell(info.type)} | ${cell(info.description)} |`)
      } else {
        lines.push(`| ${c.ModelItemId} | (unresolved) | |`)
      }
    }
    lines.push('')

    const relComponents = components.filter((c) => c.isRelationship)
    lines.push('#### Relationships')
    lines.push('')
    lines.push('| From | Relationship | To |')
    lines.push('|---|---|---|')

    interface RelRow { from: string; relType: string; to: string }
    const resolvedRels: RelRow[] = relComponents.map((c) => {
      const rel = relMap.get(c.ModelItemId)
      if (!rel) return {from: '(unresolved)', relType: '—', to: '(unresolved)'}
      return {
        from: rel.LeadObject?.Name ?? '(unknown)',
        relType: stripArchiMate(rel.RelationshipType?.Name ?? '—'),
        to: rel.MemberObject?.Name ?? '(unknown)',
      }
    })
    resolvedRels.sort((a, b) => a.from.localeCompare(b.from) || a.to.localeCompare(b.to))

    for (const r of resolvedRels) {
      lines.push(`| ${cell(r.from)} | ${cell(r.relType)} | ${cell(r.to)} |`)
    }
    lines.push('')
  }

  // Object-Diagram Coverage
  const objectDiagramMap = new Map<string, Set<string>>()
  for (const detail of objectDetails) {
    objectDiagramMap.set(detail.ObjectId, new Set())
  }
  for (const drawing of sortedDrawings) {
    for (const c of (drawingComponentsMap.get(drawing.DocumentId) ?? []).filter((c) => !c.isRelationship)) {
      objectDiagramMap.get(c.ModelItemId)?.add(drawing.DocumentId)
    }
  }

  const coverageHeader = ['Object', 'Type', ...sortedDrawings.map((d) => headerCell(d.FileName))]
  lines.push('## Object-Diagram Coverage')
  lines.push('')
  lines.push(`| ${coverageHeader.join(' | ')} |`)
  lines.push(`| ${coverageHeader.map(() => '---').join(' | ')} |`)

  for (const detail of sortedObjectDetails) {
    const diagramSet = objectDiagramMap.get(detail.ObjectId) ?? new Set()
    const isOrphan = diagramSet.size === 0
    const nameRaw = cell(detail.Name)
    const typeRaw = cell(detail.ObjectType.Name)
    const nameCell = isOrphan ? `**${nameRaw}**` : nameRaw
    const typeCell = isOrphan ? `**${typeRaw}**` : typeRaw
    const matrixCells = sortedDrawings.map((d) => (diagramSet.has(d.DocumentId) ? 'x' : ''))
    lines.push(`| ${nameCell} | ${typeCell} | ${matrixCells.join(' | ')} |`)
  }
  lines.push('')

  // Audit
  lines.push('## Audit')
  lines.push('')

  const noDiagram = sortedObjectDetails.filter((o) => (objectDiagramMap.get(o.ObjectId)?.size ?? 0) === 0)
  lines.push(`### Objects without diagrams (${noDiagram.length})`)
  lines.push('')
  if (noDiagram.length === 0) {
    lines.push('*All objects appear in at least one diagram.*')
  } else {
    lines.push('| Name | Type | Description |')
    lines.push('|---|---|---|')
    for (const obj of noDiagram) {
      const desc = objectMap.get(obj.ObjectId)?.description ?? ''
      lines.push(`| ${cell(obj.Name)} | ${cell(obj.ObjectType.Name)} | ${cell(desc)} |`)
    }
  }
  lines.push('')

  const objectsWithRelationship = new Set<string>()
  for (const rel of relationships) {
    if (rel.LeadObject?.ObjectId) objectsWithRelationship.add(rel.LeadObject.ObjectId)
    if (rel.MemberObject?.ObjectId) objectsWithRelationship.add(rel.MemberObject.ObjectId)
  }
  const noRelationship = sortedObjectDetails.filter((o) => !objectsWithRelationship.has(o.ObjectId))

  lines.push(`### Objects without relationships (${noRelationship.length})`)
  lines.push('')
  if (noRelationship.length === 0) {
    lines.push('*All objects have at least one relationship.*')
  } else {
    lines.push('| Name | Type | Description |')
    lines.push('|---|---|---|')
    for (const obj of noRelationship) {
      const desc = objectMap.get(obj.ObjectId)?.description ?? ''
      lines.push(`| ${cell(obj.Name)} | ${cell(obj.ObjectType.Name)} | ${cell(desc)} |`)
    }
  }
  lines.push('')

  if (!existsSync(outputDir)) mkdirSync(outputDir, {recursive: true})

  const filePath = join(outputDir, `${formatTimestamp(now)}-${sanitizeName(model.Name)}.md`)
  writeFileSync(filePath, lines.join('\n'), 'utf-8')

  return {drawings: drawings.length, filePath, objects: objects.length, relationships: relationships.length}
}
