import {Command, Flags} from '@oclif/core'

import {getShowHiddenModels, getSolutionFilter, getToken, getUser, resetSettings, saveShowHiddenModels, saveSolutionFilter} from '../config'

export default class Config extends Command {
  static description = 'View or update configuration'

  static flags = {
    reset: Flags.boolean({description: 'Reset settings to defaults'}),
    'show-hidden': Flags.boolean({allowNo: true, description: 'Show or hide deactivated models'}),
    solution: Flags.string({description: 'Set solution filter (use "" to clear)'}),
  }

  async run(): Promise<void> {
    const {flags} = await this.parse(Config)
    let changed = false

    if (flags.reset) {
      resetSettings()
      this.log('Settings reset to defaults.')
      changed = true
    }

    if (flags.solution !== undefined) {
      saveSolutionFilter(flags.solution === '' ? undefined : flags.solution)
      this.log(flags.solution === '' ? 'Solution filter cleared.' : `Solution filter set to "${flags.solution}".`)
      changed = true
    }

    if (flags['show-hidden'] !== undefined) {
      saveShowHiddenModels(flags['show-hidden'])
      this.log(`Deactivated models will now be ${flags['show-hidden'] ? 'shown' : 'hidden'}.`)
      changed = true
    }

    if (changed) this.log()

    const token = getToken()
    const user = getUser()
    const filter = getSolutionFilter()
    const showHidden = getShowHiddenModels()

    this.log('Current configuration:')
    this.log()
    this.log(`  User:            ${user ? `${user.name} (${user.emailAddress})` : 'Not authenticated'}`)
    this.log(`  Token:           ${token ? `${token.slice(0, 20)}... (${token.length} chars)` : 'Not set'}`)
    this.log(`  Solution filter: ${filter ?? 'None (showing all models)'}`)
    this.log(`  Hidden models:   ${showHidden ? 'Shown' : 'Hidden'}`)
  }
}
