import { getBaseUrl, odataPost, odataPatch, odataDelete } from './client.js';

// --- Objects ---

export async function createObject(
  token: string,
  modelId: string,
  objectTypeId: string,
  name: string,
): Promise<unknown> {
  return odataPost(token, `${getBaseUrl()}/odata/Objects`, {
    modelId,
    objectTypeId,
    attributeValuesFlat: { Name: name },
  });
}

export async function updateObjectFlat(
  token: string,
  objectId: string,
  attributes: Record<string, string>,
): Promise<unknown> {
  return odataPatch(token, `${getBaseUrl()}/odata/Objects(${objectId})`, {
    attributeValuesFlat: attributes,
  });
}

export async function updateObjectAttributes(
  token: string,
  objectId: string,
  attributeValues: unknown[],
): Promise<unknown> {
  return odataPatch(token, `${getBaseUrl()}/odata/Objects(${objectId})`, {
    attributeValues,
  });
}

export async function moveObjects(
  token: string,
  sourceObjectIds: string[],
  targetModelId: string,
): Promise<unknown> {
  return odataPost(token, `${getBaseUrl()}/odata/Objects/Move`, {
    SourceObjectIds: sourceObjectIds,
    TargetModelId: targetModelId,
  });
}

// --- Relationships ---

export async function createRelationship(
  token: string,
  modelId: string,
  relationshipTypeId: string,
  leadId: string,
  memberId: string,
  attributes?: Array<{ attributeName: string; stringValue: string }>,
): Promise<unknown> {
  const body: Record<string, unknown> = {
    modelId,
    relationshipTypeId,
    leadModelItemId: leadId,
    memberModelItemId: memberId,
  };
  if (attributes && attributes.length > 0) body.attributeValues = attributes;
  return odataPost(token, `${getBaseUrl()}/odata/Relationships`, body);
}

export async function updateRelationshipFlat(
  token: string,
  relationshipId: string,
  attributes: Record<string, string>,
): Promise<unknown> {
  return odataPatch(token, `${getBaseUrl()}/odata/Relationships(${relationshipId})`, {
    attributeValuesFlat: attributes,
  });
}

export async function updateRelationshipAttributes(
  token: string,
  relationshipId: string,
  attributeValues: unknown[],
): Promise<unknown> {
  return odataPatch(token, `${getBaseUrl()}/odata/Relationships(${relationshipId})`, {
    attributeValues,
  });
}

// --- Deletes ---

export async function deleteObject(token: string, objectId: string): Promise<void> {
  return odataDelete(token, `${getBaseUrl()}/odata/Objects(${objectId})`);
}

export async function deleteRelationship(token: string, relationshipId: string): Promise<void> {
  return odataDelete(token, `${getBaseUrl()}/odata/Relationships(${relationshipId})`);
}
