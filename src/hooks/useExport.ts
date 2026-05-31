import { useState, useCallback } from 'react';
import { performExcelExport, type ExcelExportResult, type ExportProgress } from '../core/export/excel.js';
import { performMarkdownExport, type MarkdownExportResult } from '../core/export/markdown.js';

export type ExportFormat = 'excel' | 'markdown';

interface UseExportResult {
  exporting: boolean;
  progress: ExportProgress | null;
  result: { filePath: string; objectCount: number; relationshipCount: number; drawingCount: number } | null;
  error: string | null;
  startExport: (token: string, modelId: string, modelName: string, format: ExportFormat, fetchDetails: boolean) => void;
  reset: () => void;
}

export function useExport(): UseExportResult {
  const [exporting, setExporting] = useState(false);
  const [progress, setProgress] = useState<ExportProgress | null>(null);
  const [result, setResult] = useState<UseExportResult['result']>(null);
  const [error, setError] = useState<string | null>(null);

  const startExport = useCallback((token: string, modelId: string, modelName: string, format: ExportFormat, fetchDetails: boolean) => {
    setExporting(true);
    setProgress(null);
    setResult(null);
    setError(null);

    const run = format === 'excel'
      ? performExcelExport(token, modelId, modelName, fetchDetails, p => setProgress(p))
      : performMarkdownExport(token, modelId, modelName, p => setProgress(p));

    run
      .then(r => setResult(r))
      .catch(e => setError(e instanceof Error ? e.message : 'Export failed'))
      .finally(() => setExporting(false));
  }, []);

  const reset = useCallback(() => {
    setExporting(false);
    setProgress(null);
    setResult(null);
    setError(null);
  }, []);

  return { exporting, progress, result, error, startExport, reset };
}
