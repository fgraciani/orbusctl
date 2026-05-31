import { useState, useEffect } from 'react';
import { fetchObjectDetail, fetchObjectRelationships, type ObjectDetail, type RelatedObject } from '../core/api/objects.js';

interface UseObjectDetailResult {
  detail: ObjectDetail | null;
  relationships: RelatedObject[];
  loading: boolean;
  error: string | null;
}

export function useObjectDetail(token: string | null, objectId: string | null): UseObjectDetailResult {
  const [detail, setDetail] = useState<ObjectDetail | null>(null);
  const [relationships, setRelationships] = useState<RelatedObject[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token || !objectId) { setDetail(null); setRelationships([]); return; }
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
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load object detail');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [token, objectId]);

  return { detail, relationships, loading, error };
}
