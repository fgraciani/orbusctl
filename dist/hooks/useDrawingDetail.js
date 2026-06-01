import { useState, useEffect } from 'react';
import { resolveDrawingComponents } from '../core/api/drawings.js';
export function useDrawingDetail(token, documentId) {
    const [components, setComponents] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    useEffect(() => {
        if (!token || !documentId) {
            setComponents([]);
            return;
        }
        let cancelled = false;
        setLoading(true);
        setError(null);
        resolveDrawingComponents(token, documentId).then(resolved => {
            if (!cancelled) {
                const objects = resolved.filter(c => !c.isRelationship).sort((a, b) => a.typeName.localeCompare(b.typeName) || a.name.localeCompare(b.name));
                const rels = resolved.filter(c => c.isRelationship);
                setComponents([...objects, ...rels]);
            }
        }).catch(e => {
            if (!cancelled)
                setError(e instanceof Error ? e.message : 'Failed to load components');
        }).finally(() => {
            if (!cancelled)
                setLoading(false);
        });
        return () => { cancelled = true; };
    }, [token, documentId]);
    return { components, loading, error };
}
