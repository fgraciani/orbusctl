import { useState, useCallback } from 'react';
import type { Model } from '../core/api/models.js';
import { scanActivity, summarizeReport, type TimePeriod, type ActivityReport, type ModelActivity, type ScanProgress, getTimePeriodRange } from '../core/domain/activity.js';

interface UseActivityResult {
  scanning: boolean;
  progress: ScanProgress | null;
  report: { models: ModelActivity[]; totalObjects: number; totalRels: number; totalCreated: number; totalModified: number; label: string; since: Date; until: Date } | null;
  error: string | null;
  startScan: (token: string, models: Model[], period: TimePeriod) => void;
  reset: () => void;
}

export function useActivity(): UseActivityResult {
  const [scanning, setScanning] = useState(false);
  const [progress, setProgress] = useState<ScanProgress | null>(null);
  const [report, setReport] = useState<UseActivityResult['report']>(null);
  const [error, setError] = useState<string | null>(null);

  const startScan = useCallback((token: string, models: Model[], period: TimePeriod) => {
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
