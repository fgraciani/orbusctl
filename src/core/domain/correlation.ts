import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { getExportsDir } from '../config.js';

export interface CorrelationEntry {
  type: 'object' | 'relationship';
  name: string;
  typeName: string;
  oldId: string;
  newId: string | null;
  status: 'ok' | 'identity' | 'failed';
  error?: string;
}

export interface CorrelationTable {
  timestamp: string;
  operation: 'move' | 'copy';
  source: { modelId: string; name: string };
  target: { modelId: string; name: string };
  entries: CorrelationEntry[];
}

export function saveCorrelationTable(table: CorrelationTable): string {
  const datePart = table.timestamp.slice(0, 16).replace(/[T:]/g, '-');
  const fileName = `correlation-${table.operation}-${datePart}.json`;
  const filePath = join(getExportsDir(), fileName);
  writeFileSync(filePath, JSON.stringify(table, null, 2));
  return filePath;
}
