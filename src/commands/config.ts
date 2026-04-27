import {Command, Flags} from '@oclif/core'

import {getBannerColor, getShowHiddenModels, getSolutionFilter, getToken, getUser, resetSettings, saveBannerColor, saveShowHiddenModels, saveSolutionFilter} from '../config'

interface ConfigResult {
  bannerColor: number | null
  showHiddenModels: boolean
  solutionFilter: string | null
  token: string | null
  user: {accountName: string; emailAddress: string; name: string} | null
}

export default class Config extends Command {
  static description = 'View or update configuration'

  static enableJsonFlag = true

  static flags = {
    'banner-color': Flags.string({description: 'Set banner color 0-255, or "random"'}),
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

    if (flags['banner-color'] !== undefined) {
      if (flags['banner-color'] === 'random') {
        saveBannerColor(undefined)
        this.log('Banner color set to random.')
      } else {
        const n = Number.parseInt(flags['banner-color'], 10)
        if (Number.isNaN(n) || n < 0 || n > 255) {
          this.error('Banner color must be a number between 0 and 255, or "random".')
        }
        saveBannerColor(n)
        this.log(`Banner color set to ${n}.`)
      }
    }

    if (flags.reset || flags.solution !== undefined || flags['show-hidden'] !== undefined || flags['banner-color'] !== undefined) this.log()

    const token = getToken()
    const user = getUser()
    const filter = getSolutionFilter()
    const showHidden = getShowHiddenModels()
    const bannerColor = getBannerColor()

    this.log('Current configuration:')
    this.log()
    this.log(`  User:            ${user ? `${user.name} (${user.emailAddress})` : 'Not authenticated'}`)
    this.log(`  Token:           ${token ? `${token.slice(0, 20)}... (${token.length} chars)` : 'Not set'}`)
    this.log(`  Solution filter: ${filter ?? 'None (showing all models)'}`)
    this.log(`  Hidden models:   ${showHidden ? 'Shown' : 'Hidden'}`)
    this.log(`  Banner color:    ${bannerColor !== undefined ? `\x1b[38;5;${bannerColor}m${bannerColor}\x1b[0m` : 'random'}`)

    return {
      bannerColor: bannerColor ?? null,
      showHiddenModels: showHidden,
      solutionFilter: filter ?? null,
      token: token ? `${token.slice(0, 20)}...` : null,
      user: user ? {accountName: user.accountName, emailAddress: user.emailAddress, name: user.name} : null,
    }
  }
}
