import { useState, useEffect } from 'react';
import { getSessionSummary } from '../core/api/counter.js';
export function useApiCounter(refreshIntervalMs = 1000) {
    const [total, setTotal] = useState(0);
    const [startup, setStartup] = useState(0);
    const [heartbeat, setHeartbeat] = useState(0);
    const [userByMethod, setUserByMethod] = useState({});
    useEffect(() => {
        const update = () => {
            const s = getSessionSummary();
            setTotal(s.total);
            setStartup(s.startup);
            setHeartbeat(s.heartbeat);
            setUserByMethod(s.userByMethod);
        };
        update();
        const t = setInterval(update, refreshIntervalMs);
        return () => clearInterval(t);
    }, [refreshIntervalMs]);
    return { total, startup, heartbeat, userByMethod };
}
