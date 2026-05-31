import React from 'react';
import { render, Box, Text, useInput, useApp } from 'ink';

// Widths that fit at 80-char terminal: paddingX(2)=4 + NW + margin(2) + WW = 80
// → NW=18, WW=56
const NW = 18;
const WW = 56;

const ITEMS = ['▶ Models', '  Compare', '  Audit', '  Activity'];
const ROWS  = ['  Enterprise Architecture', '  Business Process Mgmt', '  IT Landscape'];

// ─── border helpers ──────────────────────────────────────────────────────────

// Builds ╭─ Title ────╮ at a known width.
// Formula: 3(╭─ ) + title + 1( ) + fill + 1(╮) = W  →  fill = W - title.length - 5
const topLine = (title: string, w: number, color: string) => {
  const fill = Math.max(0, w - title.length - 5);
  return <Text color={color}>{`╭─ ${title} ${'─'.repeat(fill)}╮`}</Text>;
};
const bottomLine = (w: number, color: string) => (
  <Text color={color}>{`╰${'─'.repeat(w - 2)}╯`}</Text>
);

// ─── style components ────────────────────────────────────────────────────────

interface StyleProps {
  w: number;
  title: string;
  focused: boolean;
  children: React.ReactNode;
}

// A – title inline with border: custom top line + Ink-native sides/bottom via borderTop={false}
const A: React.FC<StyleProps> = ({ w, title, focused, children }) => {
  const c = focused ? 'cyan' : 'gray';
  return (
    <Box flexDirection="column" width={w}>
      {topLine(title, w, c)}
      <Box
        borderStyle="round"
        borderTop={false}
        borderColor={c}
        paddingX={1}
        flexDirection="column"
      >
        {children}
      </Box>
    </Box>
  );
};

// B – native border, title tight (no gap)
const B: React.FC<StyleProps> = ({ w, title, focused, children }) => {
  const c = focused ? 'cyan' : 'gray';
  return (
    <Box flexDirection="column" width={w} borderStyle="round" borderColor={c} paddingX={1}>
      <Text bold color={c}>{title}</Text>
      {children}
    </Box>
  );
};

// C – native border, title + blank line gap (original)
const C: React.FC<StyleProps> = ({ w, title, focused, children }) => {
  const c = focused ? 'cyan' : 'gray';
  return (
    <Box flexDirection="column" width={w} borderStyle="round" borderColor={c} paddingX={1}>
      <Text bold color={c}>{title}</Text>
      <Box marginTop={1} flexDirection="column">{children}</Box>
    </Box>
  );
};

// D – native border, title + ─ divider
const D: React.FC<StyleProps> = ({ w, title, focused, children }) => {
  const c = focused ? 'cyan' : 'gray';
  const divider = '─'.repeat(w - 4); // inner = w - border(2) - padding(2)
  return (
    <Box flexDirection="column" width={w} borderStyle="round" borderColor={c} paddingX={1}>
      <Text bold color={c}>{title}</Text>
      <Text color="gray" dimColor>{divider}</Text>
      {children}
    </Box>
  );
};

// E – no title, just border + content
const E: React.FC<Omit<StyleProps, 'title'>> = ({ w, focused, children }) => {
  const c = focused ? 'cyan' : 'gray';
  return (
    <Box flexDirection="column" width={w} borderStyle="round" borderColor={c} paddingX={1}>
      {children}
    </Box>
  );
};

// ─── demo content ────────────────────────────────────────────────────────────

const NavItems: React.FC<{ color: string }> = ({ color }) => (
  <>{ITEMS.map(item => <Text key={item} color={item.startsWith('▶') ? color : 'gray'}>{item}</Text>)}</>
);

const ListItems: React.FC<{ color: string }> = ({ color }) => (
  <>
    <Text dimColor color="gray">{'  Name'.padEnd(28)}Type</Text>
    {ROWS.map((row, i) => (
      <Text key={row} color={i === 0 ? color : 'gray'}>{i === 0 ? '>' : ' '}{row}</Text>
    ))}
  </>
);

// ─── demo rows ───────────────────────────────────────────────────────────────

type StyleId = 'A' | 'B' | 'C' | 'D' | 'E';
const DESCS: Record<StyleId, string> = {
  A: 'A  title inline with border',
  B: 'B  title inside, tight',
  C: 'C  title inside, with gap  ← current',
  D: 'D  title + ─ divider',
  E: 'E  no title',
};

const DemoRow: React.FC<{ id: StyleId; focused: boolean }> = ({ id, focused }) => {
  const c = focused ? 'cyan' : 'gray';
  const nav  = <NavItems  color={c} />;
  const list = <ListItems color={c} />;

  const mkSidebar = (inner: React.ReactNode) => {
    const props: StyleProps = { w: NW, title: 'Sections', focused, children: inner };
    switch (id) {
      case 'A': return <A {...props} />;
      case 'B': return <B {...props} />;
      case 'C': return <C {...props} />;
      case 'D': return <D {...props} />;
      case 'E': return <E w={NW} focused={focused}>{inner}</E>;
    }
  };

  const mkMain = (inner: React.ReactNode) => {
    const props: StyleProps = { w: WW, title: 'Models', focused, children: inner };
    switch (id) {
      case 'A': return <A {...props} />;
      case 'B': return <B {...props} />;
      case 'C': return <C {...props} />;
      case 'D': return <D {...props} />;
      case 'E': return <E w={WW} focused={focused}>{inner}</E>;
    }
  };

  return (
    <Box flexDirection="column" marginBottom={1}>
      <Text dimColor>{DESCS[id]}</Text>
      <Box marginTop={0}>
        <Box marginRight={2}>{mkSidebar(nav)}</Box>
        {mkMain(list)}
      </Box>
    </Box>
  );
};

// ─── app ─────────────────────────────────────────────────────────────────────

const App: React.FC = () => {
  const { exit } = useApp();
  useInput(() => exit());

  return (
    <Box flexDirection="column" paddingX={2} paddingY={1}>
      <Box marginBottom={2} justifyContent="space-between">
        <Text bold>Panel style options</Text>
        <Text dimColor>border/title: cyan=focused  gray=unfocused  ·  any key to exit</Text>
      </Box>
      {(['A', 'B', 'C', 'D', 'E'] as StyleId[]).map(id => (
        <DemoRow key={id} id={id} focused={true} />
      ))}
    </Box>
  );
};

render(<App />);
