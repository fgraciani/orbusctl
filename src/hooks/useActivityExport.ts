import { useState, useCallback } from 'react';
import { performActivityExcelExport, type ActivityExportResult, type ActivityExportProgress, type ActivityReport } from '../core/export/activity-excel.js';

export interface UseActivityExportResult {
  exporting: boolean;
  progress: ActivityExportProgress | null;
  result: ActivityExportResult | null;
  error: string | null;
  startExport: (report: ActivityReport) => void;
  reset: () => void;
}

export function useActivityExport(): UseActivityExportResult {
  const [exporting, setExporting] = useState(false);
  const [progress, setProgress] = useState<ActivityExportProgress | null>(null);
  const [result, setResult] = useState<ActivityExportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const startExport = useCallback((report: ActivityReport) => {
    setExporting(true);
    setProgress(null);
    setResult(null);
    setError(null);

    performActivityExcelExport(report, p => setProgress(p))
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
