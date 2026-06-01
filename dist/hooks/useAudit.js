import { useState, useCallback, useRef } from 'react';
import { performAudit } from '../core/domain/audit.js';
export function useAudit() {
    const [auditing, setAuditing] = useState(false);
    const [progress, setProgress] = useState(null);
    const [result, setResult] = useState(null);
    const [error, setError] = useState(null);
    const [scanningAll, setScanningAll] = useState(false);
    const [scanAllProgress, setScanAllProgress] = useState(null);
    const [modelResults, setModelResults] = useState(new Map());
    const cancelRef = useRef(false);
    const startAudit = useCallback((token, modelId, modelName) => {
        setAuditing(true);
        setProgress(null);
        setResult(null);
        setError(null);
        performAudit(token, modelId, modelName, p => setProgress(p))
            .then(r => setResult(r))
            .catch(e => setError(e instanceof Error ? e.message : 'Audit failed'))
            .finally(() => setAuditing(false));
    }, []);
    const startScanAll = useCallback((token, models) => {
        setScanningAll(true);
        cancelRef.current = false;
        setModelResults(new Map());
        setResult(null);
        setProgress(null);
        (async () => {
            for (let i = 0; i < models.length; i++) {
                if (cancelRef.current)
                    break;
                const m = models[i];
                if (!cancelRef.current)
                    setScanAllProgress({ current: i + 1, total: models.length, modelName: m.Name });
                try {
                    const summary = await performAudit(token, m.ModelId, m.Name, p => { if (!cancelRef.current)
                        setProgress(p); });
                    if (cancelRef.current)
                        break;
                    setModelResults(prev => new Map(prev).set(m.ModelId, summary));
                }
                catch { }
                if (!cancelRef.current)
                    setProgress(null);
            }
            if (!cancelRef.current) {
                setScanningAll(false);
                setScanAllProgress(null);
            }
        })();
    }, []);
    const selectModel = useCallback((modelId) => {
        const r = modelResults.get(modelId);
        if (r)
            setResult(r);
    }, [modelResults]);
    const reset = useCallback(() => {
        cancelRef.current = true;
        setAuditing(false);
        setScanningAll(false);
        setProgress(null);
        setScanAllProgress(null);
        setResult(null);
        setError(null);
        setModelResults(new Map());
    }, []);
    return { auditing, progress, result, error, startAudit, scanningAll, scanAllProgress, modelResults, startScanAll, selectModel, reset };
}
