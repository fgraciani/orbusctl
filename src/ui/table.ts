import boxen = require('boxen')

import {ObjectDetail, OrbusObject, RelatedObject} from '../api'
import {colorType} from './colors'

export function formatObjectTable(objects: OrbusObject[]): string[] {
  const sorted = [...objects].sort((a, b) => a.Name.localeCompare(b.Name))

  const headers = {
    name: 'Name',
    type: 'Type',
    modifiedBy: 'Last Modified By',
    modifiedDate: 'Last Modified',
  }

  const rows = sorted.map((o) => ({
    name: o.Name,
    type: o.ObjectType.Name,
    modifiedBy: o.LastModifiedBy.Name,
    modifiedDate: new Date(o.LastModifiedDate).toLocaleDateString('en-GB'),
  }))

  const colWidths = {
    name: Math.max(headers.name.length, ...rows.map((r) => r.name.length)),
    type: Math.max(headers.type.length, ...rows.map((r) => r.type.length)),
    modifiedBy: Math.max(headers.modifiedBy.length, ...rows.map((r) => r.modifiedBy.length)),
    modifiedDate: Math.max(headers.modifiedDate.length, ...rows.map((r) => r.modifiedDate.length)),
  }

  function pad(value: string, width: number): string {
    return value.padEnd(width)
  }

  function formatRow(name: string, type: string, modifiedBy: string, modifiedDate: string): string {
    return `    ${pad(name, colWidths.name)}  ${pad(type, colWidths.type)}  ${pad(modifiedBy, colWidths.modifiedBy)}  ${modifiedDate}`
  }

  const lines: string[] = []
  lines.push(formatRow(headers.name, headers.type, headers.modifiedBy, headers.modifiedDate))
  lines.push(formatRow('─'.repeat(colWidths.name), '─'.repeat(colWidths.type), '─'.repeat(colWidths.modifiedBy), '─'.repeat(colWidths.modifiedDate)))

  for (const row of rows) {
    lines.push(formatRow(row.name, row.type, row.modifiedBy, row.modifiedDate))
  }

  return lines
}

function wrapText(text: string, width: number): string[] {
  const words = text.split(/\s+/)
  const lines: string[] = []
  let current = ''

  for (const word of words) {
    if (current && current.length + 1 + word.length > width) {
      lines.push(current)
      current = word
    } else {
      current = current ? `${current} ${word}` : word
    }
  }

  if (current) lines.push(current)

  const result: string[] = []
  for (const line of lines) {
    if (line.length <= width) {
      result.push(line)
    } else {
      for (let i = 0; i < line.length; i += width) {
        result.push(line.slice(i, i + width))
      }
    }
  }

  return result
}

export function formatObjectDetail(
  obj: ObjectDetail,
  originalModelName?: string | null,
  relationships?: RelatedObject[],
  drawings?: Array<{documentId: string; fileName: string}>,
): string[] {
  const date = (s: string) => {
    const d = new Date(s)
    return `${d.toLocaleDateString('en-GB')} ${d.toLocaleTimeString('en-GB', {hour: '2-digit', minute: '2-digit'})}`
  }

  const descAttr = obj.AttributeValues.find((a) => a.AttributeName === 'Description')
  const description = descAttr?.StringValue ?? descAttr?.Value as string | undefined

  const attrs = obj.AttributeValues
    .filter((a) => {
      if (a.Value !== null && a.Value !== undefined && a.Value !== '') return true
      if (a.StringValue !== null && a.StringValue !== '' && a.StringValue !== a.Value) return true
      return false
    })
    .filter((a) => ![
      'Created By',
      'Date Created',
      'Date Last Modified',
      'Description',
      'iServer365 Id',
      'Last Modified By',
      'Metamodel Item Id',
      'Metamodel Item Name',
      'Name',
    ].includes(a.AttributeName))
    .sort((a, b) => a.AttributeName.localeCompare(b.AttributeName))

  const contentLines: string[] = []

  contentLines.push('')

  if (description) {
    for (const line of wrapText(description, 105)) {
      contentLines.push(line)
    }

    contentLines.push('')
  }

  contentLines.push(`Object ID:      ${obj.ObjectId}`)
  contentLines.push(`Model:          ${obj.Model.Name}`)
  contentLines.push(`Type:           ${colorType(obj.ObjectType.Name)}`)
  const sourceHints: Record<string, string> = {
    Original: 'created in this model',
    Reuse: 'linked from another model, stays in sync',
    Variant: 'copied from another model, independent',
  }
  const sourceHint = sourceHints[obj.Detail.Status]
  let sourceText = `${obj.Detail.Status}${sourceHint ? ` (${sourceHint})` : ''}`
  if (obj.Detail.Status !== 'Original' && originalModelName) {
    sourceText = `${obj.Detail.Status} from ${originalModelName} (${sourceHint})`
  }

  contentLines.push(`Object source:  ${sourceText}`)
  contentLines.push(`Version:        ${obj.Detail.CurrentVersionNumber}`)
  contentLines.push(`Created:        ${date(obj.DateCreated)} by ${obj.CreatedBy.Name}`)
  contentLines.push(`Last modified:  ${date(obj.LastModifiedDate)} by ${obj.LastModifiedBy.Name}`)
  if (obj.LockedOn && obj.LockedBy) {
    contentLines.push(`\x1b[31mLocked:         ${date(obj.LockedOn)} by ${obj.LockedBy.Name}\x1b[0m`)
  }

  if (attrs.length > 0) {
    const maxName = Math.max(...attrs.map((a) => a.AttributeName.length))
    const valueWidth = 105 - maxName - 4
    contentLines.push('')
    contentLines.push('Attributes:')
    for (const attr of attrs) {
      const value = attr.StringValue ?? String(attr.Value ?? '')
      const valueLines = wrapText(value, Math.max(valueWidth, 20))
      contentLines.push(`  ${attr.AttributeName.padEnd(maxName)}  ${valueLines[0]}`)
      for (let i = 1; i < valueLines.length; i++) {
        contentLines.push(`  ${' '.repeat(maxName)}  ${valueLines[i]}`)
      }
    }
  }

  if (relationships && relationships.length > 0) {
    const sorted = [...relationships].sort((a, b) =>
      a.DirectionDescription.localeCompare(b.DirectionDescription) || a.RelatedItem.Name.localeCompare(b.RelatedItem.Name),
    )
    const maxDir = Math.max(...sorted.map((r) => r.DirectionDescription.length))
    contentLines.push('')
    contentLines.push(`Relationships (${sorted.length}):`)
    for (const rel of sorted) {
      const relType = rel.RelatedItem.ObjectType?.Name
      contentLines.push(`  ${rel.DirectionDescription.padEnd(maxDir)}  ${rel.RelatedItem.Name}${relType ? ` (${colorType(relType)})` : ''}  [${rel.Relationship.RelationshipType.Name}]`)
    }
  } else if (relationships && relationships.length === 0) {
    contentLines.push('')
    contentLines.push('No relationships.')
  }

  if (drawings !== undefined) {
    contentLines.push('')
    if (drawings.length > 0) {
      contentLines.push(`Appears in drawings (${drawings.length}):`)
      for (const d of drawings.sort((a, b) => a.fileName.localeCompare(b.fileName))) {
        contentLines.push(`  ${d.fileName}`)
      }
    } else {
      contentLines.push('Not found in any drawings.')
    }
  }

  const box = boxen(contentLines.join('\n'), {
    borderStyle: 'round',
    padding: {top: 0, bottom: 0, left: 1, right: 1},
    title: obj.Name,
    titleAlignment: 'left',
  })

  return box.split('\n').map((line) => `  ${line}`)
}

