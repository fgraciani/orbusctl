import { useState, useEffect, useRef } from 'react';
import { fetchMe } from '../core/api/me.js';
import { ODataError, setCallCategory } from '../core/api/client.js';

export type HeartbeatStatus = 'connected' | 'unauthorized' | 'timeout' | 'offline' | 'idle';

interface UseHeartbeatResult {
  status: HeartbeatStatus;
  latencyMs: number | null;
  lastCheck: Date | null;
}

const INTERVAL_MS = 10_000;
const TIMEOUT_MS = 5_000;

export function useHeartbeat(token: string | null, paused: boolean): UseHeartbeatResult {
  const [status, setStatus] = useState<HeartbeatStatus>('idle');
  const [latencyMs, setLatencyMs] = useState<number | null>(null);
  const [lastCheck, setLastCheck] = useState<Date | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!token || paused) {
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
      if (!token) setStatus('idle');
      return;
    }

    const check = async () => {
      const start = Date.now();
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

      try {
        setCallCategory('heartbeat');
        await fetchMe(token);
        setCallCategory('user');
        const ms = Date.now() - start;
        setStatus('connected');
        setLatencyMs(ms);
      } catch (e) {
        setCallCategory('user');
        if (e instanceof ODataError && e.isUnauthorized) {
          setStatus('unauthorized');
        } else if (e instanceof DOMException && e.name === 'AbortError') {
          setStatus('timeout');
        } else {
          setStatus('offline');
        }
        setLatencyMs(null);
      } finally {
        clearTimeout(timeout);
        setLastCheck(new Date());
      }
    };

    check();
    timerRef.current = setInterval(check, INTERVAL_MS);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [token, paused]);

  return { status, latencyMs, lastCheck };
}
