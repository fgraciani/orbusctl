import { useState, useCallback } from 'react';
import { performTemplateExport } from '../core/export/template.js';
import { getExportsDir } from '../core/config.js';
export function useTemplateExport() {
    const [exporting, setExporting] = useState(false);
    const [progress, setProgress] = useState(null);
    const [result, setResult] = useState(null);
    const [error, setError] = useState(null);
    const startExport = useCallback((token, modelId, modelName, templatePath, variables) => {
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
