import { jsxs as _jsxs, jsx as _jsx } from "react/jsx-runtime";
import { Box, Text } from 'ink';
import { VERSION } from '../version.js';
const K = ({ children }) => (_jsxs(Text, { color: "cyan", children: ["[", children, "]"] }));
const Sep = () => _jsx(Text, { color: "gray", children: " " });
export const Footer = ({ focusedPanel, showStats }) => {
    return (_jsxs(Box, { paddingX: 1, justifyContent: "space-between", children: [_jsxs(Text, { children: [_jsx(K, { children: "Tab" }), _jsx(Text, { color: "gray", children: " focus" }), _jsx(Sep, {}), _jsx(K, { children: "\u2191\u2193" }), _jsx(Text, { color: "gray", children: " nav" }), _jsx(Sep, {}), focusedPanel === 'sidebar'
                        ? _jsxs(Text, { children: [_jsx(K, { children: "\u2192/\u21B5" }), _jsx(Text, { color: "gray", children: " open" })] })
                        : _jsxs(Text, { children: [_jsx(K, { children: "Esc/\u2190" }), _jsx(Text, { color: "gray", children: " back" }), _jsx(Sep, {}), _jsx(K, { children: "\u21B5" }), _jsx(Text, { color: "gray", children: " select" })] }), _jsx(Sep, {}), _jsx(K, { children: "s" }), _jsx(Text, { color: "gray", children: " stats" }), _jsx(Sep, {}), _jsx(K, { children: "a" }), _jsx(Text, { color: "gray", children: " auth" }), _jsx(Sep, {}), _jsx(K, { children: "?" }), _jsx(Text, { color: "gray", children: " help" }), _jsx(Sep, {}), _jsx(K, { children: "q" }), _jsx(Text, { color: "gray", children: " quit" })] }), _jsxs(Text, { color: "gray", dimColor: true, children: ["v", VERSION] })] }));
};
