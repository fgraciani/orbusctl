import { getBaseUrl, odata, odataList } from './client.js';
import { fetchObjectNameAndType } from './objects.js';

export interface Drawing {
  DocumentId: string;
  FileName: string;
  DocumentTypeId: string;
  DocumentAccessibilityCategory: string | null;
}

export interface DocumentType {
  DocumentTypeId: string;
  Name: string;
}

export interface DrawingComponent {
  ComponentId: string;
  ModelItemId: string;
  RepresentationSituationId: number | null;
  isRelationship: boolean;
  relationshipKind: 'Connector' | 'Containment' | 'Overlap' | null;
}

interface RawComponent {
  ComponentId: string;
  ModelItemId: string;
  RepresentationSituationId: number | null;
}

export async function fetchDrawings(token: string, modelId: string): Promise<Drawing[]> {
  return odataList<Drawing>(
    token,
    `${getBaseUrl()}/odata/Documents?$filter=ModelId eq ${modelId}&$select=DocumentId,FileName,DocumentTypeId,DocumentAccessibilityCategory`,
  );
}

export async function fetchDocumentTypes(token: string): Promise<DocumentType[]> {
  return odataList<DocumentType>(
    token,
    `${getBaseUrl()}/odata/DocumentTypes?$select=DocumentTypeId,Name`,
  );
}

export async function fetchDrawingComponents(token: string, documentId: string): Promise<DrawingComponent[]> {
  const data = await odata<{ Components: RawComponent[] }>(
    token,
    `${getBaseUrl()}/odata/Documents(${documentId})?$expand=Components($select=ComponentId,ModelItemId,RepresentationSituationId)`,
  );

  return (data.Components ?? []).map((raw): DrawingComponent => {
    const sit = raw.RepresentationSituationId;
    const isRel = sit === 1 || sit === 2 || sit === 3;
    const kind = sit === 1 ? 'Connector' as const : sit === 2 ? 'Containment' as const : sit === 3 ? 'Overlap' as const : null;
    return { ComponentId: raw.ComponentId, ModelItemId: raw.ModelItemId, RepresentationSituationId: sit, isRelationship: isRel, relationshipKind: kind };
  });
}

export interface ResolvedComponent {
  objectId: string;
  name: string;
  typeName: string;
  isRelationship: boolean;
  relationshipKind: string | null;
  fromName?: string;
  toName?: string;
}

async function fetchRelationshipEndpoints(token: string, relationshipId: string): Promise<{ fromName: string; toName: string } | null> {
  try {
    const data = await odata<{ LeadObject?: { Name: string }; MemberObject?: { Name: string } }>(
      token,
      `${getBaseUrl()}/odata/Relationships(${relationshipId})?$expand=LeadObject($select=Name),MemberObject($select=Name)`,
    );
    if (!data.LeadObject?.Name || !data.MemberObject?.Name) return null;
    return { fromName: data.LeadObject.Name, toName: data.MemberObject.Name };
  } catch {
    return null;
  }
}

export async function resolveDrawingComponents(token: string, documentId: string): Promise<ResolvedComponent[]> {
  const components = await fetchDrawingComponents(token, documentId);
  const resolved = await Promise.all(
    components.map(async (c): Promise<ResolvedComponent> => {
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
    }),
  );
  return resolved;
}
