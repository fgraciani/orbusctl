const BASE_URL = 'https://eurocontrol-api.iserver365.com'

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
      const [objects, relationships] = await Promise.all([
        fetchCount(token, 'Objects', id),
        fetchCount(token, 'Relationships', id),
      ])
      return [id, {objects, relationships}] as const
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
  Relationship: {RelationshipType: {Name: string}}
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
  const response = await fetch(
    `${BASE_URL}/odata/Objects(${objectId})?$select=ObjectId&$expand=RelatedObjects($expand=RelatedItem($select=Name,ObjectId;$expand=ObjectType($select=Name)),Relationship($expand=RelationshipType($select=Name)))`,
    {headers: {Authorization: `Bearer ${token}`}},
  )

  if (!response.ok) {
    throw new Error(`Failed to fetch relationships (HTTP ${response.status})`)
  }

  const data = (await response.json()) as {RelatedObjects: RelatedObject[]}
  return data.RelatedObjects ?? []
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

export async function fetchMe(token: string): Promise<MeResponse> {
  const response = await fetch(`${BASE_URL}/odata/Me`, {
    headers: {Authorization: `Bearer ${token}`},
  })

  if (!response.ok) {
    throw new Error(`Authentication failed (HTTP ${response.status})`)
  }

  return response.json() as Promise<MeResponse>
}
