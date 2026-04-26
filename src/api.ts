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
