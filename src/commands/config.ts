import {Command, Flags} from '@oclif/core'

import {getShowHiddenModels, getSolutionFilter, getToken, getUser, resetSettings, saveShowHiddenModels, saveSolutionFilter} from '../config'

interface ConfigResult {
  showHiddenModels: boolean
  solutionFilter: string | null
  token: string | null
  user: {accountName: string; emailAddress: string; name: string} | null
}

export default class Config extends Command {
  static description = 'View or update configuration'

  static enableJsonFlag = true

  static flags = {
    reset: Flags.boolean({description: 'Reset settings to defaults'}),
    'show-hidden': Flags.boolean({allowNo: true, description: 'Show or hide deactivated models'}),
    solution: Flags.string({description: 'Set solution filter (use "" to clear)'}),
  }

  async run(): Promise<ConfigResult> {
    const {flags} = await this.parse(Config)

    if (flags.reset) {
      resetSettings()
      this.log('Settings reset to defaults.')
    }

    if (flags.solution !== undefined) {
      saveSolutionFilter(flags.solution === '' ? undefined : flags.solution)
      this.log(flags.solution === '' ? 'Solution filter cleared.' : `Solution filter set to "${flags.solution}".`)
    }

    if (flags['show-hidden'] !== undefined) {
      saveShowHiddenModels(flags['show-hidden'])
      this.log(`Deactivated models will now be ${flags['show-hidden'] ? 'shown' : 'hidden'}.`)
    }

    if (flags.reset || flags.solution !== undefined || flags['show-hidden'] !== undefined) this.log()

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

    return {
      showHiddenModels: showHidden,
      solutionFilter: filter ?? null,
      token: token ? `${token.slice(0, 20)}...` : null,
      user: user ? {accountName: user.accountName, emailAddress: user.emailAddress, name: user.name} : null,
    }
  }
}
