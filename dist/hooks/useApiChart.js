import { useState, useEffect } from 'react';
import { getUserCalls, isStartupComplete } from '../core/api/counter.js';
const BUCKET_MS = 60000;
export function useApiChart(windowSize) {
    const [buckets, setBuckets] = useState([]);
    const [activeMethods, setActiveMethods] = useState(new Set());
    useEffect(() => {
        const tick = () => {
            if (!isStartupComplete())
                return;
            const userCalls = getUserCalls();
            const now = Date.now();
            // Align to clock minutes so buckets don't slide
            const currentMinute = Math.floor(now / BUCKET_MS) * BUCKET_MS;
            const windowStart = currentMinute - (windowSize - 1) * BUCKET_MS;
            const active = new Set();
            const result = [];
            for (let i = 0; i < windowSize; i++) {
                const bStart = windowStart + i * BUCKET_MS;
                const bEnd = bStart + BUCKET_MS;
                const bucket = { GET: 0, POST: 0, PATCH: 0, DELETE: 0 };
                for (const c of userCalls) {
                    if (c.timestamp >= bStart && c.timestamp < bEnd) {
                        const m = c.method;
                        if (m in bucket) {
                            bucket[m]++;
                            active.add(m);
                        }
                    }
                }
                result.push(bucket);
            }
            setBuckets(result);
            setActiveMethods(active);
        };
        tick();
        const t = setInterval(tick, 1000);
        return () => clearInterval(t);
    }, [windowSize]);
    return { buckets, activeMethods };
}
