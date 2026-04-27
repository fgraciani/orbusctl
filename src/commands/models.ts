import {Command, Flags} from '@oclif/core'

import {fetchModelDetailCounts, fetchModels} from '../api'
import {getShowHiddenModels, getSolutionFilter, getToken} from '../config'
import {formatModelTree} from '../ui/tree'

interface ModelJson {
  baselineModelId: string | null
  counts?: {drawings: number; objects: number; relationships: number}
  description: string
  isHidden: boolean
  modelId: string
  name: string
}

export default class Models extends Command {
  static description = 'List models from the Orbus repository'

  static enableJsonFlag = true

  static flags = {
    detail: Flags.boolean({char: 'd', description: 'Show object and relationship counts per model'}),
  }

  async run(): Promise<{models: ModelJson[]}> {
    const {flags} = await this.parse(Models)
    const token = getToken()
    if (!token) {
      this.error('No token configured. Run "orbusctl auth" first.')
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
    const hiddenCount = allModels.length - models.length
    this.log(`Found ${models.length} model(s).${hiddenCount > 0 ? ` (${hiddenCount} deactivated hidden)` : ''}`)

    let counts: Map<string, import('../api').ModelCounts> | undefined
    if (flags.detail) {
      this.log('Fetching object, relationship, and drawing counts...')
      counts = await fetchModelDetailCounts(token, models.map((m) => m.ModelId))
    }

    this.log()

    for (const line of formatModelTree(models, counts)) {
      this.log(line)
    }

    return {
      models: models.map((m) => {
        const json: ModelJson = {
          baselineModelId: m.BaselineModelId,
          description: m.Description,
          isHidden: m.IsHidden,
          modelId: m.ModelId,
          name: m.Name,
        }
        if (counts) {
          const c = counts.get(m.ModelId)
          if (c) json.counts = c
        }
        return json
      }),
    }
  }
}
