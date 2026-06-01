import { getBaseUrl, odata, odataList } from './client.js';
import { fetchObjectNameAndType } from './objects.js';
export async function fetchDrawings(token, modelId) {
    return odataList(token, `${getBaseUrl()}/odata/Documents?$filter=ModelId eq ${modelId}&$select=DocumentId,FileName,DocumentTypeId,DocumentAccessibilityCategory`);
}
export async function fetchDocumentTypes(token) {
    return odataList(token, `${getBaseUrl()}/odata/DocumentTypes?$select=DocumentTypeId,Name`);
}
export async function fetchDrawingComponents(token, documentId) {
    const data = await odata(token, `${getBaseUrl()}/odata/Documents(${documentId})?$expand=Components($select=ComponentId,ModelItemId,RepresentationSituationId)`);
    return (data.Components ?? []).map((raw) => {
        const sit = raw.RepresentationSituationId;
        const isRel = sit === 1 || sit === 2 || sit === 3;
        const kind = sit === 1 ? 'Connector' : sit === 2 ? 'Containment' : sit === 3 ? 'Overlap' : null;
        return { ComponentId: raw.ComponentId, ModelItemId: raw.ModelItemId, RepresentationSituationId: sit, isRelationship: isRel, relationshipKind: kind };
    });
}
async function fetchRelationshipEndpoints(token, relationshipId) {
    try {
        const data = await odata(token, `${getBaseUrl()}/odata/Relationships(${relationshipId})?$expand=LeadObject($select=Name),MemberObject($select=Name)`);
        if (!data.LeadObject?.Name || !data.MemberObject?.Name)
            return null;
        return { fromName: data.LeadObject.Name, toName: data.MemberObject.Name };
    }
    catch {
        return null;
    }
}
export async function resolveDrawingComponents(token, documentId) {
    const components = await fetchDrawingComponents(token, documentId);
    const resolved = await Promise.all(components.map(async (c) => {
        if (c.isRelationship) {
            const endpoints = await fetchRelationshipEndpoints(token, c.ModelItemId);
            return {
                objectId: c.ModelItemId,
                name: endpoints ? `${endpoints.fromName} → ${endpoints.toName}` : 'Unknown relationship',
                typeName: c.relationshipKind ?? 'Relationship',
                isRelationship: true,
                relationshipKind: c.relationshipKind,
                fromName: endpoints?.fromName,
                toName: endpoints?.toName,
            };
        }
        const obj = await fetchObjectNameAndType(token, c.ModelItemId);
        return { objectId: c.ModelItemId, name: obj.name, typeName: obj.typeName, isRelationship: false, relationshipKind: null };
    }));
    return resolved;
}
