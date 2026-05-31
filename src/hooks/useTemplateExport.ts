import { useState, useCallback } from 'react';
import { performTemplateExport, type TemplateExportResult, type TemplateProgress } from '../core/export/template.js';
import { getExportsDir } from '../core/config.js';

export interface UseTemplateExportResult {
  exporting: boolean;
  progress: TemplateProgress | null;
  result: TemplateExportResult | null;
  error: string | null;
  startExport: (token: string, modelId: string, modelName: string, templatePath: string, variables: Record<string, string>) => void;
  reset: () => void;
}

export function useTemplateExport(): UseTemplateExportResult {
  const [exporting, setExporting] = useState(false);
  const [progress, setProgress] = useState<TemplateProgress | null>(null);
  const [result, setResult] = useState<TemplateExportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const startExport = useCallback((token: string, modelId: string, modelName: string, templatePath: string, variables: Record<string, string>) => {
    setExporting(true);
    setProgress(null);
    setResult(null);
    setError(null);

    performTemplateExport(token, modelId, modelName, templatePath, getExportsDir(), variables, p => setProgress(p))
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
