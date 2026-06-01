import { getBaseUrl, odataList, odata } from './client.js';
export async function fetchRecentObjects(token, modelId, since) {
    const sinceISO = new Date(since).toISOString();
    const filter = `ModelId eq ${modelId} and (DateCreated gt ${sinceISO} or LastModifiedDate gt ${sinceISO})`;
    return odataList(token, `${getBaseUrl()}/odata/Objects?$filter=${filter}&$select=ObjectId,Name,DateCreated,LastModifiedDate,ModelId&$expand=ObjectType($select=Name),CreatedBy($select=Name),LastModifiedBy($select=Name)&$orderby=LastModifiedDate desc`);
}
// Relationships have NO server-side date filter (Bug 6).
// We fetch ordered by DateCreated desc and stop when we pass the cutoff.
export async function fetchRecentRelationships(token, modelId, since) {
    const cutoff = new Date(since).getTime();
    const all = [];
    let skip = 0;
    const PAGE = 50;
    for (;;) {
        const url = `${getBaseUrl()}/odata/Relationships?$filter=ModelId eq ${modelId}&$select=RelationshipId,DateCreated,ModelId&$expand=CreatedBy($select=Name)&$orderby=DateCreated desc&$top=${PAGE}&$skip=${skip}`;
        const data = await odata(token, url);
        let reachedCutoff = false;
        for (const rel of data.value) {
            if (new Date(rel.DateCreated).getTime() <= cutoff) {
                reachedCutoff = true;
                break;
            }
            all.push(rel);
        }
        if (reachedCutoff || data.value.length < PAGE)
            break;
        skip += PAGE;
    }
    return all;
}
