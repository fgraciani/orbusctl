import { fetchObjects, fetchObjectDetail, fetchAllRelationships, type OrbusObject, type ObjectDetail, type ExportRelationship } from '../api/objects.js';
import { fetchDrawings, fetchDrawingComponents, type Drawing } from '../api/drawings.js';

export interface AuditIssue {
  objectName: string;
  objectId: string;
  objectType: string;
  issueType: 'empty-description' | 'html-in-name' | 'html-in-description' | 'no-relationships' | 'not-in-diagram';
  detail: string;
  lastModifiedBy: string;
  lastModifiedDate: string;
}

export interface AuditSummary {
  modelName: string;
  modelId: string;
  totalObjects: number;
  totalRelationships: number;
  totalDrawings: number;
  totalIssues: number;
  issuesByType: Record<string, number>;
  issues: AuditIssue[];
  lastModifiedBy: string;
  lastModifiedDate: string;
}

export interface AuditProgress {
  phase: string;
  current?: number;
  total?: number;
}

const HTML_REGEX = /<[^>]+>|&nbsp;|&amp;|&lt;|&gt;|&#\d+;/;
const UGLY_CHARS = /[\x00-\x08\x0B\x0C\x0E-\x1F]/;

function hasHtmlOrUgly(str: string | null): boolean {
  if (!str) return false;
  return HTML_REGEX.test(str) || UGLY_CHARS.test(str);
}

export async function performAudit(
  token: string,
  modelId: string,
  modelName: string,
  onProgress?: (p: AuditProgress) => void,
): Promise<AuditSummary> {
  const issues: AuditIssue[] = [];

  // Phase 1: fetch objects
  onProgress?.({ phase: 'Fetching objects...' });
  const objects = await fetchObjects(token, modelId);

  // Phase 2: fetch relationships (bulk)
  onProgress?.({ phase: 'Fetching relationships...' });
  const relationships = await fetchAllRelationships(token, modelId);

  // Build set of objects that have relationships
  const objectsWithRels = new Set<string>();
  for (const r of relationships) {
    if (r.LeadObject?.ObjectId) objectsWithRels.add(r.LeadObject.ObjectId);
    if (r.MemberObject?.ObjectId) objectsWithRels.add(r.MemberObject.ObjectId);
  }

  // Phase 3: fetch drawings and components
  onProgress?.({ phase: 'Fetching drawings...' });
  const drawings = await fetchDrawings(token, modelId);

  const objectsInDiagrams = new Set<string>();
  for (const drawing of drawings) {
    onProgress?.({ phase: 'Checking diagrams...', current: objectsInDiagrams.size, total: drawings.length });
    try {
      const components = await fetchDrawingComponents(token, drawing.DocumentId);
      for (const c of components) {
        if (!c.isRelationship) objectsInDiagrams.add(c.ModelItemId);
      }
    } catch {}
  }

  // Phase 4: fetch object details (descriptions, last modified)
  let lastModifiedBy = '';
  let lastModifiedDate = '';

  for (let i = 0; i < objects.length; i++) {
    const obj = objects[i];
    onProgress?.({ phase: 'Auditing objects...', current: i + 1, total: objects.length });

    let detail: ObjectDetail | null = null;
    try {
      detail = await fetchObjectDetail(token, obj.ObjectId);
    } catch {}

    const modDate = detail?.LastModifiedDate ?? obj.LastModifiedDate;
    const modBy = detail?.LastModifiedBy?.Name ?? obj.LastModifiedBy?.Name ?? '';

    // Track most recent modification across the model
    if (modDate > lastModifiedDate) {
      lastModifiedDate = modDate;
      lastModifiedBy = modBy;
    }

    const base = { objectName: obj.Name, objectId: obj.ObjectId, objectType: obj.ObjectType.Name, lastModifiedBy: modBy, lastModifiedDate: modDate };

    // Check: HTML in name
    if (hasHtmlOrUgly(obj.Name)) {
      issues.push({ ...base, issueType: 'html-in-name', detail: 'Name contains HTML tags or special characters' });
    }

    if (detail) {
      // Check: empty description
      const desc = detail.AttributeValues.find(a => a.AttributeName === 'Description')?.StringValue;
      if (!desc || desc.trim() === '' || desc.trim() === '<p></p>' || desc.trim() === '<p>&nbsp;</p>') {
        issues.push({ ...base, issueType: 'empty-description', detail: 'No description' });
      } else if (hasHtmlOrUgly(desc)) {
        issues.push({ ...base, issueType: 'html-in-description', detail: 'Description contains HTML tags or special characters' });
      }
    }

    // Check: no relationships
    if (!objectsWithRels.has(obj.ObjectId)) {
      issues.push({ ...base, issueType: 'no-relationships', detail: 'No relationships' });
    }

    // Check: not in any diagram
    if (!objectsInDiagrams.has(obj.ObjectId)) {
      issues.push({ ...base, issueType: 'not-in-diagram', detail: 'Not placed in any diagram' });
    }
  }

  const issuesByType: Record<string, number> = {};
  for (const issue of issues) {
    issuesByType[issue.issueType] = (issuesByType[issue.issueType] ?? 0) + 1;
  }

  return {
    modelName, modelId,
    totalObjects: objects.length,
    totalRelationships: relationships.length,
    totalDrawings: drawings.length,
    totalIssues: issues.length,
    issuesByType,
    issues,
    lastModifiedBy,
    lastModifiedDate,
  };
}
