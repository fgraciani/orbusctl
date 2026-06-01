import { useState, useCallback } from 'react';
import { scanActivity, summarizeReport, getTimePeriodRange } from '../core/domain/activity.js';
export function useActivity() {
    const [scanning, setScanning] = useState(false);
    const [progress, setProgress] = useState(null);
    const [report, setReport] = useState(null);
    const [error, setError] = useState(null);
    const startScan = useCallback((token, models, period) => {
        setScanning(true);
        setProgress(null);
        setReport(null);
        setError(null);
        const { since, until, label } = getTimePeriodRange(period);
        scanActivity(token, models, since, until, label, (p) => setProgress(p))
            .then(raw => {
            const summary = summarizeReport(raw);
            setReport({ ...summary, label, since, until });
        })
            .catch(e => setError(e instanceof Error ? e.message : 'Scan failed'))
            .finally(() => setScanning(false));
    }, []);
    const reset = useCallback(() => {
        setScanning(false);
        setProgress(null);
        setReport(null);
        setError(null);
    }, []);
    return { scanning, progress, report, error, startScan, reset };
}
