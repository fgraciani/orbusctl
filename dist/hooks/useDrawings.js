import { useState, useEffect, useCallback } from 'react';
import { fetchDrawings, fetchDocumentTypes } from '../core/api/drawings.js';
export function useDrawings(token, modelId) {
    const [drawings, setDrawings] = useState([]);
    const [typeMap, setTypeMap] = useState(new Map());
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [tick, setTick] = useState(0);
    const refresh = useCallback(() => setTick(t => t + 1), []);
    useEffect(() => {
        if (!token || !modelId) {
            setDrawings([]);
            return;
        }
        let cancelled = false;
        setLoading(true);
        setError(null);
        (async () => {
            try {
                const [d, types] = await Promise.all([
                    fetchDrawings(token, modelId),
                    fetchDocumentTypes(token),
                ]);
                if (!cancelled) {
                    d.sort((a, b) => a.FileName.localeCompare(b.FileName));
                    setDrawings(d);
                    setTypeMap(new Map(types.map(t => [t.DocumentTypeId, t.Name])));
                }
            }
            catch (e) {
                if (!cancelled)
                    setError(e instanceof Error ? e.message : 'Failed to load drawings');
            }
            finally {
                if (!cancelled)
                    setLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, [token, modelId, tick]);
    return { drawings, typeMap, loading, error, refresh };
}
