import { existsSync, mkdirSync, readFileSync, writeFileSync, statSync, renameSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const LOGS_DIR = join(homedir(), '.orbusctl', 'logs');
const WRITE_LOG = join(LOGS_DIR, 'write.jsonl');
const AUTH_LOG = join(LOGS_DIR, 'auth.jsonl');
const ERROR_LOG = join(LOGS_DIR, 'error.jsonl');
const MAX_FILE_SIZE = 100 * 1024 * 1024;

export interface WriteLogEntry {
  timestamp: string;
  operation: string;
  modelId?: string;
  modelName?: string;
  objectId?: string;
  objectName?: string;
  objectType?: string;
  relationshipId?: string;
  params: Record<string, unknown>;
  success: boolean;
  result?: unknown;
  error?: string;
  user?: string;
}

function ensureLogsDir(): void {
  if (!existsSync(LOGS_DIR)) mkdirSync(LOGS_DIR, { recursive: true });
}

function appendLine(file: string, line: string): void {
  ensureLogsDir();
  if (existsSync(file)) {
    const size = statSync(file).size;
    if (size > MAX_FILE_SIZE) {
      // Rotate: keep the second half
      const content = readFileSync(file, 'utf-8');
      const lines = content.split('\n').filter(Boolean);
      const half = lines.slice(Math.floor(lines.length / 2));
      writeFileSync(file, half.join('\n') + '\n', { mode: 0o600 });
    }
  }
  writeFileSync(file, line + '\n', { flag: 'a', mode: 0o600 });
}

export function logWrite(entry: Omit<WriteLogEntry, 'timestamp'>): void {
  const full: WriteLogEntry = { timestamp: new Date().toISOString(), ...entry };
  appendLine(WRITE_LOG, JSON.stringify(full));
}

export function logAuth(entry: { event: string; accountName: string; userName: string }): void {
  appendLine(AUTH_LOG, JSON.stringify({ timestamp: new Date().toISOString(), ...entry }));
}

export function logError(entry: { error: string; stack?: string; context?: string }): void {
  appendLine(ERROR_LOG, JSON.stringify({ timestamp: new Date().toISOString(), ...entry }));
}

export function getRecentWriteLog(since?: string): WriteLogEntry[] {
  if (!existsSync(WRITE_LOG)) return [];
  try {
    const lines = readFileSync(WRITE_LOG, 'utf-8').split('\n').filter(Boolean);
    const entries = lines.map(l => {
      try { return JSON.parse(l) as WriteLogEntry; } catch { return null; }
    }).filter((e): e is WriteLogEntry => e !== null);
    if (!since) return entries;
    const cutoff = new Date(since).getTime();
    return entries.filter(e => new Date(e.timestamp).getTime() > cutoff);
  } catch {
    return [];
  }
}
