import {getToken, getUser} from './config'
import {logAuth} from './log'

const BASE_URL = 'https://eurocontrol-api.iserver365.com'

function logTokenExpired(): void {
  const expiredToken = getToken()
  const expiredUser = getUser()
  logAuth({
    event: 'expired',
    token: expiredToken ?? 'unknown',
    accountName: expiredUser?.accountName ?? 'unknown',
    userName: expiredUser?.name ?? 'unknown',
    emailAddress: expiredUser?.emailAddress ?? 'unknown',
  })
}

interface MeResponse {
  Name: string
  AccountName: string
  EmailAddress: string
}

export interface Model {
  BaselineModelId: string | null
  ModelId: string
  Name: string
  Description: string
  IsHidden: boolean
}

interface ModelsResponse {
  value: Model[]
}

const PAGE_SIZE = 50

export async function fetchModels(token: string, solutionFilter?: string): Promise<Model[]> {
  const all: Model[] = []
  let skip = 0

  for (;;) {
    let url = `${BASE_URL}/odata/Models?includeDeactivated=true&$select=ModelId,Name,Description,IsHidden,BaselineModelId&$top=${PAGE_SIZE}&$skip=${skip}`
    if (solutionFilter) {
      url += `&$filter=Solutions/any(s: s/Name eq '${solutionFilter}')`
    }
    const response = await fetch(url, {
      headers: {Authorization: `Bearer ${token}`},
    })

    if (!response.ok) {
      throw new Error(`Failed to fetch models (HTTP ${response.status})`)
    }

    const data = (await response.json()) as ModelsResponse
    all.push(...data.value)

    if (data.value.length < PAGE_SIZE) break
    skip += PAGE_SIZE
  }

  return all
}

export interface Solution {
  SolutionId: string
  Name: string
}

interface SolutionsResponse {
  value: Solution[]
}

interface CountResponse {
  '@odata.count': number
}

export interface ModelCounts {
  objects: number
  relationships: number
  drawings: number
}

async function fetchCount(token: string, entity: string, modelId: string): Promise<number> {
  const response = await fetch(
    `${BASE_URL}/odata/${entity}?$filter=ModelId eq ${modelId}&$count=true&$top=0`,
    {headers: {Authorization: `Bearer ${token}`}},
  )

  if (!response.ok) {
    throw new Error(`Failed to fetch ${entity} count (HTTP ${response.status})`)
  }

  const data = (await response.json()) as CountResponse
  return data['@odata.count']
}

export async function fetchModelDetailCounts(token: string, modelIds: string[]): Promise<Map<string, ModelCounts>> {
  const entries = await Promise.all(
    modelIds.map(async (id) => {
      const [objects, relationships, drawings] = await Promise.all([
        fetchCount(token, 'Objects', id),
        fetchCount(token, 'Relationships', id),
        fetchCount(token, 'Documents', id),
      ])
      return [id, {objects, relationships, drawings}] as const
    }),
  )
  return new Map(entries)
}

export interface OrbusObject {
  LastModifiedBy: {Name: string}
  LastModifiedDate: string
  Name: string
  ObjectId: string
  ObjectType: {Name: string}
}

interface ObjectsResponse {
  value: OrbusObject[]
}

export async function fetchObjects(token: string, modelId: string): Promise<OrbusObject[]> {
  const all: OrbusObject[] = []
  let skip = 0

  for (;;) {
    const url = `${BASE_URL}/odata/Objects?$filter=ModelId eq ${modelId}&$select=ObjectId,Name,LastModifiedDate&$expand=ObjectType($select=Name),LastModifiedBy($select=Name)&$top=${PAGE_SIZE}&$skip=${skip}`
    const response = await fetch(url, {
      headers: {Authorization: `Bearer ${token}`},
    })

    if (!response.ok) {
      throw new Error(`Failed to fetch objects (HTTP ${response.status})`)
    }

    const data = (await response.json()) as ObjectsResponse
    all.push(...data.value)

    if (data.value.length < PAGE_SIZE) break
    skip += PAGE_SIZE
  }

  return all
}

export interface AttributeValue {
  AttributeName: string
  StringValue: string | null
  Value?: boolean | number | string | null
}

export interface RelatedObject {
  DirectionDescription: string
  RelatedItem: {Name: string; ObjectId: string; ObjectType: {Name: string}}
  Relationship: {
    AttributeValues?: AttributeValue[]
    RelationshipType: {Name: string}
  }
}

export interface ObjectDetail {
  AttributeValues: AttributeValue[]
  CreatedBy: {Name: string}
  DateCreated: string
  Detail: {CurrentVersionNumber: number; OriginalObjectId: string | null; Status: string}
  LastModifiedBy: {Name: string}
  LastModifiedDate: string
  LockedBy: {Name: string} | null
  LockedOn: string | null
  Model: {Name: string}
  Name: string
  ObjectId: string
  ObjectType: {Description: string; Name: string}
}

export async function fetchObjectDetail(token: string, objectId: string): Promise<ObjectDetail> {
  const response = await fetch(
    `${BASE_URL}/odata/Objects(${objectId})?$expand=ObjectType,AttributeValues,Detail,CreatedBy,LastModifiedBy,LockedBy,Model`,
    {headers: {Authorization: `Bearer ${token}`}},
  )

  if (!response.ok) {
    throw new Error(`Failed to fetch object detail (HTTP ${response.status})`)
  }

  return (await response.json()) as ObjectDetail
}

export async function fetchObjectRelationships(token: string, objectId: string): Promise<RelatedObject[]> {
  const all: RelatedObject[] = []
  let skip = 0

  for (;;) {
    const url = `${BASE_URL}/odata/Relationships?$filter=LeadObjectId eq ${objectId} or MemberObjectId eq ${objectId}&$expand=RelationshipType($select=Name),LeadObject($select=Name,ObjectId;$expand=ObjectType($select=Name)),MemberObject($select=Name,ObjectId;$expand=ObjectType($select=Name)),AttributeValues&$top=${PAGE_SIZE}&$skip=${skip}`
    const response = await fetch(url, {headers: {Authorization: `Bearer ${token}`}})

    if (!response.ok) {
      throw new Error(`Failed to fetch relationships (HTTP ${response.status})`)
    }

    interface RawRel {
      AttributeValues?: AttributeValue[]
      LeadObject: {Name: string; ObjectId: string; ObjectType: {Name: string}} | null
      MemberObject: {Name: string; ObjectId: string; ObjectType: {Name: string}} | null
      RelationshipType: {Name: string} | null
    }

    const data = (await response.json()) as {value: RawRel[]}

    for (const rel of data.value) {
      if (!rel.RelationshipType) continue
      const isLead = rel.LeadObject?.ObjectId === objectId
      const related = isLead ? rel.MemberObject : rel.LeadObject
      if (!related) continue

      all.push({
        DirectionDescription: isLead ? 'Leads' : 'Member of',
        RelatedItem: {Name: related.Name, ObjectId: related.ObjectId, ObjectType: related.ObjectType},
        Relationship: {
          AttributeValues: rel.AttributeValues,
          RelationshipType: {Name: rel.RelationshipType.Name},
        },
      })
    }

    if (data.value.length < PAGE_SIZE) break
    skip += PAGE_SIZE
  }

  return all
}

export async function fetchObjectModelName(token: string, objectId: string): Promise<string | null> {
  const response = await fetch(
    `${BASE_URL}/odata/Objects(${objectId})?$select=ObjectId&$expand=Model($select=Name)`,
    {headers: {Authorization: `Bearer ${token}`}},
  )

  if (!response.ok) return null

  const data = (await response.json()) as {Model: {Name: string}}
  return data.Model?.Name ?? null
}

export async function fetchSolutions(token: string): Promise<Solution[]> {
  const response = await fetch(`${BASE_URL}/odata/Solutions?$select=SolutionId,Name`, {
    headers: {Authorization: `Bearer ${token}`},
  })

  if (!response.ok) {
    throw new Error(`Failed to fetch solutions (HTTP ${response.status})`)
  }

  const data = (await response.json()) as SolutionsResponse
  return data.value
}

export interface ActivityObject {
  CreatedBy: {Name: string}
  DateCreated: string
  LastModifiedBy: {Name: string}
  LastModifiedDate: string
  ModelId: string
  Name: string
  ObjectId: string
  ObjectType: {Name: string}
}

interface ActivityObjectsResponse {
  value: ActivityObject[]
}

export async function fetchRecentObjects(token: string, modelId: string, since: string): Promise<ActivityObject[]> {
  const all: ActivityObject[] = []
  let skip = 0
  const sinceISO = new Date(since).toISOString()

  for (;;) {
    const filter = `ModelId eq ${modelId} and (DateCreated gt ${sinceISO} or LastModifiedDate gt ${sinceISO})`
    const url = `${BASE_URL}/odata/Objects?$filter=${filter}&$select=ObjectId,Name,DateCreated,LastModifiedDate,ModelId&$expand=ObjectType($select=Name),CreatedBy($select=Name),LastModifiedBy($select=Name)&$orderby=LastModifiedDate desc&$top=${PAGE_SIZE}&$skip=${skip}`
    const response = await fetch(url, {
      headers: {Authorization: `Bearer ${token}`},
    })

    if (!response.ok) {
      if (response.status === 401) {
        logTokenExpired()
        throw new Error('TOKEN_EXPIRED')
      }
      throw new Error(`Failed to fetch recent objects (HTTP ${response.status})`)
    }

    const data = (await response.json()) as ActivityObjectsResponse
    all.push(...data.value)

    if (data.value.length < PAGE_SIZE) break
    skip += PAGE_SIZE
  }

  return all
}

export interface ActivityRelationship {
  CreatedBy: {Name: string}
  DateCreated: string
  ModelId: string
  RelationshipId: string
}

interface ActivityRelationshipsResponse {
  value: ActivityRelationship[]
}

export async function fetchRecentRelationships(token: string, modelId: string, since: string): Promise<ActivityRelationship[]> {
  const all: ActivityRelationship[] = []
  let skip = 0
  const cutoff = new Date(since).getTime()

  for (;;) {
    const url = `${BASE_URL}/odata/Relationships?$filter=ModelId eq ${modelId}&$select=RelationshipId,DateCreated,ModelId&$expand=CreatedBy($select=Name)&$orderby=DateCreated desc&$top=${PAGE_SIZE}&$skip=${skip}`
    const response = await fetch(url, {
      headers: {Authorization: `Bearer ${token}`},
    })

    if (!response.ok) {
      if (response.status === 401) {
        logTokenExpired()
        throw new Error('TOKEN_EXPIRED')
      }
      throw new Error(`Failed to fetch recent relationships (HTTP ${response.status})`)
    }

    const data = (await response.json()) as ActivityRelationshipsResponse

    let reachedCutoff = false
    for (const rel of data.value) {
      if (new Date(rel.DateCreated).getTime() <= cutoff) {
        reachedCutoff = true
        break
      }
      all.push(rel)
    }

    if (reachedCutoff || data.value.length < PAGE_SIZE) break
    skip += PAGE_SIZE
  }

  return all
}

export interface Drawing {
  DocumentId: string
  FileName: string
  DocumentTypeId: string
  DocumentAccessibilityCategory: string | null
}

export interface DocumentType {
  DocumentTypeId: string
  Name: string
}

export interface DrawingComponent {
  ComponentId: string
  ModelItemId: string
  RepresentationSituationId: number | null
  objectName: string | null
  objectTypeName: string | null
  isRelationship: boolean
  relationshipKind: 'Connector' | 'Containment' | 'Overlap' | null
  fromName: string | null
  toName: string | null
}

interface DrawingsResponse {
  value: Drawing[]
}

interface DocumentTypesResponse {
  value: DocumentType[]
}

interface RawComponent {
  ComponentId: string
  ModelItemId: string
  RepresentationSituationId: number | null
}

export async function fetchDocumentTypes(token: string): Promise<DocumentType[]> {
  const all: DocumentType[] = []
  let skip = 0

  for (;;) {
    const url = `${BASE_URL}/odata/DocumentTypes?$select=DocumentTypeId,Name&$top=${PAGE_SIZE}&$skip=${skip}`
    const response = await fetch(url, {headers: {Authorization: `Bearer ${token}`}})

    if (!response.ok) {
      throw new Error(`Failed to fetch document types (HTTP ${response.status})`)
    }

    const data = (await response.json()) as DocumentTypesResponse
    all.push(...data.value)

    if (data.value.length < PAGE_SIZE) break
    skip += PAGE_SIZE
  }

  return all
}

export async function fetchDrawings(token: string, modelId: string): Promise<Drawing[]> {
  const all: Drawing[] = []
  let skip = 0

  for (;;) {
    const url = `${BASE_URL}/odata/Documents?$filter=ModelId eq ${modelId}&$select=DocumentId,FileName,DocumentTypeId,DocumentAccessibilityCategory&$top=${PAGE_SIZE}&$skip=${skip}`
    const response = await fetch(url, {headers: {Authorization: `Bearer ${token}`}})

    if (!response.ok) {
      throw new Error(`Failed to fetch drawings (HTTP ${response.status})`)
    }

    const data = (await response.json()) as DrawingsResponse
    all.push(...data.value)

    if (data.value.length < PAGE_SIZE) break
    skip += PAGE_SIZE
  }

  return all
}

export async function fetchDrawingCount(token: string, modelId: string): Promise<number> {
  return fetchCount(token, 'Documents', modelId)
}

export async function fetchDrawingComponents(token: string, documentId: string): Promise<DrawingComponent[]> {
  const url = `${BASE_URL}/odata/Documents(${documentId})?$expand=Components($select=ComponentId,ModelItemId,RepresentationSituationId)`
  const response = await fetch(url, {headers: {Authorization: `Bearer ${token}`}})

  if (!response.ok) {
    throw new Error(`Failed to fetch drawing components (HTTP ${response.status})`)
  }

  const data = (await response.json()) as {Components: RawComponent[]}
  return (data.Components ?? []).map((raw): DrawingComponent => {
    const sit = raw.RepresentationSituationId
    if (sit === 1) {
      return {ComponentId: raw.ComponentId, ModelItemId: raw.ModelItemId, RepresentationSituationId: sit, objectName: null, objectTypeName: null, isRelationship: true, relationshipKind: 'Connector', fromName: null, toName: null}
    }
    if (sit === 2) {
      return {ComponentId: raw.ComponentId, ModelItemId: raw.ModelItemId, RepresentationSituationId: sit, objectName: null, objectTypeName: null, isRelationship: true, relationshipKind: 'Containment', fromName: null, toName: null}
    }
    if (sit === 3) {
      return {ComponentId: raw.ComponentId, ModelItemId: raw.ModelItemId, RepresentationSituationId: sit, objectName: null, objectTypeName: null, isRelationship: true, relationshipKind: 'Overlap', fromName: null, toName: null}
    }
    return {ComponentId: raw.ComponentId, ModelItemId: raw.ModelItemId, RepresentationSituationId: sit, objectName: null, objectTypeName: null, isRelationship: false, relationshipKind: null, fromName: null, toName: null}
  })
}

export async function fetchRelationshipEndpoints(
  token: string,
  relationshipId: string,
): Promise<{fromName: string; toName: string} | null> {
  const response = await fetch(
    `${BASE_URL}/odata/Relationships(${relationshipId})?$expand=LeadObject($select=Name),MemberObject($select=Name)`,
    {headers: {Authorization: `Bearer ${token}`}},
  )
  if (!response.ok) return null
  const data = (await response.json()) as {LeadObject?: {Name: string}; MemberObject?: {Name: string}}
  if (!data.LeadObject?.Name || !data.MemberObject?.Name) return null
  return {fromName: data.LeadObject.Name, toName: data.MemberObject.Name}
}

export async function fetchObjectNameAndType(token: string, objectId: string): Promise<{name: string; typeName: string}> {
  const response = await fetch(
    `${BASE_URL}/odata/Objects(${objectId})?$select=Name&$expand=ObjectType($select=Name)`,
    {headers: {Authorization: `Bearer ${token}`}},
  )
  if (!response.ok) return {name: 'Unknown', typeName: 'Unknown'}
  const data = (await response.json()) as {Name: string; ObjectType: {Name: string}}
  return {name: data.Name ?? 'Unknown', typeName: data.ObjectType?.Name ?? 'Unknown'}
}

export interface ExportRelationship {
  RelationshipId: string
  DateCreated: string
  AttributeValues?: AttributeValue[]
  CreatedBy: {Name: string}
  LeadObject: {Name: string; ObjectId: string; ObjectType: {Name: string}} | null
  MemberObject: {Name: string; ObjectId: string; ObjectType: {Name: string}} | null
  RelationshipType: {Name: string} | null
}

interface ExportRelationshipsResponse {
  value: ExportRelationship[]
}

export async function fetchAllRelationships(token: string, modelId: string): Promise<ExportRelationship[]> {
  const all: ExportRelationship[] = []
  let skip = 0

  for (;;) {
    const url = `${BASE_URL}/odata/Relationships?$filter=ModelId eq ${modelId}&$select=RelationshipId,DateCreated&$expand=RelationshipType($select=Name),LeadObject($select=Name,ObjectId;$expand=ObjectType($select=Name)),MemberObject($select=Name,ObjectId;$expand=ObjectType($select=Name)),CreatedBy($select=Name),AttributeValues&$top=${PAGE_SIZE}&$skip=${skip}`
    const response = await fetch(url, {
      headers: {Authorization: `Bearer ${token}`},
    })

    if (!response.ok) {
      throw new Error(`Failed to fetch relationships (HTTP ${response.status})`)
    }

    const data = (await response.json()) as ExportRelationshipsResponse
    all.push(...data.value)

    if (data.value.length < PAGE_SIZE) break
    skip += PAGE_SIZE
  }

  return all
}

export async function fetchDrawingsContainingObject(
  token: string,
  modelId: string,
  objectId: string,
): Promise<Array<{documentId: string; fileName: string}>> {
  const drawings = await fetchDrawings(token, modelId)

  const results = await Promise.all(
    drawings.map(async (d) => {
      const url = `${BASE_URL}/odata/Documents(${d.DocumentId})?$select=DocumentId&$expand=Components($filter=ModelItemId eq ${objectId};$select=ComponentId;$top=1)`
      const response = await fetch(url, {headers: {Authorization: `Bearer ${token}`}})
      if (!response.ok) return null
      const data = (await response.json()) as {Components: unknown[]}
      return data.Components?.length > 0 ? {documentId: d.DocumentId, fileName: d.FileName} : null
    }),
  )

  return results.filter((r): r is {documentId: string; fileName: string} => r !== null)
}

export async function fetchMe(token: string): Promise<MeResponse> {
  const response = await fetch(`${BASE_URL}/odata/Me`, {
    headers: {Authorization: `Bearer ${token}`},
  })

  if (!response.ok) {
    throw new Error(`Authentication failed (HTTP ${response.status})`)
  }

  return response.json() as Promise<MeResponse>
}

export async function createObject(token: string, modelId: string, objectTypeId: string, name: string): Promise<unknown> {
  const response = await fetch(`${BASE_URL}/odata/Objects`, {
    body: JSON.stringify({modelId, objectTypeId, attributeValuesFlat: {Name: name}}),
    headers: {Authorization: `Bearer ${token}`, 'Content-Type': 'application/json'},
    method: 'POST',
  })

  if (!response.ok) {
    throw new Error(`Failed to create object (HTTP ${response.status})`)
  }

  return response.json()
}

export async function createRelationship(token: string, modelId: string, relationshipTypeId: string, leadId: string, memberId: string, alias?: string): Promise<unknown> {
  const response = await fetch(`${BASE_URL}/odata/Relationships`, {
    body: JSON.stringify({
      modelId,
      relationshipTypeId,
      leadModelItemId: leadId,
      memberModelItemId: memberId,
      ...(alias ? {attributeValues: [{attributeName: 'Alias', stringValue: alias}]} : {}),
    }),
    headers: {Authorization: `Bearer ${token}`, 'Content-Type': 'application/json'},
    method: 'POST',
  })

  if (!response.ok) {
    throw new Error(`Failed to create relationship (HTTP ${response.status})`)
  }

  return response.json()
}
