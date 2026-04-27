import boxen = require('boxen')

import {Drawing, DrawingComponent, DocumentType} from '../api'
import {colorType} from './colors'

export function formatDrawingTable(
  drawings: Drawing[],
  typeMap: Map<string, string>,
  componentCounts: Map<string, number | null>,
): string[] {
  const sorted = [...drawings].sort((a, b) => a.FileName.localeCompare(b.FileName))

  const headers = {
    name: 'Name',
    type: 'Type',
    accessibility: 'Accessibility',
    components: 'Components',
  }

  const rows = sorted.map((d) => ({
    name: d.FileName,
    type: typeMap.get(d.DocumentTypeId) ?? 'Unknown',
    accessibility: d.DocumentAccessibilityCategory ?? '—',
    components: String(componentCounts.get(d.DocumentId) ?? '—'),
  }))

  const colWidths = {
    name: Math.max(headers.name.length, ...rows.map((r) => r.name.length)),
    type: Math.max(headers.type.length, ...rows.map((r) => r.type.length)),
    accessibility: Math.max(headers.accessibility.length, ...rows.map((r) => r.accessibility.length)),
    components: Math.max(headers.components.length, ...rows.map((r) => r.components.length)),
  }

  function pad(value: string, width: number): string {
    return value.padEnd(width)
  }

  function formatRow(name: string, type: string, accessibility: string, components: string): string {
    return `    ${pad(name, colWidths.name)}  ${pad(type, colWidths.type)}  ${pad(accessibility, colWidths.accessibility)}  ${components}`
  }

  const lines: string[] = []
  lines.push(formatRow(headers.name, headers.type, headers.accessibility, headers.components))
  lines.push(formatRow(
    '─'.repeat(colWidths.name),
    '─'.repeat(colWidths.type),
    '─'.repeat(colWidths.accessibility),
    '─'.repeat(colWidths.components),
  ))

  for (const row of rows) {
    lines.push(formatRow(row.name, row.type, row.accessibility, row.components))
  }

  return lines
}

export function formatDrawingDetail(
  drawingName: string,
  typeName: string,
  accessibility: string | null,
  components: DrawingComponent[],
): string[] {
  const objects = components
    .filter((c) => !c.isRelationship)
    .sort((a, b) => {
      const typeCompare = (a.objectTypeName ?? '').localeCompare(b.objectTypeName ?? '')
      return typeCompare !== 0 ? typeCompare : (a.objectName ?? '').localeCompare(b.objectName ?? '')
    })

  const relationships = components.filter((c) => c.isRelationship)

  const contentLines: string[] = []
  contentLines.push('')
  contentLines.push(`Type:           ${typeName}`)
  contentLines.push(`Accessibility:  ${accessibility ?? 'Not set'}`)

  if (objects.length > 0) {
    contentLines.push('')
    contentLines.push(`Objects (${objects.length}):`)
    for (const obj of objects) {
      const name = obj.objectName ?? 'Unknown'
      const type = obj.objectTypeName ?? 'Unknown'
      contentLines.push(`  ${name}  (${colorType(type)})`)
    }
  }

  if (relationships.length > 0) {
    contentLines.push('')
    contentLines.push(`Relationships (${relationships.length}):`)
    for (const rel of relationships) {
      const kind = rel.relationshipKind ?? 'Unknown'
      if (rel.fromName && rel.toName) {
        contentLines.push(`  ${rel.fromName} → ${rel.toName}  (${kind})`)
      } else {
        contentLines.push(`  ${kind}  ${rel.ModelItemId}`)
      }
    }
  }

  if (objects.length === 0 && relationships.length === 0) {
    contentLines.push('')
    contentLines.push('No components.')
  }

  const box = boxen(contentLines.join('\n'), {
    borderStyle: 'round',
    padding: {top: 0, bottom: 0, left: 1, right: 1},
    title: drawingName,
    titleAlignment: 'left',
  })

  return box.split('\n').map((line) => `  ${line}`)
}

export function buildDrawingChoices(
  drawings: Drawing[],
  typeMap: Map<string, string>,
  componentCounts: Map<string, number | null>,
): Array<{name: string; value: string}> {
  const sorted = [...drawings].sort((a, b) => a.FileName.localeCompare(b.FileName))
  if (sorted.length === 0) return []

  const maxName = Math.max(...sorted.map((d) => d.FileName.length))
  const maxType = Math.max(...sorted.map((d) => (typeMap.get(d.DocumentTypeId) ?? 'Unknown').length))
  const maxAccess = Math.max(...sorted.map((d) => (d.DocumentAccessibilityCategory ?? '—').length))

  return sorted.map((d) => {
    const typeName = typeMap.get(d.DocumentTypeId) ?? 'Unknown'
    const access = d.DocumentAccessibilityCategory ?? '—'
    const count = componentCounts.get(d.DocumentId)
    const countLabel = count === null || count === undefined ? '—' : `${count}`
    return {
      name: `${d.FileName.padEnd(maxName)}   ${typeName.padEnd(maxType)}   ${access.padEnd(maxAccess)}   ${countLabel} components`,
      value: d.DocumentId,
    }
  })
}
