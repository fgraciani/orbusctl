import React, { useState, useEffect } from 'react';
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

interface ConfirmModalProps {
  sessionStart: Date;
  tokensUsed: number;
  user?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({ sessionStart, tokensUsed, user, onConfirm, onCancel }) => {
  const { stdout } = useStdout();
  const [confirmed, setConfirmed] = useState(false);

  const w = Math.min(stdout.columns || 80, 72);
  const inner = w - 2;
  const tl = ` ORBUSCTL v${VERSION} `;
  const tr = ' Session Summary ';
  const titleFill = Math.max(0, inner - tl.length - tr.length - 2);
  const titleRaw = `╭─${tl}${'─'.repeat(titleFill)}${tr}─╮`;

  const summary = getSessionSummary();
  const duration = formatDuration(sessionStart);
  const userTotal = Object.values(summary.userByMethod).reduce((a, b) => a + b, 0);
  const tokenStr = tokensUsed > 1 ? `${tokensUsed} (${tokensUsed - 1} refresh${tokensUsed > 2 ? 'es' : ''})` : '1';
  const fmt = { day: '2-digit' as const, month: 'short' as const, year: 'numeric' as const, hour: '2-digit' as const, minute: '2-digit' as const };
  const startStr = sessionStart.toLocaleString('en-GB', fmt);
  const endStr = new Date().toLocaleString('en-GB', fmt);

  useInput((input, key) => {
    if (confirmed) return;
    if (input === 'y' || key.return) setConfirmed(true);
    if (key.escape || input === 'n') onCancel();
  });

  useEffect(() => {
    if (confirmed) onConfirm();
  }, [confirmed, onConfirm]);

  // Two-column layout matching exitSummary.ts
  const lw = 36;
  const apiCol = lw;

  const leftPad = (label: string, value: string) => `${label}${' '.repeat(Math.max(1, 14 - label.length))}${value}`;

  const DualRow: React.FC<{ label: string; value: string; rLabel: string; rValue: string; rDim?: boolean }> = ({ label, value, rLabel, rValue, rDim }) => (
    <Box>
      <Box width={lw}>
        <Text><Text color="gray">{label}</Text><Text color="white">{' '.repeat(Math.max(1, 14 - label.length))}{value}</Text></Text>
      </Box>
      <Box width={inner - lw - 2} justifyContent="space-between">
        <Text color="gray">{rLabel}</Text>
        <Text color={rDim ? 'gray' : 'white'}>{rValue}</Text>
      </Box>
    </Box>
  );

  const ApiRow: React.FC<{ label: string; value: string; color?: string; indent?: number }> = ({ label, value, color, indent = 0 }) => (
    <Box>
      <Box width={lw} />
      <Box width={inner - lw - 2} justifyContent="space-between">
        <Text color={color ?? 'gray'}>{' '.repeat(indent)}{label}</Text>
        <Text color={color ?? 'white'}>{value}</Text>
      </Box>
    </Box>
  );

  return (
    <Box flexDirection="column" width={w}>
      <Text color="gray">{titleRaw}</Text>
      <Box borderStyle="round" borderTop={false} borderColor="gray" paddingX={2} flexDirection="column">
        <Box marginTop={1} flexDirection="column">
          <DualRow label="Duration" value={duration} rLabel="Calls (total)" rValue={String(summary.total)} />
          <DualRow label="Start" value={startStr} rLabel="Startup" rValue={String(summary.startup)} rDim />
          <DualRow label="End" value={endStr} rLabel="Heartbeat" rValue={String(summary.heartbeat)} rDim />
          <DualRow label="Tokens" value={tokenStr} rLabel="User" rValue={String(userTotal)} />
          {Object.entries(summary.userByMethod).filter(([, n]) => n > 0).map(([m, n]) => (
            <ApiRow key={m} label={m} value={String(n)} color="#6cb886" indent={2} />
          ))}
        </Box>

        <Box marginTop={1} marginBottom={1}>
          <Text color="yellow">Exit ORBUSCTL? <Text dimColor>[y/↵] yes  [Esc/n] cancel</Text></Text>
        </Box>
      </Box>
    </Box>
  );
};
