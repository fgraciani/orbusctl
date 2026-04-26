import {ActivityObject, ActivityRelationship, Model} from '../api'

export interface ActivityReport {
  models: Model[]
  objectsByModel: Map<string, ActivityObject[]>
  relationshipsByModel: Map<string, ActivityRelationship[]>
  since: Date
  until: Date
  label: string
}

interface Totals {
  objectsCreated: number
  objectsModified: number
  relsCreated: number
}

function fmtDate(d: Date): string {
  return d.toLocaleDateString('en-GB', {day: '2-digit', month: 'short', year: 'numeric'})
}

function fmtDateTime(s: string): string {
  const d = new Date(s)
  return `${d.toLocaleDateString('en-GB')} ${d.toLocaleTimeString('en-GB', {hour: '2-digit', minute: '2-digit'})}`
}

function isCreated(obj: ActivityObject, sinceTime: number): boolean {
  return new Date(obj.DateCreated).getTime() > sinceTime
}

function computeTotals(report: ActivityReport): Totals {
  const sinceTime = report.since.getTime()
  let objectsCreated = 0
  let objectsModified = 0
  let relsCreated = 0

  for (const objects of report.objectsByModel.values()) {
    for (const obj of objects) {
      if (isCreated(obj, sinceTime)) objectsCreated++
      else objectsModified++
    }
  }

  for (const rels of report.relationshipsByModel.values()) {
    relsCreated += rels.length
  }

  return {objectsCreated, objectsModified, relsCreated}
}

function modelName(report: ActivityReport, modelId: string): string {
  return report.models.find((m) => m.ModelId === modelId)?.Name ?? modelId
}

export function formatActivitySummary(report: ActivityReport): string[] {
  const t = computeTotals(report)
  const lines: string[] = []

  lines.push('')
  lines.push(`  Activity report — ${report.label} (${fmtDate(report.since)} – ${fmtDate(report.until)})`)
  lines.push(`  Scanned ${report.models.length} model(s).`)
  lines.push('')
  lines.push('  Summary')
  lines.push(`    Objects created:            ${t.objectsCreated}`)
  lines.push(`    Objects modified:            ${t.objectsModified}`)
  lines.push(`    Objects deleted:             unknown`)
  lines.push(`    Relationships created:       ${t.relsCreated}`)
  lines.push(`    Relationships modified:      unknown`)
  lines.push(`    Relationships deleted:       unknown`)
  lines.push('')

  const activeModels: {name: string; objects: number; rels: number}[] = []
  for (const model of report.models) {
    const objs = report.objectsByModel.get(model.ModelId)?.length ?? 0
    const rels = report.relationshipsByModel.get(model.ModelId)?.length ?? 0
    if (objs > 0 || rels > 0) {
      activeModels.push({name: model.Name, objects: objs, rels})
    }
  }

  if (activeModels.length > 0) {
    activeModels.sort((a, b) => a.name.localeCompare(b.name))
    const maxName = Math.max(...activeModels.map((m) => m.name.length))
    lines.push('  Active models')
    for (const m of activeModels) {
      lines.push(`    ${m.name.padEnd(maxName)}   ${m.objects} object(s), ${m.rels} relationship(s)`)
    }
    lines.push('')
  }

  lines.push('  Note: This report cannot detect modifications to relationships,')
  lines.push('  deletions of any kind, or activity on models that were deleted')
  lines.push('  before this report was generated. Multiple modifications to the')
  lines.push('  same object by different users will only reflect the most recent.')
  lines.push('')

  return lines
}

export interface ModelActivityChoice {
  name: string
  value: string
}

export function buildModelActivityChoices(report: ActivityReport): ModelActivityChoice[] {
  const choices: ModelActivityChoice[] = []

  for (const model of report.models) {
    const objs = report.objectsByModel.get(model.ModelId)?.length ?? 0
    const rels = report.relationshipsByModel.get(model.ModelId)?.length ?? 0
    if (objs > 0 || rels > 0) {
      choices.push({
        name: `${model.Name} (${objs} objects, ${rels} relationships)`,
        value: model.ModelId,
      })
    }
  }

  choices.sort((a, b) => a.name.localeCompare(b.name))
  return choices
}

export function formatModelActivity(report: ActivityReport, modelId: string): string[] {
  const sinceTime = report.since.getTime()
  const name = modelName(report, modelId)
  const objects = report.objectsByModel.get(modelId) ?? []
  const rels = report.relationshipsByModel.get(modelId) ?? []
  const lines: string[] = []

  lines.push('')
  lines.push(`  ${name}`)
  lines.push('')

  const userObjects = new Map<string, {created: ActivityObject[]; modified: ActivityObject[]}>()

  for (const obj of objects) {
    const created = isCreated(obj, sinceTime)
    const userName = created ? obj.CreatedBy.Name : obj.LastModifiedBy.Name
    if (!userObjects.has(userName)) userObjects.set(userName, {created: [], modified: []})
    const entry = userObjects.get(userName)!
    if (created) entry.created.push(obj)
    else entry.modified.push(obj)
  }

  const userRels = new Map<string, number>()
  for (const rel of rels) {
    userRels.set(rel.CreatedBy.Name, (userRels.get(rel.CreatedBy.Name) ?? 0) + 1)
  }

  const allUsers = new Set([...userObjects.keys(), ...userRels.keys()])
  const sortedUsers = [...allUsers].sort()

  for (const userName of sortedUsers) {
    const entry = userObjects.get(userName)
    const relCount = userRels.get(userName) ?? 0
    lines.push(`  ${userName}`)

    if (entry?.created.length) {
      lines.push(`    Created (${entry.created.length}):`)
      for (const obj of entry.created.sort((a, b) => a.Name.localeCompare(b.Name))) {
        lines.push(`      ${obj.Name} (${obj.ObjectType.Name}) — ${fmtDateTime(obj.DateCreated)}`)
      }
    }

    if (entry?.modified.length) {
      lines.push(`    Modified (${entry.modified.length}):`)
      for (const obj of entry.modified.sort((a, b) => a.Name.localeCompare(b.Name))) {
        lines.push(`      ${obj.Name} (${obj.ObjectType.Name}) — ${fmtDateTime(obj.LastModifiedDate)}`)
      }
    }

    if (relCount > 0) {
      lines.push(`    Relationships created: ${relCount}`)
    }

    lines.push('')
  }

  if (sortedUsers.length === 0) {
    lines.push('  No activity in this model.')
    lines.push('')
  }

  return lines
}

export function formatActivityReportMarkdown(report: ActivityReport): string {
  const sinceTime = report.since.getTime()
  const t = computeTotals(report)
  const lines: string[] = []

  lines.push(`# Activity report — ${report.label}`)
  lines.push('')
  lines.push(`**Period:** ${fmtDate(report.since)} – ${fmtDate(report.until)}`)
  lines.push(`**Models scanned:** ${report.models.length}`)
  lines.push('')
  lines.push('## Summary')
  lines.push('')
  lines.push('| Metric | Count |')
  lines.push('| --- | --- |')
  lines.push(`| Objects created | ${t.objectsCreated} |`)
  lines.push(`| Objects modified | ${t.objectsModified} |`)
  lines.push(`| Objects deleted | unknown |`)
  lines.push(`| Relationships created | ${t.relsCreated} |`)
  lines.push(`| Relationships modified | unknown |`)
  lines.push(`| Relationships deleted | unknown |`)
  lines.push('')

  for (const model of report.models) {
    const objects = report.objectsByModel.get(model.ModelId) ?? []
    const rels = report.relationshipsByModel.get(model.ModelId) ?? []
    if (objects.length === 0 && rels.length === 0) continue

    lines.push(`## ${model.Name}`)
    lines.push('')

    const userObjects = new Map<string, {created: ActivityObject[]; modified: ActivityObject[]}>()

    for (const obj of objects) {
      const created = isCreated(obj, sinceTime)
      const userName = created ? obj.CreatedBy.Name : obj.LastModifiedBy.Name
      if (!userObjects.has(userName)) userObjects.set(userName, {created: [], modified: []})
      const entry = userObjects.get(userName)!
      if (created) entry.created.push(obj)
      else entry.modified.push(obj)
    }

    const userRels = new Map<string, number>()
    for (const rel of rels) {
      userRels.set(rel.CreatedBy.Name, (userRels.get(rel.CreatedBy.Name) ?? 0) + 1)
    }

    const allUsers = new Set([...userObjects.keys(), ...userRels.keys()])
    const sortedUsers = [...allUsers].sort()

    for (const userName of sortedUsers) {
      const entry = userObjects.get(userName)
      const relCount = userRels.get(userName) ?? 0
      lines.push(`### ${userName}`)
      lines.push('')

      if (entry?.created.length) {
        lines.push('**Created:**')
        lines.push('')
        lines.push('| Object | Type | Date |')
        lines.push('| --- | --- | --- |')
        for (const obj of entry.created.sort((a, b) => a.Name.localeCompare(b.Name))) {
          lines.push(`| ${obj.Name} | ${obj.ObjectType.Name} | ${fmtDateTime(obj.DateCreated)} |`)
        }
        lines.push('')
      }

      if (entry?.modified.length) {
        lines.push('**Modified:**')
        lines.push('')
        lines.push('| Object | Type | Date |')
        lines.push('| --- | --- | --- |')
        for (const obj of entry.modified.sort((a, b) => a.Name.localeCompare(b.Name))) {
          lines.push(`| ${obj.Name} | ${obj.ObjectType.Name} | ${fmtDateTime(obj.LastModifiedDate)} |`)
        }
        lines.push('')
      }

      if (relCount > 0) {
        lines.push(`**Relationships created:** ${relCount}`)
        lines.push('')
      }
    }
  }

  lines.push('---')
  lines.push('')
  lines.push('*Note: This report cannot detect modifications to relationships,')
  lines.push('deletions of any kind, or activity on models that were deleted')
  lines.push('before this report was generated. Multiple modifications to the')
  lines.push('same object by different users will only reflect the most recent.*')
  lines.push('')

  return lines.join('\n')
}
