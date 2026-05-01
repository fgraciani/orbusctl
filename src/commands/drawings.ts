import {Command, Flags} from '@oclif/core'

import {fetchDocumentTypes, fetchDrawingComponents, fetchDrawings, fetchModels, fetchObjectNameAndType} from '../api'
import {getShowHiddenModels, getSolutionFilter, getToken} from '../config'
import {formatDrawingDetail, formatDrawingTable} from '../ui/drawings'
import {resolveMatch} from '../utils/resolve'

export default class Drawings extends Command {
  static description = 'List drawings in a model'

  static enableJsonFlag = true

  static flags = {
    drawing: Flags.string({char: 'd', description: 'Drawing name (partial match) — show components'}),
    model: Flags.string({char: 'm', description: 'Model name (partial match)', required: true}),
  }

  async run(): Promise<Record<string, unknown>> {
    const {flags} = await this.parse(Drawings)
    const token = getToken()
    if (!token) {
      this.error('No token configured. Run "orbusctl auth" first.')
    }

    const filter = getSolutionFilter()
    const allModels = await fetchModels(token, filter)
    const showHidden = getShowHiddenModels()
    const models = showHidden ? allModels : allModels.filter((m) => !m.IsHidden)

    const match = resolveMatch(models, flags.model, (m) => m.Name, 'model', (msg) => this.error(msg))

    this.log(`Fetching drawings for "${match.Name}"...`)

    const [docTypes, drawings] = await Promise.all([
      fetchDocumentTypes(token),
      fetchDrawings(token, match.ModelId),
    ])

    const typeMap = new Map(docTypes.map((t) => [t.DocumentTypeId, t.Name]))
    const modelRef = {modelId: match.ModelId, name: match.Name}

    if (flags.drawing) {
      const drawing = resolveMatch(drawings, flags.drawing!, (d) => d.FileName, 'drawing', (msg) => this.error(msg))

      this.log(`Fetching components for "${drawing.FileName}"...`)
      this.log()

      const components = await fetchDrawingComponents(token, drawing.DocumentId)
      const typeName = typeMap.get(drawing.DocumentTypeId) ?? 'Unknown'

      const objectComponents = components.filter((c) => !c.isRelationship)
      const nameMap = new Map<string, {name: string; typeName: string}>()
      await Promise.all(
        objectComponents.map(async (c) => {
          nameMap.set(c.ModelItemId, await fetchObjectNameAndType(token, c.ModelItemId))
        }),
      )
      const enriched = components.map((c) => {
        const info = nameMap.get(c.ModelItemId)
        return {...c, objectName: info?.name ?? c.objectName, objectTypeName: info?.typeName ?? c.objectTypeName}
      })

      for (const line of formatDrawingDetail(drawing.FileName, typeName, drawing.DocumentAccessibilityCategory, enriched)) {
        this.log(line)
      }

      const objects = enriched
        .filter((c) => !c.isRelationship)
        .map((c) => ({modelItemId: c.ModelItemId, name: c.objectName ?? 'Unknown', typeName: c.objectTypeName ?? 'Unknown'}))

      const relationships = components
        .filter((c) => c.isRelationship)
        .map((c) => ({modelItemId: c.ModelItemId, kind: c.relationshipKind}))

      return {
        model: modelRef,
        drawing: {
          documentId: drawing.DocumentId,
          name: drawing.FileName,
          typeName,
          accessibility: drawing.DocumentAccessibilityCategory,
          components: {objects, relationships},
        },
      }
    }

    const componentCounts = new Map<string, number | null>()
    await Promise.all(
      drawings.map(async (d) => {
        try {
          const components = await fetchDrawingComponents(token, d.DocumentId)
          componentCounts.set(d.DocumentId, components.length)
        } catch {
          componentCounts.set(d.DocumentId, null)
        }
      }),
    )

    this.log(`Found ${drawings.length} drawing(s).`)
    this.log()

    for (const line of formatDrawingTable(drawings, typeMap, componentCounts)) {
      this.log(line)
    }

    return {
      model: modelRef,
      drawings: drawings.map((d) => ({
        documentId: d.DocumentId,
        name: d.FileName,
        typeName: typeMap.get(d.DocumentTypeId) ?? 'Unknown',
        accessibility: d.DocumentAccessibilityCategory,
        componentCount: componentCounts.get(d.DocumentId) ?? null,
      })),
    }
  }
}
