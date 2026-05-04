import {scryptSync, timingSafeEqual} from 'node:crypto'

import {Command, Flags} from '@oclif/core'

import {updateRelationship, updateRelationshipAttributes} from '../../api'
import {resolveChoiceValues} from '../../choice-maps'
import {getToken, getUser} from '../../config'
import {logWrite} from '../../log'

const WRITE_SALT = '9dc632722f5969c6b7df90968eead7cc'
const WRITE_HASH = 'becd93073ec4fa900ef9934909354a89bf49d05bac32666b36b394e839a9dcbe803aa35bc82536b66023b93e241af333944407853dc60815a7370d8be89fe480'

function verifyWrite(password: string): boolean {
  const hash = scryptSync(password, WRITE_SALT, 64)
  return timingSafeEqual(hash, Buffer.from(WRITE_HASH, 'hex'))
}

export default class RelationshipsUpdate extends Command {
  static description = 'Update attribute values on an existing relationship'

  static enableJsonFlag = true

  static flags = {
    password: Flags.string({char: 'p', description: 'Write password'}),
    'relationship-id': Flags.string({description: 'Relationship ID (GUID)', required: true}),
    set: Flags.string({description: 'Text attribute key=value pair', multiple: true}),
    'set-choice': Flags.string({description: 'Choice attribute name=value1,value2 (e.g. "RASCI=R,A")', multiple: true}),
  }

  async run(): Promise<Record<string, unknown>> {
    const {flags} = await this.parse(RelationshipsUpdate)

    if (!flags.set && !flags['set-choice']) {
      this.error('At least one of --set or --set-choice must be provided.')
    }

    const password = flags.password ?? process.env.ORBUSCTL_WRITE_KEY
    if (!password || !verifyWrite(password)) {
      this.error('Access denied. Provide the write password with --password or ORBUSCTL_WRITE_KEY.')
    }

    const token = getToken()
    if (!token) {
      this.error('No token configured. Run "orbusctl auth" first.')
    }

    this.log(`Updating relationship ${flags['relationship-id']}...`)

    let result: Record<string, unknown>

    if (flags['set-choice']) {
      const attributeValues: unknown[] = []

      if (flags.set) {
        for (const pair of flags.set) {
          const eq = pair.indexOf('=')
          if (eq === -1) this.error(`Invalid --set value "${pair}": expected key=value`)
          attributeValues.push({
            attributeName: pair.slice(0, eq),
            attributeCategory: 'Text',
            textValue: {plainText: pair.slice(eq + 1), richText: null},
          })
        }
      }

      for (const pair of flags['set-choice']) {
        const eq = pair.indexOf('=')
        if (eq === -1) this.error(`Invalid --set-choice value "${pair}": expected AttributeName=Value1,Value2`)
        const attrName = pair.slice(0, eq)
        const values = pair.slice(eq + 1).split(',').map((v) => v.trim()).filter(Boolean)
        const {choiceValues} = resolveChoiceValues(attrName, values)
        attributeValues.push({
          attributeName: attrName,
          attributeCategory: 'Choice',
          choiceValues,
        })
      }

      const params = {relationshipId: flags['relationship-id'], attributeValues}
      try {
        result = await updateRelationshipAttributes(token, flags['relationship-id'], attributeValues) as Record<string, unknown>
      } catch (err) {
        logWrite({operation: 'updateRelationship', modelId: '', params, success: false, error: (err as Error).message, user: getUser()})
        throw err
      }
      logWrite({operation: 'updateRelationship', modelId: '', params, success: true, result, user: getUser()})
      this.log(`Updated relationship: ${flags['relationship-id']}`)
      return {attributeValues, relationshipId: flags['relationship-id'], result}
    }

    const attributes: Record<string, string> = {}
    for (const pair of flags.set!) {
      const eq = pair.indexOf('=')
      if (eq === -1) this.error(`Invalid --set value "${pair}": expected key=value`)
      attributes[pair.slice(0, eq)] = pair.slice(eq + 1)
    }

    try {
      result = await updateRelationship(token, flags['relationship-id'], attributes) as Record<string, unknown>
    } catch (err) {
      logWrite({operation: 'updateRelationship', modelId: '', params: {relationshipId: flags['relationship-id'], attributes}, success: false, error: (err as Error).message, user: getUser()})
      throw err
    }

    logWrite({operation: 'updateRelationship', modelId: '', params: {relationshipId: flags['relationship-id'], attributes}, success: true, result, user: getUser()})

    this.log(`Updated relationship: ${flags['relationship-id']}`)

    return {
      attributes,
      relationshipId: flags['relationship-id'],
      result,
    }
  }
}
