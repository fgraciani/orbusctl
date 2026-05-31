import { useState, useEffect } from 'react';
import { resolveDrawingComponents, type ResolvedComponent } from '../core/api/drawings.js';

interface UseDrawingDetailResult {
  components: ResolvedComponent[];
  loading: boolean;
  error: string | null;
}

export function useDrawingDetail(token: string | null, documentId: string | null): UseDrawingDetailResult {
  const [components, setComponents] = useState<ResolvedComponent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token || !documentId) { setComponents([]); return; }
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
      if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load components');
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });

    return () => { cancelled = true; };
  }, [token, documentId]);

  return { components, loading, error };
}
