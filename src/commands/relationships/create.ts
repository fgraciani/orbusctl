import {scryptSync, timingSafeEqual} from 'node:crypto'

import {Command, Flags} from '@oclif/core'

import {createRelationship} from '../../api'
import {getToken, getUser} from '../../config'
import {logWrite} from '../../log'
import {resolveRelationshipTypeId} from '../../type-maps'

const WRITE_SALT = '9dc632722f5969c6b7df90968eead7cc'
const WRITE_HASH = 'becd93073ec4fa900ef9934909354a89bf49d05bac32666b36b394e839a9dcbe803aa35bc82536b66023b93e241af333944407853dc60815a7370d8be89fe480'

function verifyWrite(password: string): boolean {
  const hash = scryptSync(password, WRITE_SALT, 64)
  return timingSafeEqual(hash, Buffer.from(WRITE_HASH, 'hex'))
}

export default class RelationshipsCreate extends Command {
  static description = 'Create a relationship between two objects'

  static enableJsonFlag = true

  static flags = {
    alias: Flags.string({char: 'a', description: 'Alias value for the relationship'}),
    'lead-id': Flags.string({description: 'Lead object ID (GUID)', required: true}),
    'member-id': Flags.string({description: 'Member object ID (GUID)', required: true}),
    'model-id': Flags.string({char: 'm', description: 'Model ID (GUID)', required: true}),
    password: Flags.string({char: 'p', description: 'Write password'}),
    type: Flags.string({char: 't', description: 'Relationship type name', required: true}),
  }

  async run(): Promise<Record<string, unknown>> {
    const {flags} = await this.parse(RelationshipsCreate)

    const password = flags.password ?? process.env.ORBUSCTL_WRITE_KEY
    if (!password || !verifyWrite(password)) {
      this.error('Access denied. Provide the write password with --password or ORBUSCTL_WRITE_KEY.')
    }

    const token = getToken()
    if (!token) {
      this.error('No token configured. Run "orbusctl auth" first.')
    }

    const relationshipTypeId = resolveRelationshipTypeId(flags.type)

    this.log(`Creating ${flags.type} relationship...`)

    let result: Record<string, unknown>
    try {
      result = await createRelationship(token, flags['model-id'], relationshipTypeId, flags['lead-id'], flags['member-id'], flags.alias) as Record<string, unknown>
    } catch (err) {
      logWrite({operation: 'createRelationship', modelId: flags['model-id'], params: {type: flags.type, relationshipTypeId, leadId: flags['lead-id'], memberId: flags['member-id'], alias: flags.alias}, success: false, error: (err as Error).message, user: getUser()})
      throw err
    }

    logWrite({operation: 'createRelationship', modelId: flags['model-id'], params: {type: flags.type, relationshipTypeId, leadId: flags['lead-id'], memberId: flags['member-id'], alias: flags.alias}, success: true, result, user: getUser()})

    const msg = result.successMessage as Record<string, unknown> | undefined
    const def = msg?.messageDefinition as Record<string, unknown> | undefined
    const relationshipId = (def?.relationshipId ?? result.RelationshipId ?? result.relationshipId ?? null) as string | null

    this.log(`Created relationship: ${relationshipId ?? 'unknown'}`)

    return {
      alias: flags.alias ?? null,
      leadId: flags['lead-id'],
      memberId: flags['member-id'],
      modelId: flags['model-id'],
      relationshipId,
      relationshipType: flags.type,
      relationshipTypeId,
      result,
    }
  }
}
