import { useState, useCallback } from 'react';
import { performAuditExcelExport, type AuditExportResult, type AuditExportProgress } from '../core/export/audit-excel.js';
import type { AuditSummary } from '../core/domain/audit.js';

export interface UseAuditExportResult {
  exporting: boolean;
  progress: AuditExportProgress | null;
  result: AuditExportResult | null;
  error: string | null;
  startExport: (summaries: AuditSummary[]) => void;
  reset: () => void;
}

export function useAuditExport(): UseAuditExportResult {
  const [exporting, setExporting] = useState(false);
  const [progress, setProgress] = useState<AuditExportProgress | null>(null);
  const [result, setResult] = useState<AuditExportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const startExport = useCallback((summaries: AuditSummary[]) => {
    setExporting(true);
    setProgress(null);
    setResult(null);
    setError(null);

    performAuditExcelExport(summaries, p => setProgress(p))
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
