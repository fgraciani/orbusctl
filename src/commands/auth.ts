import {input} from '@inquirer/prompts'
import {Args, Command, Flags} from '@oclif/core'

import {fetchMe} from '../api'
import {saveAuth} from '../config'

export default class Auth extends Command {
  static args = {
    token: Args.string({description: 'Bearer token to validate and save', required: false}),
  }

  static description = 'Set authentication token'

  static enableJsonFlag = true

  static flags = {
    token: Flags.string({char: 't', description: 'Bearer token to validate and save'}),
  }

  async run(): Promise<{accountName: string; emailAddress: string; name: string}> {
    const {args, flags} = await this.parse(Auth)
    let token = flags.token ?? args.token

    if (!token) {
      if (this.jsonEnabled()) {
        this.error('Token is required in JSON mode. Use --token or pass as argument.')
      }

      token = await input({message: 'Enter your bearer token:'})
    }

    this.log('Validating token...')

    const me = await fetchMe(token)
    saveAuth(token, {
      name: me.Name,
      accountName: me.AccountName,
      emailAddress: me.EmailAddress,
    })
    this.log(`Authenticated as ${me.Name} (${me.EmailAddress}).`)
    this.log('Token saved to ~/.orbusctl/config.json.')

    return {
      accountName: me.AccountName,
      emailAddress: me.EmailAddress,
      name: me.Name,
    }
  }
}
