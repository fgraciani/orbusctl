import {Command} from '@oclif/core'

import {checkForUpdate, getLocalVersion} from '../update'

export default class Version extends Command {
  static description = 'Show version and check for updates'

  async run(): Promise<void> {
    const local = getLocalVersion()
    this.log(`orbusctl v${local}`)
    this.log()
    this.log('Checking for updates...')

    const remote = await checkForUpdate()
    if (remote && remote !== local) {
      this.log(`Update available: v${local} → v${remote}`)
      this.log('Run: npm install -g github:fgraciani/orbusctl')
    } else {
      this.log('You are on the latest version.')
    }
  }
}
