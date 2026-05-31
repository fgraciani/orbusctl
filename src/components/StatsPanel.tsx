import React, { useState, useEffect } from 'react';
import { Box, Text } from 'ink';
import { Panel } from './Panel.js';
import type { AuthState, RoleInfo } from '../types.js';
import { formatTokenAge } from '../core/config.js';
import type { ChartBucket } from '../hooks/useApiChart.js';

const Stat: React.FC<{ label: string; value: string; valueColor?: string }> = ({
  label, value, valueColor = 'white',
}) => (
  <Box justifyContent="space-between">
    <Text color="gray">{label}</Text>
    <Text color={valueColor}>{value}</Text>
  </Box>
);

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <Box flexDirection="column" marginBottom={1}>
    <Text bold color="white">{title}</Text>
    <Box flexDirection="column" paddingLeft={1}>
      {children}
    </Box>
  </Box>
);

function formatDuration(start: Date): string {
  const secs = Math.floor((Date.now() - start.getTime()) / 1000);
  if (secs < 60) return `${secs}s`;
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  if (m < 60) return `${m}m ${s}s`;
  const h = Math.floor(m / 60);
  const rm = m % 60;
  if (h < 24) return `${h}h ${rm}m`;
  const d = Math.floor(h / 24);
  const rh = h % 24;
  return `${d}d ${rh}h ${rm}m`;
}

function licenseColor(license: string): string {
  switch (license) {
    case 'Admin': return '#e88a7a';
    case 'Author': return '#d4a053';
    case 'Viewer': return '#6cb886';
    default: return 'gray';
  }
}

// --- Per-method sparkline charts ---

const BLOCKS = ['▁', '▂', '▃', '▄', '▅', '▆', '▇', '█'];
const METHOD_COLOR: Record<string, string> = { GET: '#6cb886', POST: 'yellow', PATCH: 'cyan', DELETE: 'red' };
const DISPLAY_METHODS = ['GET', 'POST', 'PATCH', 'DELETE'];
const CHART_WIDTH = 22;

function sparkline(buckets: ChartBucket[], method: string, width: number): string {
  // Take the last `width` buckets (or pad with empties if fewer)
  const start = Math.max(0, buckets.length - width);
  const slice = buckets.slice(start);
  const values = slice.map(b => b[method as keyof ChartBucket] ?? 0);
  const max = Math.max(8, ...values); // scale 1:1 up to 8, then compress

  let line = '';
  // Leading blanks if not enough history
  for (let i = 0; i < width - values.length; i++) line += ' ';
  for (const v of values) {
    if (v === 0) { line += ' '; }
    else {
      const level = Math.max(1, Math.min(8, Math.ceil((v / max) * 8)));
      line += BLOCKS[level - 1];
    }
  }
  return line;
}

const UserMethodCharts: React.FC<{ userByMethod: Record<string, number>; buckets: ChartBucket[]; activeMethods: Set<string> }> = ({ userByMethod, buckets, activeMethods }) => (
  <Box flexDirection="column">
    {DISPLAY_METHODS.filter(m => (userByMethod[m] ?? 0) > 0 || activeMethods.has(m)).map(m => (
      <Box key={m} flexDirection="column">
        <Box justifyContent="space-between" paddingLeft={1}>
          <Text color={METHOD_COLOR[m] ?? 'gray'}>{m}</Text>
          <Text color={METHOD_COLOR[m] ?? 'white'}>{userByMethod[m] ?? 0}</Text>
        </Box>
        <Box justifyContent="flex-end">
          <Text color={METHOD_COLOR[m]}>{sparkline(buckets, m, CHART_WIDTH)}</Text>
        </Box>
      </Box>
    ))}
  </Box>
);

interface StatsPanelProps {
  auth: AuthState;
  sessionStart: Date;
  heartbeatLatency: number | null;
  apiTotal: number;
  apiStartup: number;
  apiHeartbeat: number;
  apiUserByMethod: Record<string, number>;
  chartBuckets: ChartBucket[];
  chartActiveMethods: Set<string>;
}

export const StatsPanel: React.FC<StatsPanelProps> = ({ auth, sessionStart, heartbeatLatency, apiTotal, apiStartup, apiHeartbeat, apiUserByMethod, chartBuckets, chartActiveMethods }) => {
  const [duration, setDuration] = useState(formatDuration(sessionStart));

  useEffect(() => {
    const t = setInterval(() => setDuration(formatDuration(sessionStart)), 1000);
    return () => clearInterval(t);
  }, [sessionStart]);

  return (
    <Panel title="Info" width={30} marginLeft={1} paddingX={1}>
      <Box flexDirection="column" marginTop={1}>
        <Section title="Session">
          <Stat label="Duration" value={duration} />
          {formatTokenAge() && <Stat label="Token age" value={formatTokenAge()!} valueColor="gray" />}
        </Section>

        <Section title="License">
          <Text>
            {auth.isAdmin && <Text color={licenseColor('Admin')}>Admin</Text>}
            {auth.isAdmin && auth.licenses?.length ? <Text color="gray"> | </Text> : null}
            {auth.licenses?.map((l, i) => (
              <Text key={l}>
                {i > 0 && <Text color="gray"> | </Text>}
                <Text color={licenseColor(l)}>{l}</Text>
              </Text>
            ))}
          </Text>
        </Section>

        {auth.roles && auth.roles.length > 0 && (
          <Section title={`Roles (${auth.roles.length})`}>
            {auth.roles.map(r => (
              <Text key={r.name} color={licenseColor(r.license)} wrap="truncate">{r.name}</Text>
            ))}
          </Section>
        )}

        <Section title="API">
          {heartbeatLatency !== null && (
            <Stat label="Latency" value={`${heartbeatLatency}ms`} />
          )}
          <Stat label="Calls (total)" value={String(apiTotal)} />
          <Stat label="Startup" value={String(apiStartup)} valueColor="gray" />
          <Stat label="Heartbeat" value={String(apiHeartbeat)} valueColor="gray" />
          <Stat label="User" value={String(Object.values(apiUserByMethod).reduce((a, b) => a + b, 0))} />
          <UserMethodCharts userByMethod={apiUserByMethod} buckets={chartBuckets} activeMethods={chartActiveMethods} />
        </Section>

      </Box>
    </Panel>
  );
};
