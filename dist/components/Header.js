import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import { Box, Text } from 'ink';
import { getOrgName } from '../core/config.js';
const PULSE_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
const PULSE_INTERVAL = 80;
const STATUS_DISPLAY = {
    connected: { symbol: '●', color: 'green' },
    unauthorized: { symbol: '✕', color: 'red', label: 'unauthorized' },
    timeout: { symbol: '~', color: 'yellow', label: 'timeout' },
    offline: { symbol: '✕', color: 'red', label: 'offline' },
    idle: { symbol: '○', color: 'gray' },
};
export const Header = ({ auth, heartbeatStatus, heartbeatLastCheck }) => {
    const [pulseFrame, setPulseFrame] = useState(-1);
    useEffect(() => {
        if (!heartbeatLastCheck)
            return;
        setPulseFrame(0);
    }, [heartbeatLastCheck]);
    useEffect(() => {
        if (pulseFrame < 0 || pulseFrame >= PULSE_FRAMES.length)
            return;
        const t = setTimeout(() => setPulseFrame(f => f + 1), PULSE_INTERVAL);
        return () => clearTimeout(t);
    }, [pulseFrame]);
    const hb = STATUS_DISPLAY[heartbeatStatus];
    const isPulsing = pulseFrame >= 0 && pulseFrame < PULSE_FRAMES.length;
    const dot = heartbeatStatus === 'connected' && isPulsing ? PULSE_FRAMES[pulseFrame] : hb.symbol;
    const badge = auth.status === 'authenticated'
        ? _jsxs(Text, { children: [_jsx(Text, { color: hb.color, children: dot }), " ", _jsx(Text, { color: "green", children: auth.user }), hb.label ? _jsxs(Text, { color: hb.color, children: [" ", hb.label] }) : null] })
        : _jsx(Text, { color: "red", dimColor: true, children: "\u25CB no auth" });
    return (_jsx(Box, { flexDirection: "column", width: "100%", marginBottom: 1, children: _jsxs(Box, { paddingX: 1, justifyContent: "space-between", children: [_jsxs(Box, { children: [_jsx(Text, { bold: true, color: "cyan", children: "ORBUSCTL" }), _jsxs(Text, { color: "gray", children: [" \u00B7 ", getOrgName()] })] }), badge] }) }));
};
