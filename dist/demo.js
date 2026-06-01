import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { render, Box, Text, useInput, useApp } from 'ink';
// Widths that fit at 80-char terminal: paddingX(2)=4 + NW + margin(2) + WW = 80
// → NW=18, WW=56
const NW = 18;
const WW = 56;
const ITEMS = ['▶ Models', '  Compare', '  Audit', '  Activity'];
const ROWS = ['  Enterprise Architecture', '  Business Process Mgmt', '  IT Landscape'];
// ─── border helpers ──────────────────────────────────────────────────────────
// Builds ╭─ Title ────╮ at a known width.
// Formula: 3(╭─ ) + title + 1( ) + fill + 1(╮) = W  →  fill = W - title.length - 5
const topLine = (title, w, color) => {
    const fill = Math.max(0, w - title.length - 5);
    return _jsx(Text, { color: color, children: `╭─ ${title} ${'─'.repeat(fill)}╮` });
};
const bottomLine = (w, color) => (_jsx(Text, { color: color, children: `╰${'─'.repeat(w - 2)}╯` }));
// A – title inline with border: custom top line + Ink-native sides/bottom via borderTop={false}
const A = ({ w, title, focused, children }) => {
    const c = focused ? 'cyan' : 'gray';
    return (_jsxs(Box, { flexDirection: "column", width: w, children: [topLine(title, w, c), _jsx(Box, { borderStyle: "round", borderTop: false, borderColor: c, paddingX: 1, flexDirection: "column", children: children })] }));
};
// B – native border, title tight (no gap)
const B = ({ w, title, focused, children }) => {
    const c = focused ? 'cyan' : 'gray';
    return (_jsxs(Box, { flexDirection: "column", width: w, borderStyle: "round", borderColor: c, paddingX: 1, children: [_jsx(Text, { bold: true, color: c, children: title }), children] }));
};
// C – native border, title + blank line gap (original)
const C = ({ w, title, focused, children }) => {
    const c = focused ? 'cyan' : 'gray';
    return (_jsxs(Box, { flexDirection: "column", width: w, borderStyle: "round", borderColor: c, paddingX: 1, children: [_jsx(Text, { bold: true, color: c, children: title }), _jsx(Box, { marginTop: 1, flexDirection: "column", children: children })] }));
};
// D – native border, title + ─ divider
const D = ({ w, title, focused, children }) => {
    const c = focused ? 'cyan' : 'gray';
    const divider = '─'.repeat(w - 4); // inner = w - border(2) - padding(2)
    return (_jsxs(Box, { flexDirection: "column", width: w, borderStyle: "round", borderColor: c, paddingX: 1, children: [_jsx(Text, { bold: true, color: c, children: title }), _jsx(Text, { color: "gray", dimColor: true, children: divider }), children] }));
};
// E – no title, just border + content
const E = ({ w, focused, children }) => {
    const c = focused ? 'cyan' : 'gray';
    return (_jsx(Box, { flexDirection: "column", width: w, borderStyle: "round", borderColor: c, paddingX: 1, children: children }));
};
// ─── demo content ────────────────────────────────────────────────────────────
const NavItems = ({ color }) => (_jsx(_Fragment, { children: ITEMS.map(item => _jsx(Text, { color: item.startsWith('▶') ? color : 'gray', children: item }, item)) }));
const ListItems = ({ color }) => (_jsxs(_Fragment, { children: [_jsxs(Text, { dimColor: true, color: "gray", children: ['  Name'.padEnd(28), "Type"] }), ROWS.map((row, i) => (_jsxs(Text, { color: i === 0 ? color : 'gray', children: [i === 0 ? '>' : ' ', row] }, row)))] }));
const DESCS = {
    A: 'A  title inline with border',
    B: 'B  title inside, tight',
    C: 'C  title inside, with gap  ← current',
    D: 'D  title + ─ divider',
    E: 'E  no title',
};
const DemoRow = ({ id, focused }) => {
    const c = focused ? 'cyan' : 'gray';
    const nav = _jsx(NavItems, { color: c });
    const list = _jsx(ListItems, { color: c });
    const mkSidebar = (inner) => {
        const props = { w: NW, title: 'Sections', focused, children: inner };
        switch (id) {
            case 'A': return _jsx(A, { ...props });
            case 'B': return _jsx(B, { ...props });
            case 'C': return _jsx(C, { ...props });
            case 'D': return _jsx(D, { ...props });
            case 'E': return _jsx(E, { w: NW, focused: focused, children: inner });
        }
    };
    const mkMain = (inner) => {
        const props = { w: WW, title: 'Models', focused, children: inner };
        switch (id) {
            case 'A': return _jsx(A, { ...props });
            case 'B': return _jsx(B, { ...props });
            case 'C': return _jsx(C, { ...props });
            case 'D': return _jsx(D, { ...props });
            case 'E': return _jsx(E, { w: WW, focused: focused, children: inner });
        }
    };
    return (_jsxs(Box, { flexDirection: "column", marginBottom: 1, children: [_jsx(Text, { dimColor: true, children: DESCS[id] }), _jsxs(Box, { marginTop: 0, children: [_jsx(Box, { marginRight: 2, children: mkSidebar(nav) }), mkMain(list)] })] }));
};
// ─── app ─────────────────────────────────────────────────────────────────────
const App = () => {
    const { exit } = useApp();
    useInput(() => exit());
    return (_jsxs(Box, { flexDirection: "column", paddingX: 2, paddingY: 1, children: [_jsxs(Box, { marginBottom: 2, justifyContent: "space-between", children: [_jsx(Text, { bold: true, children: "Panel style options" }), _jsx(Text, { dimColor: true, children: "border/title: cyan=focused  gray=unfocused  \u00B7  any key to exit" })] }), ['A', 'B', 'C', 'D', 'E'].map(id => (_jsx(DemoRow, { id: id, focused: true }, id)))] }));
};
render(_jsx(App, {}));
