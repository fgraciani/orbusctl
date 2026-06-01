import { jsxs as _jsxs, jsx as _jsx } from "react/jsx-runtime";
import { Box, Text } from 'ink';
import { SECTIONS, SECTION_LABELS, SECTIONS_REQUIRING_AUTH } from '../types.js';
import { Panel } from './Panel.js';
export const Sidebar = ({ sectionIndex, focused, auth }) => (_jsx(Panel, { title: "Menu", focused: focused, width: 18, marginRight: 1, paddingX: 1, children: _jsx(Box, { flexDirection: "column", marginTop: 1, children: SECTIONS.map((section, index) => {
            const isSelected = index === sectionIndex;
            const isLocked = SECTIONS_REQUIRING_AUTH.includes(section) && auth.status !== 'authenticated';
            const color = isLocked
                ? 'gray'
                : isSelected
                    ? (focused ? 'cyan' : 'white')
                    : 'gray';
            const prefix = isSelected
                ? (isLocked ? '⊘ ' : '▶ ')
                : '  ';
            return (_jsx(Box, { paddingX: 1, children: _jsxs(Text, { color: color, bold: isSelected && !isLocked, dimColor: isLocked, children: [prefix, SECTION_LABELS[section]] }) }, section));
        }) }) }));
