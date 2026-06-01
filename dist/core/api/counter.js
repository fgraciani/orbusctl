const calls = [];
const listeners = [];
let startupEndIndex = -1;
export function recordCall(record) {
    calls.push(record);
    for (const fn of listeners)
        fn(record);
}
export function onCall(fn) {
    listeners.push(fn);
    return () => {
        const idx = listeners.indexOf(fn);
        if (idx >= 0)
            listeners.splice(idx, 1);
    };
}
export function getAllCalls() {
    return calls;
}
export function getCallsSince(sinceMs) {
    return calls.filter(c => c.timestamp >= sinceMs);
}
export function getCallsByMethod() {
    const counts = {};
    for (const c of calls) {
        counts[c.method] = (counts[c.method] ?? 0) + 1;
    }
    return counts;
}
export function markStartupComplete() {
    if (startupEndIndex < 0)
        startupEndIndex = calls.length;
}
export function getStartupCount() {
    return startupEndIndex >= 0 ? startupEndIndex : calls.length;
}
export function isStartupComplete() {
    return startupEndIndex >= 0;
}
export function getUserCalls() {
    return calls.filter(c => c.category === 'user');
}
export function getHeartbeatCount() {
    return calls.filter(c => c.category === 'heartbeat').length;
}
export function getSessionSummary() {
    const total = calls.length;
    const startup = getStartupCount();
    const heartbeat = getHeartbeatCount();
    const userCalls = calls.filter(c => c.category === 'user');
    const userByMethod = {};
    for (const c of userCalls) {
        userByMethod[c.method] = (userByMethod[c.method] ?? 0) + 1;
    }
    return { total, startup, heartbeat, userByMethod, userTotal: userCalls.length };
}
