import {scryptSync, timingSafeEqual} from 'node:crypto'

import {Command, Flags} from '@oclif/core'

import {type ExportRelationship, type Model, createRelationship, fetchAllRelationships, fetchDrawings, fetchModel, fetchModels, fetchObjects, moveObjects} from '../../api'
import {getExportsDir, getShowHiddenModels, getSolutionFilter, getToken, getUser} from '../../config'
import {type CorrelationEntry, type CorrelationTable, saveCorrelationTable} from '../../correlation'
import {logWrite} from '../../log'
import {resolveRelationshipTypeId} from '../../type-maps'
import {resolveMatch} from '../../utils/resolve'

const WRITE_SALT = '9dc632722f5969c6b7df90968eead7cc'
const WRITE_HASH = 'becd93073ec4fa900ef9934909354a89bf49d05bac32666b36b394e839a9dcbe803aa35bc82536b66023b93e241af333944407853dc60815a7370d8be89fe480'

const REL_AUTO_GENERATED = new Set([
  'iServer365 Id',
  'Created By',
  'Date Created',
  'Last Modified By',
  'Date Last Modified',
  'Lead Object',
  'Lead Model Item Id',
  'Member Object',
  'Member Model Item Id',
  'Relationship',
  'Metamodel Item Id',
  'Metamodel Item Name',
])

function verifyWrite(password: string): boolean {
  const hash = scryptSync(password, WRITE_SALT, 64)
  return timingSafeEqual(hash, Buffer.from(WRITE_HASH, 'hex'))
}

async function resolveModel(token: string, name: string | undefined, id: string | undefined, label: string, onError: (msg: string) => never): Promise<Model> {
  if (id) return fetchModel(token, id)
  const filter = getSolutionFilter()
  const allModels = await fetchModels(token, filter)
  const showHidden = getShowHiddenModels()
  const models = showHidden ? allModels : allModels.filter((m) => !m.IsHidden)
  return resolveMatch(models, name!, (m) => m.Name, label, onError)
}

export default class ObjectsMove extends Command {
  static description = 'Move all objects from a source model to a target model'

  static enableJsonFlag = true

  static flags = {
    'dry-run': Flags.boolean({default: false, description: 'Show what would be moved without executing'}),
    password: Flags.string({char: 'p', description: 'Write password'}),
    source: Flags.string({char: 's', description: 'Source model name (partial match)'}),
    'source-id': Flags.string({description: 'Source model ID (GUID)'}),
    target: Flags.string({char: 't', description: 'Target model name (partial match)'}),
    'target-id': Flags.string({description: 'Target model ID (GUID)'}),
  }

  async run(): Promise<Record<string, unknown>> {
    const {flags} = await this.parse(ObjectsMove)

    const password = flags.password ?? process.env.ORBUSCTL_WRITE_KEY
    if (!password || !verifyWrite(password)) {
      this.error('Access denied. Provide the write password with --password or ORBUSCTL_WRITE_KEY.')
    }

    const token = getToken()
    if (!token) {
      this.error('No token configured. Run "orbusctl auth" first.')
    }

    if (flags.source && flags['source-id']) this.error('Provide --source or --source-id, not both.')
    if (!flags.source && !flags['source-id']) this.error('Provide --source (name) or --source-id (GUID).')
    if (flags.target && flags['target-id']) this.error('Provide --target or --target-id, not both.')
    if (!flags.target && !flags['target-id']) this.error('Provide --target (name) or --target-id (GUID).')

    const [sourceModel, targetModel] = await Promise.all([
      resolveModel(token, flags.source, flags['source-id'], 'source model', (msg) => this.error(msg)),
      resolveModel(token, flags.target, flags['target-id'], 'target model', (msg) => this.error(msg)),
    ])

    const [objects, relationships, drawings] = await Promise.all([
      fetchObjects(token, sourceModel.ModelId),
      fetchAllRelationships(token, sourceModel.ModelId),
      fetchDrawings(token, sourceModel.ModelId),
    ])

    const objectCount = objects.length
    const relationshipCount = relationships.length
    const drawingCount = drawings.length

    this.log(`Source: ${sourceModel.Name} (${sourceModel.ModelId})`)
    this.log(`Target: ${targetModel.Name} (${targetModel.ModelId})`)
    this.log('')
    this.log(`Objects:       ${objectCount}`)
    this.log(`Relationships: ${relationshipCount}`)
    this.log(`Drawings:      ${drawingCount} (will NOT be moved — manual migration required)`)

    if (flags['dry-run']) {
      this.log('')
      this.log('Dry run — no changes made.')
      return {
        source: {modelId: sourceModel.ModelId, name: sourceModel.Name},
        target: {modelId: targetModel.ModelId, name: targetModel.Name},
        preMoveCount: {objects: objectCount, relationships: relationshipCount, drawings: drawingCount},
        postMoveCount: null,
        relationshipsAttempted: null,
        relationshipsSucceeded: null,
        relationshipsFailed: null,
        failures: [],
        correlationFile: null,
        dryRun: true,
      }
    }

    const sourceObjectIds = objects.map((o) => o.ObjectId)

    let moveResult: unknown
    try {
      moveResult = await moveObjects(token, sourceObjectIds, targetModel.ModelId)
    } catch (err) {
      logWrite({
        operation: 'moveObjects',
        modelId: sourceModel.ModelId,
        params: {sourceModelId: sourceModel.ModelId, targetModelId: targetModel.ModelId, objectCount},
        success: false,
        error: (err as Error).message,
        user: getUser(),
      })
      throw err
    }

    this.log('')
    this.log('Move complete.')

    logWrite({
      operation: 'moveObjects',
      modelId: sourceModel.ModelId,
      params: {sourceModelId: sourceModel.ModelId, targetModelId: targetModel.ModelId, objectCount},
      success: true,
      result: moveResult,
      user: getUser(),
    })

    // Build object correlation entries — for a move, IDs are preserved (identity)
    const targetObjects = await fetchObjects(token, targetModel.ModelId)
    const targetObjectIdSet = new Set(targetObjects.map((o) => o.ObjectId))
    const sourceObjectIdSet = new Set(sourceObjectIds)

    const objectEntries: CorrelationEntry[] = objects.map((o) => ({
      type: 'object' as const,
      name: o.Name,
      typeName: o.ObjectType?.Name ?? 'Unknown',
      oldId: o.ObjectId,
      newId: targetObjectIdSet.has(o.ObjectId) ? o.ObjectId : null,
      status: targetObjectIdSet.has(o.ObjectId) ? ('identity' as const) : ('failed' as const),
      ...(targetObjectIdSet.has(o.ObjectId) ? {} : {error: 'Object not found in target after move'}),
    }))

    const postObjectCount = targetObjects.length

    // Recreate relationships in the target model
    const relEntries: CorrelationEntry[] = []
    const failures: Array<{type: string; lead: string; member: string; error: string}> = []
    let successCount = 0
    let failCount = 0

    process.stderr.write(`  Recreating relationships (0/${relationshipCount})...`)

    for (let i = 0; i < relationships.length; i++) {
      const rel = relationships[i]
      process.stderr.write(`\r  Recreating relationships (${i + 1}/${relationshipCount})...`)

      const relEntry = await recreateRelationship(token, rel, targetModel.ModelId, sourceObjectIdSet)
      relEntries.push(relEntry)

      if (relEntry.status === 'ok') {
        successCount++
      } else {
        failCount++
        failures.push({
          type: rel.RelationshipType?.Name ?? 'Unknown',
          lead: rel.LeadObject?.Name ?? 'Unknown',
          member: rel.MemberObject?.Name ?? 'Unknown',
          error: relEntry.error ?? 'Unknown error',
        })
      }
    }

    process.stderr.write('\n')

    logWrite({
      operation: 'recreateRelationships',
      modelId: targetModel.ModelId,
      params: {total: relationships.length, succeeded: successCount, failed: failCount},
      success: failCount === 0,
      user: getUser(),
    })

    // Save correlation table
    const table: CorrelationTable = {
      timestamp: new Date().toISOString(),
      operation: 'move',
      source: {modelId: sourceModel.ModelId, name: sourceModel.Name},
      target: {modelId: targetModel.ModelId, name: targetModel.Name},
      entries: [...objectEntries, ...relEntries],
    }

    const correlationFile = saveCorrelationTable(table, getExportsDir())

    // Report results
    const objectsOk = postObjectCount === objectCount
    const relsOk = failCount === 0

    this.log(`Relationships: ${relationshipCount} attempted, ${successCount} succeeded, ${failCount} failed`)

    if (failures.length > 0) {
      this.log('')
      this.log('Failed relationships:')
      for (const f of failures) {
        this.log(`  ${f.type}  "${f.lead}" -> "${f.member}": ${f.error}`)
      }
    }

    this.log('')
    this.log(`Objects:       ${objectCount} -> ${postObjectCount} (${objectsOk ? 'OK' : 'WARNING: count mismatch'})`)
    this.log(`Relationships: ${relationshipCount} -> ${successCount} (${relsOk ? 'OK' : `WARNING: ${failCount} failed`})`)
    this.log(`Drawings:      ${drawingCount} (not moved — requires manual XML migration)`)
    this.log('')
    this.log(`Correlation table saved to ${correlationFile}`)

    return {
      source: {modelId: sourceModel.ModelId, name: sourceModel.Name},
      target: {modelId: targetModel.ModelId, name: targetModel.Name},
      preMoveCount: {objects: objectCount, relationships: relationshipCount, drawings: drawingCount},
      postMoveCount: {objects: postObjectCount, relationships: successCount, drawings: 0},
      relationshipsAttempted: relationshipCount,
      relationshipsSucceeded: successCount,
      relationshipsFailed: failCount,
      failures,
      correlationFile,
      dryRun: false,
    }
  }
}

async function recreateRelationship(
  token: string,
  rel: ExportRelationship,
  targetModelId: string,
  sourceObjectIdSet: Set<string>,
): Promise<CorrelationEntry> {
  const leadId = rel.LeadObject?.ObjectId ?? null
  const memberId = rel.MemberObject?.ObjectId ?? null
  const typeName = rel.RelationshipType?.Name ?? null
  const leadName = rel.LeadObject?.Name ?? 'Unknown'
  const memberName = rel.MemberObject?.Name ?? 'Unknown'
  const entryName = `${leadName} -> ${memberName}`
  const entryTypeName = typeName ?? 'Unknown'

  if (!leadId || !memberId || !typeName) {
    return {
      type: 'relationship',
      name: entryName,
      typeName: entryTypeName,
      oldId: rel.RelationshipId,
      newId: null,
      status: 'failed',
      error: 'Missing lead, member, or relationship type',
    }
  }

  // Only recreate if both objects are from the source model (moved objects)
  if (!sourceObjectIdSet.has(leadId) || !sourceObjectIdSet.has(memberId)) {
    return {
      type: 'relationship',
      name: entryName,
      typeName: entryTypeName,
      oldId: rel.RelationshipId,
      newId: null,
      status: 'failed',
      error: 'Lead or member object not in source model object set',
    }
  }

  let relationshipTypeId: string
  try {
    relationshipTypeId = resolveRelationshipTypeId(typeName)
  } catch (err) {
    return {
      type: 'relationship',
      name: entryName,
      typeName: entryTypeName,
      oldId: rel.RelationshipId,
      newId: null,
      status: 'failed',
      error: (err as Error).message,
    }
  }

  const attributes = (rel.AttributeValues ?? [])
    .filter((a) => !REL_AUTO_GENERATED.has(a.AttributeName))
    .filter((a) => a.StringValue != null && a.StringValue !== '')
    .map((a) => ({attributeName: a.AttributeName, stringValue: a.StringValue!}))

  let result: Record<string, unknown>
  try {
    result = (await createRelationship(token, targetModelId, relationshipTypeId, leadId, memberId, attributes.length > 0 ? attributes : undefined)) as Record<string, unknown>
  } catch (err) {
    return {
      type: 'relationship',
      name: entryName,
      typeName: entryTypeName,
      oldId: rel.RelationshipId,
      newId: null,
      status: 'failed',
      error: (err as Error).message,
    }
  }

  const msg = result.successMessage as Record<string, unknown> | undefined
  const def = msg?.messageDefinition as Record<string, unknown> | undefined
  const newRelId = (def?.relationshipId ?? result.RelationshipId ?? result.relationshipId ?? null) as string | null

  return {
    type: 'relationship',
    name: entryName,
    typeName: entryTypeName,
    oldId: rel.RelationshipId,
    newId: newRelId,
    status: 'ok',
  }
}
