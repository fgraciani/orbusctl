import React, { useMemo } from 'react';
import { Box, Text } from 'ink';
import type { Section, AuthState, ModelsView } from '../types.js';
import { SECTIONS_REQUIRING_AUTH } from '../types.js';
import { Panel } from './Panel.js';
import type { Model, ModelCounts } from '../core/api/models.js';
import type { OrbusObject, ObjectDetail, RelatedObject } from '../core/api/objects.js';
import type { Drawing, ResolvedComponent } from '../core/api/drawings.js';
import type { Solution } from '../core/api/models.js';
import { getServer, getSolutionFilter, getShowHiddenModels, getToken, getWritePasswordHash, getWritePasswordSetAt, isWritePasswordExpired, getBrowser } from '../core/config.js';
import { getRecentWriteLog, type WriteLogEntry } from '../core/log.js';
import type { CompareRow } from '../hooks/useCompare.js';
import type { UseAuditExportResult } from '../hooks/useAuditExport.js';
import type { UseActivityExportResult } from '../hooks/useActivityExport.js';
import type { UseTemplateExportResult } from '../hooks/useTemplateExport.js';
import type { AuditSummary, AuditProgress, AuditIssue } from '../core/domain/audit.js';
import { buildTree, flattenTree } from '../core/domain/tree.js';
import { getTypeInkColor } from '../core/domain/colors.js';
import { TIME_PERIOD_LABELS, type TimePeriod, type ModelActivity, type ScanProgress } from '../core/domain/activity.js';

// --- Virtual scroll helper ---

// Rows consumed by chrome: header(2) + footer(1) + panel borders(2) + col header(1) + guidance(1) + scroll indicators(2)
const CHROME_ROWS = 9;
const INDICATOR_RESERVE = 2;

function computeScroll(totalItems: number, selectedIndex: number, maxVisible: number) {
  let scrollStart = 0;
  if (totalItems > maxVisible) {
    scrollStart = Math.max(0, Math.min(selectedIndex - 2, totalItems - maxVisible));
    if (selectedIndex < scrollStart + 2) scrollStart = Math.max(0, selectedIndex - 2);
  }
  const scrollEnd = Math.min(totalItems, scrollStart + maxVisible);
  return { scrollStart, scrollEnd, hasMoreAbove: scrollStart > 0, hasMoreBelow: scrollEnd < totalItems };
}

const ScrollUp: React.FC<{ count: number }> = ({ count }) => (
  <Box paddingLeft={2}><Text color="gray" dimColor>▲ {count} more above</Text></Box>
);
const ScrollDown: React.FC<{ count: number; total: number }> = ({ count, total }) => (
  <Box paddingLeft={2}><Text color="gray" dimColor>▼ {count} more below</Text></Box>
);

// --- Shared helpers ---

const CW = 8;
const pad = (n: number) => String(n).padStart(CW - 1);

function formatTimeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(ms / 60_000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

// ═══════════════════════════════════════════════════════════════
// MODELS SECTION (three levels: list → objects → detail)
// ═══════════════════════════════════════════════════════════════

// Compute fixed name column width to avoid Ink flexGrow overflow artifacts
// sidebar(18) + sidebarMargin(1) + cursor(2) + counts(3*CW) + panelBorders(2) + panelPadding(4) + statsPanel(0 or 25)
function nameWidth(termCols: number, showStats: boolean): number {
  return Math.max(20, termCols - 18 - 1 - 2 - 3 * CW - 2 - 4 - (showStats ? 31 : 0));
}

interface ModelListProps {
  selectedIndex: number; focused: boolean; termRows: number; termCols: number; showStats: boolean;
  modelFlat: ReturnType<typeof flattenTree>; counts: Map<string, ModelCounts>; loading: boolean; error: string | null;
  highlightModelId?: string | null;
}

const ModelList: React.FC<ModelListProps> = ({ selectedIndex, focused, termRows, termCols, showStats, modelFlat, counts, loading, error, highlightModelId }) => {
  if (loading && modelFlat.length === 0) return <Box marginTop={1} paddingLeft={2}><Text color="cyan">Loading models...</Text></Box>;
  if (error) return <Box marginTop={1} paddingLeft={2}><Text color="red">{error}</Text></Box>;
  if (modelFlat.length === 0) return <Box marginTop={1} paddingLeft={2}><Text color="gray">No models found</Text></Box>;

  const nw = nameWidth(termCols, showStats);
  const maxVisible = Math.max(5, termRows - CHROME_ROWS - INDICATOR_RESERVE);
  const { scrollStart, scrollEnd, hasMoreAbove, hasMoreBelow } = computeScroll(modelFlat.length, selectedIndex, maxVisible);
  const visible = modelFlat.slice(scrollStart, scrollEnd);

  return (
    <Box flexDirection="column" marginTop={1}>
      <Box paddingLeft={2}>
        <Box width={nw}><Text color="gray" dimColor>Name</Text></Box>
        <Box width={CW}><Text color="gray" dimColor>{'Objects'.padStart(CW - 1)}</Text></Box>
        <Box width={CW}><Text color="gray" dimColor>{'Rels'.padStart(CW - 1)}</Text></Box>
        <Box width={CW}><Text color="gray" dimColor>{'Draws'.padStart(CW - 1)}</Text></Box>
      </Box>
      {hasMoreAbove && <ScrollUp count={scrollStart} />}
      {visible.map((entry, vi) => {
        const i = scrollStart + vi;
        const c = counts.get(entry.model.ModelId);
        const selected = i === selectedIndex;
        const isHighlighted = highlightModelId === entry.model.ModelId;
        const indent = '  '.repeat(entry.depth);
        const name = `${indent}${entry.model.Name}`.slice(0, nw).padEnd(nw);
        return (
          <Box key={entry.model.ModelId}>
            <Box width={2}><Text color={selected && focused ? 'cyan' : isHighlighted ? 'yellow' : 'gray'}>{selected ? '▶' : isHighlighted ? '●' : ' '}</Text></Box>
            <Box width={nw}><Text color={selected && focused ? 'cyan' : isHighlighted ? 'yellow' : (entry.model.IsHidden ? 'gray' : undefined)} dimColor={entry.model.IsHidden}>{name}</Text></Box>
            <Box width={CW}><Text color={selected && focused ? 'white' : 'gray'}>{c ? pad(c.objects) : '     …'}</Text></Box>
            <Box width={CW}><Text color={selected && focused ? 'white' : 'gray'}>{c ? pad(c.relationships) : '     …'}</Text></Box>
            <Box width={CW}><Text color={selected && focused ? 'white' : 'gray'}>{c ? pad(c.drawings) : '     …'}</Text></Box>
          </Box>
        );
      })}
      {hasMoreBelow && <ScrollDown count={modelFlat.length - scrollEnd} total={modelFlat.length} />}
      <Box paddingLeft={2} marginTop={1}><Text color="gray" dimColor>{loading ? 'Loading counts...' : '[↵] browse objects  ·  [↑↓] navigate'}</Text></Box>
    </Box>
  );
};

// --- Object list (compact, for use inside a Panel) ---

const SYSTEM_ATTRS = new Set([
  'Name', 'Description', 'Type',
  'Created By', 'Date Created', 'Last Modified By', 'Date Last Modified',
  'Metamodel Item Id', 'Metamodel Item Name', 'iServer365 Id',
]);

interface ObjectListCompactProps {
  selectedIndex: number; focused: boolean; termRows: number; termCols: number; showStats: boolean;
  objects: OrbusObject[]; loading: boolean; error: string | null;
  viewedObjectId: string | null; hasDetail: boolean;
}

const ObjectListCompact: React.FC<ObjectListCompactProps> = ({
  selectedIndex, focused, termRows, termCols, showStats, objects, loading, error, viewedObjectId, hasDetail,
}) => {
  if (loading && objects.length === 0) return <Box marginTop={1} paddingLeft={2}><Text color="cyan">Loading objects...</Text></Box>;
  if (error) return <Box marginTop={1} paddingLeft={2}><Text color="red">{error}</Text></Box>;
  if (objects.length === 0) return <Box marginTop={1} paddingLeft={2}><Text color="gray">No objects in this model</Text></Box>;

  const listMaxVisible = hasDetail
    ? Math.max(4, Math.floor((termRows - CHROME_ROWS - INDICATOR_RESERVE) * 0.35))
    : Math.max(5, termRows - CHROME_ROWS - INDICATOR_RESERVE);
  const { scrollStart, scrollEnd, hasMoreAbove, hasMoreBelow: moreBelow } = computeScroll(objects.length, selectedIndex, listMaxVisible);
  const visible = objects.slice(scrollStart, scrollEnd);

  // Fixed width for name column: total - cursor(2) - type(22) - modified(10) - sidebar(18) - margins/borders/padding
  const objNameW = Math.max(20, termCols - 18 - 1 - 2 - 22 - 10 - 2 - 4 - (showStats ? 31 : 0));

  return (
    <Box flexDirection="column" marginTop={1}>
      <Box paddingLeft={2}>
        <Box width={objNameW}><Text color="gray" dimColor>Name</Text></Box>
        <Box width={22}><Text color="gray" dimColor>Type</Text></Box>
        <Box width={10}><Text color="gray" dimColor>Modified</Text></Box>
      </Box>
      {hasMoreAbove && <ScrollUp count={scrollStart} />}
      {visible.map((obj, vi) => {
        const i = scrollStart + vi;
        const selected = i === selectedIndex;
        const isViewed = obj.ObjectId === viewedObjectId;
        const typeColor = getTypeInkColor(obj.ObjectType.Name);
        const objName = obj.Name.slice(0, objNameW).padEnd(objNameW);
        const typeName = obj.ObjectType.Name.slice(0, 21).padEnd(21);
        return (
          <Box key={obj.ObjectId}>
            <Box width={2}><Text color={selected && focused ? 'cyan' : isViewed ? 'yellow' : 'gray'}>{selected ? '▶' : isViewed ? '●' : ' '}</Text></Box>
            <Box width={objNameW}><Text color={selected && focused ? 'cyan' : undefined} bold={isViewed}>{objName}</Text></Box>
            <Box width={22}><Text color={typeColor}>{typeName}</Text></Box>
            <Box width={10}><Text color="gray">{formatTimeAgo(obj.LastModifiedDate).padEnd(9)}</Text></Box>
          </Box>
        );
      })}
      {moreBelow && <ScrollDown count={objects.length - scrollEnd} total={objects.length} />}
      {!hasDetail && <Box paddingLeft={2} marginTop={1}><Text color="gray" dimColor>[↵] view detail  ·  [←/Esc] back  ·  [↑↓] navigate</Text></Box>}
    </Box>
  );
};

// --- Object detail pane (inside its own Panel) ---

interface ObjectDetailPaneProps {
  detail: ObjectDetail; relationships: RelatedObject[];
  termRows: number; detailFocused: boolean; relIndex: number;
}

const ObjectDetailPane: React.FC<ObjectDetailPaneProps> = ({ detail, relationships, termRows, detailFocused, relIndex }) => {
  const desc = detail.AttributeValues.find(a => a.AttributeName === 'Description')?.StringValue;
  const customAttrs = detail.AttributeValues.filter(a => !SYSTEM_ATTRS.has(a.AttributeName) && a.StringValue);
  const typeColor = getTypeInkColor(detail.ObjectType.Name);

  return (
    <Box flexDirection="column" paddingLeft={1} marginTop={1}>
      <Box>
        <Text color={typeColor}>{detail.ObjectType.Name}</Text>
        <Text color="gray">  ·  v{detail.Detail.CurrentVersionNumber}  ·  {detail.Detail.Status}</Text>
      </Box>

      {desc && <Text>{desc}</Text>}

      <Box marginTop={1}>
        <Text color="gray">
          Created {formatTimeAgo(detail.DateCreated)} by {detail.CreatedBy.Name}  ·  Modified {formatTimeAgo(detail.LastModifiedDate)} by {detail.LastModifiedBy.Name}
          {detail.LockedBy ? `  ·  LOCKED by ${detail.LockedBy.Name}` : ''}
        </Text>
      </Box>

      {customAttrs.length > 0 && (
        <Box flexDirection="column" marginTop={1}>
          <Text bold color="yellow">Attributes ({customAttrs.length})</Text>
          {customAttrs.map(a => (
            <Text key={a.AttributeName} color="gray" wrap="truncate">  {a.AttributeName}: {a.StringValue}</Text>
          ))}
        </Box>
      )}

      <Box marginTop={1}><Text color="gray" dimColor>[o] open in Orbus</Text></Box>

      {relationships.length > 0 && (
        <Box flexDirection="column" marginTop={1}>
          <Text bold color="yellow">Relationships ({relationships.length}){detailFocused ? '' : '  [↵] to navigate'}</Text>
          {relationships.map((r, i) => {
            const selected = detailFocused && i === relIndex;
            return (
              <Box key={i}>
                <Text color={selected ? 'cyan' : 'gray'}>{selected ? '▶ ' : '  '}{r.DirectionDescription} </Text>
                <Text color={selected ? 'cyan' : undefined} wrap="truncate">{r.RelatedItem.Name}</Text>
                <Text color="gray" dimColor> ({r.Relationship.RelationshipType.Name.replace('ArchiMate: ', '')})</Text>
              </Box>
            );
          })}
        </Box>
      )}
    </Box>
  );
};

// ═══════════════════════════════════════════════════════════════
// DRAWINGS SECTION
// ═══════════════════════════════════════════════════════════════

interface DrawingsListProps {
  selectedIndex: number; focused: boolean; termRows: number;
  modelName: string; drawings: Drawing[]; typeMap: Map<string, string>;
  loading: boolean; error: string | null;
}

const DrawingsList: React.FC<DrawingsListProps> = ({ selectedIndex, focused, termRows, modelName, drawings, typeMap, loading, error }) => {
  if (loading) return <Box marginTop={1} paddingLeft={2}><Text color="cyan">Loading drawings in {modelName}...</Text></Box>;
  if (error) return <Box marginTop={1} paddingLeft={2}><Text color="red">{error}</Text></Box>;
  if (drawings.length === 0) return <Box marginTop={1} paddingLeft={2}><Text color="gray">No drawings in this model</Text></Box>;

  const maxDrawingsVisible = Math.max(5, termRows - CHROME_ROWS - INDICATOR_RESERVE);
  const { scrollStart, scrollEnd, hasMoreAbove, hasMoreBelow } = computeScroll(drawings.length, selectedIndex, maxDrawingsVisible);
  const visible = drawings.slice(scrollStart, scrollEnd);

  return (
    <Box flexDirection="column" marginTop={1}>
      <Box paddingLeft={2}>
        <Box flexGrow={1}><Text color="gray" dimColor>Name</Text></Box>
        <Box width={28}><Text color="gray" dimColor>Type</Text></Box>
      </Box>
      {hasMoreAbove && <ScrollUp count={scrollStart} />}
      {visible.map((d, vi) => {
        const i = scrollStart + vi;
        const selected = i === selectedIndex;
        return (
          <Box key={d.DocumentId}>
            <Box width={2}><Text color={selected && focused ? 'cyan' : 'gray'}>{selected ? '▶' : ' '}</Text></Box>
            <Box flexGrow={1}><Text color={selected && focused ? 'cyan' : undefined} wrap="truncate">{d.FileName}</Text></Box>
            <Box width={28}><Text color="gray" wrap="truncate">{typeMap.get(d.DocumentTypeId) ?? 'Unknown'}</Text></Box>
          </Box>
        );
      })}
      {hasMoreBelow && <ScrollDown count={drawings.length - scrollEnd} total={drawings.length} />}
      <Box paddingLeft={2} marginTop={1}><Text color="gray" dimColor>[↵] view components  ·  [←/Esc] back  ·  [↑↓] navigate</Text></Box>
    </Box>
  );
};

// --- Drawing component detail ---

interface DrawingComponentListProps {
  selectedIndex: number; focused: boolean; termRows: number;
  components: ResolvedComponent[]; loading: boolean; error: string | null;
  hasDetail?: boolean; viewedDrawingObjectId?: string | null;
}

const DrawingComponentList: React.FC<DrawingComponentListProps> = ({ selectedIndex, focused, termRows, components, loading, error, hasDetail, viewedDrawingObjectId }) => {
  if (loading) return <Box marginTop={1} paddingLeft={2}><Text color="cyan">Loading components...</Text></Box>;
  if (error) return <Box marginTop={1} paddingLeft={2}><Text color="red">{error}</Text></Box>;
  if (components.length === 0) return <Box marginTop={1} paddingLeft={2}><Text color="gray">No components in this drawing</Text></Box>;

  const maxVisible = hasDetail
    ? Math.max(4, Math.floor((termRows - CHROME_ROWS - INDICATOR_RESERVE) * 0.35))
    : Math.max(5, termRows - CHROME_ROWS - INDICATOR_RESERVE);
  const { scrollStart, scrollEnd, hasMoreAbove, hasMoreBelow } = computeScroll(components.length, selectedIndex, maxVisible);
  const visible = components.slice(scrollStart, scrollEnd);

  const objects = components.filter(c => !c.isRelationship);
  const rels = components.filter(c => c.isRelationship);

  return (
    <Box flexDirection="column" marginTop={1}>
      <Box paddingLeft={2}>
        <Text color="gray" dimColor>{objects.length} objects, {rels.length} relationships</Text>
      </Box>
      {hasMoreAbove && <ScrollUp count={scrollStart} />}
      {visible.map((c, vi) => {
        const i = scrollStart + vi;
        const selected = i === selectedIndex;
        const isViewed = !c.isRelationship && viewedDrawingObjectId !== null && c.objectId === viewedDrawingObjectId;
        const typeColor = c.isRelationship ? 'gray' : getTypeInkColor(c.typeName);
        return (
          <Box key={i}>
            <Box width={2}><Text color={selected && focused ? 'cyan' : isViewed ? 'yellow' : 'gray'}>{selected ? '▶' : isViewed ? '●' : ' '}</Text></Box>
            <Box width={3}><Text color={c.isRelationship ? 'gray' : typeColor} dimColor={c.isRelationship}>{c.isRelationship ? ' ↔' : '  '}</Text></Box>
            <Box flexGrow={1}><Text color={selected && focused ? 'cyan' : c.isRelationship ? 'gray' : undefined} bold={isViewed} wrap="truncate">{c.name}</Text></Box>
            <Box width={22}><Text color={typeColor} dimColor={c.isRelationship} wrap="truncate">{c.typeName}</Text></Box>
          </Box>
        );
      })}
      {hasMoreBelow && <ScrollDown count={components.length - scrollEnd} total={components.length} />}
      {!hasDetail && <Box paddingLeft={2} marginTop={1}><Text color="gray" dimColor>[↵] view detail  ·  [o] open in Draw  ·  [←/Esc] back to drawings  ·  [↑↓] navigate</Text></Box>}
    </Box>
  );
};

// ═══════════════════════════════════════════════════════════════
// PLACEHOLDER SECTIONS (wired in later iterations)
// ═══════════════════════════════════════════════════════════════

// --- Audit section ---

const ISSUE_LABELS: Record<string, string> = {
  'empty-description': 'Empty description',
  'html-in-name': 'HTML in name',
  'html-in-description': 'HTML in description',
  'no-relationships': 'No relationships',
  'not-in-diagram': 'Not in any diagram',
};

const ISSUE_COLORS: Record<string, string> = {
  'empty-description': 'yellow',
  'html-in-name': 'red',
  'html-in-description': 'red',
  'no-relationships': 'yellow',
  'not-in-diagram': 'yellow',
};

interface AuditSectionProps {
  selectedIndex: number; focused: boolean; termRows: number; termCols: number; showStats: boolean;
  audit: MainContentProps['audit'];
  auditExport: UseAuditExportResult;
  issueFilter: string | null;
  mode: string;
  selectedModelIds: Set<string>;
  modelFlat: ReturnType<typeof flattenTree>;
  modelCounts: Map<string, import('../core/api/models.js').ModelCounts>;
  modelsLoading: boolean; modelsError: string | null;
  hasDetail: boolean;
  viewedAuditObjectId: string | null;
}

const AuditSection: React.FC<AuditSectionProps> = ({ selectedIndex, focused, termRows, termCols, showStats, audit, auditExport, issueFilter, mode, selectedModelIds, modelFlat, modelCounts, modelsLoading, modelsError, hasDetail, viewedAuditObjectId }) => {
  // Export overlay
  if (auditExport.exporting) {
    const p = auditExport.progress;
    return (
      <Box flexDirection="column" marginTop={1} paddingLeft={2}>
        <Text color="cyan">Exporting audit results...</Text>
        {p && <Text color="gray">{p.phase}{p.current && p.total ? ` (${p.current}/${p.total})` : ''}</Text>}
      </Box>
    );
  }
  if (auditExport.result) {
    const r = auditExport.result;
    return (
      <Box flexDirection="column" marginTop={1} paddingLeft={2}>
        <Text color="green">Export complete!</Text>
        <Box marginTop={1} flexDirection="column">
          <Text color="gray">Models:  <Text color="white">{r.modelCount}</Text></Text>
          <Text color="gray">Issues:  <Text color="white">{r.issueCount}</Text></Text>
        </Box>
        <Box marginTop={1}><Text color="gray">Saved to: <Text color="white">{r.filePath}</Text></Text></Box>
        <Box marginTop={1}><Text color="gray" dimColor>[o] open  ·  [←/Esc] back</Text></Box>
      </Box>
    );
  }
  if (auditExport.error) {
    return (
      <Box flexDirection="column" marginTop={1} paddingLeft={2}>
        <Text color="red">{auditExport.error}</Text>
        <Box marginTop={1}><Text color="gray" dimColor>[←/Esc] back</Text></Box>
      </Box>
    );
  }

  // Menu: choose single or all
  if (mode === 'menu') {
    const options = ['Audit single model', 'Audit all models', 'Audit selected models'];
    return (
      <Box flexDirection="column" marginTop={1}>
        {options.map((o, i) => {
          const selected = i === selectedIndex;
          return (
            <Box key={i}>
              <Box width={2}><Text color={selected && focused ? 'cyan' : 'gray'}>{selected ? '▶' : ' '}</Text></Box>
              <Text color={selected && focused ? 'cyan' : undefined}>{o}</Text>
            </Box>
          );
        })}
        <Box paddingLeft={2} marginTop={1}><Text color="gray" dimColor>[↵] select  ·  [↑↓] navigate</Text></Box>
      </Box>
    );
  }

  // Multi-select model list
  if (mode === 'select-models') {
    if (modelsLoading && modelFlat.length === 0) return <Box marginTop={1} paddingLeft={2}><Text color="cyan">Loading models...</Text></Box>;
    if (modelsError) return <Box marginTop={1} paddingLeft={2}><Text color="red">{modelsError}</Text></Box>;
    if (modelFlat.length === 0) return <Box marginTop={1} paddingLeft={2}><Text color="gray">No models found</Text></Box>;

    const nw = nameWidth(termCols, showStats);
    const extraRows = 3; // status + col header + guidance
    const maxVisible = Math.max(5, termRows - CHROME_ROWS - INDICATOR_RESERVE - extraRows);
    const { scrollStart, scrollEnd, hasMoreAbove, hasMoreBelow } = computeScroll(modelFlat.length, selectedIndex, maxVisible);
    const visible = modelFlat.slice(scrollStart, scrollEnd);

    const selCount = selectedModelIds.size;
    const statusText = selCount === 0 ? 'Select at least one model' : `${selCount} model${selCount !== 1 ? 's' : ''} selected`;

    return (
      <Box flexDirection="column" marginTop={1}>
        <Box paddingLeft={2} marginBottom={1}>
          <Text color={selCount === 0 ? 'yellow' : 'green'}>{statusText}</Text>
        </Box>
        <Box paddingLeft={2}>
          <Box width={nw}><Text color="gray" dimColor>Name</Text></Box>
          <Box width={8}><Text color="gray" dimColor>{'Objects'.padStart(7)}</Text></Box>
          <Box width={8}><Text color="gray" dimColor>{'Rels'.padStart(7)}</Text></Box>
          <Box width={8}><Text color="gray" dimColor>{'Draws'.padStart(7)}</Text></Box>
        </Box>
        {hasMoreAbove && <ScrollUp count={scrollStart} />}
        {visible.map((entry, vi) => {
          const i = scrollStart + vi;
          const selected = i === selectedIndex;
          const modelId = entry.model.ModelId;
          const toggled = selectedModelIds.has(modelId);
          const counts = modelCounts.get(modelId);
          const indent = '  '.repeat(entry.depth);
          const nameText = indent + entry.model.Name;
          const cursor = selected && focused ? '▶' : ' ';
          const toggle = toggled ? '●' : ' ';
          return (
            <Box key={entry.model.ModelId} paddingLeft={2}>
              <Box width={2}><Text color={selected && focused ? 'cyan' : 'gray'}>{cursor}</Text></Box>
              <Box width={2}><Text color={toggled ? 'green' : 'gray'}>{toggle}</Text></Box>
              <Box width={nw - 2}><Text color={toggled ? 'white' : undefined} bold={toggled} wrap="truncate">{nameText}</Text></Box>
              <Box width={8}><Text color={toggled ? 'white' : undefined} bold={toggled}>{pad(counts?.objects ?? 0)}</Text></Box>
              <Box width={8}><Text color={toggled ? 'white' : undefined} bold={toggled}>{pad(counts?.relationships ?? 0)}</Text></Box>
              <Box width={8}><Text color={toggled ? 'white' : undefined} bold={toggled}>{pad(counts?.drawings ?? 0)}</Text></Box>
            </Box>
          );
        })}
        {hasMoreBelow && <ScrollDown count={modelFlat.length - scrollEnd} total={modelFlat.length} />}
        <Box paddingLeft={2} marginTop={1}>
          <Text color="gray" dimColor>[Space] toggle  ·  [Enter] start audit  ·  [Esc] back</Text>
        </Box>
      </Box>
    );
  }

  // Scanning single
  if (audit.auditing) {
    const p = audit.progress;
    return (
      <Box flexDirection="column" marginTop={1} paddingLeft={2}>
        <Text color="cyan">Auditing model...</Text>
        {p && <Text color="gray">{p.phase}{p.current && p.total ? ` (${p.current}/${p.total})` : ''}</Text>}
      </Box>
    );
  }

  if (audit.error) {
    return <Box marginTop={1} paddingLeft={2}><Text color="red">{audit.error}</Text></Box>;
  }

  // All-results: model list with issue counts (shows progressively during scan)
  if (mode === 'all-results') {
    // 5 issue columns × 8 chars = 40, vs model list's 3 × 8 = 24. Diff = 16.
    const nw = Math.max(20, nameWidth(termCols, showStats) - 16);
    const extraRows = (audit.scanningAll ? 2 : 1) + 2;
    const maxVisible = Math.max(5, termRows - CHROME_ROWS - INDICATOR_RESERVE - extraRows);
    const { scrollStart, scrollEnd, hasMoreAbove, hasMoreBelow } = computeScroll(modelFlat.length, selectedIndex, maxVisible);
    const visible = modelFlat.slice(scrollStart, scrollEnd);

    const sp = audit.scanAllProgress;
    const mp = audit.progress;

    return (
      <Box flexDirection="column" marginTop={1}>
        {audit.scanningAll && sp && (
          <Box paddingLeft={2} flexDirection="column">
            <Text color="cyan" wrap="truncate">Model {sp.current}/{sp.total}: <Text color="white">{sp.modelName}</Text>{mp ? `  —  ${mp.phase}${mp.current && mp.total ? ` (${mp.current}/${mp.total})` : ''}` : ''}</Text>
          </Box>
        )}
        {!audit.scanningAll && audit.modelResults.size > 0 && (
          <Box paddingLeft={2}>
            <Text color="green">Audit complete — {audit.modelResults.size} model{audit.modelResults.size !== 1 ? 's' : ''} scanned</Text>
          </Box>
        )}
        <Box paddingLeft={2}>
          <Box width={nw}><Text color="gray" dimColor>Name</Text></Box>
          <Box width={8}><Text color="gray" dimColor>{'Issues'.padStart(7)}</Text></Box>
          <Box width={8}><Text color="gray" dimColor>{'NoDesc'.padStart(7)}</Text></Box>
          <Box width={8}><Text color="gray" dimColor>{'NoRel'.padStart(7)}</Text></Box>
          <Box width={8}><Text color="gray" dimColor>{'NoDiag'.padStart(7)}</Text></Box>
          <Box width={8}><Text color="gray" dimColor>{'HTML'.padStart(7)}</Text></Box>
        </Box>
        {hasMoreAbove && <ScrollUp count={scrollStart} />}
        {visible.map((entry, vi) => {
          const i = scrollStart + vi;
          const selected = i === selectedIndex;
          const indent = '  '.repeat(entry.depth);
          const name = `${indent}${entry.model.Name}`.slice(0, nw).padEnd(nw);
          const r = audit.modelResults.get(entry.model.ModelId);
          const issues = r?.totalIssues ?? -1;
          const noDesc = r?.issuesByType['empty-description'] ?? 0;
          const noRel = r?.issuesByType['no-relationships'] ?? 0;
          const noDiag = r?.issuesByType['not-in-diagram'] ?? 0;
          const html = (r?.issuesByType['html-in-name'] ?? 0) + (r?.issuesByType['html-in-description'] ?? 0);

          return (
            <Box key={entry.model.ModelId}>
              <Box width={2}><Text color={selected && focused ? 'cyan' : 'gray'}>{selected ? '▶' : ' '}</Text></Box>
              <Box width={nw}><Text color={selected && focused ? 'cyan' : undefined}>{name}</Text></Box>
              <Box width={8}><Text color={issues > 0 ? 'yellow' : issues === 0 ? 'green' : 'gray'}>{(issues >= 0 ? String(issues).padStart(7) : '      …').padEnd(8)}</Text></Box>
              <Box width={8}><Text color={noDesc > 0 ? 'yellow' : 'gray'}>{(r ? String(noDesc).padStart(7) : '      …').padEnd(8)}</Text></Box>
              <Box width={8}><Text color={noRel > 0 ? 'yellow' : 'gray'}>{(r ? String(noRel).padStart(7) : '      …').padEnd(8)}</Text></Box>
              <Box width={8}><Text color={noDiag > 0 ? 'yellow' : 'gray'}>{(r ? String(noDiag).padStart(7) : '      …').padEnd(8)}</Text></Box>
              <Box width={8}><Text color={html > 0 ? 'red' : 'gray'}>{(r ? String(html).padStart(7) : '      …').padEnd(8)}</Text></Box>
            </Box>
          );
        })}
        {hasMoreBelow && <ScrollDown count={modelFlat.length - scrollEnd} total={modelFlat.length} />}
        <Box paddingLeft={2} marginTop={1}><Text color="gray" dimColor>[↵] view model detail  ·  [e] export  ·  [←/Esc] back  ·  [↑↓] navigate</Text></Box>
      </Box>
    );
  }

  // Results: issue detail list
  if (audit.result && issueFilter) {
    const filtered = audit.result.issues.filter(i => i.issueType === issueFilter);
    const nameW = Math.max(10, termCols - 18 - 1 - 2 - 20 - 22 - 12 - 6 - (showStats ? 31 : 0));
    const maxVisible = hasDetail
      ? Math.max(4, Math.floor((termRows - CHROME_ROWS - INDICATOR_RESERVE) * 0.35))
      : Math.max(5, termRows - CHROME_ROWS - INDICATOR_RESERVE - 4);
    const { scrollStart, scrollEnd, hasMoreAbove, hasMoreBelow } = computeScroll(filtered.length, selectedIndex, maxVisible);
    const visible = filtered.slice(scrollStart, scrollEnd);

    return (
      <Box flexDirection="column" marginTop={1}>
        <Box paddingLeft={2}>
          <Text color={ISSUE_COLORS[issueFilter] ?? 'yellow'}>{ISSUE_LABELS[issueFilter] ?? issueFilter}</Text>
          <Text color="gray"> — {filtered.length} issue{filtered.length !== 1 ? 's' : ''}</Text>
        </Box>
        <Box marginTop={1} flexDirection="column">
          {hasMoreAbove && <ScrollUp count={scrollStart} />}
          {visible.map((issue, vi) => {
            const i = scrollStart + vi;
            const selected = i === selectedIndex;
            const isViewed = issue.objectId === viewedAuditObjectId;
            const name = issue.objectName.slice(0, nameW).padEnd(nameW);
            return (
              <Box key={i}>
                <Box width={2}><Text color={selected && focused ? 'cyan' : isViewed ? 'yellow' : 'gray'}>{selected ? '▶' : isViewed ? '●' : ' '}</Text></Box>
                <Box width={nameW}><Text color={selected && focused ? 'cyan' : undefined} bold={isViewed}>{name}</Text></Box>
                <Box width={20}><Text color={getTypeInkColor(issue.objectType)} wrap="truncate">{issue.objectType}</Text></Box>
                <Box width={22}><Text color="gray" wrap="truncate">{issue.lastModifiedBy}</Text></Box>
                <Box width={12}><Text color="gray" dimColor>{fmtDateTime(issue.lastModifiedDate)}</Text></Box>
              </Box>
            );
          })}
          {hasMoreBelow && <ScrollDown count={filtered.length - scrollEnd} total={filtered.length} />}
        </Box>
        <Box paddingLeft={2} marginTop={1}><Text color="gray" dimColor>[↵] view detail  ·  [←/Esc] back to summary  ·  [↑↓] navigate</Text></Box>
      </Box>
    );
  }

  // Results: summary
  if (audit.result) {
    const r = audit.result;
    const types = Object.keys(r.issuesByType);

    return (
      <Box flexDirection="column" marginTop={1}>
        <Box paddingLeft={2} flexDirection="column">
          <Text color="gray">Last modified by <Text color="white">{r.lastModifiedBy}</Text> on <Text color="white">{fmtDateTime(r.lastModifiedDate)}</Text></Text>
          <Text color="gray">{r.totalObjects} objects  ·  {r.totalRelationships} relationships  ·  {r.totalDrawings} drawings</Text>
          <Box marginTop={1}>
            {r.totalIssues === 0
              ? <Text color="green">No issues found!</Text>
              : <Text color="yellow">{r.totalIssues} issue{r.totalIssues !== 1 ? 's' : ''} found</Text>
            }
          </Box>
        </Box>
        {types.length > 0 && (
          <Box marginTop={1} flexDirection="column">
            {types.map((t, i) => {
              const selected = i === selectedIndex;
              return (
                <Box key={t}>
                  <Box width={2}><Text color={selected && focused ? 'cyan' : 'gray'}>{selected ? '▶' : ' '}</Text></Box>
                  <Box width={30}><Text color={selected && focused ? 'cyan' : ISSUE_COLORS[t] ?? 'yellow'}>{ISSUE_LABELS[t] ?? t}</Text></Box>
                  <Text color="white">{r.issuesByType[t]}</Text>
                </Box>
              );
            })}
          </Box>
        )}
        <Box paddingLeft={2} marginTop={1}><Text color="gray" dimColor>{types.length > 0 ? '[↵] view issues  ·  ' : ''}[e] export  ·  [←/Esc] back  ·  [↑↓] navigate</Text></Box>
      </Box>
    );
  }

  // Model selector
  return <ModelList selectedIndex={selectedIndex} focused={focused} termRows={termRows} termCols={termCols} showStats={showStats} modelFlat={modelFlat} counts={modelCounts} loading={modelsLoading} error={modelsError} />;
};

interface CompareSectionProps {
  selectedIndex: number; focused: boolean; termRows: number; termCols: number; showStats: boolean;
  compare: MainContentProps['compare'];
  modelAId: string | null; modelAName: string; modelBName: string; modelBId: string | null;
  modelFlat: ReturnType<typeof flattenTree>;
  modelCounts: Map<string, import('../core/api/models.js').ModelCounts>;
  modelsLoading: boolean; modelsError: string | null;
}

const CompareSection: React.FC<CompareSectionProps> = ({ selectedIndex, focused, termRows, termCols, showStats, compare, modelAId, modelAName, modelBName, modelBId, modelFlat, modelCounts, modelsLoading, modelsError }) => {
  // Results: side-by-side diff
  if (modelBId && compare.rows.length > 0) {
    const halfW = Math.floor((termCols - 18 - 1 - (showStats ? 31 : 0) - 6) / 2);
    const maxVisible = Math.max(5, termRows - CHROME_ROWS - INDICATOR_RESERVE - 4);
    const { scrollStart, scrollEnd, hasMoreAbove, hasMoreBelow } = computeScroll(compare.rows.length, selectedIndex, maxVisible);
    const visible = compare.rows.slice(scrollStart, scrollEnd);

    return (
      <Box flexDirection="column" marginTop={1}>
        <Box paddingLeft={2}>
          <Text color="gray">
            <Text color="green">+{compare.leftOnlyCount}</Text> only in A  ·  <Text color="green">+{compare.rightOnlyCount}</Text> only in B  ·  {compare.bothCount} in both
          </Text>
        </Box>
        <Box paddingLeft={2}>
          <Box width={halfW}><Text bold color="gray">{modelAName}</Text></Box>
          <Box width={3}><Text color="gray"> │ </Text></Box>
          <Box width={halfW}><Text bold color="gray">{modelBName}</Text></Box>
        </Box>
        {hasMoreAbove && <ScrollUp count={scrollStart} />}
        {visible.map((row, vi) => {
          const i = scrollStart + vi;
          const selected = i === selectedIndex;
          const leftName = row.left ? row.left.Name.slice(0, halfW - 2).padEnd(halfW - 2) : ' '.repeat(halfW - 2);
          const rightName = row.right ? row.right.Name.slice(0, halfW - 2).padEnd(halfW - 2) : ' '.repeat(halfW - 2);
          const leftColor = row.match === 'left-only' ? 'green' : row.match === 'right-only' ? undefined : undefined;
          const rightColor = row.match === 'right-only' ? 'green' : row.match === 'left-only' ? undefined : undefined;
          const leftDim = row.match === 'right-only';
          const rightDim = row.match === 'left-only';

          return (
            <Box key={i}>
              <Box width={2}><Text color={selected && focused ? 'cyan' : 'gray'}>{selected ? '▶' : ' '}</Text></Box>
              <Box width={halfW}><Text color={selected && focused ? 'cyan' : leftColor} dimColor={leftDim}>{leftName}</Text></Box>
              <Box width={3}><Text color="gray"> │ </Text></Box>
              <Box width={halfW}><Text color={selected && focused ? 'cyan' : rightColor} dimColor={rightDim}>{rightName}</Text></Box>
            </Box>
          );
        })}
        {hasMoreBelow && <ScrollDown count={compare.rows.length - scrollEnd} total={compare.rows.length} />}
        <Box paddingLeft={2} marginTop={1}><Text color="gray" dimColor>[←/Esc] select different model  ·  [↑↓] navigate</Text></Box>
      </Box>
    );
  }

  // Loading
  if (modelBId && compare.loading) {
    return <Box marginTop={1} paddingLeft={2}><Text color="cyan">Comparing models...</Text></Box>;
  }

  if (modelBId && compare.error) {
    return <Box marginTop={1} paddingLeft={2}><Text color="red">{compare.error}</Text></Box>;
  }

  // Model selector — highlight Model A when selecting B
  return <ModelList selectedIndex={selectedIndex} focused={focused} termRows={termRows} termCols={termCols} showStats={showStats} modelFlat={modelFlat} counts={modelCounts} loading={modelsLoading} error={modelsError} highlightModelId={modelAId} />;
};

// --- Activity section (real data) ---

interface ActivitySectionProps {
  selectedIndex: number; focused: boolean; termRows: number; termCols: number; showStats: boolean;
  activity: MainContentProps['activity'];
  activityExport: UseActivityExportResult;
  periods: TimePeriod[];
  modelIndex: number | null;
}

const fmtDate = (d: Date) => d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

const fmtDateTime = (s: string) => {
  const d = new Date(s);
  return `${d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })} ${d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`;
};

const ActivitySection: React.FC<ActivitySectionProps> = ({ selectedIndex, focused, termRows, termCols, showStats, activity, activityExport, periods, modelIndex }) => {
  // Export overlay
  if (activityExport.exporting) {
    const p = activityExport.progress;
    return (
      <Box flexDirection="column" marginTop={1} paddingLeft={2}>
        <Text color="cyan">Exporting activity report...</Text>
        {p && <Text color="gray">{p.phase}{p.current && p.total ? ` (${p.current}/${p.total})` : ''}</Text>}
      </Box>
    );
  }
  if (activityExport.result) {
    const r = activityExport.result;
    return (
      <Box flexDirection="column" marginTop={1} paddingLeft={2}>
        <Text color="green">Export complete!</Text>
        <Box marginTop={1} flexDirection="column">
          <Text color="gray">Models:  <Text color="white">{r.modelCount}</Text></Text>
          <Text color="gray">Entries: <Text color="white">{r.entryCount}</Text></Text>
        </Box>
        <Box marginTop={1}><Text color="gray">Saved to: <Text color="white">{r.filePath}</Text></Text></Box>
        <Box marginTop={1}><Text color="gray" dimColor>[o] open  ·  [←/Esc] back</Text></Box>
      </Box>
    );
  }
  if (activityExport.error) {
    return (
      <Box flexDirection="column" marginTop={1} paddingLeft={2}>
        <Text color="red">{activityExport.error}</Text>
        <Box marginTop={1}><Text color="gray" dimColor>[←/Esc] back</Text></Box>
      </Box>
    );
  }

  // State 1: Period selector
  if (!activity.scanning && !activity.report) {
    return (
      <Box flexDirection="column" marginTop={1}>
        <Text color="gray" dimColor>Select a time period to scan for activity across all models:</Text>
        <Box marginTop={1} flexDirection="column">
          {periods.map((p, i) => {
            const selected = i === selectedIndex;
            return (
              <Box key={p}>
                <Box width={2}><Text color={selected && focused ? 'cyan' : 'gray'}>{selected ? '▶' : ' '}</Text></Box>
                <Text color={selected && focused ? 'cyan' : undefined}>{TIME_PERIOD_LABELS[p]}</Text>
              </Box>
            );
          })}
        </Box>
        <Box paddingLeft={2} marginTop={1}><Text color="gray" dimColor>[↵] start scan  ·  [↑↓] navigate</Text></Box>
      </Box>
    );
  }

  // State 2: Scanning
  if (activity.scanning) {
    const p = activity.progress;
    return (
      <Box flexDirection="column" marginTop={1} paddingLeft={2}>
        <Text color="cyan">Scanning models for activity...</Text>
        {p && (
          <>
            <Text color="gray">Model {p.current} of {p.total}: {p.modelName}</Text>
            {p.objectsFound > 0 && <Text color="gray" dimColor>  {p.objectsFound} objects, {p.relsFound} relationships</Text>}
          </>
        )}
        <Box marginTop={1}><Text color="gray" dimColor>[Esc] cancel</Text></Box>
      </Box>
    );
  }

  // State 3: Results
  if (activity.error) {
    return <Box marginTop={1} paddingLeft={2}><Text color="red">{activity.error}</Text></Box>;
  }

  const r = activity.report!;

  // State 3b: Model detail
  if (modelIndex !== null && r.models[modelIndex]) {
    const m = r.models[modelIndex];

    // Flatten all entries: created objects, modified objects, individual relationships
    interface ActivityEntry { name: string; typeName: string; action: string; user: string; date: string }
    const entries: ActivityEntry[] = [];
    for (const u of m.users) {
      for (const obj of u.created) {
        entries.push({ name: obj.Name, typeName: obj.ObjectType.Name, action: 'Created', user: u.userName, date: obj.DateCreated });
      }
      for (const obj of u.modified) {
        entries.push({ name: obj.Name, typeName: obj.ObjectType.Name, action: 'Modified', user: u.userName, date: obj.LastModifiedDate });
      }
      for (const rel of u.relationships) {
        entries.push({ name: rel.RelationshipId, typeName: 'Relationship', action: 'Created', user: u.userName, date: rel.DateCreated });
      }
    }
    // Sort: objects first (by type → name), then relationships (by date)
    const objects = entries.filter(e => e.typeName !== 'Relationship').sort((a, b) => a.typeName.localeCompare(b.typeName) || a.name.localeCompare(b.name));
    const rels = entries.filter(e => e.typeName === 'Relationship').sort((a, b) => b.date.localeCompare(a.date));
    entries.length = 0;
    entries.push(...objects, ...rels);

    // Fixed column widths to prevent overflow
    const actionW = 10;
    const typeW = 20;
    const userW = 22;
    const dateW = 12;
    const nameW = Math.max(10, termCols - 18 - 1 - 2 - actionW - typeW - userW - dateW - 6 - (showStats ? 31 : 0));

    const maxVisible = Math.max(5, termRows - CHROME_ROWS - INDICATOR_RESERVE - 4);
    const { scrollStart, scrollEnd, hasMoreAbove, hasMoreBelow } = computeScroll(entries.length, selectedIndex, maxVisible);
    const visible = entries.slice(scrollStart, scrollEnd);

    return (
      <Box flexDirection="column" marginTop={1}>
        <Box paddingLeft={2}>
          <Text color="gray">{m.totalObjects} objects, {m.totalRels} relationships  ·  {m.users.length} user{m.users.length !== 1 ? 's' : ''}</Text>
        </Box>
        <Box marginTop={1} flexDirection="column">
          {hasMoreAbove && <ScrollUp count={scrollStart} />}
          {visible.map((e, vi) => {
            const i = scrollStart + vi;
            const selected = i === selectedIndex;
            const actionColor = e.action === 'Created' ? 'green' : 'yellow';
            const typeColor = e.typeName === 'Relationship' ? 'gray' : getTypeInkColor(e.typeName);
            const name = e.name.slice(0, nameW).padEnd(nameW);
            return (
              <Box key={i}>
                <Box width={2}><Text color={selected && focused ? 'cyan' : 'gray'}>{selected ? '▶' : ' '}</Text></Box>
                <Box width={actionW}><Text color={actionColor}>{e.action}</Text></Box>
                <Box width={nameW}><Text color={selected && focused ? 'cyan' : undefined}>{name}</Text></Box>
                <Box width={typeW}><Text color={typeColor} dimColor={e.typeName === 'Relationship'}>{e.typeName.slice(0, typeW - 1)}</Text></Box>
                <Box width={userW}><Text color="gray">{e.user.slice(0, userW - 1)}</Text></Box>
                <Box width={dateW}><Text color="gray" dimColor>{fmtDateTime(e.date)}</Text></Box>
              </Box>
            );
          })}
          {hasMoreBelow && <ScrollDown count={entries.length - scrollEnd} total={entries.length} />}
        </Box>
        <Box paddingLeft={2} marginTop={1}><Text color="gray" dimColor>[e] export  ·  [←/Esc] back to models  ·  [↑↓] navigate</Text></Box>
      </Box>
    );
  }

  // State 3a: Model list
  const maxVisible = Math.max(5, termRows - CHROME_ROWS - INDICATOR_RESERVE - 6);
  const { scrollStart, scrollEnd, hasMoreAbove, hasMoreBelow } = computeScroll(r.models.length, selectedIndex, maxVisible);
  const visible = r.models.slice(scrollStart, scrollEnd);

  return (
    <Box flexDirection="column" marginTop={1}>
      <Box paddingLeft={2} flexDirection="column">
        <Text color="gray">{r.label}  ·  {fmtDate(r.since)} – {fmtDate(r.until)}</Text>
        <Text color="gray">
          <Text color="green">+{r.totalCreated} created</Text>  <Text color="yellow">{r.totalModified} modified</Text>  <Text color="gray">{r.totalRels} relationships</Text>  ·  {r.models.length} active model{r.models.length !== 1 ? 's' : ''}
        </Text>
      </Box>
      <Box marginTop={1} flexDirection="column">
        {hasMoreAbove && <ScrollUp count={scrollStart} />}
        {visible.map((m, vi) => {
          const i = scrollStart + vi;
          const selected = i === selectedIndex;
          return (
            <Box key={m.modelId}>
              <Box width={2}><Text color={selected && focused ? 'cyan' : 'gray'}>{selected ? '▶' : ' '}</Text></Box>
              <Box flexGrow={1}><Text color={selected && focused ? 'cyan' : undefined} wrap="truncate">{m.modelName}</Text></Box>
              <Box width={20}><Text color="gray">{m.totalObjects} obj, {m.totalRels} rel</Text></Box>
              <Box width={12}><Text color="gray">{m.users.length} user{m.users.length !== 1 ? 's' : ''}</Text></Box>
            </Box>
          );
        })}
        {hasMoreBelow && <ScrollDown count={r.models.length - scrollEnd} total={r.models.length} />}
      </Box>
      <Box paddingLeft={2} marginTop={1}><Text color="gray" dimColor>[↵] view detail  ·  [e] export  ·  [←/Esc] back to periods  ·  [↑↓] navigate</Text></Box>
    </Box>
  );
};

// --- Export section ---

interface ExportSectionProps {
  selectedIndex: number; focused: boolean;
  exportHook: MainContentProps['exportHook'];
  exportModelId: string | null;
  formats: MainContentProps['exportFormats'];
  modelFlat: ReturnType<typeof flattenTree>;
  modelCounts: Map<string, import('../core/api/models.js').ModelCounts>;
  modelsLoading: boolean;
  modelsError: string | null;
  termRows: number; termCols: number; showStats: boolean;
  templateExport: UseTemplateExportResult;
  exportTemplatePicking: boolean;
  exportTemplates: Array<{ name: string; path: string }>;
  exportTemplate: { name: string; path: string } | null;
  exportTemplateVars: Array<{ name: string; prompt: string; objectType?: string }>;
  exportVarIndex: number;
  exportVarInput: string;
  exportVarOptions: string[];
  exportVarLoading: boolean;
}

const ExportSection: React.FC<ExportSectionProps> = ({ selectedIndex, focused, exportHook, exportModelId, formats, modelFlat, modelCounts, modelsLoading, modelsError, termRows, termCols, showStats, templateExport, exportTemplatePicking, exportTemplates, exportTemplate, exportTemplateVars, exportVarIndex, exportVarInput, exportVarOptions, exportVarLoading }) => {
  // Template export in progress
  if (templateExport.exporting) {
    const p = templateExport.progress;
    return (
      <Box flexDirection="column" marginTop={1} paddingLeft={2}>
        <Text color="cyan">Generating template...</Text>
        {p && <Text color="gray">{p.phase}{p.current && p.total ? ` (${p.current}/${p.total})` : ''}</Text>}
      </Box>
    );
  }

  // Template export complete
  if (templateExport.result) {
    const r = templateExport.result;
    return (
      <Box flexDirection="column" marginTop={1} paddingLeft={2}>
        <Text color="green">Template export complete!</Text>
        <Box marginTop={1} flexDirection="column">
          <Text color="gray">Objects:       <Text color="white">{r.objectCount}</Text></Text>
          <Text color="gray">Relationships: <Text color="white">{r.relationshipCount}</Text></Text>
        </Box>
        <Box marginTop={1}><Text color="gray">Saved to: <Text color="white">{r.filePath}</Text></Text></Box>
        <Box marginTop={1}><Text color="gray" dimColor>[o] open  ·  [←/Esc] back</Text></Box>
      </Box>
    );
  }

  // Template export error
  if (templateExport.error) {
    return (
      <Box flexDirection="column" marginTop={1} paddingLeft={2}>
        <Text color="red">{templateExport.error}</Text>
        <Box marginTop={1}><Text color="gray" dimColor>[←/Esc] back</Text></Box>
      </Box>
    );
  }

  // Variable input / pick
  if (exportVarIndex >= 0 && exportTemplate) {
    const v = exportTemplateVars[exportVarIndex];
    const nextLabel = exportVarIndex + 1 < exportTemplateVars.length ? 'next' : 'start export';

    // Pick mode: options loaded
    if (exportVarOptions.length > 0) {
      const maxVisible = Math.max(5, termRows - CHROME_ROWS - INDICATOR_RESERVE - 5);
      const { scrollStart, scrollEnd, hasMoreAbove, hasMoreBelow } = computeScroll(exportVarOptions.length, selectedIndex, maxVisible);
      const visible = exportVarOptions.slice(scrollStart, scrollEnd);
      return (
        <Box flexDirection="column" marginTop={1}>
          <Box paddingLeft={2} flexDirection="column">
            <Text color="gray">Template: <Text color="white">{exportTemplate.name}</Text></Text>
            <Text color="gray" dimColor>{v?.prompt}  ({exportVarIndex + 1}/{exportTemplateVars.length})</Text>
          </Box>
          <Box marginTop={1} flexDirection="column">
            {hasMoreAbove && <ScrollUp count={scrollStart} />}
            {visible.map((name, vi) => {
              const i = scrollStart + vi;
              const selected = i === selectedIndex;
              return (
                <Box key={i}>
                  <Box width={2}><Text color={selected && focused ? 'cyan' : 'gray'}>{selected ? '▶' : ' '}</Text></Box>
                  <Text color={selected && focused ? 'cyan' : undefined} wrap="truncate">{name}</Text>
                </Box>
              );
            })}
            {hasMoreBelow && <ScrollDown count={exportVarOptions.length - scrollEnd} total={exportVarOptions.length} />}
          </Box>
          <Box paddingLeft={2} marginTop={1}><Text color="gray" dimColor>[↵] {nextLabel}  ·  [←/Esc] back  ·  [↑↓] navigate</Text></Box>
        </Box>
      );
    }

    // Loading state
    if (exportVarLoading) {
      return (
        <Box flexDirection="column" marginTop={1} paddingLeft={2}>
          <Text color="gray">Template: <Text color="white">{exportTemplate.name}</Text></Text>
          <Box marginTop={1}><Text color="cyan">Loading options for {v?.prompt}...</Text></Box>
        </Box>
      );
    }

    // Text input mode (no objectType declared)
    return (
      <Box flexDirection="column" marginTop={1} paddingLeft={2}>
        <Text color="gray">Template: <Text color="white">{exportTemplate.name}</Text></Text>
        <Box marginTop={1}>
          <Text color="gray">{v?.prompt}  <Text color="gray" dimColor>({exportVarIndex + 1}/{exportTemplateVars.length})</Text></Text>
        </Box>
        <Box marginTop={1}>
          <Text color="cyan">{exportVarInput}</Text>
          <Text color="cyan">█</Text>
        </Box>
        <Box marginTop={1}><Text color="gray" dimColor>[↵] {nextLabel}  ·  [Esc] back to templates</Text></Box>
      </Box>
    );
  }

  // Template picker
  if (exportTemplatePicking) {
    if (exportTemplates.length === 0) {
      return (
        <Box flexDirection="column" marginTop={1} paddingLeft={2}>
          <Text color="yellow">No templates found in ~/.orbusctl/templates/</Text>
          <Box marginTop={1}><Text color="gray" dimColor>Add .md template files to get started.</Text></Box>
          <Box marginTop={1}><Text color="gray" dimColor>[←/Esc] back</Text></Box>
        </Box>
      );
    }
    return (
      <Box flexDirection="column" marginTop={1}>
        <Box paddingLeft={2}><Text color="gray" dimColor>Select a template:</Text></Box>
        <Box marginTop={1} flexDirection="column">
          {exportTemplates.map((t, i) => {
            const selected = i === selectedIndex;
            return (
              <Box key={t.path}>
                <Box width={2}><Text color={selected && focused ? 'cyan' : 'gray'}>{selected ? '▶' : ' '}</Text></Box>
                <Text color={selected && focused ? 'cyan' : undefined}>{t.name}</Text>
              </Box>
            );
          })}
        </Box>
        <Box paddingLeft={2} marginTop={1}><Text color="gray" dimColor>[↵] select  ·  [←/Esc] back  ·  [↑↓] navigate</Text></Box>
      </Box>
    );
  }

  // Exporting in progress
  if (exportHook.exporting) {
    const p = exportHook.progress;
    return (
      <Box flexDirection="column" marginTop={1} paddingLeft={2}>
        <Text color="cyan">Exporting...</Text>
        {p && (
          <Text color="gray">{p.phase}{p.current && p.total ? ` (${p.current}/${p.total})` : ''}</Text>
        )}
      </Box>
    );
  }

  // Export complete
  if (exportHook.result) {
    const r = exportHook.result;
    return (
      <Box flexDirection="column" marginTop={1} paddingLeft={2}>
        <Text color="green">Export complete!</Text>
        <Box marginTop={1} flexDirection="column">
          <Text color="gray">Objects:       <Text color="white">{r.objectCount}</Text></Text>
          <Text color="gray">Relationships: <Text color="white">{r.relationshipCount}</Text></Text>
          <Text color="gray">Drawings:      <Text color="white">{r.drawingCount}</Text></Text>
        </Box>
        <Box marginTop={1}>
          <Text color="gray">Saved to: <Text color="white">{r.filePath}</Text></Text>
        </Box>
        <Box marginTop={1}><Text color="gray" dimColor>[o] open  ·  [←/Esc] back</Text></Box>
      </Box>
    );
  }

  // Error
  if (exportHook.error) {
    return (
      <Box flexDirection="column" marginTop={1} paddingLeft={2}>
        <Text color="red">{exportHook.error}</Text>
        <Box marginTop={1}><Text color="gray" dimColor>[←/Esc] back</Text></Box>
      </Box>
    );
  }

  // Format selector
  if (exportModelId) {
    return (
      <Box flexDirection="column" marginTop={1}>
        <Box paddingLeft={2}><Text color="gray" dimColor>Select export format:</Text></Box>
        <Box marginTop={1} flexDirection="column">
          {formats.map((f, i) => {
            const selected = i === selectedIndex;
            return (
              <Box key={f.value}>
                <Box width={2}><Text color={selected && focused ? 'cyan' : 'gray'}>{selected ? '▶' : ' '}</Text></Box>
                <Text color={selected && focused ? 'cyan' : undefined}>{f.label}</Text>
              </Box>
            );
          })}
        </Box>
        <Box paddingLeft={2} marginTop={1}><Text color="gray" dimColor>[↵] export  ·  [←/Esc] back  ·  [↑↓] navigate</Text></Box>
      </Box>
    );
  }

  // Model selector (reuse ModelList)
  return <ModelList selectedIndex={selectedIndex} focused={focused} termRows={termRows} termCols={termCols} showStats={showStats} modelFlat={modelFlat} counts={modelCounts} loading={modelsLoading} error={modelsError} />;
};

// --- Config section ---

const BROWSER_OPTIONS: { label: string; value: string | undefined }[] = [
  { label: 'System default', value: undefined },
  { label: 'Microsoft Edge', value: 'Microsoft Edge' },
  { label: 'Google Chrome', value: 'Google Chrome' },
  { label: 'Firefox', value: 'Firefox' },
  { label: 'Safari', value: 'Safari' },
];

interface ConfigSectionProps {
  selectedIndex: number; focused: boolean;
  editing: string | null;
  textInput: string;
  solutions: Solution[];
}

const ConfigSection: React.FC<ConfigSectionProps> = ({ selectedIndex, focused, editing, textInput, solutions }) => {
  const server = getServer();
  const filter = getSolutionFilter();
  const showHidden = getShowHiddenModels();
  const hasAuthToken = !!getToken();
  const browser = getBrowser();

  const writePasswordHash = getWritePasswordHash();
  let writePasswordStatus = 'Not set';
  if (writePasswordHash) {
    if (isWritePasswordExpired()) {
      writePasswordStatus = 'Expired';
    } else {
      const setAt = getWritePasswordSetAt();
      if (setAt) {
        const ageMs = Date.now() - new Date(setAt).getTime();
        const ageH = Math.floor(ageMs / 3_600_000);
        const ageM = Math.floor((ageMs % 3_600_000) / 60_000);
        writePasswordStatus = ageH > 0 ? `Active (${ageH}h ${ageM}m ago)` : `Active (${ageM}m ago)`;
      } else {
        writePasswordStatus = 'Active';
      }
    }
  }

  // Sub-view: write password log
  if (editing === 'write-password-log') {
    const writePasswordSetAt = getWritePasswordSetAt();
    const entries = getRecentWriteLog(writePasswordSetAt);
    return (
      <Box flexDirection="column" marginTop={1} paddingLeft={2}>
        <Text color="gray">Write operations since last password ({entries.length}):</Text>
        {entries.length === 0
          ? <Box marginTop={1}><Text color="gray" dimColor>(none)</Text></Box>
          : (
            <Box flexDirection="column" marginTop={1}>
              {entries.slice(-10).map((e, i) => {
                const typeStr = (e.objectType ?? '').padEnd(20);
                const nameStr = (e.objectName ?? e.objectId?.slice(0, 12) ?? e.relationshipId?.slice(0, 12) ?? '—').padEnd(25);
                return (
                  <Box key={i}>
                    <Text color="gray">{e.timestamp.slice(0, 16).replace('T', ' ')}  </Text>
                    <Text color={e.success ? 'white' : 'red'}>{e.operation.padEnd(22)}</Text>
                    <Text color="gray">{typeStr}</Text>
                    <Text color="gray" dimColor>{nameStr}</Text>
                    <Text color={e.success ? 'green' : 'red'}>{e.success ? '✓' : '✗'}</Text>
                  </Box>
                );
              })}
            </Box>
          )
        }
        <Box marginTop={1}><Text color="gray" dimColor>[↵] set new password  ·  [Esc] cancel</Text></Box>
      </Box>
    );
  }

  // Sub-view: write password input (masked)
  if (editing === 'write-password') {
    return (
      <Box flexDirection="column" marginTop={1} paddingLeft={2}>
        <Text color="gray">Write password:</Text>
        <Box marginTop={1}>
          <Text color="cyan">{'●'.repeat(textInput.length)}</Text>
          <Text color="cyan">█</Text>
        </Box>
        <Box marginTop={1}><Text color="gray" dimColor>[↵] save  ·  [Esc] cancel</Text></Box>
      </Box>
    );
  }

  // Sub-view: browser picker
  if (editing === 'browser') {
    return (
      <Box flexDirection="column" marginTop={1}>
        <Box paddingLeft={2}><Text color="gray" dimColor>Select a browser for "open in Orbus":</Text></Box>
        <Box marginTop={1} flexDirection="column">
          {BROWSER_OPTIONS.map((opt, i) => {
            const selected = i === selectedIndex;
            const isCurrent = opt.value === browser;
            return (
              <Box key={i}>
                <Box width={2}><Text color={selected && focused ? 'cyan' : 'gray'}>{selected ? '▶' : ' '}</Text></Box>
                <Text color={selected && focused ? 'cyan' : isCurrent ? 'white' : 'gray'} bold={isCurrent}>{opt.label}</Text>
                {isCurrent && <Text color="green"> ●</Text>}
              </Box>
            );
          })}
        </Box>
        <Box paddingLeft={2} marginTop={1}><Text color="gray" dimColor>[↵] select  ·  [Esc] cancel</Text></Box>
      </Box>
    );
  }

  // Sub-view: solution picker
  if (editing === 'solution') {
    const options = [{ label: 'All models (no filter)', value: '' }, ...solutions.map(s => ({ label: s.Name, value: s.Name }))];
    return (
      <Box flexDirection="column" marginTop={1}>
        <Text color="gray" dimColor>Select a solution filter:</Text>
        <Box marginTop={1} flexDirection="column">
          {options.map((o, i) => {
            const selected = i === selectedIndex;
            const isCurrent = (i === 0 && !filter) || o.value === filter;
            return (
              <Box key={i}>
                <Box width={2}><Text color={selected && focused ? 'cyan' : 'gray'}>{selected ? '▶' : ' '}</Text></Box>
                <Text color={selected && focused ? 'cyan' : isCurrent ? 'white' : 'gray'} bold={isCurrent}>{o.label}</Text>
                {isCurrent && <Text color="green"> ●</Text>}
              </Box>
            );
          })}
        </Box>
        <Box paddingLeft={2} marginTop={1}><Text color="gray" dimColor>[↵] select  ·  [Esc] cancel</Text></Box>
      </Box>
    );
  }

  // Sub-view: server text input
  if (editing === 'server') {
    return (
      <Box flexDirection="column" marginTop={1} paddingLeft={2}>
        <Text color="gray">Server URL:</Text>
        <Box marginTop={1}>
          <Text color="cyan">{textInput}</Text>
          <Text color="cyan">█</Text>
        </Box>
        <Box marginTop={1}><Text color="gray" dimColor>[↵] save  ·  [Esc] cancel</Text></Box>
      </Box>
    );
  }

  // Main settings list
  const settings = [
    { label: 'Server', value: server, hint: 'API endpoint' },
    { label: 'Solution filter', value: filter ?? 'All models', hint: 'filter models by solution' },
    { label: 'Show hidden models', value: showHidden ? 'Yes' : 'No', hint: 'toggle with Enter' },
    { label: 'Auth token', value: hasAuthToken ? 'Set ●' : 'Not set', hint: hasAuthToken ? 'open auth modal' : 'set a token' },
    { label: 'Write password', value: writePasswordStatus, hint: 'required for write operations' },
    { label: 'Browser', value: browser ?? 'System default', hint: 'for "open in Orbus"' },
  ];

  return (
    <Box flexDirection="column" marginTop={1}>
      {settings.map((s, i) => {
        const selected = i === selectedIndex;
        return (
          <Box key={i}>
            <Box width={2}><Text color={selected && focused ? 'cyan' : 'gray'}>{selected ? '▶' : ' '}</Text></Box>
            <Box width={22}><Text color={selected && focused ? 'cyan' : 'white'}>{s.label}</Text></Box>
            <Text color="gray">{s.value}</Text>
          </Box>
        );
      })}
      <Box paddingLeft={2} marginTop={1}><Text color="gray" dimColor>[↵] change  ·  [↑↓] navigate</Text></Box>
    </Box>
  );
};

// ═══════════════════════════════════════════════════════════════
// MAIN CONTENT CONTAINER
// ═══════════════════════════════════════════════════════════════

const SECTION_TITLES: Record<Section, string> = {
  models: 'Models', drawings: 'Drawings', compare: 'Compare', activity: 'Activity', audit: 'Audit', export: 'Export', config: 'Configuration',
};

const LockedSection: React.FC<{ section: Section }> = ({ section }) => (
  <Box flexDirection="column" flexGrow={1} alignItems="center" justifyContent="center">
    <Text color="gray">⊘  {SECTION_TITLES[section]} requires authentication</Text>
    <Box marginTop={1}><Text dimColor>Press [a] to authenticate</Text></Box>
  </Box>
);

interface MainContentProps {
  section: Section;
  selectedIndex: number;
  focused: boolean;
  auth: AuthState;
  models: Model[];
  modelFlat: ReturnType<typeof flattenTree>;
  modelCounts: Map<string, ModelCounts>;
  modelsLoading: boolean;
  modelsError: string | null;
  modelsView: ModelsView;
  objects: OrbusObject[];
  objectsLoading: boolean;
  objectsError: string | null;
  objectDetail: ObjectDetail | null;
  objectRelationships: RelatedObject[];
  detailLoading: boolean;
  detailError: string | null;
  viewedObjectId: string | null;
  detailFocused: boolean;
  relIndex: number;
  drawings: Drawing[];
  drawingTypeMap: Map<string, string>;
  drawingsLoading: boolean;
  drawingsError: string | null;
  drawingsModelId: string | null;
  drawingsModelName: string;
  viewedDrawingId: string | null;
  drawingComponents: ResolvedComponent[];
  drawingDetailLoading: boolean;
  drawingDetailError: string | null;
  viewedDrawingObjectId: string | null;
  drawingObjectDetail: ObjectDetail | null;
  drawingObjectRelationships: RelatedObject[];
  drawingObjectDetailLoading: boolean;
  drawingObjectDetailError: string | null;
  drawingDetailFocused: boolean;
  drawingRelIndex: number;
  termRows: number;
  termCols: number;
  showStats: boolean;
  audit: {
    auditing: boolean;
    progress: AuditProgress | null;
    result: AuditSummary | null;
    error: string | null;
    scanningAll: boolean;
    scanAllProgress: { current: number; total: number; modelName: string } | null;
    modelResults: Map<string, AuditSummary>;
  };
  auditIssueFilter: string | null;
  auditMode: string;
  auditSelectedModelIds: Set<string>;
  viewedAuditObjectId: string | null;
  auditObjectDetail: ObjectDetail | null;
  auditObjectRelationships: RelatedObject[];
  auditDetailLoading: boolean;
  auditDetailError: string | null;
  auditDetailFocused: boolean;
  auditRelIndex: number;
  compare: {
    rows: CompareRow[];
    loading: boolean;
    error: string | null;
    leftCount: number;
    rightCount: number;
    bothCount: number;
    leftOnlyCount: number;
    rightOnlyCount: number;
  };
  compareModelAId: string | null;
  compareModelAName: string;
  compareModelBId: string | null;
  compareModelBName: string;
  auditExport: UseAuditExportResult;
  activityExport: UseActivityExportResult;
  templateExport: UseTemplateExportResult;
  exportTemplatePicking: boolean;
  exportTemplates: Array<{ name: string; path: string }>;
  exportTemplate: { name: string; path: string } | null;
  exportTemplateVars: Array<{ name: string; prompt: string; objectType?: string }>;
  exportVarIndex: number;
  exportVarInput: string;
  exportVarOptions: string[];
  exportVarLoading: boolean;
  exportHook: {
    exporting: boolean;
    progress: { phase: string; current?: number; total?: number } | null;
    result: { filePath: string; objectCount: number; relationshipCount: number; drawingCount: number } | null;
    error: string | null;
  };
  exportModelId: string | null;
  exportFormats: { label: string; value: string }[];
  activityModelIndex: number | null;
  configEditing: string | null;
  configTextInput: string;
  solutions: Solution[];
  activity: {
    scanning: boolean;
    progress: ScanProgress | null;
    report: { models: ModelActivity[]; totalObjects: number; totalRels: number; totalCreated: number; totalModified: number; label: string; since: Date; until: Date } | null;
    error: string | null;
  };
  activityPeriods: TimePeriod[];
}

export const MainContent: React.FC<MainContentProps> = (props) => {
  const { section, selectedIndex, focused, auth, termRows } = props;
  const isLocked = SECTIONS_REQUIRING_AUTH.includes(section) && auth.status !== 'authenticated';

  // Objects view with detail: two sibling Panels
  if (section === 'models' && !isLocked && props.modelsView.level === 'objects') {
    const { modelsView, objects, objectsLoading, objectsError, viewedObjectId, objectDetail, objectRelationships, detailLoading, detailError, detailFocused, relIndex } = props;
    const hasDetail = viewedObjectId !== null;
    const objectsTitle = `${modelsView.modelName} · Objects (${objects.length})`;
    const detailTitle = objectDetail ? objectDetail.Name : 'Detail';
    const listFocused = focused && !detailFocused;

    const panelW = props.termCols - 18 - 1 - (props.showStats ? 31 : 0);

    return (
      <Box flexDirection="column" flexGrow={1}>
        <Panel title={objectsTitle} focused={listFocused} width={panelW} flexGrow={hasDetail ? undefined : 1} paddingX={2}>
          <ObjectListCompact
            selectedIndex={selectedIndex} focused={listFocused} termRows={termRows} termCols={props.termCols} showStats={props.showStats}
            objects={objects} loading={objectsLoading} error={objectsError}
            viewedObjectId={viewedObjectId} hasDetail={hasDetail}
          />
        </Panel>
        {hasDetail && (
          <Panel title={detailTitle} focused={detailFocused} width={panelW} flexGrow={1} paddingX={2}>
            {detailLoading ? (
              <Box paddingLeft={1} marginTop={1}><Text color="cyan">Loading...</Text></Box>
            ) : detailError ? (
              <Box paddingLeft={1} marginTop={1}><Text color="red">{detailError}</Text></Box>
            ) : objectDetail ? (
              <ObjectDetailPane detail={objectDetail} relationships={objectRelationships} termRows={termRows} detailFocused={detailFocused} relIndex={relIndex} />
            ) : null}
          </Panel>
        )}
      </Box>
    );
  }

  // Drawings view with component list + detail: two sibling Panels
  if (section === 'drawings' && !isLocked && props.viewedDrawingId) {
    const { viewedDrawingObjectId, drawingObjectDetail, drawingObjectRelationships, drawingObjectDetailLoading, drawingObjectDetailError, drawingDetailFocused, drawingRelIndex } = props;
    const hasDetail = viewedDrawingObjectId !== null;
    const d = props.drawings.find(dr => dr.DocumentId === props.viewedDrawingId);
    const drawingTitle = d ? `${d.FileName} · Components (${props.drawingComponents.length})` : `Components (${props.drawingComponents.length})`;
    const detailTitle = drawingObjectDetail ? drawingObjectDetail.Name : 'Detail';
    const listFocused = focused && !drawingDetailFocused;

    const panelW = props.termCols - 18 - 1 - (props.showStats ? 31 : 0);

    return (
      <Box flexDirection="column" flexGrow={1}>
        <Panel title={drawingTitle} focused={listFocused} width={panelW} flexGrow={hasDetail ? undefined : 1} paddingX={2}>
          <DrawingComponentList
            selectedIndex={selectedIndex} focused={listFocused} termRows={termRows}
            components={props.drawingComponents} loading={props.drawingDetailLoading} error={props.drawingDetailError}
            hasDetail={hasDetail} viewedDrawingObjectId={viewedDrawingObjectId}
          />
        </Panel>
        {hasDetail && (
          <Panel title={detailTitle} focused={drawingDetailFocused} width={panelW} flexGrow={1} paddingX={2}>
            {drawingObjectDetailLoading ? (
              <Box paddingLeft={1} marginTop={1}><Text color="cyan">Loading...</Text></Box>
            ) : drawingObjectDetailError ? (
              <Box paddingLeft={1} marginTop={1}><Text color="red">{drawingObjectDetailError}</Text></Box>
            ) : drawingObjectDetail ? (
              <ObjectDetailPane detail={drawingObjectDetail} relationships={drawingObjectRelationships} termRows={termRows} detailFocused={drawingDetailFocused} relIndex={drawingRelIndex} />
            ) : null}
          </Panel>
        )}
      </Box>
    );
  }

  // Audit issue list with detail: two sibling Panels
  if (section === 'audit' && !isLocked && props.auditMode === 'detail' && props.audit.result && props.auditIssueFilter) {
    const { viewedAuditObjectId, auditObjectDetail, auditObjectRelationships, auditDetailLoading, auditDetailError, auditDetailFocused, auditRelIndex } = props;
    const hasDetail = viewedAuditObjectId !== null;
    const filtered = props.audit.result.issues.filter(i => i.issueType === props.auditIssueFilter);
    const issueTitle = `Audit · ${props.audit.result.modelName} · ${ISSUE_LABELS[props.auditIssueFilter!] ?? props.auditIssueFilter} (${filtered.length})`;
    const detailTitle = auditObjectDetail ? auditObjectDetail.Name : 'Detail';
    const listFocused = focused && !auditDetailFocused;
    const panelW = props.termCols - 18 - 1 - (props.showStats ? 31 : 0);

    return (
      <Box flexDirection="column" flexGrow={1}>
        <Panel title={issueTitle} focused={listFocused} width={panelW} flexGrow={hasDetail ? undefined : 1} paddingX={2}>
          <AuditSection
            selectedIndex={selectedIndex} focused={listFocused} termRows={termRows} termCols={props.termCols} showStats={props.showStats}
            audit={props.audit} auditExport={props.auditExport} issueFilter={props.auditIssueFilter} mode={props.auditMode}
            selectedModelIds={props.auditSelectedModelIds} modelFlat={props.modelFlat} modelCounts={props.modelCounts}
            modelsLoading={props.modelsLoading} modelsError={props.modelsError}
            hasDetail={hasDetail} viewedAuditObjectId={viewedAuditObjectId}
          />
        </Panel>
        <Box display={hasDetail ? 'flex' : 'none'} flexDirection="column" flexGrow={1}>
          <Panel title={detailTitle} focused={auditDetailFocused} width={panelW} flexGrow={1} paddingX={2}>
            {auditDetailLoading ? (
              <Box paddingLeft={1} marginTop={1}><Text color="cyan">Loading...</Text></Box>
            ) : auditDetailError ? (
              <Box paddingLeft={1} marginTop={1}><Text color="red">{auditDetailError}</Text></Box>
            ) : auditObjectDetail ? (
              <ObjectDetailPane detail={auditObjectDetail} relationships={auditObjectRelationships} termRows={termRows} detailFocused={auditDetailFocused} relIndex={auditRelIndex} />
            ) : null}
          </Panel>
        </Box>
      </Box>
    );
  }

  // Standard single-panel view for all other sections
  let title = SECTION_TITLES[section];
  if (section === 'models' && props.models.length > 0) title = `Models (${props.models.length})`;
  else if (section === 'drawings') {
    if (props.viewedDrawingId) {
      const d = props.drawings.find(d => d.DocumentId === props.viewedDrawingId);
      title = d ? `${d.FileName} · Components (${props.drawingComponents.length})` : 'Components';
    } else if (props.drawingsModelId) {
      title = `${props.drawingsModelName} · Drawings (${props.drawings.length})`;
    } else if (props.models.length > 0) {
      title = `Drawings — select a model`;
    }
  } else if (section === 'audit') {
    if (props.auditMode === 'detail' && props.audit.result && props.auditIssueFilter) {
      title = `Audit · ${props.audit.result.modelName} · ${ISSUE_LABELS[props.auditIssueFilter] ?? props.auditIssueFilter}`;
    } else if (props.auditMode === 'detail' && props.audit.result) {
      title = `Audit · ${props.audit.result.modelName} · ${props.audit.result.totalIssues} issues`;
    } else if (props.auditMode === 'all-results') {
      const done = props.audit.modelResults.size;
      title = props.audit.scanningAll ? `Audit · Scanning (${done} done)` : `Audit · All models (${done})`;
    } else if (props.audit.auditing) {
      title = 'Audit · Scanning...';
    } else if (props.auditMode === 'select-model') {
      title = 'Audit — select a model';
    } else if (props.auditMode === 'select-models') {
      const selCount = props.auditSelectedModelIds.size;
      title = selCount === 0 ? 'Audit — select models' : `Audit — ${selCount} model${selCount !== 1 ? 's' : ''} selected`;
    } else {
      title = 'Audit';
    }
  } else if (section === 'compare') {
    if (props.compareModelBId) title = `Compare · ${props.compareModelAName} vs ${props.compareModelBName}`;
    else if (props.compareModelAId) title = `Compare · Select Model B`;
    else title = 'Compare — select Model A';
  } else if (section === 'export') {
    if (props.exportHook.result) title = 'Export · Complete';
    else if (props.exportHook.exporting) title = 'Export · Working...';
    else if (props.exportModelId) title = `Export · Select format`;
    else title = 'Export — select a model';
  } else if (section === 'activity') {
    if (props.activity.report && props.activityModelIndex !== null) {
      const m = props.activity.report.models[props.activityModelIndex];
      if (m) title = `Activity · ${m.modelName}`;
    } else if (props.activity.report) {
      title = `Activity · ${props.activity.report.label}`;
    } else if (props.activity.scanning) {
      title = 'Activity · Scanning...';
    }
  }

  const renderSection = () => {
    if (isLocked) return <LockedSection section={section} />;
    switch (section) {
      case 'models':
        return <ModelList selectedIndex={selectedIndex} focused={focused} termRows={termRows} termCols={props.termCols} showStats={props.showStats} modelFlat={props.modelFlat} counts={props.modelCounts} loading={props.modelsLoading} error={props.modelsError} />;
      case 'drawings':
        if (props.viewedDrawingId) {
          return <DrawingComponentList selectedIndex={selectedIndex} focused={focused} termRows={termRows} components={props.drawingComponents} loading={props.drawingDetailLoading} error={props.drawingDetailError} />;
        }
        if (!props.drawingsModelId) {
          return <ModelList selectedIndex={selectedIndex} focused={focused} termRows={termRows} termCols={props.termCols} showStats={props.showStats} modelFlat={props.modelFlat} counts={props.modelCounts} loading={props.modelsLoading} error={props.modelsError} />;
        }
        return <DrawingsList selectedIndex={selectedIndex} focused={focused} termRows={termRows} modelName={props.drawingsModelName} drawings={props.drawings} typeMap={props.drawingTypeMap} loading={props.drawingsLoading} error={props.drawingsError} />;
      case 'audit': return <AuditSection selectedIndex={selectedIndex} focused={focused} termRows={termRows} termCols={props.termCols} showStats={props.showStats} audit={props.audit} auditExport={props.auditExport} issueFilter={props.auditIssueFilter} mode={props.auditMode} selectedModelIds={props.auditSelectedModelIds} modelFlat={props.modelFlat} modelCounts={props.modelCounts} modelsLoading={props.modelsLoading} modelsError={props.modelsError} hasDetail={false} viewedAuditObjectId={null} />;
      case 'compare': return <CompareSection selectedIndex={selectedIndex} focused={focused} termRows={termRows} termCols={props.termCols} showStats={props.showStats} compare={props.compare} modelAId={props.compareModelAId} modelAName={props.compareModelAName} modelBName={props.compareModelBName} modelBId={props.compareModelBId} modelFlat={props.modelFlat} modelCounts={props.modelCounts} modelsLoading={props.modelsLoading} modelsError={props.modelsError} />;
      case 'export': return <ExportSection selectedIndex={selectedIndex} focused={focused} exportHook={props.exportHook} exportModelId={props.exportModelId} formats={props.exportFormats} modelFlat={props.modelFlat} modelCounts={props.modelCounts} modelsLoading={props.modelsLoading} modelsError={props.modelsError} termRows={termRows} termCols={props.termCols} showStats={props.showStats} templateExport={props.templateExport} exportTemplatePicking={props.exportTemplatePicking} exportTemplates={props.exportTemplates} exportTemplate={props.exportTemplate} exportTemplateVars={props.exportTemplateVars} exportVarIndex={props.exportVarIndex} exportVarInput={props.exportVarInput} exportVarOptions={props.exportVarOptions} exportVarLoading={props.exportVarLoading} />;
      case 'activity': return <ActivitySection selectedIndex={selectedIndex} focused={focused} termRows={termRows} termCols={props.termCols} showStats={props.showStats} activity={props.activity} activityExport={props.activityExport} periods={props.activityPeriods} modelIndex={props.activityModelIndex} />;
      case 'config': return <ConfigSection selectedIndex={selectedIndex} focused={focused} editing={props.configEditing} textInput={props.configTextInput} solutions={props.solutions} />;
    }
  };

  return (
    <Panel title={title} focused={focused && !isLocked} flexGrow={1} paddingX={2}>
      {renderSection()}
    </Panel>
  );
};
