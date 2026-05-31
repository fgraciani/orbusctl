import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { ExportRelationship } from '../api/objects.js';

export interface ModelObject {
  description: string;
  id: string;
  name: string;
  type: string;
}

const ATTR_RE = /(\w+)="([^"]*?)"/g;

export function parseAttrs(attrStr: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  ATTR_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = ATTR_RE.exec(attrStr)) !== null) {
    attrs[match[1]] = match[2];
  }
  return attrs;
}

export function cell(s: string): string {
  const sanitized = s.replace(/\|/g, '/').replace(/[\r\n]+/g, ' ').trim();
  if (sanitized.length <= 200) return sanitized;
  return sanitized.slice(0, 200) + ' [...]';
}

export function normalizeName(name: string): string {
  return name.replace(/&nbsp;/g, ' ').trim();
}

export function sanitizeDiagramName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

export function getRelAttrValue(rel: ExportRelationship, attrName: string): string {
  const attr = rel.AttributeValues?.find((a) => a.AttributeName === attrName);
  return attr?.StringValue ?? (attr?.Value as string | undefined) ?? '';
}

export function findProcessByName(name: string, objectsById: Map<string, ModelObject>): ModelObject | undefined {
  for (const obj of objectsById.values()) {
    if (obj.type === 'Business process' && obj.name === name) return obj;
  }
  return undefined;
}

export function getChildProcesses(
  parentId: string,
  relationships: ExportRelationship[],
  objectsById: Map<string, ModelObject>,
  seen?: Set<string>,
): ModelObject[] {
  const visited = seen ?? new Set<string>();
  const results: ModelObject[] = [];
  for (const rel of relationships) {
    if (rel.RelationshipType?.Name !== 'ArchiMate: Aggregation') continue;
    if (rel.LeadObject?.ObjectId !== parentId) continue;
    const memberId = rel.MemberObject?.ObjectId;
    if (!memberId || visited.has(memberId)) continue;
    visited.add(memberId);
    const member = objectsById.get(memberId);
    if (!member) continue;
    if (member.type === 'Business process') {
      results.push(member);
    } else if (member.type === 'Grouping') {
      results.push(...getChildProcesses(memberId, relationships, objectsById, visited));
    }
  }
  return results;
}

export function resolveTasks(
  processName: string,
  process: ModelObject,
  scopeOverride: Map<string, string[]>,
  relationships: ExportRelationship[],
  objectsById: Map<string, ModelObject>,
): ModelObject[] {
  const override = scopeOverride.get(processName);
  if (override) {
    const tasks: ModelObject[] = [];
    for (const taskName of override) {
      const task = findProcessByName(taskName, objectsById);
      if (task) tasks.push(task);
    }
    return tasks;
  }
  return getChildProcesses(process.id, relationships, objectsById);
}

export function findActivityForTask(
  taskId: string,
  relationships: ExportRelationship[],
  objectsById: Map<string, ModelObject>,
): string {
  const parentRels = relationships.filter(
    (r) => r.RelationshipType?.Name === 'ArchiMate: Aggregation' && r.MemberObject?.ObjectId === taskId,
  );
  if (parentRels.length === 0) return '(unknown)';

  for (const rel of parentRels) {
    const parent = objectsById.get(rel.LeadObject?.ObjectId ?? '');
    if (parent?.type === 'Business process') return parent.name;
  }

  for (const rel of parentRels) {
    const parent = objectsById.get(rel.LeadObject?.ObjectId ?? '');
    if (parent?.type === 'Grouping') {
      const gpRels = relationships.filter(
        (r) => r.RelationshipType?.Name === 'ArchiMate: Aggregation' && r.MemberObject?.ObjectId === parent.id,
      );
      for (const grel of gpRels) {
        const gp = objectsById.get(grel.LeadObject?.ObjectId ?? '');
        if (gp?.type === 'Business process') return gp.name;
      }
    }
  }

  return '(unknown)';
}

export function resolveTasksFromAttr(
  attrs: Record<string, string>,
  objectsById: Map<string, ModelObject>,
): ModelObject[] | null {
  const taskList = attrs['tasks'];
  if (!taskList) return null;
  const tasks: ModelObject[] = [];
  for (const name of taskList.split(',').map((s) => s.trim()).filter(Boolean)) {
    const task = findProcessByName(name, objectsById);
    if (task) tasks.push(task);
  }
  return tasks;
}

export function formatRasciShort(stringValue: string): string {
  if (!stringValue) return '';
  return stringValue
    .split(',')
    .map((part) => part.trim().charAt(0))
    .join('');
}

export function generateTasksTable(
  attrs: Record<string, string>,
  relationships: ExportRelationship[],
  objectsById: Map<string, ModelObject>,
  scopeOverride: Map<string, string[]>,
): string {
  const tagTasks = resolveTasksFromAttr(attrs, objectsById);
  if (tagTasks) {
    const lines = ['', '| Task | Description |', '|---|---|'];
    for (const task of tagTasks.sort((a, b) => a.name.localeCompare(b.name))) {
      lines.push(`| ${cell(task.name)} | ${cell(task.description)} |`);
    }
    lines.push('');
    return lines.join('\n');
  }

  const processName = attrs['process'];
  if (!processName) return `<!-- ERROR: tasks table requires process="..." or tasks="..." -->`;

  const process = findProcessByName(processName, objectsById);
  if (!process) return `<!-- ERROR: Process "${processName}" not found in model -->`;

  const tasks = [...resolveTasks(processName, process, scopeOverride, relationships, objectsById)].sort((a, b) =>
    a.name.localeCompare(b.name),
  );

  const lines = ['', '| Task | Description |', '|---|---|'];
  for (const task of tasks) lines.push(`| ${cell(task.name)} | ${cell(task.description)} |`);
  lines.push('');
  return lines.join('\n');
}

export function generateIOTable(
  attrs: Record<string, string>,
  relationships: ExportRelationship[],
  objectsById: Map<string, ModelObject>,
  scopeOverride: Map<string, string[]>,
): string {
  const processName = attrs['process'];
  const direction = attrs['direction'];

  if (!processName) return `<!-- ERROR: io table requires process="..." -->`;
  if (direction !== 'input' && direction !== 'output' && direction !== 'all') {
    return `<!-- ERROR: io table requires direction="input", direction="output", or direction="all" -->`;
  }

  const process = findProcessByName(processName, objectsById);
  if (!process) return `<!-- ERROR: Process "${processName}" not found in model -->`;

  const scopeIds = new Set<string>([process.id]);
  for (const task of resolveTasks(processName, process, scopeOverride, relationships, objectsById)) scopeIds.add(task.id);

  const collected = new Map<string, ModelObject>();

  for (const rel of relationships) {
    if (rel.RelationshipType?.Name !== 'ArchiMate: Access') continue;
    const leadId = rel.LeadObject?.ObjectId;
    const memberId = rel.MemberObject?.ObjectId;
    if (!leadId || !memberId) continue;
    const leadObj = objectsById.get(leadId);
    const memberObj = objectsById.get(memberId);
    if (!leadObj || !memberObj) continue;

    const processIsLead = scopeIds.has(leadId) && memberObj.type === 'Business object';
    const processIsMember = scopeIds.has(memberId) && leadObj.type === 'Business object';
    if (!processIsLead && !processIsMember) continue;

    const businessObj = processIsLead ? memberObj : leadObj;
    const operator = getRelAttrValue(rel, 'Access Operator');

    let isInput: boolean;
    let isOutput: boolean;
    if (operator) {
      isInput = operator.includes('Read (');
      isOutput = operator.includes('Create (') || operator.includes('Update (');
    } else {
      isInput = processIsLead;
      isOutput = processIsMember;
    }

    if (direction === 'all' || (direction === 'input' && isInput) || (direction === 'output' && isOutput)) {
      collected.set(businessObj.id, businessObj);
    }
  }

  const sorted = [...collected.values()].sort((a, b) => a.name.localeCompare(b.name));
  const lines = ['', '| Name | Description |', '|---|---|'];
  for (const obj of sorted) lines.push(`| ${cell(obj.name)} | ${cell(obj.description)} |`);
  lines.push('');
  return lines.join('\n');
}

export function generateRolesTable(
  attrs: Record<string, string>,
  relationships: ExportRelationship[],
  objectsById: Map<string, ModelObject>,
  scopeOverride: Map<string, string[]>,
): string {
  const processName = attrs['process'];

  let scopeIds: Set<string>;
  if (processName) {
    const process = findProcessByName(processName, objectsById);
    if (!process) return `<!-- ERROR: Process "${processName}" not found in model -->`;
    scopeIds = new Set<string>([process.id]);
    for (const task of resolveTasks(processName, process, scopeOverride, relationships, objectsById)) scopeIds.add(task.id);
  } else {
    scopeIds = new Set<string>();
    for (const obj of objectsById.values()) {
      if (obj.type === 'Business process') scopeIds.add(obj.id);
    }
  }

  const collected = new Map<string, ModelObject>();

  for (const rel of relationships) {
    if (rel.RelationshipType?.Name !== 'ArchiMate: Association') continue;
    const leadId = rel.LeadObject?.ObjectId;
    const memberId = rel.MemberObject?.ObjectId;
    if (!leadId || !memberId) continue;
    const leadObj = objectsById.get(leadId);
    const memberObj = objectsById.get(memberId);
    if (!leadObj || !memberObj) continue;

    if (leadObj.type === 'Business role' && scopeIds.has(memberId)) {
      collected.set(leadId, leadObj);
    } else if (memberObj.type === 'Business role' && scopeIds.has(leadId)) {
      collected.set(memberId, memberObj);
    }
  }

  const sorted = [...collected.values()].sort((a, b) => a.name.localeCompare(b.name));
  const lines = ['', '| Role | Description |', '|---|---|'];
  for (const role of sorted) lines.push(`| ${cell(role.name)} | ${cell(role.description)} |`);
  lines.push('');
  return lines.join('\n');
}

export function generateRasciTable(
  attrs: Record<string, string>,
  relationships: ExportRelationship[],
  objectsById: Map<string, ModelObject>,
  scopeOverride: Map<string, string[]>,
): string {
  const processName = attrs['process'];

  if (processName) {
    const process = findProcessByName(processName, objectsById);
    if (!process) return `<!-- ERROR: Process "${processName}" not found in model -->`;

    const tasks = resolveTasks(processName, process, scopeOverride, relationships, objectsById);
    const taskIds = new Set(tasks.map((t) => t.id));

    const roleSet = new Set<string>();
    const rasciMap = new Map<string, Map<string, string>>();

    for (const rel of relationships) {
      if (rel.RelationshipType?.Name !== 'ArchiMate: Association') continue;
      const leadId = rel.LeadObject?.ObjectId;
      const memberId = rel.MemberObject?.ObjectId;
      if (!leadId || !memberId) continue;
      const leadObj = objectsById.get(leadId);
      const memberObj = objectsById.get(memberId);
      if (!leadObj || !memberObj) continue;

      let roleId: string | null = null;
      let taskId: string | null = null;
      if (leadObj.type === 'Business role' && taskIds.has(memberId)) {
        roleId = leadId; taskId = memberId;
      } else if (memberObj.type === 'Business role' && taskIds.has(leadId)) {
        roleId = memberId; taskId = leadId;
      }

      if (roleId && taskId) {
        roleSet.add(roleId);
        if (!rasciMap.has(taskId)) rasciMap.set(taskId, new Map());
        rasciMap.get(taskId)!.set(roleId, formatRasciShort(getRelAttrValue(rel, 'RASCI')));
      }
    }

    const rolesSorted = [...roleSet]
      .map((id) => objectsById.get(id))
      .filter((o): o is ModelObject => o !== undefined)
      .sort((a, b) => a.name.localeCompare(b.name));

    const tasksSorted = [...tasks].sort((a, b) => a.name.localeCompare(b.name));

    const lines = [
      '',
      `| Task | ${rolesSorted.map((r) => cell(r.name)).join(' | ')} |`,
      `| ${['---', ...rolesSorted.map(() => '---')].join(' | ')} |`,
    ];
    for (const task of tasksSorted) {
      const row = rasciMap.get(task.id) ?? new Map();
      lines.push(`| ${cell(task.name)} | ${rolesSorted.map((r) => row.get(r.id) ?? '').join(' | ')} |`);
    }
    lines.push('');
    return lines.join('\n');
  }

  // Global RASCI
  const rasciRels: Array<{ rasci: string; roleId: string; taskId: string }> = [];

  for (const rel of relationships) {
    if (rel.RelationshipType?.Name !== 'ArchiMate: Association') continue;
    const leadId = rel.LeadObject?.ObjectId;
    const memberId = rel.MemberObject?.ObjectId;
    if (!leadId || !memberId) continue;
    const leadObj = objectsById.get(leadId);
    const memberObj = objectsById.get(memberId);
    if (!leadObj || !memberObj) continue;

    if (leadObj.type === 'Business role' && memberObj.type === 'Business process') {
      rasciRels.push({ rasci: formatRasciShort(getRelAttrValue(rel, 'RASCI')), roleId: leadId, taskId: memberId });
    } else if (memberObj.type === 'Business role' && leadObj.type === 'Business process') {
      rasciRels.push({ rasci: formatRasciShort(getRelAttrValue(rel, 'RASCI')), roleId: memberId, taskId: leadId });
    }
  }

  if (rasciRels.length === 0) return `<!-- ERROR: No RASCI associations found -->`;

  const roleSet = new Set(rasciRels.map((r) => r.roleId));
  const taskSet = new Set(rasciRels.map((r) => r.taskId));

  const rolesSorted = [...roleSet]
    .map((id) => objectsById.get(id))
    .filter((o): o is ModelObject => o !== undefined)
    .sort((a, b) => a.name.localeCompare(b.name));

  const rasciLookup = new Map<string, Map<string, string>>();
  for (const { taskId, roleId, rasci } of rasciRels) {
    if (!rasciLookup.has(taskId)) rasciLookup.set(taskId, new Map());
    rasciLookup.get(taskId)!.set(roleId, rasci);
  }

  const scopeActivityMap = new Map<string, string>();
  for (const [activityName, taskNames] of scopeOverride) {
    for (const tn of taskNames) scopeActivityMap.set(tn, activityName);
  }

  const tasksSorted = [...taskSet]
    .map((id) => {
      const obj = objectsById.get(id);
      if (!obj) return null;
      const activity = scopeActivityMap.get(obj.name) ?? findActivityForTask(id, relationships, objectsById);
      return { activity, obj };
    })
    .filter((t): t is { activity: string; obj: ModelObject } => t !== null)
    .sort((a, b) => a.activity.localeCompare(b.activity) || a.obj.name.localeCompare(b.obj.name));

  const lines = [
    '',
    `| Activity | Task | ${rolesSorted.map((r) => cell(r.name)).join(' | ')} |`,
    `| ${['---', '---', ...rolesSorted.map(() => '---')].join(' | ')} |`,
  ];
  for (const { activity, obj: task } of tasksSorted) {
    const row = rasciLookup.get(task.id) ?? new Map();
    lines.push(
      `| ${cell(activity)} | ${cell(task.name)} | ${rolesSorted.map((r) => row.get(r.id) ?? '').join(' | ')} |`,
    );
  }
  lines.push('');
  return lines.join('\n');
}

export function generateLifecycleList(
  attrs: Record<string, string>,
  relationships: ExportRelationship[],
  objectsById: Map<string, ModelObject>,
): string {
  const processName = attrs['process'];
  if (!processName) return `<!-- ERROR: lifecycle table requires process="..." -->`;

  const process = findProcessByName(processName, objectsById);
  if (!process) return `<!-- ERROR: Process "${processName}" not found in model -->`;

  const direct: ModelObject[] = [];
  for (const rel of relationships) {
    if (rel.RelationshipType?.Name !== 'ArchiMate: Aggregation') continue;
    if (rel.LeadObject?.ObjectId !== process.id) continue;
    const memberId = rel.MemberObject?.ObjectId;
    if (!memberId) continue;
    const member = objectsById.get(memberId);
    if (member?.type === 'Business process') direct.push(member);
  }

  const sorted = [...direct].sort((a, b) => a.name.localeCompare(b.name));
  const letters = 'abcdefghijklmnopqrstuvwxyz';
  const lines = [''];
  for (let i = 0; i < sorted.length; i++) {
    lines.push(`- (${letters[i] ?? String(i + 1)}) ${sorted[i].name}`);
  }
  lines.push('');
  return lines.join('\n');
}

export function generateDiagram(
  attrs: Record<string, string>,
  assetRelPath: string | undefined,
  assetAbsDir: string | undefined,
): string {
  const name = attrs['name'] ?? '';
  const caption = attrs['caption'] ?? name;
  const filename = `${sanitizeDiagramName(name)}.svg`;
  const imgPath = assetRelPath ? `${assetRelPath}/${filename}` : `assets/${filename}`;

  if (assetAbsDir) {
    const fullPath = join(assetAbsDir, filename);
    if (!existsSync(fullPath)) {
      process.stderr.write(`  WARNING: assets/${filename} not found -- re-export SVG from Orbus Draw\n`);
    }
  }

  return `![${caption}](${imgPath})`;
}

export function processTag(
  tagType: string,
  attrStr: string,
  relationships: ExportRelationship[],
  objectsById: Map<string, ModelObject>,
  scopeOverride: Map<string, string[]>,
  assetRelPath?: string,
  assetAbsDir?: string,
): string {
  const attrs = parseAttrs(attrStr);

  if (tagType === 'ORBUS-DIAGRAM') {
    return generateDiagram(attrs, assetRelPath, assetAbsDir);
  }

  if (tagType === 'ORBUS-TABLE') {
    const type = attrs['type'];
    switch (type) {
      case 'tasks':     return generateTasksTable(attrs, relationships, objectsById, scopeOverride);
      case 'io':        return generateIOTable(attrs, relationships, objectsById, scopeOverride);
      case 'roles':     return generateRolesTable(attrs, relationships, objectsById, scopeOverride);
      case 'rasci':     return generateRasciTable(attrs, relationships, objectsById, scopeOverride);
      case 'lifecycle': return generateLifecycleList(attrs, relationships, objectsById);
      default:          return `<!-- ERROR: Unknown table type "${type ?? ''}" -->`;
    }
  }

  return `<!-- ERROR: Unknown tag type "${tagType}" -->`;
}
