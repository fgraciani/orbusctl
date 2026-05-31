import { useState, useEffect, useCallback } from 'react';
import { fetchModels, fetchModelDetailCounts, type Model, type ModelCounts } from '../core/api/models.js';
import { getSolutionFilter, getShowHiddenModels } from '../core/config.js';
import { markStartupComplete } from '../core/api/counter.js';
import { setCallCategory } from '../core/api/client.js';

interface UseModelsResult {
  models: Model[];
  counts: Map<string, ModelCounts>;
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

export function useModels(token: string | null): UseModelsResult {
  const [models, setModels] = useState<Model[]>([]);
  const [counts, setCounts] = useState<Map<string, ModelCounts>>(new Map());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const refresh = useCallback(() => setTick(t => t + 1), []);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        const solutionFilter = getSolutionFilter();
        const showHidden = getShowHiddenModels();
        let all = await fetchModels(token, solutionFilter);
        if (!showHidden) all = all.filter(m => !m.IsHidden);
        if (cancelled) return;
        setModels(all);

        const detailCounts = await fetchModelDetailCounts(token, all.map(m => m.ModelId));
        if (cancelled) return;
        setCounts(detailCounts);
        markStartupComplete();
        setCallCategory('user');
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load models');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [token, tick]);

  return { models, counts, loading, error, refresh };
}
