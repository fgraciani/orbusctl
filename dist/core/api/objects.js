import { getBaseUrl, odata, odataList } from './client.js';
function stripHtml(str) {
    if (!str)
        return str;
    return str.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim();
}
export async function fetchObjects(token, modelId) {
    return odataList(token, `${getBaseUrl()}/odata/Objects?$filter=ModelId eq ${modelId}&$select=ObjectId,Name,LastModifiedDate&$expand=ObjectType($select=Name),LastModifiedBy($select=Name)`);
}
export async function fetchObjectDetail(token, objectId) {
    const detail = await odata(token, `${getBaseUrl()}/odata/Objects(${objectId})?$expand=ObjectType,AttributeValues,Detail,CreatedBy,LastModifiedBy,LockedBy,Model`);
    for (const attr of detail.AttributeValues) {
        if (attr.StringValue)
            attr.StringValue = stripHtml(attr.StringValue);
    }
    return detail;
}
export async function fetchObjectRelationships(token, objectId) {
    const raw = await odataList(token, `${getBaseUrl()}/odata/Relationships?$filter=LeadObjectId eq ${objectId} or MemberObjectId eq ${objectId}&$expand=RelationshipType($select=Name),LeadObject($select=Name,ObjectId;$expand=ObjectType($select=Name)),MemberObject($select=Name,ObjectId;$expand=ObjectType($select=Name)),AttributeValues`);
    const result = [];
    for (const rel of raw) {
        if (!rel.RelationshipType)
            continue;
        const isLead = rel.LeadObject?.ObjectId === objectId;
        const related = isLead ? rel.MemberObject : rel.LeadObject;
        if (!related)
            continue;
        result.push({
            DirectionDescription: isLead ? 'Leads' : 'Member of',
            RelatedItem: { Name: related.Name, ObjectId: related.ObjectId, ObjectType: related.ObjectType },
            Relationship: {
                AttributeValues: rel.AttributeValues,
                RelationshipType: { Name: rel.RelationshipType.Name },
            },
        });
    }
    return result;
}
export async function fetchAllRelationships(token, modelId) {
    return odataList(token, `${getBaseUrl()}/odata/Relationships?$filter=ModelId eq ${modelId}&$select=RelationshipId,DateCreated&$expand=RelationshipType($select=Name),LeadObject($select=Name,ObjectId;$expand=ObjectType($select=Name)),MemberObject($select=Name,ObjectId;$expand=ObjectType($select=Name)),CreatedBy($select=Name),AttributeValues`);
}
export async function fetchObjectNameAndType(token, objectId) {
    try {
        const data = await odata(token, `${getBaseUrl()}/odata/Objects(${objectId})?$select=Name&$expand=ObjectType($select=Name)`);
        return { name: data.Name ?? 'Unknown', typeName: data.ObjectType?.Name ?? 'Unknown' };
    }
    catch {
        return { name: 'Unknown', typeName: 'Unknown' };
    }
}
