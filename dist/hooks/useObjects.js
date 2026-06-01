import { useState, useEffect, useCallback } from 'react';
import { fetchObjects } from '../core/api/objects.js';
export function useObjects(token, modelId) {
    const [objects, setObjects] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [tick, setTick] = useState(0);
    const refresh = useCallback(() => setTick(t => t + 1), []);
    useEffect(() => {
        if (!token || !modelId) {
            setObjects([]);
            return;
        }
        let cancelled = false;
        setLoading(true);
        setError(null);
        (async () => {
            try {
                const all = await fetchObjects(token, modelId);
                if (!cancelled) {
                    all.sort((a, b) => a.ObjectType.Name.localeCompare(b.ObjectType.Name) || a.Name.localeCompare(b.Name));
                    setObjects(all);
                }
            }
            catch (e) {
                if (!cancelled)
                    setError(e instanceof Error ? e.message : 'Failed to load objects');
            }
            finally {
                if (!cancelled)
                    setLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, [token, modelId, tick]);
    return { objects, loading, error, refresh };
}
