import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { ORBUSCTL_ASCII } from '../assets/logo.js';
import { getOrgName, formatTokenAge } from '../core/config.js';
export const WelcomeModal = ({ auth, onAuthenticated, onSkip, onDismiss, }) => {
    const [token, setToken] = useState('');
    const [error, setError] = useState('');
    const [validating, setValidating] = useState(false);
    const needsAuth = auth.status !== 'authenticated';
    const handleSubmit = async () => {
        if (!token.trim()) {
            setError('Token cannot be empty');
            return;
        }
        setValidating(true);
        setError('');
        try {
            await onAuthenticated(token.trim());
        }
        catch {
            setError('Authentication failed — check your token');
        }
        finally {
            setValidating(false);
        }
    };
    useInput((input, key) => {
        if (validating)
            return;
        if (!needsAuth) {
            onDismiss();
            return;
        }
        if (key.escape) {
            onSkip();
            return;
        }
        if (key.return) {
            if (token.length > 0)
                handleSubmit();
            return;
        }
        if (key.backspace || key.delete) {
            setToken(prev => prev.slice(0, -1));
            return;
        }
        if (input && !key.ctrl && !key.meta) {
            setToken(prev => prev + input);
        }
    });
    const tokenAge = formatTokenAge();
    const statusLine = auth.status === 'expired'
        ? `⚠  Session expired — enter a new bearer token${tokenAge ? ` (previous token: ${tokenAge})` : ''}`
        : '   Enter your bearer token to authenticate';
    const tokenDisplay = token.length === 0
        ? _jsx(Text, { dimColor: true, children: "paste token and press Enter" })
        : _jsxs(Text, { color: "green", children: [token.slice(0, 20), "\u2026", token.slice(-10), " ", _jsxs(Text, { color: "gray", dimColor: true, children: ["(", token.length, " chars)"] })] });
    return (_jsx(Box, { flexDirection: "column", width: "100%", height: "100%", alignItems: "center", justifyContent: "center", children: _jsxs(Box, { flexDirection: "column", alignItems: "center", borderStyle: "round", borderColor: "cyan", paddingX: 4, paddingY: 1, children: [_jsx(Box, { marginBottom: 1, children: _jsx(Text, { color: "cyan", children: ORBUSCTL_ASCII }) }), _jsxs(Text, { color: "gray", dimColor: true, children: ["Orbus Administration CLI  \u00B7  ", getOrgName()] }), _jsx(Box, { marginTop: 2, flexDirection: "column", alignItems: "center", children: needsAuth ? (_jsxs(_Fragment, { children: [_jsx(Text, { color: auth.status === 'expired' ? 'yellow' : 'gray', children: statusLine }), validating ? (_jsx(Box, { marginTop: 1, children: _jsx(Text, { color: "cyan", children: "Validating token..." }) })) : (_jsxs(_Fragment, { children: [_jsxs(Box, { marginTop: 1, gap: 1, children: [_jsx(Text, { color: "cyan", children: "Token\u203A" }), tokenDisplay] }), error ? (_jsx(Text, { color: "red", children: error })) : (_jsx(Box, { marginTop: 1, children: _jsx(Text, { dimColor: true, children: "[Enter] authenticate  [Esc] continue without auth" }) }))] }))] })) : (_jsxs(_Fragment, { children: [_jsxs(Text, { color: "green", children: ["\u25CF  Welcome, ", auth.user, "!"] }), _jsx(Text, { color: "gray", dimColor: true, children: "Auth token valid" }), _jsx(Box, { marginTop: 1, children: _jsx(Text, { dimColor: true, children: "Press any key to enter" }) })] })) })] }) }));
};
