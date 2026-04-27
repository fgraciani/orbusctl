import {writeFileSync} from 'node:fs'
import {join} from 'node:path'
import {scryptSync, timingSafeEqual} from 'node:crypto'

import {Command, Flags} from '@oclif/core'

import {type ActivityObject, type ActivityRelationship, type Model, fetchMe, fetchModels, fetchRecentObjects, fetchRecentRelationships} from '../api'
import {getReportsDir, getShowHiddenModels, getSolutionFilter, getToken} from '../config'
import {type ActivityReport, formatActivityReportMarkdown, formatActivitySummary} from '../ui/activity'

const ADMIN_SALT = '8c4c4904a54b3b7b841d1e2e36761208'
const ADMIN_HASH = 'fdbddc27e1c36f54a6835448acea75f13ffe696df0e77e5fca23638042e9689c5333b724c23e6cb91d15cf2e23685f46324d79578ed48c8b3d9b12f2c703b56d'

function verifyAdmin(password: string): boolean {
  const hash = scryptSync(password, ADMIN_SALT, 64)
  return timingSafeEqual(hash, Buffer.from(ADMIN_HASH, 'hex'))
}

export default class Activity extends Command {
  static description = 'Show user activity report (admin only)'

  static enableJsonFlag = true

  static flags = {
    days: Flags.integer({char: 'd', description: 'Look back N days (default: 7)'}),
    hours: Flags.integer({char: 'H', description: 'Look back N hours (overrides --days)'}),
    password: Flags.string({char: 'p', description: 'Admin password'}),
    user: Flags.string({char: 'u', description: 'Filter by user name (partial match)'}),
  }

  async run(): Promise<Record<string, unknown>> {
    const {flags} = await this.parse(Activity)

    const password = flags.password ?? process.env.ORBUS_ADMIN_KEY
    if (!password || !verifyAdmin(password)) {
      this.error('Access denied. Provide the admin password with --password or ORBUS_ADMIN_KEY.')
    }

    const token = getToken()
    if (!token) {
      this.error('No token configured. Run "orbusctl auth" first.')
    }

    this.log('Validating token...')
    try {
      await fetchMe(token)
    } catch {
      this.error('Token expired or invalid. Run "orbusctl auth" first.')
    }

    const now = new Date()
    let since: Date
    let label: string

    if (flags.hours) {
      since = new Date(now.getTime() - flags.hours * 60 * 60 * 1000)
      label = `last ${flags.hours} hour(s)`
    } else {
      const days = flags.days ?? 7
      since = new Date(now.getTime() - days * 24 * 60 * 60 * 1000)
      label = `last ${days} day(s)`
    }

    const filter = getSolutionFilter()
    if (filter) {
      this.log(`Fetching models (filtered by "${filter}")...`)
    } else {
      this.log('Fetching all models...')
    }

    const allModels = await fetchModels(token, filter)
    const showHidden = getShowHiddenModels()
    const models = showHidden ? allModels : allModels.filter((m) => !m.IsHidden)
    this.log(`Found ${models.length} model(s). Scanning activity...`)

    const report = await this.scanActivity(token, models, since, now, label)

    if (flags.user) {
      this.filterByUser(report, flags.user)
      report.label += ` (user: "${flags.user}")`
    }

    for (const line of formatActivitySummary(report)) {
      this.log(line)
    }

    const md = formatActivityReportMarkdown(report)
    const datePart = now.toISOString().slice(0, 10)
    const windowPart = flags.hours ? `${flags.hours}h` : `${flags.days ?? 7}d`
    const userPart = flags.user ? `_${flags.user.toLowerCase().replace(/\s+/g, '-')}` : ''
    const fileName = `activity_${datePart}_${windowPart}${userPart}.md`
    const filePath = join(getReportsDir(), fileName)
    writeFileSync(filePath, md)
    this.log(`  Report saved to ${filePath}`)

    let objectsCreated = 0
    let objectsModified = 0
    let relationshipsCreated = 0
    for (const objs of report.objectsByModel.values()) {
      for (const o of objs) {
        if (new Date(o.DateCreated) >= report.since) objectsCreated++
        if (new Date(o.LastModifiedDate) >= report.since && new Date(o.DateCreated) < report.since) objectsModified++
      }
    }
    for (const rels of report.relationshipsByModel.values()) {
      relationshipsCreated += rels.length
    }

    const activityModels = []
    for (const model of report.models) {
      const objs = report.objectsByModel.get(model.ModelId)
      const rels = report.relationshipsByModel.get(model.ModelId)
      if (!objs && !rels) continue
      activityModels.push({
        modelId: model.ModelId,
        name: model.Name,
        objects: (objs ?? []).map((o) => ({
          createdBy: o.CreatedBy.Name,
          dateCreated: o.DateCreated,
          lastModifiedBy: o.LastModifiedBy.Name,
          lastModifiedDate: o.LastModifiedDate,
          name: o.Name,
          objectId: o.ObjectId,
          objectType: o.ObjectType.Name,
        })),
        relationships: (rels ?? []).map((r) => ({
          createdBy: r.CreatedBy.Name,
          dateCreated: r.DateCreated,
          relationshipId: r.RelationshipId,
        })),
      })
    }

    return {
      label: report.label,
      models: activityModels,
      reportPath: filePath,
      since: report.since.toISOString(),
      summary: {objectsCreated, objectsModified, relationshipsCreated},
      until: report.until.toISOString(),
    }
  }

  private filterByUser(report: ActivityReport, userFilter: string): void {
    const lower = userFilter.toLowerCase()

    for (const [modelId, objects] of report.objectsByModel) {
      const filtered = objects.filter(
        (o) => o.CreatedBy.Name.toLowerCase().includes(lower) || o.LastModifiedBy.Name.toLowerCase().includes(lower),
      )
      if (filtered.length > 0) {
        report.objectsByModel.set(modelId, filtered)
      } else {
        report.objectsByModel.delete(modelId)
      }
    }

    for (const [modelId, rels] of report.relationshipsByModel) {
      const filtered = rels.filter((r) => r.CreatedBy.Name.toLowerCase().includes(lower))
      if (filtered.length > 0) {
        report.relationshipsByModel.set(modelId, filtered)
      } else {
        report.relationshipsByModel.delete(modelId)
      }
    }
  }

  private async scanActivity(token: string, models: Model[], since: Date, until: Date, label: string): Promise<ActivityReport> {
    const sinceISO = since.toISOString()
    const objectsByModel = new Map<string, ActivityObject[]>()
    const relationshipsByModel = new Map<string, ActivityRelationship[]>()

    for (const model of models) {
      try {
        const [objects, relationships] = await Promise.all([
          fetchRecentObjects(token, model.ModelId, sinceISO),
          fetchRecentRelationships(token, model.ModelId, sinceISO),
        ])

        if (objects.length > 0) objectsByModel.set(model.ModelId, objects)
        if (relationships.length > 0) relationshipsByModel.set(model.ModelId, relationships)

        const total = objects.length + relationships.length
        if (total > 0) {
          this.log(`  ${model.Name}: ${objects.length} object(s), ${relationships.length} relationship(s)`)
        }
      } catch (error) {
        if (error instanceof Error && error.message === 'TOKEN_EXPIRED') {
          this.warn('Token expired mid-scan. Returning partial results.')
          break
        }
        this.warn(`Failed to scan "${model.Name}": ${error instanceof Error ? error.message : error}`)
      }
    }

    return {label, models, objectsByModel, relationshipsByModel, since, until}
  }
}
