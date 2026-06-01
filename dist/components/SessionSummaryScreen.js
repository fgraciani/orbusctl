import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { Box, Text, useInput, useStdout } from 'ink';
import { getSessionSummary } from '../core/api/counter.js';
import { VERSION } from '../version.js';
function formatDuration(start) {
    const secs = Math.floor((Date.now() - start.getTime()) / 1000);
    if (secs < 60)
        return `${secs}s`;
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    if (m < 60)
        return s > 0 ? `${m}m ${s}s` : `${m}m`;
    const h = Math.floor(m / 60);
    const rm = m % 60;
    return rm > 0 ? `${h}h ${rm}m` : `${h}h`;
}
export const SessionSummaryScreen = ({ sessionStart, tokensUsed, user, onExit }) => {
    const { stdout } = useStdout();
    const [countdown, setCountdown] = useState(5);
    const duration = formatDuration(sessionStart);
    const summary = getSessionSummary();
    const userTotal = Object.values(summary.userByMethod).reduce((a, b) => a + b, 0);
    const w = Math.min(stdout.columns || 80, 72);
    const inner = w - 2;
    const fill = Math.max(0, inner - 33);
    useEffect(() => {
        if (countdown <= 0) {
            onExit();
            return;
        }
        const t = setTimeout(() => setCountdown(c => c - 1), 1000);
        return () => clearTimeout(t);
    }, [countdown, onExit]);
    useInput(() => onExit());
    const tokenStr = tokensUsed > 1 ? `${tokensUsed} (${tokensUsed - 1} refresh${tokensUsed > 2 ? 'es' : ''})` : '1';
    const startStr = sessionStart.toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
    const endStr = new Date().toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
    return (_jsxs(Box, { flexDirection: "column", width: w, children: [_jsxs(Text, { color: "gray", children: ["\u256D\u2500 ", _jsx(Text, { bold: true, color: "cyan", children: "ORBUSCTL" }), " ", _jsxs(Text, { color: "gray", children: ["v", VERSION] }), " ", _jsx(Text, { color: "gray", children: '─'.repeat(fill) }), " ", _jsx(Text, { color: "white", children: "Session Summary" }), " ", _jsx(Text, { color: "gray", children: "\u2500\u256E" })] }), _jsxs(Box, { borderStyle: "round", borderTop: false, borderColor: "gray", paddingX: 2, flexDirection: "column", children: [_jsxs(Box, { marginTop: 1, flexDirection: "column", children: [_jsxs(Text, { color: "gray", children: ["Duration    ", _jsx(Text, { color: "white", children: duration })] }), _jsxs(Text, { color: "gray", children: ["Start       ", _jsx(Text, { color: "white", children: startStr })] }), _jsxs(Text, { color: "gray", children: ["End         ", _jsx(Text, { color: "white", children: endStr })] }), _jsxs(Text, { color: "gray", children: ["Tokens      ", _jsx(Text, { color: "white", children: tokenStr })] })] }), _jsxs(Box, { marginTop: 1, flexDirection: "column", children: [_jsxs(Text, { color: "gray", children: ["API calls   ", _jsx(Text, { color: "white", children: summary.total }), " total  \u00B7  startup ", summary.startup, "  \u00B7  heartbeat ", summary.heartbeat, "  \u00B7  user ", _jsx(Text, { color: "white", children: userTotal })] }), Object.entries(summary.userByMethod).filter(([, n]) => n > 0).map(([m, n]) => (_jsxs(Text, { color: "gray", children: ["            ", _jsx(Text, { color: "green", children: m }), ": ", n] }, m)))] }), _jsx(Box, { marginTop: 1, children: _jsxs(Text, { color: "green", children: ["Goodbye", user ? `, ${user}` : '', "!"] }) }), _jsx(Box, { marginBottom: 1, children: _jsxs(Text, { dimColor: true, children: ["Exiting in ", countdown, "s  \u00B7  any key to exit now"] }) })] })] }));
};
