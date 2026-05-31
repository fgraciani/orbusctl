import type { Model } from '../api/models.js';
import type { ActivityObject, ActivityRelationship } from '../api/activity.js';
import { fetchRecentObjects, fetchRecentRelationships } from '../api/activity.js';

// --- Time period helpers ---

export type TimePeriod = '24h' | '7d' | 'past-week' | '30d' | 'past-month';

export const TIME_PERIOD_LABELS: Record<TimePeriod, string> = {
  '24h': 'Last 24 hours',
  '7d': 'Last 7 days',
  'past-week': 'Past week (Mon–Sun)',
  '30d': 'Last 30 days',
  'past-month': 'Past month',
};

export function getTimePeriodRange(period: TimePeriod): { since: Date; until: Date; label: string } {
  const now = new Date();
  const label = TIME_PERIOD_LABELS[period];

  switch (period) {
    case '24h':
      return { since: new Date(now.getTime() - 24 * 60 * 60 * 1000), until: now, label };

    case '7d':
      return { since: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000), until: now, label };

    case 'past-week': {
      // Monday-to-Sunday of the previous calendar week
      const dayOfWeek = now.getDay(); // 0=Sun, 1=Mon, ...
      const daysSinceMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      const thisMonday = new Date(now);
      thisMonday.setHours(0, 0, 0, 0);
      thisMonday.setDate(thisMonday.getDate() - daysSinceMonday);
      const lastMonday = new Date(thisMonday);
      lastMonday.setDate(lastMonday.getDate() - 7);
      return { since: lastMonday, until: thisMonday, label };
    }

    case '30d':
      return { since: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000), until: now, label };

    case 'past-month': {
      // 1st to last day of the previous calendar month
      const firstOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const lastOfPrevMonth = new Date(firstOfThisMonth.getTime() - 1);
      const firstOfPrevMonth = new Date(lastOfPrevMonth.getFullYear(), lastOfPrevMonth.getMonth(), 1);
      return { since: firstOfPrevMonth, until: firstOfThisMonth, label };
    }
  }
}

// --- Activity report ---

export interface ActivityReport {
  models: Model[];
  objectsByModel: Map<string, ActivityObject[]>;
  relationshipsByModel: Map<string, ActivityRelationship[]>;
  since: Date;
  until: Date;
  label: string;
}

export interface ScanProgress {
  current: number;
  total: number;
  modelName: string;
  objectsFound: number;
  relsFound: number;
}

export async function scanActivity(
  token: string,
  models: Model[],
  since: Date,
  until: Date,
  label: string,
  onProgress?: (progress: ScanProgress) => void,
): Promise<ActivityReport> {
  const sinceISO = since.toISOString();
  const objectsByModel = new Map<string, ActivityObject[]>();
  const relationshipsByModel = new Map<string, ActivityRelationship[]>();

  for (let i = 0; i < models.length; i++) {
    const model = models[i];
    try {
      const [objects, relationships] = await Promise.all([
        fetchRecentObjects(token, model.ModelId, sinceISO),
        fetchRecentRelationships(token, model.ModelId, sinceISO),
      ]);

      if (objects.length > 0) objectsByModel.set(model.ModelId, objects);
      if (relationships.length > 0) relationshipsByModel.set(model.ModelId, relationships);

      onProgress?.({
        current: i + 1,
        total: models.length,
        modelName: model.Name,
        objectsFound: objects.length,
        relsFound: relationships.length,
      });
    } catch (e) {
      onProgress?.({ current: i + 1, total: models.length, modelName: model.Name, objectsFound: 0, relsFound: 0 });
    }
  }

  return { models, objectsByModel, relationshipsByModel, since, until, label };
}

// --- Report helpers ---

export interface UserRelActivity {
  RelationshipId: string;
  DateCreated: string;
}

export interface UserActivity {
  userName: string;
  created: ActivityObject[];
  modified: ActivityObject[];
  relsCreated: number;
  relationships: UserRelActivity[];
}

export interface ModelActivity {
  modelName: string;
  modelId: string;
  users: UserActivity[];
  totalObjects: number;
  totalRels: number;
}

export function summarizeReport(report: ActivityReport): { models: ModelActivity[]; totalObjects: number; totalRels: number; totalCreated: number; totalModified: number } {
  const sinceTime = report.since.getTime();
  const result: ModelActivity[] = [];
  let totalObjects = 0;
  let totalRels = 0;
  let totalCreated = 0;
  let totalModified = 0;

  for (const model of report.models) {
    const objects = report.objectsByModel.get(model.ModelId) ?? [];
    const rels = report.relationshipsByModel.get(model.ModelId) ?? [];
    if (objects.length === 0 && rels.length === 0) continue;

    const userMap = new Map<string, { created: ActivityObject[]; modified: ActivityObject[] }>();
    const userRels = new Map<string, { count: number; items: { RelationshipId: string; DateCreated: string }[] }>();

    for (const obj of objects) {
      const isNew = new Date(obj.DateCreated).getTime() > sinceTime;
      const userName = isNew ? obj.CreatedBy.Name : obj.LastModifiedBy.Name;
      if (!userMap.has(userName)) userMap.set(userName, { created: [], modified: [] });
      const entry = userMap.get(userName)!;
      if (isNew) { entry.created.push(obj); totalCreated++; }
      else { entry.modified.push(obj); totalModified++; }
    }

    for (const rel of rels) {
      const userName = rel.CreatedBy.Name;
      const entry = userRels.get(userName) ?? { count: 0, items: [] };
      entry.count++;
      entry.items.push({ RelationshipId: rel.RelationshipId, DateCreated: rel.DateCreated });
      userRels.set(userName, entry);
    }

    const allUsers = new Set([...userMap.keys(), ...userRels.keys()]);
    const users: UserActivity[] = [...allUsers].sort().map(userName => ({
      userName,
      created: userMap.get(userName)?.created ?? [],
      modified: userMap.get(userName)?.modified ?? [],
      relsCreated: userRels.get(userName)?.count ?? 0,
      relationships: userRels.get(userName)?.items ?? [],
    }));

    result.push({ modelName: model.Name, modelId: model.ModelId, users, totalObjects: objects.length, totalRels: rels.length });
    totalObjects += objects.length;
    totalRels += rels.length;
  }

  result.sort((a, b) => a.modelName.localeCompare(b.modelName));
  return { models: result, totalObjects, totalRels, totalCreated, totalModified };
}
