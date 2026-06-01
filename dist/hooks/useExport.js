import { useState, useCallback } from 'react';
import { performExcelExport } from '../core/export/excel.js';
import { performMarkdownExport } from '../core/export/markdown.js';
export function useExport() {
    const [exporting, setExporting] = useState(false);
    const [progress, setProgress] = useState(null);
    const [result, setResult] = useState(null);
    const [error, setError] = useState(null);
    const startExport = useCallback((token, modelId, modelName, format, fetchDetails) => {
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
