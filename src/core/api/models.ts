import { getBaseUrl, odataList, odataCount, odata, escapeODataString } from './client.js';

export interface Model {
  BaselineModelId: string | null;
  ModelId: string;
  Name: string;
  Description: string;
  IsHidden: boolean;
}

export interface Solution {
  SolutionId: string;
  Name: string;
}

export interface ModelCounts {
  objects: number;
  relationships: number;
  drawings: number;
}

export async function fetchModels(token: string, solutionFilter?: string): Promise<Model[]> {
  let url = `${getBaseUrl()}/odata/Models?includeDeactivated=true&$select=ModelId,Name,Description,IsHidden,BaselineModelId`;
  if (solutionFilter) {
    url += `&$filter=Solutions/any(s: s/Name eq '${escapeODataString(solutionFilter)}')`;
  }
  return odataList<Model>(token, url);
}

export async function fetchSolutions(token: string): Promise<Solution[]> {
  return odataList<Solution>(token, `${getBaseUrl()}/odata/Solutions?$select=SolutionId,Name`);
}

export async function fetchModelDetailCounts(token: string, modelIds: string[]): Promise<Map<string, ModelCounts>> {
  const entries = await Promise.all(
    modelIds.map(async (id) => {
      const [objects, relationships, drawings] = await Promise.all([
        odataCount(token, 'Objects', id),
        odataCount(token, 'Relationships', id),
        odataCount(token, 'Documents', id),
      ]);
      return [id, { objects, relationships, drawings }] as const;
    }),
  );
  return new Map(entries);
}
