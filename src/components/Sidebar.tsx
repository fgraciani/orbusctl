import React from 'react';
import { Box, Text } from 'ink';
import { SECTIONS, SECTION_LABELS, SECTIONS_REQUIRING_AUTH } from '../types.js';
import { Panel } from './Panel.js';
import type { AuthState } from '../types.js';

interface SidebarProps {
  sectionIndex: number;
  focused: boolean;
  auth: AuthState;
}

export const Sidebar: React.FC<SidebarProps> = ({ sectionIndex, focused, auth }) => (
  <Panel title="Menu" focused={focused} width={18} marginRight={1} paddingX={1}>
    <Box flexDirection="column" marginTop={1}>
      {SECTIONS.map((section, index) => {
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

        return (
          <Box key={section} paddingX={1}>
            <Text color={color} bold={isSelected && !isLocked} dimColor={isLocked}>
              {prefix}{SECTION_LABELS[section]}
            </Text>
          </Box>
        );
      })}
    </Box>
  </Panel>
);
