import { useState, useEffect, useCallback } from 'react';
import { fetchModels, fetchModelDetailCounts } from '../core/api/models.js';
import { getSolutionFilter, getShowHiddenModels } from '../core/config.js';
import { markStartupComplete } from '../core/api/counter.js';
import { setCallCategory } from '../core/api/client.js';
export function useModels(token) {
    const [models, setModels] = useState([]);
    const [counts, setCounts] = useState(new Map());
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [tick, setTick] = useState(0);
    const refresh = useCallback(() => setTick(t => t + 1), []);
    useEffect(() => {
        if (!token)
            return;
        let cancelled = false;
        setLoading(true);
        setError(null);
        (async () => {
            try {
                const solutionFilter = getSolutionFilter();
                const showHidden = getShowHiddenModels();
                let all = await fetchModels(token, solutionFilter);
                if (!showHidden)
                    all = all.filter(m => !m.IsHidden);
                if (cancelled)
                    return;
                setModels(all);
                const detailCounts = await fetchModelDetailCounts(token, all.map(m => m.ModelId));
                if (cancelled)
                    return;
                setCounts(detailCounts);
                markStartupComplete();
                setCallCategory('user');
            }
            catch (e) {
                if (!cancelled)
                    setError(e instanceof Error ? e.message : 'Failed to load models');
            }
            finally {
                if (!cancelled)
                    setLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, [token, tick]);
    return { models, counts, loading, error, refresh };
}
