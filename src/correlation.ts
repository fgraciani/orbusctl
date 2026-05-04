import {existsSync, mkdirSync, writeFileSync} from 'node:fs'
import {join} from 'node:path'

export interface CorrelationEntry {
  type: 'object' | 'relationship'
  name: string
  typeName: string
  oldId: string
  newId: string | null
  status: 'ok' | 'identity' | 'failed'
  error?: string
}

export interface CorrelationTable {
  timestamp: string
  operation: 'move' | 'copy'
  source: {modelId: string; name: string}
  target: {modelId: string; name: string}
  entries: CorrelationEntry[]
}

export function saveCorrelationTable(table: CorrelationTable, outputDir: string): string {
  if (!existsSync(outputDir)) mkdirSync(outputDir, {recursive: true})
  const ts = table.timestamp.replace(/[:.]/g, '-').slice(0, 16)
  const filePath = join(outputDir, `correlation-${table.operation}-${ts}.json`)
  writeFileSync(filePath, JSON.stringify(table, null, 2))
  return filePath
}
