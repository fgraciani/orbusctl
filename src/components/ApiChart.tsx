import React from 'react';
import { Box, Text } from 'ink';
import type { ChartBucket } from '../hooks/useApiChart.js';

const BLOCKS = ['▁', '▂', '▃', '▄', '▅', '▆', '▇', '█'];

const METHOD_COLOR: Record<string, string> = {
  GET: 'green',
  POST: 'yellow',
  PATCH: 'cyan',
  DELETE: 'red',
};

const METHOD_LABEL: Record<string, string> = {
  GET: 'GET',
  POST: 'PST',
  PATCH: 'PAT',
  DELETE: 'DEL',
};

interface ApiChartProps {
  buckets: ChartBucket[];
  activeMethods: Set<string>;
  width: number;
}

function renderLane(buckets: ChartBucket[], method: string, width: number): string {
  const values = buckets.map(b => b[method as keyof ChartBucket] ?? 0);
  const max = Math.max(1, ...values);

  let line = '';
  const start = Math.max(0, values.length - width);
  for (let i = start; i < start + width; i++) {
    const v = i < values.length ? values[i] : 0;
    if (v === 0) {
      line += ' ';
    } else {
      const level = Math.max(0, Math.min(7, Math.round((v / max) * 7)));
      line += BLOCKS[level];
    }
  }

  const padLen = width - line.length;
  if (padLen > 0) line = ' '.repeat(padLen) + line;

  return line;
}

export const ApiChart: React.FC<ApiChartProps> = ({ buckets, activeMethods, width }) => {
  if (activeMethods.size === 0) {
    return <Text color="gray" dimColor>Waiting for activity...</Text>;
  }

  const sparkWidth = Math.max(8, width - 4);
  const methods = ['GET', 'POST', 'PATCH', 'DELETE'].filter(m => activeMethods.has(m));

  return (
    <Box flexDirection="column">
      {methods.map(method => {
        const line = renderLane(buckets, method, sparkWidth);
        const color = METHOD_COLOR[method];
        const label = METHOD_LABEL[method];

        return (
          <Text key={method}>
            <Text color={color} dimColor>{label} </Text>
            <Text color={color}>{line}</Text>
          </Text>
        );
      })}
    </Box>
  );
};
