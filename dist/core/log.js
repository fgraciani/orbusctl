import { existsSync, mkdirSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
const LOGS_DIR = join(homedir(), '.orbusctl', 'logs');
const WRITE_LOG = join(LOGS_DIR, 'write.jsonl');
const AUTH_LOG = join(LOGS_DIR, 'auth.jsonl');
const ERROR_LOG = join(LOGS_DIR, 'error.jsonl');
const MAX_FILE_SIZE = 100 * 1024 * 1024;
function ensureLogsDir() {
    if (!existsSync(LOGS_DIR))
        mkdirSync(LOGS_DIR, { recursive: true });
}
function appendLine(file, line) {
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
export function logWrite(entry) {
    const full = { timestamp: new Date().toISOString(), ...entry };
    appendLine(WRITE_LOG, JSON.stringify(full));
}
export function logAuth(entry) {
    appendLine(AUTH_LOG, JSON.stringify({ timestamp: new Date().toISOString(), ...entry }));
}
export function logError(entry) {
    appendLine(ERROR_LOG, JSON.stringify({ timestamp: new Date().toISOString(), ...entry }));
}
export function getRecentWriteLog(since) {
    if (!existsSync(WRITE_LOG))
        return [];
    try {
        const lines = readFileSync(WRITE_LOG, 'utf-8').split('\n').filter(Boolean);
        const entries = lines.map(l => {
            try {
                return JSON.parse(l);
            }
            catch {
                return null;
            }
        }).filter((e) => e !== null);
        if (!since)
            return entries;
        const cutoff = new Date(since).getTime();
        return entries.filter(e => new Date(e.timestamp).getTime() > cutoff);
    }
    catch {
        return [];
    }
}
