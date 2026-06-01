import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
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
export const ConfirmModal = ({ sessionStart, tokensUsed, user, onConfirm, onCancel }) => {
    const { stdout } = useStdout();
    const [confirmed, setConfirmed] = useState(false);
    const w = Math.min(stdout.columns || 80, 72);
    const inner = w - 2;
    const tl = ` ORBUSCTL v${VERSION} `;
    const tr = ' Session Summary ';
    const titleFill = Math.max(0, inner - tl.length - tr.length - 2);
    const titleRaw = `╭─${tl}${'─'.repeat(titleFill)}${tr}─╮`;
    const summary = getSessionSummary();
    const duration = formatDuration(sessionStart);
    const userTotal = Object.values(summary.userByMethod).reduce((a, b) => a + b, 0);
    const tokenStr = tokensUsed > 1 ? `${tokensUsed} (${tokensUsed - 1} refresh${tokensUsed > 2 ? 'es' : ''})` : '1';
    const fmt = { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' };
    const startStr = sessionStart.toLocaleString('en-GB', fmt);
    const endStr = new Date().toLocaleString('en-GB', fmt);
    useInput((input, key) => {
        if (confirmed)
            return;
        if (input === 'y' || key.return)
            setConfirmed(true);
        if (key.escape || input === 'n')
            onCancel();
    });
    useEffect(() => {
        if (confirmed)
            onConfirm();
    }, [confirmed, onConfirm]);
    // Two-column layout matching exitSummary.ts
    const lw = 36;
    const apiCol = lw;
    const leftPad = (label, value) => `${label}${' '.repeat(Math.max(1, 14 - label.length))}${value}`;
    const DualRow = ({ label, value, rLabel, rValue, rDim }) => (_jsxs(Box, { children: [_jsx(Box, { width: lw, children: _jsxs(Text, { children: [_jsx(Text, { color: "gray", children: label }), _jsxs(Text, { color: "white", children: [' '.repeat(Math.max(1, 14 - label.length)), value] })] }) }), _jsxs(Box, { width: inner - lw - 2, justifyContent: "space-between", children: [_jsx(Text, { color: "gray", children: rLabel }), _jsx(Text, { color: rDim ? 'gray' : 'white', children: rValue })] })] }));
    const ApiRow = ({ label, value, color, indent = 0 }) => (_jsxs(Box, { children: [_jsx(Box, { width: lw }), _jsxs(Box, { width: inner - lw - 2, justifyContent: "space-between", children: [_jsxs(Text, { color: color ?? 'gray', children: [' '.repeat(indent), label] }), _jsx(Text, { color: color ?? 'white', children: value })] })] }));
    return (_jsxs(Box, { flexDirection: "column", width: w, children: [_jsx(Text, { color: "gray", children: titleRaw }), _jsxs(Box, { borderStyle: "round", borderTop: false, borderColor: "gray", paddingX: 2, flexDirection: "column", children: [_jsxs(Box, { marginTop: 1, flexDirection: "column", children: [_jsx(DualRow, { label: "Duration", value: duration, rLabel: "Calls (total)", rValue: String(summary.total) }), _jsx(DualRow, { label: "Start", value: startStr, rLabel: "Startup", rValue: String(summary.startup), rDim: true }), _jsx(DualRow, { label: "End", value: endStr, rLabel: "Heartbeat", rValue: String(summary.heartbeat), rDim: true }), _jsx(DualRow, { label: "Tokens", value: tokenStr, rLabel: "User", rValue: String(userTotal) }), Object.entries(summary.userByMethod).filter(([, n]) => n > 0).map(([m, n]) => (_jsx(ApiRow, { label: m, value: String(n), color: "#6cb886", indent: 2 }, m)))] }), _jsx(Box, { marginTop: 1, marginBottom: 1, children: _jsxs(Text, { color: "yellow", children: ["Exit ORBUSCTL? ", _jsx(Text, { dimColor: true, children: "[y/\u21B5] yes  [Esc/n] cancel" })] }) })] })] }));
};
