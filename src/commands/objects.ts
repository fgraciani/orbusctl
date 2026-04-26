import {Command, Flags} from '@oclif/core'

import {fetchModels, fetchObjectDetail, fetchObjectModelName, fetchObjectRelationships, fetchObjects} from '../api'
import {getShowHiddenModels, getSolutionFilter, getToken} from '../config'
import {formatObjectDetail, formatObjectTable} from '../ui/table'

export default class Objects extends Command {
  static description = 'List objects in a model'

  static flags = {
    model: Flags.string({char: 'm', description: 'Model name (or partial match)', required: true}),
    object: Flags.string({char: 'o', description: 'Object name (partial match) — show full details'}),
  }

  async run(): Promise<void> {
    const {flags} = await this.parse(Objects)
    const token = getToken()
    if (!token) {
      this.error('No token configured. Run "orbusctl auth" first.')
    }

    const filter = getSolutionFilter()
    const allModels = await fetchModels(token, filter)
    const showHidden = getShowHiddenModels()
    const models = showHidden ? allModels : allModels.filter((m) => !m.IsHidden)

    const match = models.find((m) => m.Name.toLowerCase().includes(flags.model.toLowerCase()))
    if (!match) {
      this.error(`No model found matching "${flags.model}".`)
    }

    this.log(`Fetching objects for "${match.Name}"...`)

    const objects = await fetchObjects(token, match.ModelId)

    if (flags.object) {
      const obj = objects.find((o) => o.Name.toLowerCase().includes(flags.object!.toLowerCase()))
      if (!obj) {
        this.error(`No object found matching "${flags.object}" in "${match.Name}".`)
      }

      this.log(`Fetching details for "${obj.Name}"...`)
      this.log()

      const detail = await fetchObjectDetail(token, obj.ObjectId)

      let originalModelName: string | null = null
      if (detail.Detail.Status !== 'Original' && detail.Detail.OriginalObjectId) {
        originalModelName = await fetchObjectModelName(token, detail.Detail.OriginalObjectId)
      }

      const relationships = await fetchObjectRelationships(token, obj.ObjectId)

      for (const line of formatObjectDetail(detail, originalModelName, relationships)) {
        this.log(line)
      }
    } else {
      this.log(`Found ${objects.length} object(s).`)
      this.log()

      for (const line of formatObjectTable(objects)) {
        this.log(line)
      }
    }
  }
}
