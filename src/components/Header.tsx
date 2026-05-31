import React, { useState, useEffect } from 'react';
import { Box, Text } from 'ink';
import type { AuthState } from '../types.js';
import type { HeartbeatStatus } from '../hooks/useHeartbeat.js';
import { getOrgName } from '../core/config.js';

const PULSE_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
const PULSE_INTERVAL = 80;

const STATUS_DISPLAY: Record<HeartbeatStatus, { symbol: string; color: string; label?: string }> = {
  connected:    { symbol: '●', color: 'green' },
  unauthorized: { symbol: '✕', color: 'red',    label: 'unauthorized' },
  timeout:      { symbol: '~', color: 'yellow', label: 'timeout' },
  offline:      { symbol: '✕', color: 'red',    label: 'offline' },
  idle:         { symbol: '○', color: 'gray' },
};

interface HeaderProps {
  auth: AuthState;
  heartbeatStatus: HeartbeatStatus;
  heartbeatLastCheck: Date | null;
}

export const Header: React.FC<HeaderProps> = ({ auth, heartbeatStatus, heartbeatLastCheck }) => {
  const [pulseFrame, setPulseFrame] = useState(-1);

  useEffect(() => {
    if (!heartbeatLastCheck) return;
    setPulseFrame(0);
  }, [heartbeatLastCheck]);

  useEffect(() => {
    if (pulseFrame < 0 || pulseFrame >= PULSE_FRAMES.length) return;
    const t = setTimeout(() => setPulseFrame(f => f + 1), PULSE_INTERVAL);
    return () => clearTimeout(t);
  }, [pulseFrame]);

  const hb = STATUS_DISPLAY[heartbeatStatus];
  const isPulsing = pulseFrame >= 0 && pulseFrame < PULSE_FRAMES.length;
  const dot = heartbeatStatus === 'connected' && isPulsing ? PULSE_FRAMES[pulseFrame] : hb.symbol;

  const badge = auth.status === 'authenticated'
    ? <Text><Text color={hb.color}>{dot}</Text> <Text color="green">{auth.user}</Text>{hb.label ? <Text color={hb.color}> {hb.label}</Text> : null}</Text>
    : <Text color="red" dimColor>○ no auth</Text>;

  return (
    <Box flexDirection="column" width="100%" marginBottom={1}>
      <Box paddingX={1} justifyContent="space-between">
        <Box>
          <Text bold color="cyan">ORBUSCTL</Text>
          <Text color="gray"> · {getOrgName()}</Text>
        </Box>
        {badge}
      </Box>
    </Box>
  );
};
