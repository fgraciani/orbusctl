import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Box, Text } from 'ink';
const BLOCKS = ['▁', '▂', '▃', '▄', '▅', '▆', '▇', '█'];
const METHOD_COLOR = {
    GET: 'green',
    POST: 'yellow',
    PATCH: 'cyan',
    DELETE: 'red',
};
const METHOD_LABEL = {
    GET: 'GET',
    POST: 'PST',
    PATCH: 'PAT',
    DELETE: 'DEL',
};
function renderLane(buckets, method, width) {
    const values = buckets.map(b => b[method] ?? 0);
    const max = Math.max(1, ...values);
    let line = '';
    const start = Math.max(0, values.length - width);
    for (let i = start; i < start + width; i++) {
        const v = i < values.length ? values[i] : 0;
        if (v === 0) {
            line += ' ';
        }
        else {
            const level = Math.max(0, Math.min(7, Math.round((v / max) * 7)));
            line += BLOCKS[level];
        }
    }
    const padLen = width - line.length;
    if (padLen > 0)
        line = ' '.repeat(padLen) + line;
    return line;
}
export const ApiChart = ({ buckets, activeMethods, width }) => {
    if (activeMethods.size === 0) {
        return _jsx(Text, { color: "gray", dimColor: true, children: "Waiting for activity..." });
    }
    const sparkWidth = Math.max(8, width - 4);
    const methods = ['GET', 'POST', 'PATCH', 'DELETE'].filter(m => activeMethods.has(m));
    return (_jsx(Box, { flexDirection: "column", children: methods.map(method => {
            const line = renderLane(buckets, method, sparkWidth);
            const color = METHOD_COLOR[method];
            const label = METHOD_LABEL[method];
            return (_jsxs(Text, { children: [_jsxs(Text, { color: color, dimColor: true, children: [label, " "] }), _jsx(Text, { color: color, children: line })] }, method));
        }) }));
};
