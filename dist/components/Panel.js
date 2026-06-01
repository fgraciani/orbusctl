import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useRef, useEffect, useState } from 'react';
import { Box, Text, measureElement } from 'ink';
export const Panel = ({ title, focused = false, children, paddingX = 1, width, flexGrow, marginLeft, marginRight, marginTop, }) => {
    const ref = useRef(null);
    const [measuredWidth, setMeasuredWidth] = useState(0);
    const panelWidth = width ?? measuredWidth;
    const color = focused ? 'cyan' : 'gray';
    useEffect(() => {
        if (width !== undefined)
            return;
        if (ref.current) {
            const { width: w } = measureElement(ref.current);
            if (w !== measuredWidth)
                setMeasuredWidth(w);
        }
    });
    const fill = Math.max(0, panelWidth - title.length - 5);
    const top = `╭─ ${title} ${'─'.repeat(fill)}╮`;
    return (_jsxs(Box, { ref: ref, flexDirection: "column", width: width, flexGrow: flexGrow, marginLeft: marginLeft, marginRight: marginRight, marginTop: marginTop, children: [panelWidth > 0 && _jsx(Text, { color: color, children: top }), _jsx(Box, { borderStyle: "round", borderTop: false, borderColor: color, paddingX: paddingX, flexGrow: 1, flexDirection: "column", children: children })] }));
};
