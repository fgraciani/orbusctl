import {scryptSync, timingSafeEqual} from 'node:crypto'

import {Command, Flags} from '@oclif/core'

import {createObject} from '../../api'
import {getToken, getUser} from '../../config'
import {logWrite} from '../../log'
import {resolveObjectTypeId} from '../../type-maps'

const WRITE_SALT = '9dc632722f5969c6b7df90968eead7cc'
const WRITE_HASH = 'becd93073ec4fa900ef9934909354a89bf49d05bac32666b36b394e839a9dcbe803aa35bc82536b66023b93e241af333944407853dc60815a7370d8be89fe480'

function verifyWrite(password: string): boolean {
  const hash = scryptSync(password, WRITE_SALT, 64)
  return timingSafeEqual(hash, Buffer.from(WRITE_HASH, 'hex'))
}

export default class ObjectsCreate extends Command {
  static description = 'Create an object in a model'

  static enableJsonFlag = true

  static flags = {
    'model-id': Flags.string({char: 'm', description: 'Model ID (GUID)', required: true}),
    name: Flags.string({char: 'n', description: 'Object name', required: true}),
    password: Flags.string({char: 'p', description: 'Write password'}),
    type: Flags.string({char: 't', description: 'Object type name', required: true}),
  }

  async run(): Promise<Record<string, unknown>> {
    const {flags} = await this.parse(ObjectsCreate)

    const password = flags.password ?? process.env.ORBUSCTL_WRITE_KEY
    if (!password || !verifyWrite(password)) {
      this.error('Access denied. Provide the write password with --password or ORBUSCTL_WRITE_KEY.')
    }

    const token = getToken()
    if (!token) {
      this.error('No token configured. Run "orbusctl auth" first.')
    }

    const objectTypeId = resolveObjectTypeId(flags.type)

    this.log(`Creating object "${flags.name}" (${flags.type}) in model ${flags['model-id']}...`)

    let result: Record<string, unknown>
    try {
      result = await createObject(token, flags['model-id'], objectTypeId, flags.name) as Record<string, unknown>
    } catch (err) {
      logWrite({operation: 'createObject', modelId: flags['model-id'], params: {name: flags.name, type: flags.type, objectTypeId}, success: false, error: (err as Error).message, user: getUser()})
      throw err
    }

    logWrite({operation: 'createObject', modelId: flags['model-id'], params: {name: flags.name, type: flags.type, objectTypeId}, success: true, result, user: getUser()})

    const msg = result.successMessage as Record<string, unknown> | undefined
    const def = msg?.messageDefinition as Record<string, unknown> | undefined
    const objectId = (def?.objectId ?? result.ObjectId ?? result.objectId ?? null) as string | null

    this.log(`Created object: ${objectId ?? 'unknown'}`)

    return {
      modelId: flags['model-id'],
      name: flags.name,
      objectId,
      objectType: flags.type,
      objectTypeId,
      result,
    }
  }
}
