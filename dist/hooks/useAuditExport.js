import { useState, useCallback } from 'react';
import { performAuditExcelExport } from '../core/export/audit-excel.js';
export function useAuditExport() {
    const [exporting, setExporting] = useState(false);
    const [progress, setProgress] = useState(null);
    const [result, setResult] = useState(null);
    const [error, setError] = useState(null);
    const startExport = useCallback((summaries) => {
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
