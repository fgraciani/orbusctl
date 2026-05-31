import { getBaseUrl, odata, odataList } from './client.js';

export interface OrbusObject {
  LastModifiedBy: { Name: string };
  LastModifiedDate: string;
  Name: string;
  ObjectId: string;
  ObjectType: { Name: string };
}

export interface AttributeValue {
  AttributeName: string;
  StringValue: string | null;
  Value?: boolean | number | string | null;
}

export interface RelatedObject {
  DirectionDescription: string;
  RelatedItem: { Name: string; ObjectId: string; ObjectType: { Name: string } };
  Relationship: {
    AttributeValues?: AttributeValue[];
    RelationshipType: { Name: string };
  };
}

export interface ObjectDetail {
  AttributeValues: AttributeValue[];
  CreatedBy: { Name: string };
  DateCreated: string;
  Detail: { CurrentVersionNumber: number; OriginalObjectId: string | null; Status: string };
  LastModifiedBy: { Name: string };
  LastModifiedDate: string;
  LockedBy: { Name: string } | null;
  LockedOn: string | null;
  Model: { Name: string };
  Name: string;
  ObjectId: string;
  ObjectType: { Description: string; Name: string };
}

function stripHtml(str: string | null): string | null {
  if (!str) return str;
  return str.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim();
}

export async function fetchObjects(token: string, modelId: string): Promise<OrbusObject[]> {
  return odataList<OrbusObject>(
    token,
    `${getBaseUrl()}/odata/Objects?$filter=ModelId eq ${modelId}&$select=ObjectId,Name,LastModifiedDate&$expand=ObjectType($select=Name),LastModifiedBy($select=Name)`,
  );
}

export async function fetchObjectDetail(token: string, objectId: string): Promise<ObjectDetail> {
  const detail = await odata<ObjectDetail>(
    token,
    `${getBaseUrl()}/odata/Objects(${objectId})?$expand=ObjectType,AttributeValues,Detail,CreatedBy,LastModifiedBy,LockedBy,Model`,
  );
  for (const attr of detail.AttributeValues) {
    if (attr.StringValue) attr.StringValue = stripHtml(attr.StringValue);
  }
  return detail;
}

export async function fetchObjectRelationships(token: string, objectId: string): Promise<RelatedObject[]> {
  interface RawRel {
    AttributeValues?: AttributeValue[];
    LeadObject: { Name: string; ObjectId: string; ObjectType: { Name: string } } | null;
    MemberObject: { Name: string; ObjectId: string; ObjectType: { Name: string } } | null;
    RelationshipType: { Name: string } | null;
  }

  const raw = await odataList<RawRel>(
    token,
    `${getBaseUrl()}/odata/Relationships?$filter=LeadObjectId eq ${objectId} or MemberObjectId eq ${objectId}&$expand=RelationshipType($select=Name),LeadObject($select=Name,ObjectId;$expand=ObjectType($select=Name)),MemberObject($select=Name,ObjectId;$expand=ObjectType($select=Name)),AttributeValues`,
  );

  const result: RelatedObject[] = [];
  for (const rel of raw) {
    if (!rel.RelationshipType) continue;
    const isLead = rel.LeadObject?.ObjectId === objectId;
    const related = isLead ? rel.MemberObject : rel.LeadObject;
    if (!related) continue;

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

export interface ExportRelationship {
  RelationshipId: string;
  DateCreated: string;
  AttributeValues?: AttributeValue[];
  CreatedBy: { Name: string };
  LeadObject: { Name: string; ObjectId: string; ObjectType: { Name: string } } | null;
  MemberObject: { Name: string; ObjectId: string; ObjectType: { Name: string } } | null;
  RelationshipType: { Name: string } | null;
}

export async function fetchAllRelationships(token: string, modelId: string): Promise<ExportRelationship[]> {
  return odataList<ExportRelationship>(
    token,
    `${getBaseUrl()}/odata/Relationships?$filter=ModelId eq ${modelId}&$select=RelationshipId,DateCreated&$expand=RelationshipType($select=Name),LeadObject($select=Name,ObjectId;$expand=ObjectType($select=Name)),MemberObject($select=Name,ObjectId;$expand=ObjectType($select=Name)),CreatedBy($select=Name),AttributeValues`,
  );
}

export async function fetchObjectNameAndType(token: string, objectId: string): Promise<{ name: string; typeName: string }> {
  try {
    const data = await odata<{ Name: string; ObjectType: { Name: string } }>(
      token,
      `${getBaseUrl()}/odata/Objects(${objectId})?$select=Name&$expand=ObjectType($select=Name)`,
    );
    return { name: data.Name ?? 'Unknown', typeName: data.ObjectType?.Name ?? 'Unknown' };
  } catch {
    return { name: 'Unknown', typeName: 'Unknown' };
  }
}
