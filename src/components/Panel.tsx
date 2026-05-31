import React, { useRef, useEffect, useState } from 'react';
import { Box, Text, measureElement } from 'ink';
import type { DOMElement } from 'ink';

interface PanelProps {
  title: string;
  focused?: boolean;
  children: React.ReactNode;
  width?: number;
  flexGrow?: number;
  marginLeft?: number;
  marginRight?: number;
  marginTop?: number;
  paddingX?: number;
}

export const Panel: React.FC<PanelProps> = ({
  title,
  focused = false,
  children,
  paddingX = 1,
  width,
  flexGrow,
  marginLeft,
  marginRight,
  marginTop,
}) => {
  const ref = useRef<DOMElement>(null);
  const [measuredWidth, setMeasuredWidth] = useState(0);
  const panelWidth = width ?? measuredWidth;
  const color = focused ? 'cyan' : 'gray';

  useEffect(() => {
    if (width !== undefined) return;
    if (ref.current) {
      const { width: w } = measureElement(ref.current);
      if (w !== measuredWidth) setMeasuredWidth(w);
    }
  });

  const fill = Math.max(0, panelWidth - title.length - 5);
  const top = `╭─ ${title} ${'─'.repeat(fill)}╮`;

  return (
    <Box
      ref={ref}
      flexDirection="column"
      width={width}
      flexGrow={flexGrow}
      marginLeft={marginLeft}
      marginRight={marginRight}
      marginTop={marginTop}
    >
      {panelWidth > 0 && <Text color={color}>{top}</Text>}
      <Box
        borderStyle="round"
        borderTop={false}
        borderColor={color}
        paddingX={paddingX}
        flexGrow={1}
        flexDirection="column"
      >
        {children}
      </Box>
    </Box>
  );
};
