import { useState, useEffect } from 'react';
import { fetchObjectDetail, fetchObjectRelationships } from '../core/api/objects.js';
export function useObjectDetail(token, objectId) {
    const [detail, setDetail] = useState(null);
    const [relationships, setRelationships] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    useEffect(() => {
        if (!token || !objectId) {
            setDetail(null);
            setRelationships([]);
            return;
        }
        let cancelled = false;
        setLoading(true);
        setError(null);
        (async () => {
            try {
                const [d, rels] = await Promise.all([
                    fetchObjectDetail(token, objectId),
                    fetchObjectRelationships(token, objectId),
                ]);
                if (!cancelled) {
                    setDetail(d);
                    setRelationships(rels);
                }
            }
            catch (e) {
                if (!cancelled)
                    setError(e instanceof Error ? e.message : 'Failed to load object detail');
            }
            finally {
                if (!cancelled)
                    setLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, [token, objectId]);
    return { detail, relationships, loading, error };
}
