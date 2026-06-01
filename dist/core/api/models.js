import { getBaseUrl, odataList, odataCount, escapeODataString } from './client.js';
export async function fetchModels(token, solutionFilter) {
    let url = `${getBaseUrl()}/odata/Models?includeDeactivated=true&$select=ModelId,Name,Description,IsHidden,BaselineModelId`;
    if (solutionFilter) {
        url += `&$filter=Solutions/any(s: s/Name eq '${escapeODataString(solutionFilter)}')`;
    }
    return odataList(token, url);
}
export async function fetchSolutions(token) {
    return odataList(token, `${getBaseUrl()}/odata/Solutions?$select=SolutionId,Name`);
}
export async function fetchModelDetailCounts(token, modelIds) {
    const entries = await Promise.all(modelIds.map(async (id) => {
        const [objects, relationships, drawings] = await Promise.all([
            odataCount(token, 'Objects', id),
            odataCount(token, 'Relationships', id),
            odataCount(token, 'Documents', id),
        ]);
        return [id, { objects, relationships, drawings }];
    }));
    return new Map(entries);
}
