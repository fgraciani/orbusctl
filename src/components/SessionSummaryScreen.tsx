import React, { useEffect, useState } from 'react';
import { Box, Text, useInput, useStdout } from 'ink';
import { getSessionSummary } from '../core/api/counter.js';
import { VERSION } from '../version.js';

function formatDuration(start: Date): string {
  const secs = Math.floor((Date.now() - start.getTime()) / 1000);
  if (secs < 60) return `${secs}s`;
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  if (m < 60) return s > 0 ? `${m}m ${s}s` : `${m}m`;
  const h = Math.floor(m / 60);
  const rm = m % 60;
  return rm > 0 ? `${h}h ${rm}m` : `${h}h`;
}

interface SessionSummaryScreenProps {
  sessionStart: Date;
  tokensUsed: number;
  user?: string;
  onExit: () => void;
}

export const SessionSummaryScreen: React.FC<SessionSummaryScreenProps> = ({ sessionStart, tokensUsed, user, onExit }) => {
  const { stdout } = useStdout();
  const [countdown, setCountdown] = useState(5);
  const duration = formatDuration(sessionStart);
  const summary = getSessionSummary();
  const userTotal = Object.values(summary.userByMethod).reduce((a, b) => a + b, 0);

  const w = Math.min(stdout.columns || 80, 72);
  const inner = w - 2;
  const fill = Math.max(0, inner - 33);

  useEffect(() => {
    if (countdown <= 0) { onExit(); return; }
    const t = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown, onExit]);

  useInput(() => onExit());

  const tokenStr = tokensUsed > 1 ? `${tokensUsed} (${tokensUsed - 1} refresh${tokensUsed > 2 ? 'es' : ''})` : '1';
  const startStr = sessionStart.toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  const endStr = new Date().toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });

  return (
    <Box flexDirection="column" width={w}>
      <Text color="gray">╭─ <Text bold color="cyan">ORBUSCTL</Text> <Text color="gray">v{VERSION}</Text> <Text color="gray">{'─'.repeat(fill)}</Text> <Text color="white">Session Summary</Text> <Text color="gray">─╮</Text></Text>
      <Box borderStyle="round" borderTop={false} borderColor="gray" paddingX={2} flexDirection="column">
        <Box marginTop={1} flexDirection="column">
          <Text color="gray">Duration    <Text color="white">{duration}</Text></Text>
          <Text color="gray">Start       <Text color="white">{startStr}</Text></Text>
          <Text color="gray">End         <Text color="white">{endStr}</Text></Text>
          <Text color="gray">Tokens      <Text color="white">{tokenStr}</Text></Text>
        </Box>

        <Box marginTop={1} flexDirection="column">
          <Text color="gray">API calls   <Text color="white">{summary.total}</Text> total  ·  startup {summary.startup}  ·  heartbeat {summary.heartbeat}  ·  user <Text color="white">{userTotal}</Text></Text>
          {Object.entries(summary.userByMethod).filter(([, n]) => n > 0).map(([m, n]) => (
            <Text key={m} color="gray">            <Text color="green">{m}</Text>: {n}</Text>
          ))}
        </Box>

        <Box marginTop={1}>
          <Text color="green">Goodbye{user ? `, ${user}` : ''}!</Text>
        </Box>
        <Box marginBottom={1}>
          <Text dimColor>Exiting in {countdown}s  ·  any key to exit now</Text>
        </Box>
      </Box>
    </Box>
  );
};
