import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { getExportsDir } from '../config.js';
export function saveCorrelationTable(table) {
    const datePart = table.timestamp.slice(0, 16).replace(/[T:]/g, '-');
    const fileName = `correlation-${table.operation}-${datePart}.json`;
    const filePath = join(getExportsDir(), fileName);
    writeFileSync(filePath, JSON.stringify(table, null, 2));
    return filePath;
}
