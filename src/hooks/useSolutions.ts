import { useState, useEffect } from 'react';
import { fetchSolutions, type Solution } from '../core/api/models.js';

export function useSolutions(token: string | null) {
  const [solutions, setSolutions] = useState<Solution[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    setLoading(true);

    fetchSolutions(token).then(s => {
      if (!cancelled) {
        s.sort((a, b) => a.Name.localeCompare(b.Name));
        setSolutions(s);
      }
    }).catch(() => {}).finally(() => {
      if (!cancelled) setLoading(false);
    });

    return () => { cancelled = true; };
  }, [token]);

  return { solutions, loading };
}
