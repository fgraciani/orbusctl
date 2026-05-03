import {Command, Flags} from '@oclif/core'

import {fetchDrawingCount, fetchDrawingsContainingObject, fetchModels, fetchObjectDetail, fetchObjectModelName, fetchObjectRelationships, fetchObjects} from '../../api'
import {getShowHiddenModels, getSolutionFilter, getToken} from '../../config'
import {formatObjectDetail, formatObjectTable} from '../../ui/table'
import {resolveMatch} from '../../utils/resolve'

const SYSTEM_ATTRIBUTES = new Set([
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

export default class Objects extends Command {
  static description = 'List objects in a model'

  static enableJsonFlag = true

  static flags = {
    model: Flags.string({char: 'm', description: 'Model name (or partial match)', required: true}),
    object: Flags.string({char: 'o', description: 'Object name (partial match) — show full details'}),
  }

  async run(): Promise<Record<string, unknown>> {
    const {flags} = await this.parse(Objects)
    const token = getToken()
    if (!token) {
      this.error('No token configured. Run "orbusctl auth" first.')
    }

    const filter = getSolutionFilter()
    const allModels = await fetchModels(token, filter)
    const showHidden = getShowHiddenModels()
    const models = showHidden ? allModels : allModels.filter((m) => !m.IsHidden)

    const match = resolveMatch(models, flags.model, (m) => m.Name, 'model', (msg) => this.error(msg))

    this.log(`Fetching objects for "${match.Name}"...`)

    const objects = await fetchObjects(token, match.ModelId)
    const modelRef = {modelId: match.ModelId, name: match.Name}

    if (flags.object) {
      const obj = resolveMatch(objects, flags.object!, (o) => o.Name, 'object', (msg) => this.error(msg))

      this.log(`Fetching details for "${obj.Name}"...`)
      this.log()

      const detail = await fetchObjectDetail(token, obj.ObjectId)

      let originalModelName: string | null = null
      if (detail.Detail.Status !== 'Original' && detail.Detail.OriginalObjectId) {
        originalModelName = await fetchObjectModelName(token, detail.Detail.OriginalObjectId)
      }

      const [relationships, drawings] = await Promise.all([
        fetchObjectRelationships(token, obj.ObjectId),
        fetchDrawingsContainingObject(token, match.ModelId, obj.ObjectId),
      ])

      for (const line of formatObjectDetail(detail, originalModelName, relationships, drawings)) {
        this.log(line)
      }

      const descAttr = detail.AttributeValues.find((a) => a.AttributeName === 'Description')
      const description = descAttr?.StringValue ?? (descAttr?.Value as string | undefined) ?? null

      const attrs = detail.AttributeValues
        .filter((a) => !SYSTEM_ATTRIBUTES.has(a.AttributeName))
        .filter((a) => a.Value !== null && a.Value !== undefined && a.Value !== '' || a.StringValue !== null && a.StringValue !== '' && a.StringValue !== a.Value)
        .map((a) => ({name: a.AttributeName, value: a.StringValue ?? a.Value ?? null}))

      return {
        model: modelRef,
        object: {
          attributes: attrs,
          createdBy: detail.CreatedBy.Name,
          dateCreated: detail.DateCreated,
          description,
          lastModifiedBy: detail.LastModifiedBy.Name,
          lastModifiedDate: detail.LastModifiedDate,
          lockedBy: detail.LockedBy?.Name ?? null,
          lockedOn: detail.LockedOn ?? null,
          model: detail.Model.Name,
          name: detail.Name,
          objectId: detail.ObjectId,
          objectType: {description: detail.ObjectType.Description, name: detail.ObjectType.Name},
          originalModelName,
          relationships: relationships.map((r) => ({
            direction: r.DirectionDescription,
            relatedObject: {name: r.RelatedItem.Name, objectId: r.RelatedItem.ObjectId, objectType: r.RelatedItem.ObjectType.Name},
            relationshipType: r.Relationship.RelationshipType.Name,
            attributes: (r.Relationship.AttributeValues ?? [])
              .filter((a) => !SYSTEM_ATTRIBUTES.has(a.AttributeName))
              .filter((a) => a.Value !== null && a.Value !== undefined && a.Value !== '' || a.StringValue !== null && a.StringValue !== '' && a.StringValue !== a.Value)
              .map((a) => ({name: a.AttributeName, value: a.StringValue ?? a.Value ?? null})),
          })),
          drawings: drawings.map((d) => ({documentId: d.documentId, name: d.fileName})),
          status: detail.Detail.Status,
          version: detail.Detail.CurrentVersionNumber,
        },
      }
    }

    const drawingCount = await fetchDrawingCount(token, match.ModelId)
    this.log(`Found ${objects.length} object(s), ${drawingCount} drawing(s).`)
    this.log()

    for (const line of formatObjectTable(objects)) {
      this.log(line)
    }

    return {
      model: modelRef,
      objects: objects.map((o) => ({
        lastModifiedBy: o.LastModifiedBy.Name,
        lastModifiedDate: o.LastModifiedDate,
        name: o.Name,
        objectId: o.ObjectId,
        objectType: o.ObjectType.Name,
      })),
    }
  }
}
