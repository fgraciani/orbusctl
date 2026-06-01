import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import { Box, Text } from 'ink';
import { Panel } from './Panel.js';
import { formatTokenAge } from '../core/config.js';
const Stat = ({ label, value, valueColor = 'white', }) => (_jsxs(Box, { justifyContent: "space-between", children: [_jsx(Text, { color: "gray", children: label }), _jsx(Text, { color: valueColor, children: value })] }));
const Section = ({ title, children }) => (_jsxs(Box, { flexDirection: "column", marginBottom: 1, children: [_jsx(Text, { bold: true, color: "white", children: title }), _jsx(Box, { flexDirection: "column", paddingLeft: 1, children: children })] }));
function formatDuration(start) {
    const secs = Math.floor((Date.now() - start.getTime()) / 1000);
    if (secs < 60)
        return `${secs}s`;
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    if (m < 60)
        return `${m}m ${s}s`;
    const h = Math.floor(m / 60);
    const rm = m % 60;
    if (h < 24)
        return `${h}h ${rm}m`;
    const d = Math.floor(h / 24);
    const rh = h % 24;
    return `${d}d ${rh}h ${rm}m`;
}
function licenseColor(license) {
    switch (license) {
        case 'Admin': return '#e88a7a';
        case 'Author': return '#d4a053';
        case 'Viewer': return '#6cb886';
        default: return 'gray';
    }
}
// --- Per-method sparkline charts ---
const BLOCKS = ['▁', '▂', '▃', '▄', '▅', '▆', '▇', '█'];
const METHOD_COLOR = { GET: '#6cb886', POST: 'yellow', PATCH: 'cyan', DELETE: 'red' };
const DISPLAY_METHODS = ['GET', 'POST', 'PATCH', 'DELETE'];
const CHART_WIDTH = 22;
function sparkline(buckets, method, width) {
    // Take the last `width` buckets (or pad with empties if fewer)
    const start = Math.max(0, buckets.length - width);
    const slice = buckets.slice(start);
    const values = slice.map(b => b[method] ?? 0);
    const max = Math.max(8, ...values); // scale 1:1 up to 8, then compress
    let line = '';
    // Leading blanks if not enough history
    for (let i = 0; i < width - values.length; i++)
        line += ' ';
    for (const v of values) {
        if (v === 0) {
            line += ' ';
        }
        else {
            const level = Math.max(1, Math.min(8, Math.ceil((v / max) * 8)));
            line += BLOCKS[level - 1];
        }
    }
    return line;
}
const UserMethodCharts = ({ userByMethod, buckets, activeMethods }) => (_jsx(Box, { flexDirection: "column", children: DISPLAY_METHODS.filter(m => (userByMethod[m] ?? 0) > 0 || activeMethods.has(m)).map(m => (_jsxs(Box, { flexDirection: "column", children: [_jsxs(Box, { justifyContent: "space-between", paddingLeft: 1, children: [_jsx(Text, { color: METHOD_COLOR[m] ?? 'gray', children: m }), _jsx(Text, { color: METHOD_COLOR[m] ?? 'white', children: userByMethod[m] ?? 0 })] }), _jsx(Box, { justifyContent: "flex-end", children: _jsx(Text, { color: METHOD_COLOR[m], children: sparkline(buckets, m, CHART_WIDTH) }) })] }, m))) }));
export const StatsPanel = ({ auth, sessionStart, heartbeatLatency, apiTotal, apiStartup, apiHeartbeat, apiUserByMethod, chartBuckets, chartActiveMethods }) => {
    const [duration, setDuration] = useState(formatDuration(sessionStart));
    useEffect(() => {
        const t = setInterval(() => setDuration(formatDuration(sessionStart)), 1000);
        return () => clearInterval(t);
    }, [sessionStart]);
    return (_jsx(Panel, { title: "Info", width: 30, marginLeft: 1, paddingX: 1, children: _jsxs(Box, { flexDirection: "column", marginTop: 1, children: [_jsxs(Section, { title: "Session", children: [_jsx(Stat, { label: "Duration", value: duration }), formatTokenAge() && _jsx(Stat, { label: "Token age", value: formatTokenAge(), valueColor: "gray" })] }), _jsx(Section, { title: "License", children: _jsxs(Text, { children: [auth.isAdmin && _jsx(Text, { color: licenseColor('Admin'), children: "Admin" }), auth.isAdmin && auth.licenses?.length ? _jsx(Text, { color: "gray", children: " | " }) : null, auth.licenses?.map((l, i) => (_jsxs(Text, { children: [i > 0 && _jsx(Text, { color: "gray", children: " | " }), _jsx(Text, { color: licenseColor(l), children: l })] }, l)))] }) }), auth.roles && auth.roles.length > 0 && (_jsx(Section, { title: `Roles (${auth.roles.length})`, children: auth.roles.map(r => (_jsx(Text, { color: licenseColor(r.license), wrap: "truncate", children: r.name }, r.name))) })), _jsxs(Section, { title: "API", children: [heartbeatLatency !== null && (_jsx(Stat, { label: "Latency", value: `${heartbeatLatency}ms` })), _jsx(Stat, { label: "Calls (total)", value: String(apiTotal) }), _jsx(Stat, { label: "Startup", value: String(apiStartup), valueColor: "gray" }), _jsx(Stat, { label: "Heartbeat", value: String(apiHeartbeat), valueColor: "gray" }), _jsx(Stat, { label: "User", value: String(Object.values(apiUserByMethod).reduce((a, b) => a + b, 0)) }), _jsx(UserMethodCharts, { userByMethod: apiUserByMethod, buckets: chartBuckets, activeMethods: chartActiveMethods })] })] }) }));
};
