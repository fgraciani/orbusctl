import React from 'react';
import { Box, Text } from 'ink';
import type { Section, FocusedPanel } from '../types.js';
import { VERSION } from '../version.js';

const K: React.FC<{ children: string }> = ({ children }) => (
  <Text color="cyan">[{children}]</Text>
);

const Sep: React.FC = () => <Text color="gray"> </Text>;

interface FooterProps {
  focusedPanel: FocusedPanel;
  section: Section;
  showStats: boolean;
}

export const Footer: React.FC<FooterProps> = ({ focusedPanel, showStats }) => {
  return (
    <Box paddingX={1} justifyContent="space-between">
      <Text>
        <K>Tab</K><Text color="gray"> focus</Text>
        <Sep />
        <K>↑↓</K><Text color="gray"> nav</Text>
        <Sep />
        {focusedPanel === 'sidebar'
          ? <Text><K>→/↵</K><Text color="gray"> open</Text></Text>
          : <Text><K>Esc/←</K><Text color="gray"> back</Text><Sep /><K>↵</K><Text color="gray"> select</Text></Text>
        }
        <Sep />
        <K>s</K><Text color="gray"> stats</Text>
        <Sep />
        <K>a</K><Text color="gray"> auth</Text>
        <Sep />
        <K>?</K><Text color="gray"> help</Text>
        <Sep />
        <K>q</K><Text color="gray"> quit</Text>
      </Text>
      <Text color="gray" dimColor>v{VERSION}</Text>
    </Box>
  );
};
