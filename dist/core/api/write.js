import { getBaseUrl, odataPost, odataPatch, odataDelete } from './client.js';
// --- Objects ---
export async function createObject(token, modelId, objectTypeId, name) {
    return odataPost(token, `${getBaseUrl()}/odata/Objects`, {
        modelId,
        objectTypeId,
        attributeValuesFlat: { Name: name },
    });
}
export async function updateObjectFlat(token, objectId, attributes) {
    return odataPatch(token, `${getBaseUrl()}/odata/Objects(${objectId})`, {
        attributeValuesFlat: attributes,
    });
}
export async function updateObjectAttributes(token, objectId, attributeValues) {
    return odataPatch(token, `${getBaseUrl()}/odata/Objects(${objectId})`, {
        attributeValues,
    });
}
export async function moveObjects(token, sourceObjectIds, targetModelId) {
    return odataPost(token, `${getBaseUrl()}/odata/Objects/Move`, {
        SourceObjectIds: sourceObjectIds,
        TargetModelId: targetModelId,
    });
}
// --- Relationships ---
export async function createRelationship(token, modelId, relationshipTypeId, leadId, memberId, attributes) {
    const body = {
        modelId,
        relationshipTypeId,
        leadModelItemId: leadId,
        memberModelItemId: memberId,
    };
    if (attributes && attributes.length > 0)
        body.attributeValues = attributes;
    return odataPost(token, `${getBaseUrl()}/odata/Relationships`, body);
}
export async function updateRelationshipFlat(token, relationshipId, attributes) {
    return odataPatch(token, `${getBaseUrl()}/odata/Relationships(${relationshipId})`, {
        attributeValuesFlat: attributes,
    });
}
export async function updateRelationshipAttributes(token, relationshipId, attributeValues) {
    return odataPatch(token, `${getBaseUrl()}/odata/Relationships(${relationshipId})`, {
        attributeValues,
    });
}
// --- Deletes ---
export async function deleteObject(token, objectId) {
    return odataDelete(token, `${getBaseUrl()}/odata/Objects(${objectId})`);
}
export async function deleteRelationship(token, relationshipId) {
    return odataDelete(token, `${getBaseUrl()}/odata/Relationships(${relationshipId})`);
}
