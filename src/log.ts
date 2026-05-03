import {closeSync, existsSync, mkdirSync, openSync, readFileSync, statSync, writeFileSync} from 'node:fs'
import {constants} from 'node:fs'
import {homedir} from 'node:os'
import {join} from 'node:path'

const LOGS_DIR = join(homedir(), '.orbusctl', 'logs')
const WRITE_LOG = join(LOGS_DIR, 'write.jsonl')
const AUTH_LOG = join(LOGS_DIR, 'auth.jsonl')
const ERROR_LOG = join(LOGS_DIR, 'error.jsonl')

const MAX_FILE_SIZE = 5 * 1024 * 1024

export interface LogContext {
  command: string
  mode: 'interactive' | 'command'
  tty: boolean
  version: string
}

interface WriteEntry {
  operation: string
  modelId: string
  params: Record<string, unknown>
  success: boolean
  result?: unknown
  error?: string
  user?: {name: string; accountName: string}
}

interface AuthEntry {
  event: 'save' | 'expired'
  // Full token stored intentionally — for half-life analysis and account-misuse detection.
  token: string
  accountName: string
  userName: string
  emailAddress: string
}

interface ErrorEntry {
  error: string
  stack?: string
  context?: string
}

let ctx: LogContext | undefined

export function setLogContext(context: LogContext): void {
  ctx = context
}

function ensureLogsDir(): void {
  if (!existsSync(LOGS_DIR)) {
    mkdirSync(LOGS_DIR, {recursive: true, mode: 0o700})
  }
}

function appendLine(filePath: string, data: Record<string, unknown>): void {
  ensureLogsDir()
  const line = JSON.stringify({
    timestamp: new Date().toISOString(),
    version: ctx?.version,
    command: ctx?.command,
    mode: ctx?.mode,
    tty: ctx?.tty,
    ...data,
  }) + '\n'
  const fd = openSync(filePath, constants.O_APPEND | constants.O_CREAT | constants.O_WRONLY, 0o600)
  try {
    writeFileSync(fd, line)
  } finally {
    closeSync(fd)
  }
  maybeTruncate(filePath)
}

function maybeTruncate(filePath: string): void {
  try {
    const stat = statSync(filePath)
    if (stat.size <= MAX_FILE_SIZE) return
    const lines = readFileSync(filePath, 'utf-8').split('\n').filter(Boolean)
    const keep = lines.slice(Math.floor(lines.length / 2))
    writeFileSync(filePath, keep.join('\n') + '\n', {mode: 0o600})
  } catch {
    // ignore truncation errors
  }
}

export function logWrite(entry: WriteEntry): void {
  appendLine(WRITE_LOG, entry as unknown as Record<string, unknown>)
}

export function logAuth(entry: AuthEntry): void {
  appendLine(AUTH_LOG, {...entry, tokenLength: entry.token.length} as unknown as Record<string, unknown>)
}

export function logError(entry: ErrorEntry): void {
  appendLine(ERROR_LOG, entry as unknown as Record<string, unknown>)
}
