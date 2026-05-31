import { useState, useCallback, useRef } from 'react';
import { performAudit, type AuditSummary, type AuditProgress } from '../core/domain/audit.js';
import type { Model } from '../core/api/models.js';

interface UseAuditResult {
  auditing: boolean;
  progress: AuditProgress | null;
  result: AuditSummary | null;
  error: string | null;
  startAudit: (token: string, modelId: string, modelName: string) => void;
  // Scan-all mode
  scanningAll: boolean;
  scanAllProgress: { current: number; total: number; modelName: string } | null;
  modelResults: Map<string, AuditSummary>;
  startScanAll: (token: string, models: Model[]) => void;
  selectModel: (modelId: string) => void;
  reset: () => void;
}

export function useAudit(): UseAuditResult {
  const [auditing, setAuditing] = useState(false);
  const [progress, setProgress] = useState<AuditProgress | null>(null);
  const [result, setResult] = useState<AuditSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [scanningAll, setScanningAll] = useState(false);
  const [scanAllProgress, setScanAllProgress] = useState<{ current: number; total: number; modelName: string } | null>(null);
  const [modelResults, setModelResults] = useState<Map<string, AuditSummary>>(new Map());
  const cancelRef = useRef(false);

  const startAudit = useCallback((token: string, modelId: string, modelName: string) => {
    setAuditing(true);
    setProgress(null);
    setResult(null);
    setError(null);

    performAudit(token, modelId, modelName, p => setProgress(p))
      .then(r => setResult(r))
      .catch(e => setError(e instanceof Error ? e.message : 'Audit failed'))
      .finally(() => setAuditing(false));
  }, []);

  const startScanAll = useCallback((token: string, models: Model[]) => {
    setScanningAll(true);
    cancelRef.current = false;
    setModelResults(new Map());
    setResult(null);
    setProgress(null);

    (async () => {
      for (let i = 0; i < models.length; i++) {
        if (cancelRef.current) break;
        const m = models[i];
        if (!cancelRef.current) setScanAllProgress({ current: i + 1, total: models.length, modelName: m.Name });
        try {
          const summary = await performAudit(token, m.ModelId, m.Name, p => { if (!cancelRef.current) setProgress(p); });
          if (cancelRef.current) break;
          setModelResults(prev => new Map(prev).set(m.ModelId, summary));
        } catch {}
        if (!cancelRef.current) setProgress(null);
      }
      if (!cancelRef.current) {
        setScanningAll(false);
        setScanAllProgress(null);
      }
    })();
  }, []);

  const selectModel = useCallback((modelId: string) => {
    const r = modelResults.get(modelId);
    if (r) setResult(r);
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
