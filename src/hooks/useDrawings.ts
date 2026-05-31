import { useState, useEffect, useCallback } from 'react';
import { fetchDrawings, fetchDocumentTypes, type Drawing, type DocumentType } from '../core/api/drawings.js';

interface UseDrawingsResult {
  drawings: Drawing[];
  typeMap: Map<string, string>;
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

export function useDrawings(token: string | null, modelId: string | null): UseDrawingsResult {
  const [drawings, setDrawings] = useState<Drawing[]>([]);
  const [typeMap, setTypeMap] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const refresh = useCallback(() => setTick(t => t + 1), []);

  useEffect(() => {
    if (!token || !modelId) { setDrawings([]); return; }
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
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load drawings');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [token, modelId, tick]);

  return { drawings, typeMap, loading, error, refresh };
}
