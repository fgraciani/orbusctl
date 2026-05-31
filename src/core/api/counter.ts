export type CallCategory = 'startup' | 'heartbeat' | 'user';

export interface ApiCallRecord {
  method: string;
  timestamp: number;
  status: number;
  latencyMs: number;
  url: string;
  category: CallCategory;
}

const calls: ApiCallRecord[] = [];
const listeners: Array<(record: ApiCallRecord) => void> = [];
let startupEndIndex = -1;

export function recordCall(record: ApiCallRecord): void {
  calls.push(record);
  for (const fn of listeners) fn(record);
}

export function onCall(fn: (record: ApiCallRecord) => void): () => void {
  listeners.push(fn);
  return () => {
    const idx = listeners.indexOf(fn);
    if (idx >= 0) listeners.splice(idx, 1);
  };
}

export function getAllCalls(): readonly ApiCallRecord[] {
  return calls;
}

export function getCallsSince(sinceMs: number): ApiCallRecord[] {
  return calls.filter(c => c.timestamp >= sinceMs);
}

export function getCallsByMethod(): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const c of calls) {
    counts[c.method] = (counts[c.method] ?? 0) + 1;
  }
  return counts;
}

export function markStartupComplete(): void {
  if (startupEndIndex < 0) startupEndIndex = calls.length;
}

export function getStartupCount(): number {
  return startupEndIndex >= 0 ? startupEndIndex : calls.length;
}

export function isStartupComplete(): boolean {
  return startupEndIndex >= 0;
}

export function getUserCalls(): readonly ApiCallRecord[] {
  return calls.filter(c => c.category === 'user');
}

export function getHeartbeatCount(): number {
  return calls.filter(c => c.category === 'heartbeat').length;
}

export function getSessionSummary() {
  const total = calls.length;
  const startup = getStartupCount();
  const heartbeat = getHeartbeatCount();
  const userCalls = calls.filter(c => c.category === 'user');
  const userByMethod: Record<string, number> = {};
  for (const c of userCalls) {
    userByMethod[c.method] = (userByMethod[c.method] ?? 0) + 1;
  }
  return { total, startup, heartbeat, userByMethod, userTotal: userCalls.length };
}
