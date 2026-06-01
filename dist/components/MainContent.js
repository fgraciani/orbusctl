import { jsxs as _jsxs, jsx as _jsx, Fragment as _Fragment } from "react/jsx-runtime";
import { Box, Text } from 'ink';
import { SECTIONS_REQUIRING_AUTH } from '../types.js';
import { Panel } from './Panel.js';
import { getServer, getSolutionFilter, getShowHiddenModels, getToken, getWritePasswordHash, getWritePasswordSetAt, isWritePasswordExpired, getBrowser } from '../core/config.js';
import { getRecentWriteLog } from '../core/log.js';
import { getTypeInkColor } from '../core/domain/colors.js';
import { TIME_PERIOD_LABELS } from '../core/domain/activity.js';
// --- Virtual scroll helper ---
// Rows consumed by chrome: header(2) + footer(1) + panel borders(2) + col header(1) + guidance(1) + scroll indicators(2)
const CHROME_ROWS = 9;
const INDICATOR_RESERVE = 2;
function computeScroll(totalItems, selectedIndex, maxVisible) {
    let scrollStart = 0;
    if (totalItems > maxVisible) {
        scrollStart = Math.max(0, Math.min(selectedIndex - 2, totalItems - maxVisible));
        if (selectedIndex < scrollStart + 2)
            scrollStart = Math.max(0, selectedIndex - 2);
    }
    const scrollEnd = Math.min(totalItems, scrollStart + maxVisible);
    return { scrollStart, scrollEnd, hasMoreAbove: scrollStart > 0, hasMoreBelow: scrollEnd < totalItems };
}
const ScrollUp = ({ count }) => (_jsx(Box, { paddingLeft: 2, children: _jsxs(Text, { color: "gray", dimColor: true, children: ["\u25B2 ", count, " more above"] }) }));
const ScrollDown = ({ count, total }) => (_jsx(Box, { paddingLeft: 2, children: _jsxs(Text, { color: "gray", dimColor: true, children: ["\u25BC ", count, " more below"] }) }));
// --- Shared helpers ---
const CW = 8;
const pad = (n) => String(n).padStart(CW - 1);
function formatTimeAgo(iso) {
    const ms = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(ms / 60000);
    if (mins < 1)
        return 'now';
    if (mins < 60)
        return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24)
        return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return `${days}d ago`;
}
// ═══════════════════════════════════════════════════════════════
// MODELS SECTION (three levels: list → objects → detail)
// ═══════════════════════════════════════════════════════════════
// Compute fixed name column width to avoid Ink flexGrow overflow artifacts
// sidebar(18) + sidebarMargin(1) + cursor(2) + counts(3*CW) + panelBorders(2) + panelPadding(4) + statsPanel(0 or 25)
function nameWidth(termCols, showStats) {
    return Math.max(20, termCols - 18 - 1 - 2 - 3 * CW - 2 - 4 - (showStats ? 31 : 0));
}
const ModelList = ({ selectedIndex, focused, termRows, termCols, showStats, modelFlat, counts, loading, error, highlightModelId }) => {
    if (loading && modelFlat.length === 0)
        return _jsx(Box, { marginTop: 1, paddingLeft: 2, children: _jsx(Text, { color: "cyan", children: "Loading models..." }) });
    if (error)
        return _jsx(Box, { marginTop: 1, paddingLeft: 2, children: _jsx(Text, { color: "red", children: error }) });
    if (modelFlat.length === 0)
        return _jsx(Box, { marginTop: 1, paddingLeft: 2, children: _jsx(Text, { color: "gray", children: "No models found" }) });
    const nw = nameWidth(termCols, showStats);
    const maxVisible = Math.max(5, termRows - CHROME_ROWS - INDICATOR_RESERVE);
    const { scrollStart, scrollEnd, hasMoreAbove, hasMoreBelow } = computeScroll(modelFlat.length, selectedIndex, maxVisible);
    const visible = modelFlat.slice(scrollStart, scrollEnd);
    return (_jsxs(Box, { flexDirection: "column", marginTop: 1, children: [_jsxs(Box, { paddingLeft: 2, children: [_jsx(Box, { width: nw, children: _jsx(Text, { color: "gray", dimColor: true, children: "Name" }) }), _jsx(Box, { width: CW, children: _jsx(Text, { color: "gray", dimColor: true, children: 'Objects'.padStart(CW - 1) }) }), _jsx(Box, { width: CW, children: _jsx(Text, { color: "gray", dimColor: true, children: 'Rels'.padStart(CW - 1) }) }), _jsx(Box, { width: CW, children: _jsx(Text, { color: "gray", dimColor: true, children: 'Draws'.padStart(CW - 1) }) })] }), hasMoreAbove && _jsx(ScrollUp, { count: scrollStart }), visible.map((entry, vi) => {
                const i = scrollStart + vi;
                const c = counts.get(entry.model.ModelId);
                const selected = i === selectedIndex;
                const isHighlighted = highlightModelId === entry.model.ModelId;
                const indent = '  '.repeat(entry.depth);
                const name = `${indent}${entry.model.Name}`.slice(0, nw).padEnd(nw);
                return (_jsxs(Box, { children: [_jsx(Box, { width: 2, children: _jsx(Text, { color: selected && focused ? 'cyan' : isHighlighted ? 'yellow' : 'gray', children: selected ? '▶' : isHighlighted ? '●' : ' ' }) }), _jsx(Box, { width: nw, children: _jsx(Text, { color: selected && focused ? 'cyan' : isHighlighted ? 'yellow' : (entry.model.IsHidden ? 'gray' : undefined), dimColor: entry.model.IsHidden, children: name }) }), _jsx(Box, { width: CW, children: _jsx(Text, { color: selected && focused ? 'white' : 'gray', children: c ? pad(c.objects) : '     …' }) }), _jsx(Box, { width: CW, children: _jsx(Text, { color: selected && focused ? 'white' : 'gray', children: c ? pad(c.relationships) : '     …' }) }), _jsx(Box, { width: CW, children: _jsx(Text, { color: selected && focused ? 'white' : 'gray', children: c ? pad(c.drawings) : '     …' }) })] }, entry.model.ModelId));
            }), hasMoreBelow && _jsx(ScrollDown, { count: modelFlat.length - scrollEnd, total: modelFlat.length }), _jsx(Box, { paddingLeft: 2, marginTop: 1, children: _jsx(Text, { color: "gray", dimColor: true, children: loading ? 'Loading counts...' : '[↵] browse objects  ·  [↑↓] navigate' }) })] }));
};
// --- Object list (compact, for use inside a Panel) ---
const SYSTEM_ATTRS = new Set([
    'Name', 'Description', 'Type',
    'Created By', 'Date Created', 'Last Modified By', 'Date Last Modified',
    'Metamodel Item Id', 'Metamodel Item Name', 'iServer365 Id',
]);
const ObjectListCompact = ({ selectedIndex, focused, termRows, termCols, showStats, objects, loading, error, viewedObjectId, hasDetail, }) => {
    if (loading && objects.length === 0)
        return _jsx(Box, { marginTop: 1, paddingLeft: 2, children: _jsx(Text, { color: "cyan", children: "Loading objects..." }) });
    if (error)
        return _jsx(Box, { marginTop: 1, paddingLeft: 2, children: _jsx(Text, { color: "red", children: error }) });
    if (objects.length === 0)
        return _jsx(Box, { marginTop: 1, paddingLeft: 2, children: _jsx(Text, { color: "gray", children: "No objects in this model" }) });
    const listMaxVisible = hasDetail
        ? Math.max(4, Math.floor((termRows - CHROME_ROWS - INDICATOR_RESERVE) * 0.35))
        : Math.max(5, termRows - CHROME_ROWS - INDICATOR_RESERVE);
    const { scrollStart, scrollEnd, hasMoreAbove, hasMoreBelow: moreBelow } = computeScroll(objects.length, selectedIndex, listMaxVisible);
    const visible = objects.slice(scrollStart, scrollEnd);
    // Fixed width for name column: total - cursor(2) - type(22) - modified(10) - sidebar(18) - margins/borders/padding
    const objNameW = Math.max(20, termCols - 18 - 1 - 2 - 22 - 10 - 2 - 4 - (showStats ? 31 : 0));
    return (_jsxs(Box, { flexDirection: "column", marginTop: 1, children: [_jsxs(Box, { paddingLeft: 2, children: [_jsx(Box, { width: objNameW, children: _jsx(Text, { color: "gray", dimColor: true, children: "Name" }) }), _jsx(Box, { width: 22, children: _jsx(Text, { color: "gray", dimColor: true, children: "Type" }) }), _jsx(Box, { width: 10, children: _jsx(Text, { color: "gray", dimColor: true, children: "Modified" }) })] }), hasMoreAbove && _jsx(ScrollUp, { count: scrollStart }), visible.map((obj, vi) => {
                const i = scrollStart + vi;
                const selected = i === selectedIndex;
                const isViewed = obj.ObjectId === viewedObjectId;
                const typeColor = getTypeInkColor(obj.ObjectType.Name);
                const objName = obj.Name.slice(0, objNameW).padEnd(objNameW);
                const typeName = obj.ObjectType.Name.slice(0, 21).padEnd(21);
                return (_jsxs(Box, { children: [_jsx(Box, { width: 2, children: _jsx(Text, { color: selected && focused ? 'cyan' : isViewed ? 'yellow' : 'gray', children: selected ? '▶' : isViewed ? '●' : ' ' }) }), _jsx(Box, { width: objNameW, children: _jsx(Text, { color: selected && focused ? 'cyan' : undefined, bold: isViewed, children: objName }) }), _jsx(Box, { width: 22, children: _jsx(Text, { color: typeColor, children: typeName }) }), _jsx(Box, { width: 10, children: _jsx(Text, { color: "gray", children: formatTimeAgo(obj.LastModifiedDate).padEnd(9) }) })] }, obj.ObjectId));
            }), moreBelow && _jsx(ScrollDown, { count: objects.length - scrollEnd, total: objects.length }), !hasDetail && _jsx(Box, { paddingLeft: 2, marginTop: 1, children: _jsx(Text, { color: "gray", dimColor: true, children: "[\u21B5] view detail  \u00B7  [\u2190/Esc] back  \u00B7  [\u2191\u2193] navigate" }) })] }));
};
const ObjectDetailPane = ({ detail, relationships, termRows, detailFocused, relIndex }) => {
    const desc = detail.AttributeValues.find(a => a.AttributeName === 'Description')?.StringValue;
    const customAttrs = detail.AttributeValues.filter(a => !SYSTEM_ATTRS.has(a.AttributeName) && a.StringValue);
    const typeColor = getTypeInkColor(detail.ObjectType.Name);
    return (_jsxs(Box, { flexDirection: "column", paddingLeft: 1, marginTop: 1, children: [_jsxs(Box, { children: [_jsx(Text, { color: typeColor, children: detail.ObjectType.Name }), _jsxs(Text, { color: "gray", children: ["  \u00B7  v", detail.Detail.CurrentVersionNumber, "  \u00B7  ", detail.Detail.Status] })] }), desc && _jsx(Text, { children: desc }), _jsx(Box, { marginTop: 1, children: _jsxs(Text, { color: "gray", children: ["Created ", formatTimeAgo(detail.DateCreated), " by ", detail.CreatedBy.Name, "  \u00B7  Modified ", formatTimeAgo(detail.LastModifiedDate), " by ", detail.LastModifiedBy.Name, detail.LockedBy ? `  ·  LOCKED by ${detail.LockedBy.Name}` : ''] }) }), customAttrs.length > 0 && (_jsxs(Box, { flexDirection: "column", marginTop: 1, children: [_jsxs(Text, { bold: true, color: "yellow", children: ["Attributes (", customAttrs.length, ")"] }), customAttrs.map(a => (_jsxs(Text, { color: "gray", wrap: "truncate", children: ["  ", a.AttributeName, ": ", a.StringValue] }, a.AttributeName)))] })), _jsx(Box, { marginTop: 1, children: _jsx(Text, { color: "gray", dimColor: true, children: "[o] open in Orbus" }) }), relationships.length > 0 && (_jsxs(Box, { flexDirection: "column", marginTop: 1, children: [_jsxs(Text, { bold: true, color: "yellow", children: ["Relationships (", relationships.length, ")", detailFocused ? '' : '  [↵] to navigate'] }), relationships.map((r, i) => {
                        const selected = detailFocused && i === relIndex;
                        return (_jsxs(Box, { children: [_jsxs(Text, { color: selected ? 'cyan' : 'gray', children: [selected ? '▶ ' : '  ', r.DirectionDescription, " "] }), _jsx(Text, { color: selected ? 'cyan' : undefined, wrap: "truncate", children: r.RelatedItem.Name }), _jsxs(Text, { color: "gray", dimColor: true, children: [" (", r.Relationship.RelationshipType.Name.replace('ArchiMate: ', ''), ")"] })] }, i));
                    })] }))] }));
};
const DrawingsList = ({ selectedIndex, focused, termRows, modelName, drawings, typeMap, loading, error }) => {
    if (loading)
        return _jsx(Box, { marginTop: 1, paddingLeft: 2, children: _jsxs(Text, { color: "cyan", children: ["Loading drawings in ", modelName, "..."] }) });
    if (error)
        return _jsx(Box, { marginTop: 1, paddingLeft: 2, children: _jsx(Text, { color: "red", children: error }) });
    if (drawings.length === 0)
        return _jsx(Box, { marginTop: 1, paddingLeft: 2, children: _jsx(Text, { color: "gray", children: "No drawings in this model" }) });
    const maxDrawingsVisible = Math.max(5, termRows - CHROME_ROWS - INDICATOR_RESERVE);
    const { scrollStart, scrollEnd, hasMoreAbove, hasMoreBelow } = computeScroll(drawings.length, selectedIndex, maxDrawingsVisible);
    const visible = drawings.slice(scrollStart, scrollEnd);
    return (_jsxs(Box, { flexDirection: "column", marginTop: 1, children: [_jsxs(Box, { paddingLeft: 2, children: [_jsx(Box, { flexGrow: 1, children: _jsx(Text, { color: "gray", dimColor: true, children: "Name" }) }), _jsx(Box, { width: 28, children: _jsx(Text, { color: "gray", dimColor: true, children: "Type" }) })] }), hasMoreAbove && _jsx(ScrollUp, { count: scrollStart }), visible.map((d, vi) => {
                const i = scrollStart + vi;
                const selected = i === selectedIndex;
                return (_jsxs(Box, { children: [_jsx(Box, { width: 2, children: _jsx(Text, { color: selected && focused ? 'cyan' : 'gray', children: selected ? '▶' : ' ' }) }), _jsx(Box, { flexGrow: 1, children: _jsx(Text, { color: selected && focused ? 'cyan' : undefined, wrap: "truncate", children: d.FileName }) }), _jsx(Box, { width: 28, children: _jsx(Text, { color: "gray", wrap: "truncate", children: typeMap.get(d.DocumentTypeId) ?? 'Unknown' }) })] }, d.DocumentId));
            }), hasMoreBelow && _jsx(ScrollDown, { count: drawings.length - scrollEnd, total: drawings.length }), _jsx(Box, { paddingLeft: 2, marginTop: 1, children: _jsx(Text, { color: "gray", dimColor: true, children: "[\u21B5] view components  \u00B7  [\u2190/Esc] back  \u00B7  [\u2191\u2193] navigate" }) })] }));
};
const DrawingComponentList = ({ selectedIndex, focused, termRows, components, loading, error, hasDetail, viewedDrawingObjectId }) => {
    if (loading)
        return _jsx(Box, { marginTop: 1, paddingLeft: 2, children: _jsx(Text, { color: "cyan", children: "Loading components..." }) });
    if (error)
        return _jsx(Box, { marginTop: 1, paddingLeft: 2, children: _jsx(Text, { color: "red", children: error }) });
    if (components.length === 0)
        return _jsx(Box, { marginTop: 1, paddingLeft: 2, children: _jsx(Text, { color: "gray", children: "No components in this drawing" }) });
    const maxVisible = hasDetail
        ? Math.max(4, Math.floor((termRows - CHROME_ROWS - INDICATOR_RESERVE) * 0.35))
        : Math.max(5, termRows - CHROME_ROWS - INDICATOR_RESERVE);
    const { scrollStart, scrollEnd, hasMoreAbove, hasMoreBelow } = computeScroll(components.length, selectedIndex, maxVisible);
    const visible = components.slice(scrollStart, scrollEnd);
    const objects = components.filter(c => !c.isRelationship);
    const rels = components.filter(c => c.isRelationship);
    return (_jsxs(Box, { flexDirection: "column", marginTop: 1, children: [_jsx(Box, { paddingLeft: 2, children: _jsxs(Text, { color: "gray", dimColor: true, children: [objects.length, " objects, ", rels.length, " relationships"] }) }), hasMoreAbove && _jsx(ScrollUp, { count: scrollStart }), visible.map((c, vi) => {
                const i = scrollStart + vi;
                const selected = i === selectedIndex;
                const isViewed = !c.isRelationship && viewedDrawingObjectId !== null && c.objectId === viewedDrawingObjectId;
                const typeColor = c.isRelationship ? 'gray' : getTypeInkColor(c.typeName);
                return (_jsxs(Box, { children: [_jsx(Box, { width: 2, children: _jsx(Text, { color: selected && focused ? 'cyan' : isViewed ? 'yellow' : 'gray', children: selected ? '▶' : isViewed ? '●' : ' ' }) }), _jsx(Box, { width: 3, children: _jsx(Text, { color: c.isRelationship ? 'gray' : typeColor, dimColor: c.isRelationship, children: c.isRelationship ? ' ↔' : '  ' }) }), _jsx(Box, { flexGrow: 1, children: _jsx(Text, { color: selected && focused ? 'cyan' : c.isRelationship ? 'gray' : undefined, bold: isViewed, wrap: "truncate", children: c.name }) }), _jsx(Box, { width: 22, children: _jsx(Text, { color: typeColor, dimColor: c.isRelationship, wrap: "truncate", children: c.typeName }) })] }, i));
            }), hasMoreBelow && _jsx(ScrollDown, { count: components.length - scrollEnd, total: components.length }), !hasDetail && _jsx(Box, { paddingLeft: 2, marginTop: 1, children: _jsx(Text, { color: "gray", dimColor: true, children: "[\u21B5] view detail  \u00B7  [o] open in Draw  \u00B7  [\u2190/Esc] back to drawings  \u00B7  [\u2191\u2193] navigate" }) })] }));
};
// ═══════════════════════════════════════════════════════════════
// PLACEHOLDER SECTIONS (wired in later iterations)
// ═══════════════════════════════════════════════════════════════
// --- Audit section ---
const ISSUE_LABELS = {
    'empty-description': 'Empty description',
    'html-in-name': 'HTML in name',
    'html-in-description': 'HTML in description',
    'no-relationships': 'No relationships',
    'not-in-diagram': 'Not in any diagram',
};
const ISSUE_COLORS = {
    'empty-description': 'yellow',
    'html-in-name': 'red',
    'html-in-description': 'red',
    'no-relationships': 'yellow',
    'not-in-diagram': 'yellow',
};
const AuditSection = ({ selectedIndex, focused, termRows, termCols, showStats, audit, auditExport, issueFilter, mode, selectedModelIds, modelFlat, modelCounts, modelsLoading, modelsError, hasDetail, viewedAuditObjectId }) => {
    // Export overlay
    if (auditExport.exporting) {
        const p = auditExport.progress;
        return (_jsxs(Box, { flexDirection: "column", marginTop: 1, paddingLeft: 2, children: [_jsx(Text, { color: "cyan", children: "Exporting audit results..." }), p && _jsxs(Text, { color: "gray", children: [p.phase, p.current && p.total ? ` (${p.current}/${p.total})` : ''] })] }));
    }
    if (auditExport.result) {
        const r = auditExport.result;
        return (_jsxs(Box, { flexDirection: "column", marginTop: 1, paddingLeft: 2, children: [_jsx(Text, { color: "green", children: "Export complete!" }), _jsxs(Box, { marginTop: 1, flexDirection: "column", children: [_jsxs(Text, { color: "gray", children: ["Models:  ", _jsx(Text, { color: "white", children: r.modelCount })] }), _jsxs(Text, { color: "gray", children: ["Issues:  ", _jsx(Text, { color: "white", children: r.issueCount })] })] }), _jsx(Box, { marginTop: 1, children: _jsxs(Text, { color: "gray", children: ["Saved to: ", _jsx(Text, { color: "white", children: r.filePath })] }) }), _jsx(Box, { marginTop: 1, children: _jsx(Text, { color: "gray", dimColor: true, children: "[o] open  \u00B7  [\u2190/Esc] back" }) })] }));
    }
    if (auditExport.error) {
        return (_jsxs(Box, { flexDirection: "column", marginTop: 1, paddingLeft: 2, children: [_jsx(Text, { color: "red", children: auditExport.error }), _jsx(Box, { marginTop: 1, children: _jsx(Text, { color: "gray", dimColor: true, children: "[\u2190/Esc] back" }) })] }));
    }
    // Menu: choose single or all
    if (mode === 'menu') {
        const options = ['Audit single model', 'Audit all models', 'Audit selected models'];
        return (_jsxs(Box, { flexDirection: "column", marginTop: 1, children: [options.map((o, i) => {
                    const selected = i === selectedIndex;
                    return (_jsxs(Box, { children: [_jsx(Box, { width: 2, children: _jsx(Text, { color: selected && focused ? 'cyan' : 'gray', children: selected ? '▶' : ' ' }) }), _jsx(Text, { color: selected && focused ? 'cyan' : undefined, children: o })] }, i));
                }), _jsx(Box, { paddingLeft: 2, marginTop: 1, children: _jsx(Text, { color: "gray", dimColor: true, children: "[\u21B5] select  \u00B7  [\u2191\u2193] navigate" }) })] }));
    }
    // Multi-select model list
    if (mode === 'select-models') {
        if (modelsLoading && modelFlat.length === 0)
            return _jsx(Box, { marginTop: 1, paddingLeft: 2, children: _jsx(Text, { color: "cyan", children: "Loading models..." }) });
        if (modelsError)
            return _jsx(Box, { marginTop: 1, paddingLeft: 2, children: _jsx(Text, { color: "red", children: modelsError }) });
        if (modelFlat.length === 0)
            return _jsx(Box, { marginTop: 1, paddingLeft: 2, children: _jsx(Text, { color: "gray", children: "No models found" }) });
        const nw = nameWidth(termCols, showStats);
        const extraRows = 3; // status + col header + guidance
        const maxVisible = Math.max(5, termRows - CHROME_ROWS - INDICATOR_RESERVE - extraRows);
        const { scrollStart, scrollEnd, hasMoreAbove, hasMoreBelow } = computeScroll(modelFlat.length, selectedIndex, maxVisible);
        const visible = modelFlat.slice(scrollStart, scrollEnd);
        const selCount = selectedModelIds.size;
        const statusText = selCount === 0 ? 'Select at least one model' : `${selCount} model${selCount !== 1 ? 's' : ''} selected`;
        return (_jsxs(Box, { flexDirection: "column", marginTop: 1, children: [_jsx(Box, { paddingLeft: 2, marginBottom: 1, children: _jsx(Text, { color: selCount === 0 ? 'yellow' : 'green', children: statusText }) }), _jsxs(Box, { paddingLeft: 2, children: [_jsx(Box, { width: nw, children: _jsx(Text, { color: "gray", dimColor: true, children: "Name" }) }), _jsx(Box, { width: 8, children: _jsx(Text, { color: "gray", dimColor: true, children: 'Objects'.padStart(7) }) }), _jsx(Box, { width: 8, children: _jsx(Text, { color: "gray", dimColor: true, children: 'Rels'.padStart(7) }) }), _jsx(Box, { width: 8, children: _jsx(Text, { color: "gray", dimColor: true, children: 'Draws'.padStart(7) }) })] }), hasMoreAbove && _jsx(ScrollUp, { count: scrollStart }), visible.map((entry, vi) => {
                    const i = scrollStart + vi;
                    const selected = i === selectedIndex;
                    const modelId = entry.model.ModelId;
                    const toggled = selectedModelIds.has(modelId);
                    const counts = modelCounts.get(modelId);
                    const indent = '  '.repeat(entry.depth);
                    const nameText = indent + entry.model.Name;
                    const cursor = selected && focused ? '▶' : ' ';
                    const toggle = toggled ? '●' : ' ';
                    return (_jsxs(Box, { paddingLeft: 2, children: [_jsx(Box, { width: 2, children: _jsx(Text, { color: selected && focused ? 'cyan' : 'gray', children: cursor }) }), _jsx(Box, { width: 2, children: _jsx(Text, { color: toggled ? 'green' : 'gray', children: toggle }) }), _jsx(Box, { width: nw - 2, children: _jsx(Text, { color: toggled ? 'white' : undefined, bold: toggled, wrap: "truncate", children: nameText }) }), _jsx(Box, { width: 8, children: _jsx(Text, { color: toggled ? 'white' : undefined, bold: toggled, children: pad(counts?.objects ?? 0) }) }), _jsx(Box, { width: 8, children: _jsx(Text, { color: toggled ? 'white' : undefined, bold: toggled, children: pad(counts?.relationships ?? 0) }) }), _jsx(Box, { width: 8, children: _jsx(Text, { color: toggled ? 'white' : undefined, bold: toggled, children: pad(counts?.drawings ?? 0) }) })] }, entry.model.ModelId));
                }), hasMoreBelow && _jsx(ScrollDown, { count: modelFlat.length - scrollEnd, total: modelFlat.length }), _jsx(Box, { paddingLeft: 2, marginTop: 1, children: _jsx(Text, { color: "gray", dimColor: true, children: "[Space] toggle  \u00B7  [Enter] start audit  \u00B7  [Esc] back" }) })] }));
    }
    // Scanning single
    if (audit.auditing) {
        const p = audit.progress;
        return (_jsxs(Box, { flexDirection: "column", marginTop: 1, paddingLeft: 2, children: [_jsx(Text, { color: "cyan", children: "Auditing model..." }), p && _jsxs(Text, { color: "gray", children: [p.phase, p.current && p.total ? ` (${p.current}/${p.total})` : ''] })] }));
    }
    if (audit.error) {
        return _jsx(Box, { marginTop: 1, paddingLeft: 2, children: _jsx(Text, { color: "red", children: audit.error }) });
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
        return (_jsxs(Box, { flexDirection: "column", marginTop: 1, children: [audit.scanningAll && sp && (_jsx(Box, { paddingLeft: 2, flexDirection: "column", children: _jsxs(Text, { color: "cyan", wrap: "truncate", children: ["Model ", sp.current, "/", sp.total, ": ", _jsx(Text, { color: "white", children: sp.modelName }), mp ? `  —  ${mp.phase}${mp.current && mp.total ? ` (${mp.current}/${mp.total})` : ''}` : ''] }) })), !audit.scanningAll && audit.modelResults.size > 0 && (_jsx(Box, { paddingLeft: 2, children: _jsxs(Text, { color: "green", children: ["Audit complete \u2014 ", audit.modelResults.size, " model", audit.modelResults.size !== 1 ? 's' : '', " scanned"] }) })), _jsxs(Box, { paddingLeft: 2, children: [_jsx(Box, { width: nw, children: _jsx(Text, { color: "gray", dimColor: true, children: "Name" }) }), _jsx(Box, { width: 8, children: _jsx(Text, { color: "gray", dimColor: true, children: 'Issues'.padStart(7) }) }), _jsx(Box, { width: 8, children: _jsx(Text, { color: "gray", dimColor: true, children: 'NoDesc'.padStart(7) }) }), _jsx(Box, { width: 8, children: _jsx(Text, { color: "gray", dimColor: true, children: 'NoRel'.padStart(7) }) }), _jsx(Box, { width: 8, children: _jsx(Text, { color: "gray", dimColor: true, children: 'NoDiag'.padStart(7) }) }), _jsx(Box, { width: 8, children: _jsx(Text, { color: "gray", dimColor: true, children: 'HTML'.padStart(7) }) })] }), hasMoreAbove && _jsx(ScrollUp, { count: scrollStart }), visible.map((entry, vi) => {
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
                    return (_jsxs(Box, { children: [_jsx(Box, { width: 2, children: _jsx(Text, { color: selected && focused ? 'cyan' : 'gray', children: selected ? '▶' : ' ' }) }), _jsx(Box, { width: nw, children: _jsx(Text, { color: selected && focused ? 'cyan' : undefined, children: name }) }), _jsx(Box, { width: 8, children: _jsx(Text, { color: issues > 0 ? 'yellow' : issues === 0 ? 'green' : 'gray', children: (issues >= 0 ? String(issues).padStart(7) : '      …').padEnd(8) }) }), _jsx(Box, { width: 8, children: _jsx(Text, { color: noDesc > 0 ? 'yellow' : 'gray', children: (r ? String(noDesc).padStart(7) : '      …').padEnd(8) }) }), _jsx(Box, { width: 8, children: _jsx(Text, { color: noRel > 0 ? 'yellow' : 'gray', children: (r ? String(noRel).padStart(7) : '      …').padEnd(8) }) }), _jsx(Box, { width: 8, children: _jsx(Text, { color: noDiag > 0 ? 'yellow' : 'gray', children: (r ? String(noDiag).padStart(7) : '      …').padEnd(8) }) }), _jsx(Box, { width: 8, children: _jsx(Text, { color: html > 0 ? 'red' : 'gray', children: (r ? String(html).padStart(7) : '      …').padEnd(8) }) })] }, entry.model.ModelId));
                }), hasMoreBelow && _jsx(ScrollDown, { count: modelFlat.length - scrollEnd, total: modelFlat.length }), _jsx(Box, { paddingLeft: 2, marginTop: 1, children: _jsx(Text, { color: "gray", dimColor: true, children: "[\u21B5] view model detail  \u00B7  [e] export  \u00B7  [\u2190/Esc] back  \u00B7  [\u2191\u2193] navigate" }) })] }));
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
        return (_jsxs(Box, { flexDirection: "column", marginTop: 1, children: [_jsxs(Box, { paddingLeft: 2, children: [_jsx(Text, { color: ISSUE_COLORS[issueFilter] ?? 'yellow', children: ISSUE_LABELS[issueFilter] ?? issueFilter }), _jsxs(Text, { color: "gray", children: [" \u2014 ", filtered.length, " issue", filtered.length !== 1 ? 's' : ''] })] }), _jsxs(Box, { marginTop: 1, flexDirection: "column", children: [hasMoreAbove && _jsx(ScrollUp, { count: scrollStart }), visible.map((issue, vi) => {
                            const i = scrollStart + vi;
                            const selected = i === selectedIndex;
                            const isViewed = issue.objectId === viewedAuditObjectId;
                            const name = issue.objectName.slice(0, nameW).padEnd(nameW);
                            return (_jsxs(Box, { children: [_jsx(Box, { width: 2, children: _jsx(Text, { color: selected && focused ? 'cyan' : isViewed ? 'yellow' : 'gray', children: selected ? '▶' : isViewed ? '●' : ' ' }) }), _jsx(Box, { width: nameW, children: _jsx(Text, { color: selected && focused ? 'cyan' : undefined, bold: isViewed, children: name }) }), _jsx(Box, { width: 20, children: _jsx(Text, { color: getTypeInkColor(issue.objectType), wrap: "truncate", children: issue.objectType }) }), _jsx(Box, { width: 22, children: _jsx(Text, { color: "gray", wrap: "truncate", children: issue.lastModifiedBy }) }), _jsx(Box, { width: 12, children: _jsx(Text, { color: "gray", dimColor: true, children: fmtDateTime(issue.lastModifiedDate) }) })] }, i));
                        }), hasMoreBelow && _jsx(ScrollDown, { count: filtered.length - scrollEnd, total: filtered.length })] }), _jsx(Box, { paddingLeft: 2, marginTop: 1, children: _jsx(Text, { color: "gray", dimColor: true, children: "[\u21B5] view detail  \u00B7  [\u2190/Esc] back to summary  \u00B7  [\u2191\u2193] navigate" }) })] }));
    }
    // Results: summary
    if (audit.result) {
        const r = audit.result;
        const types = Object.keys(r.issuesByType);
        return (_jsxs(Box, { flexDirection: "column", marginTop: 1, children: [_jsxs(Box, { paddingLeft: 2, flexDirection: "column", children: [_jsxs(Text, { color: "gray", children: ["Last modified by ", _jsx(Text, { color: "white", children: r.lastModifiedBy }), " on ", _jsx(Text, { color: "white", children: fmtDateTime(r.lastModifiedDate) })] }), _jsxs(Text, { color: "gray", children: [r.totalObjects, " objects  \u00B7  ", r.totalRelationships, " relationships  \u00B7  ", r.totalDrawings, " drawings"] }), _jsx(Box, { marginTop: 1, children: r.totalIssues === 0
                                ? _jsx(Text, { color: "green", children: "No issues found!" })
                                : _jsxs(Text, { color: "yellow", children: [r.totalIssues, " issue", r.totalIssues !== 1 ? 's' : '', " found"] }) })] }), types.length > 0 && (_jsx(Box, { marginTop: 1, flexDirection: "column", children: types.map((t, i) => {
                        const selected = i === selectedIndex;
                        return (_jsxs(Box, { children: [_jsx(Box, { width: 2, children: _jsx(Text, { color: selected && focused ? 'cyan' : 'gray', children: selected ? '▶' : ' ' }) }), _jsx(Box, { width: 30, children: _jsx(Text, { color: selected && focused ? 'cyan' : ISSUE_COLORS[t] ?? 'yellow', children: ISSUE_LABELS[t] ?? t }) }), _jsx(Text, { color: "white", children: r.issuesByType[t] })] }, t));
                    }) })), _jsx(Box, { paddingLeft: 2, marginTop: 1, children: _jsxs(Text, { color: "gray", dimColor: true, children: [types.length > 0 ? '[↵] view issues  ·  ' : '', "[e] export  \u00B7  [\u2190/Esc] back  \u00B7  [\u2191\u2193] navigate"] }) })] }));
    }
    // Model selector
    return _jsx(ModelList, { selectedIndex: selectedIndex, focused: focused, termRows: termRows, termCols: termCols, showStats: showStats, modelFlat: modelFlat, counts: modelCounts, loading: modelsLoading, error: modelsError });
};
const CompareSection = ({ selectedIndex, focused, termRows, termCols, showStats, compare, modelAId, modelAName, modelBName, modelBId, modelFlat, modelCounts, modelsLoading, modelsError }) => {
    // Results: side-by-side diff
    if (modelBId && compare.rows.length > 0) {
        const halfW = Math.floor((termCols - 18 - 1 - (showStats ? 31 : 0) - 6) / 2);
        const maxVisible = Math.max(5, termRows - CHROME_ROWS - INDICATOR_RESERVE - 4);
        const { scrollStart, scrollEnd, hasMoreAbove, hasMoreBelow } = computeScroll(compare.rows.length, selectedIndex, maxVisible);
        const visible = compare.rows.slice(scrollStart, scrollEnd);
        return (_jsxs(Box, { flexDirection: "column", marginTop: 1, children: [_jsx(Box, { paddingLeft: 2, children: _jsxs(Text, { color: "gray", children: [_jsxs(Text, { color: "green", children: ["+", compare.leftOnlyCount] }), " only in A  \u00B7  ", _jsxs(Text, { color: "green", children: ["+", compare.rightOnlyCount] }), " only in B  \u00B7  ", compare.bothCount, " in both"] }) }), _jsxs(Box, { paddingLeft: 2, children: [_jsx(Box, { width: halfW, children: _jsx(Text, { bold: true, color: "gray", children: modelAName }) }), _jsx(Box, { width: 3, children: _jsx(Text, { color: "gray", children: " \u2502 " }) }), _jsx(Box, { width: halfW, children: _jsx(Text, { bold: true, color: "gray", children: modelBName }) })] }), hasMoreAbove && _jsx(ScrollUp, { count: scrollStart }), visible.map((row, vi) => {
                    const i = scrollStart + vi;
                    const selected = i === selectedIndex;
                    const leftName = row.left ? row.left.Name.slice(0, halfW - 2).padEnd(halfW - 2) : ' '.repeat(halfW - 2);
                    const rightName = row.right ? row.right.Name.slice(0, halfW - 2).padEnd(halfW - 2) : ' '.repeat(halfW - 2);
                    const leftColor = row.match === 'left-only' ? 'green' : row.match === 'right-only' ? undefined : undefined;
                    const rightColor = row.match === 'right-only' ? 'green' : row.match === 'left-only' ? undefined : undefined;
                    const leftDim = row.match === 'right-only';
                    const rightDim = row.match === 'left-only';
                    return (_jsxs(Box, { children: [_jsx(Box, { width: 2, children: _jsx(Text, { color: selected && focused ? 'cyan' : 'gray', children: selected ? '▶' : ' ' }) }), _jsx(Box, { width: halfW, children: _jsx(Text, { color: selected && focused ? 'cyan' : leftColor, dimColor: leftDim, children: leftName }) }), _jsx(Box, { width: 3, children: _jsx(Text, { color: "gray", children: " \u2502 " }) }), _jsx(Box, { width: halfW, children: _jsx(Text, { color: selected && focused ? 'cyan' : rightColor, dimColor: rightDim, children: rightName }) })] }, i));
                }), hasMoreBelow && _jsx(ScrollDown, { count: compare.rows.length - scrollEnd, total: compare.rows.length }), _jsx(Box, { paddingLeft: 2, marginTop: 1, children: _jsx(Text, { color: "gray", dimColor: true, children: "[\u2190/Esc] select different model  \u00B7  [\u2191\u2193] navigate" }) })] }));
    }
    // Loading
    if (modelBId && compare.loading) {
        return _jsx(Box, { marginTop: 1, paddingLeft: 2, children: _jsx(Text, { color: "cyan", children: "Comparing models..." }) });
    }
    if (modelBId && compare.error) {
        return _jsx(Box, { marginTop: 1, paddingLeft: 2, children: _jsx(Text, { color: "red", children: compare.error }) });
    }
    // Model selector — highlight Model A when selecting B
    return _jsx(ModelList, { selectedIndex: selectedIndex, focused: focused, termRows: termRows, termCols: termCols, showStats: showStats, modelFlat: modelFlat, counts: modelCounts, loading: modelsLoading, error: modelsError, highlightModelId: modelAId });
};
const fmtDate = (d) => d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
const fmtDateTime = (s) => {
    const d = new Date(s);
    return `${d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })} ${d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`;
};
const ActivitySection = ({ selectedIndex, focused, termRows, termCols, showStats, activity, activityExport, periods, modelIndex }) => {
    // Export overlay
    if (activityExport.exporting) {
        const p = activityExport.progress;
        return (_jsxs(Box, { flexDirection: "column", marginTop: 1, paddingLeft: 2, children: [_jsx(Text, { color: "cyan", children: "Exporting activity report..." }), p && _jsxs(Text, { color: "gray", children: [p.phase, p.current && p.total ? ` (${p.current}/${p.total})` : ''] })] }));
    }
    if (activityExport.result) {
        const r = activityExport.result;
        return (_jsxs(Box, { flexDirection: "column", marginTop: 1, paddingLeft: 2, children: [_jsx(Text, { color: "green", children: "Export complete!" }), _jsxs(Box, { marginTop: 1, flexDirection: "column", children: [_jsxs(Text, { color: "gray", children: ["Models:  ", _jsx(Text, { color: "white", children: r.modelCount })] }), _jsxs(Text, { color: "gray", children: ["Entries: ", _jsx(Text, { color: "white", children: r.entryCount })] })] }), _jsx(Box, { marginTop: 1, children: _jsxs(Text, { color: "gray", children: ["Saved to: ", _jsx(Text, { color: "white", children: r.filePath })] }) }), _jsx(Box, { marginTop: 1, children: _jsx(Text, { color: "gray", dimColor: true, children: "[o] open  \u00B7  [\u2190/Esc] back" }) })] }));
    }
    if (activityExport.error) {
        return (_jsxs(Box, { flexDirection: "column", marginTop: 1, paddingLeft: 2, children: [_jsx(Text, { color: "red", children: activityExport.error }), _jsx(Box, { marginTop: 1, children: _jsx(Text, { color: "gray", dimColor: true, children: "[\u2190/Esc] back" }) })] }));
    }
    // State 1: Period selector
    if (!activity.scanning && !activity.report) {
        return (_jsxs(Box, { flexDirection: "column", marginTop: 1, children: [_jsx(Text, { color: "gray", dimColor: true, children: "Select a time period to scan for activity across all models:" }), _jsx(Box, { marginTop: 1, flexDirection: "column", children: periods.map((p, i) => {
                        const selected = i === selectedIndex;
                        return (_jsxs(Box, { children: [_jsx(Box, { width: 2, children: _jsx(Text, { color: selected && focused ? 'cyan' : 'gray', children: selected ? '▶' : ' ' }) }), _jsx(Text, { color: selected && focused ? 'cyan' : undefined, children: TIME_PERIOD_LABELS[p] })] }, p));
                    }) }), _jsx(Box, { paddingLeft: 2, marginTop: 1, children: _jsx(Text, { color: "gray", dimColor: true, children: "[\u21B5] start scan  \u00B7  [\u2191\u2193] navigate" }) })] }));
    }
    // State 2: Scanning
    if (activity.scanning) {
        const p = activity.progress;
        return (_jsxs(Box, { flexDirection: "column", marginTop: 1, paddingLeft: 2, children: [_jsx(Text, { color: "cyan", children: "Scanning models for activity..." }), p && (_jsxs(_Fragment, { children: [_jsxs(Text, { color: "gray", children: ["Model ", p.current, " of ", p.total, ": ", p.modelName] }), p.objectsFound > 0 && _jsxs(Text, { color: "gray", dimColor: true, children: ["  ", p.objectsFound, " objects, ", p.relsFound, " relationships"] })] })), _jsx(Box, { marginTop: 1, children: _jsx(Text, { color: "gray", dimColor: true, children: "[Esc] cancel" }) })] }));
    }
    // State 3: Results
    if (activity.error) {
        return _jsx(Box, { marginTop: 1, paddingLeft: 2, children: _jsx(Text, { color: "red", children: activity.error }) });
    }
    const r = activity.report;
    // State 3b: Model detail
    if (modelIndex !== null && r.models[modelIndex]) {
        const m = r.models[modelIndex];
        const entries = [];
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
        return (_jsxs(Box, { flexDirection: "column", marginTop: 1, children: [_jsx(Box, { paddingLeft: 2, children: _jsxs(Text, { color: "gray", children: [m.totalObjects, " objects, ", m.totalRels, " relationships  \u00B7  ", m.users.length, " user", m.users.length !== 1 ? 's' : ''] }) }), _jsxs(Box, { marginTop: 1, flexDirection: "column", children: [hasMoreAbove && _jsx(ScrollUp, { count: scrollStart }), visible.map((e, vi) => {
                            const i = scrollStart + vi;
                            const selected = i === selectedIndex;
                            const actionColor = e.action === 'Created' ? 'green' : 'yellow';
                            const typeColor = e.typeName === 'Relationship' ? 'gray' : getTypeInkColor(e.typeName);
                            const name = e.name.slice(0, nameW).padEnd(nameW);
                            return (_jsxs(Box, { children: [_jsx(Box, { width: 2, children: _jsx(Text, { color: selected && focused ? 'cyan' : 'gray', children: selected ? '▶' : ' ' }) }), _jsx(Box, { width: actionW, children: _jsx(Text, { color: actionColor, children: e.action }) }), _jsx(Box, { width: nameW, children: _jsx(Text, { color: selected && focused ? 'cyan' : undefined, children: name }) }), _jsx(Box, { width: typeW, children: _jsx(Text, { color: typeColor, dimColor: e.typeName === 'Relationship', children: e.typeName.slice(0, typeW - 1) }) }), _jsx(Box, { width: userW, children: _jsx(Text, { color: "gray", children: e.user.slice(0, userW - 1) }) }), _jsx(Box, { width: dateW, children: _jsx(Text, { color: "gray", dimColor: true, children: fmtDateTime(e.date) }) })] }, i));
                        }), hasMoreBelow && _jsx(ScrollDown, { count: entries.length - scrollEnd, total: entries.length })] }), _jsx(Box, { paddingLeft: 2, marginTop: 1, children: _jsx(Text, { color: "gray", dimColor: true, children: "[e] export  \u00B7  [\u2190/Esc] back to models  \u00B7  [\u2191\u2193] navigate" }) })] }));
    }
    // State 3a: Model list
    const maxVisible = Math.max(5, termRows - CHROME_ROWS - INDICATOR_RESERVE - 6);
    const { scrollStart, scrollEnd, hasMoreAbove, hasMoreBelow } = computeScroll(r.models.length, selectedIndex, maxVisible);
    const visible = r.models.slice(scrollStart, scrollEnd);
    return (_jsxs(Box, { flexDirection: "column", marginTop: 1, children: [_jsxs(Box, { paddingLeft: 2, flexDirection: "column", children: [_jsxs(Text, { color: "gray", children: [r.label, "  \u00B7  ", fmtDate(r.since), " \u2013 ", fmtDate(r.until)] }), _jsxs(Text, { color: "gray", children: [_jsxs(Text, { color: "green", children: ["+", r.totalCreated, " created"] }), "  ", _jsxs(Text, { color: "yellow", children: [r.totalModified, " modified"] }), "  ", _jsxs(Text, { color: "gray", children: [r.totalRels, " relationships"] }), "  \u00B7  ", r.models.length, " active model", r.models.length !== 1 ? 's' : ''] })] }), _jsxs(Box, { marginTop: 1, flexDirection: "column", children: [hasMoreAbove && _jsx(ScrollUp, { count: scrollStart }), visible.map((m, vi) => {
                        const i = scrollStart + vi;
                        const selected = i === selectedIndex;
                        return (_jsxs(Box, { children: [_jsx(Box, { width: 2, children: _jsx(Text, { color: selected && focused ? 'cyan' : 'gray', children: selected ? '▶' : ' ' }) }), _jsx(Box, { flexGrow: 1, children: _jsx(Text, { color: selected && focused ? 'cyan' : undefined, wrap: "truncate", children: m.modelName }) }), _jsx(Box, { width: 20, children: _jsxs(Text, { color: "gray", children: [m.totalObjects, " obj, ", m.totalRels, " rel"] }) }), _jsx(Box, { width: 12, children: _jsxs(Text, { color: "gray", children: [m.users.length, " user", m.users.length !== 1 ? 's' : ''] }) })] }, m.modelId));
                    }), hasMoreBelow && _jsx(ScrollDown, { count: r.models.length - scrollEnd, total: r.models.length })] }), _jsx(Box, { paddingLeft: 2, marginTop: 1, children: _jsx(Text, { color: "gray", dimColor: true, children: "[\u21B5] view detail  \u00B7  [e] export  \u00B7  [\u2190/Esc] back to periods  \u00B7  [\u2191\u2193] navigate" }) })] }));
};
const ExportSection = ({ selectedIndex, focused, exportHook, exportModelId, formats, modelFlat, modelCounts, modelsLoading, modelsError, termRows, termCols, showStats, templateExport, exportTemplatePicking, exportTemplates, exportTemplate, exportTemplateVars, exportVarIndex, exportVarInput, exportVarOptions, exportVarLoading }) => {
    // Template export in progress
    if (templateExport.exporting) {
        const p = templateExport.progress;
        return (_jsxs(Box, { flexDirection: "column", marginTop: 1, paddingLeft: 2, children: [_jsx(Text, { color: "cyan", children: "Generating template..." }), p && _jsxs(Text, { color: "gray", children: [p.phase, p.current && p.total ? ` (${p.current}/${p.total})` : ''] })] }));
    }
    // Template export complete
    if (templateExport.result) {
        const r = templateExport.result;
        return (_jsxs(Box, { flexDirection: "column", marginTop: 1, paddingLeft: 2, children: [_jsx(Text, { color: "green", children: "Template export complete!" }), _jsxs(Box, { marginTop: 1, flexDirection: "column", children: [_jsxs(Text, { color: "gray", children: ["Objects:       ", _jsx(Text, { color: "white", children: r.objectCount })] }), _jsxs(Text, { color: "gray", children: ["Relationships: ", _jsx(Text, { color: "white", children: r.relationshipCount })] })] }), _jsx(Box, { marginTop: 1, children: _jsxs(Text, { color: "gray", children: ["Saved to: ", _jsx(Text, { color: "white", children: r.filePath })] }) }), _jsx(Box, { marginTop: 1, children: _jsx(Text, { color: "gray", dimColor: true, children: "[o] open  \u00B7  [\u2190/Esc] back" }) })] }));
    }
    // Template export error
    if (templateExport.error) {
        return (_jsxs(Box, { flexDirection: "column", marginTop: 1, paddingLeft: 2, children: [_jsx(Text, { color: "red", children: templateExport.error }), _jsx(Box, { marginTop: 1, children: _jsx(Text, { color: "gray", dimColor: true, children: "[\u2190/Esc] back" }) })] }));
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
            return (_jsxs(Box, { flexDirection: "column", marginTop: 1, children: [_jsxs(Box, { paddingLeft: 2, flexDirection: "column", children: [_jsxs(Text, { color: "gray", children: ["Template: ", _jsx(Text, { color: "white", children: exportTemplate.name })] }), _jsxs(Text, { color: "gray", dimColor: true, children: [v?.prompt, "  (", exportVarIndex + 1, "/", exportTemplateVars.length, ")"] })] }), _jsxs(Box, { marginTop: 1, flexDirection: "column", children: [hasMoreAbove && _jsx(ScrollUp, { count: scrollStart }), visible.map((name, vi) => {
                                const i = scrollStart + vi;
                                const selected = i === selectedIndex;
                                return (_jsxs(Box, { children: [_jsx(Box, { width: 2, children: _jsx(Text, { color: selected && focused ? 'cyan' : 'gray', children: selected ? '▶' : ' ' }) }), _jsx(Text, { color: selected && focused ? 'cyan' : undefined, wrap: "truncate", children: name })] }, i));
                            }), hasMoreBelow && _jsx(ScrollDown, { count: exportVarOptions.length - scrollEnd, total: exportVarOptions.length })] }), _jsx(Box, { paddingLeft: 2, marginTop: 1, children: _jsxs(Text, { color: "gray", dimColor: true, children: ["[\u21B5] ", nextLabel, "  \u00B7  [\u2190/Esc] back  \u00B7  [\u2191\u2193] navigate"] }) })] }));
        }
        // Loading state
        if (exportVarLoading) {
            return (_jsxs(Box, { flexDirection: "column", marginTop: 1, paddingLeft: 2, children: [_jsxs(Text, { color: "gray", children: ["Template: ", _jsx(Text, { color: "white", children: exportTemplate.name })] }), _jsx(Box, { marginTop: 1, children: _jsxs(Text, { color: "cyan", children: ["Loading options for ", v?.prompt, "..."] }) })] }));
        }
        // Text input mode (no objectType declared)
        return (_jsxs(Box, { flexDirection: "column", marginTop: 1, paddingLeft: 2, children: [_jsxs(Text, { color: "gray", children: ["Template: ", _jsx(Text, { color: "white", children: exportTemplate.name })] }), _jsx(Box, { marginTop: 1, children: _jsxs(Text, { color: "gray", children: [v?.prompt, "  ", _jsxs(Text, { color: "gray", dimColor: true, children: ["(", exportVarIndex + 1, "/", exportTemplateVars.length, ")"] })] }) }), _jsxs(Box, { marginTop: 1, children: [_jsx(Text, { color: "cyan", children: exportVarInput }), _jsx(Text, { color: "cyan", children: "\u2588" })] }), _jsx(Box, { marginTop: 1, children: _jsxs(Text, { color: "gray", dimColor: true, children: ["[\u21B5] ", nextLabel, "  \u00B7  [Esc] back to templates"] }) })] }));
    }
    // Template picker
    if (exportTemplatePicking) {
        if (exportTemplates.length === 0) {
            return (_jsxs(Box, { flexDirection: "column", marginTop: 1, paddingLeft: 2, children: [_jsx(Text, { color: "yellow", children: "No templates found in ~/.orbusctl/templates/" }), _jsx(Box, { marginTop: 1, children: _jsx(Text, { color: "gray", dimColor: true, children: "Add .md template files to get started." }) }), _jsx(Box, { marginTop: 1, children: _jsx(Text, { color: "gray", dimColor: true, children: "[\u2190/Esc] back" }) })] }));
        }
        return (_jsxs(Box, { flexDirection: "column", marginTop: 1, children: [_jsx(Box, { paddingLeft: 2, children: _jsx(Text, { color: "gray", dimColor: true, children: "Select a template:" }) }), _jsx(Box, { marginTop: 1, flexDirection: "column", children: exportTemplates.map((t, i) => {
                        const selected = i === selectedIndex;
                        return (_jsxs(Box, { children: [_jsx(Box, { width: 2, children: _jsx(Text, { color: selected && focused ? 'cyan' : 'gray', children: selected ? '▶' : ' ' }) }), _jsx(Text, { color: selected && focused ? 'cyan' : undefined, children: t.name })] }, t.path));
                    }) }), _jsx(Box, { paddingLeft: 2, marginTop: 1, children: _jsx(Text, { color: "gray", dimColor: true, children: "[\u21B5] select  \u00B7  [\u2190/Esc] back  \u00B7  [\u2191\u2193] navigate" }) })] }));
    }
    // Exporting in progress
    if (exportHook.exporting) {
        const p = exportHook.progress;
        return (_jsxs(Box, { flexDirection: "column", marginTop: 1, paddingLeft: 2, children: [_jsx(Text, { color: "cyan", children: "Exporting..." }), p && (_jsxs(Text, { color: "gray", children: [p.phase, p.current && p.total ? ` (${p.current}/${p.total})` : ''] }))] }));
    }
    // Export complete
    if (exportHook.result) {
        const r = exportHook.result;
        return (_jsxs(Box, { flexDirection: "column", marginTop: 1, paddingLeft: 2, children: [_jsx(Text, { color: "green", children: "Export complete!" }), _jsxs(Box, { marginTop: 1, flexDirection: "column", children: [_jsxs(Text, { color: "gray", children: ["Objects:       ", _jsx(Text, { color: "white", children: r.objectCount })] }), _jsxs(Text, { color: "gray", children: ["Relationships: ", _jsx(Text, { color: "white", children: r.relationshipCount })] }), _jsxs(Text, { color: "gray", children: ["Drawings:      ", _jsx(Text, { color: "white", children: r.drawingCount })] })] }), _jsx(Box, { marginTop: 1, children: _jsxs(Text, { color: "gray", children: ["Saved to: ", _jsx(Text, { color: "white", children: r.filePath })] }) }), _jsx(Box, { marginTop: 1, children: _jsx(Text, { color: "gray", dimColor: true, children: "[o] open  \u00B7  [\u2190/Esc] back" }) })] }));
    }
    // Error
    if (exportHook.error) {
        return (_jsxs(Box, { flexDirection: "column", marginTop: 1, paddingLeft: 2, children: [_jsx(Text, { color: "red", children: exportHook.error }), _jsx(Box, { marginTop: 1, children: _jsx(Text, { color: "gray", dimColor: true, children: "[\u2190/Esc] back" }) })] }));
    }
    // Format selector
    if (exportModelId) {
        return (_jsxs(Box, { flexDirection: "column", marginTop: 1, children: [_jsx(Box, { paddingLeft: 2, children: _jsx(Text, { color: "gray", dimColor: true, children: "Select export format:" }) }), _jsx(Box, { marginTop: 1, flexDirection: "column", children: formats.map((f, i) => {
                        const selected = i === selectedIndex;
                        return (_jsxs(Box, { children: [_jsx(Box, { width: 2, children: _jsx(Text, { color: selected && focused ? 'cyan' : 'gray', children: selected ? '▶' : ' ' }) }), _jsx(Text, { color: selected && focused ? 'cyan' : undefined, children: f.label })] }, f.value));
                    }) }), _jsx(Box, { paddingLeft: 2, marginTop: 1, children: _jsx(Text, { color: "gray", dimColor: true, children: "[\u21B5] export  \u00B7  [\u2190/Esc] back  \u00B7  [\u2191\u2193] navigate" }) })] }));
    }
    // Model selector (reuse ModelList)
    return _jsx(ModelList, { selectedIndex: selectedIndex, focused: focused, termRows: termRows, termCols: termCols, showStats: showStats, modelFlat: modelFlat, counts: modelCounts, loading: modelsLoading, error: modelsError });
};
// --- Config section ---
const BROWSER_OPTIONS = [
    { label: 'System default', value: undefined },
    { label: 'Microsoft Edge', value: 'Microsoft Edge' },
    { label: 'Google Chrome', value: 'Google Chrome' },
    { label: 'Firefox', value: 'Firefox' },
    { label: 'Safari', value: 'Safari' },
];
const ConfigSection = ({ selectedIndex, focused, editing, textInput, solutions }) => {
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
        }
        else {
            const setAt = getWritePasswordSetAt();
            if (setAt) {
                const ageMs = Date.now() - new Date(setAt).getTime();
                const ageH = Math.floor(ageMs / 3600000);
                const ageM = Math.floor((ageMs % 3600000) / 60000);
                writePasswordStatus = ageH > 0 ? `Active (${ageH}h ${ageM}m ago)` : `Active (${ageM}m ago)`;
            }
            else {
                writePasswordStatus = 'Active';
            }
        }
    }
    // Sub-view: write password log
    if (editing === 'write-password-log') {
        const writePasswordSetAt = getWritePasswordSetAt();
        const entries = getRecentWriteLog(writePasswordSetAt);
        return (_jsxs(Box, { flexDirection: "column", marginTop: 1, paddingLeft: 2, children: [_jsxs(Text, { color: "gray", children: ["Write operations since last password (", entries.length, "):"] }), entries.length === 0
                    ? _jsx(Box, { marginTop: 1, children: _jsx(Text, { color: "gray", dimColor: true, children: "(none)" }) })
                    : (_jsx(Box, { flexDirection: "column", marginTop: 1, children: entries.slice(-10).map((e, i) => {
                            const typeStr = (e.objectType ?? '').padEnd(20);
                            const nameStr = (e.objectName ?? e.objectId?.slice(0, 12) ?? e.relationshipId?.slice(0, 12) ?? '—').padEnd(25);
                            return (_jsxs(Box, { children: [_jsxs(Text, { color: "gray", children: [e.timestamp.slice(0, 16).replace('T', ' '), "  "] }), _jsx(Text, { color: e.success ? 'white' : 'red', children: e.operation.padEnd(22) }), _jsx(Text, { color: "gray", children: typeStr }), _jsx(Text, { color: "gray", dimColor: true, children: nameStr }), _jsx(Text, { color: e.success ? 'green' : 'red', children: e.success ? '✓' : '✗' })] }, i));
                        }) })), _jsx(Box, { marginTop: 1, children: _jsx(Text, { color: "gray", dimColor: true, children: "[\u21B5] set new password  \u00B7  [Esc] cancel" }) })] }));
    }
    // Sub-view: write password input (masked)
    if (editing === 'write-password') {
        return (_jsxs(Box, { flexDirection: "column", marginTop: 1, paddingLeft: 2, children: [_jsx(Text, { color: "gray", children: "Write password:" }), _jsxs(Box, { marginTop: 1, children: [_jsx(Text, { color: "cyan", children: '●'.repeat(textInput.length) }), _jsx(Text, { color: "cyan", children: "\u2588" })] }), _jsx(Box, { marginTop: 1, children: _jsx(Text, { color: "gray", dimColor: true, children: "[\u21B5] save  \u00B7  [Esc] cancel" }) })] }));
    }
    // Sub-view: browser picker
    if (editing === 'browser') {
        return (_jsxs(Box, { flexDirection: "column", marginTop: 1, children: [_jsx(Box, { paddingLeft: 2, children: _jsx(Text, { color: "gray", dimColor: true, children: "Select a browser for \"open in Orbus\":" }) }), _jsx(Box, { marginTop: 1, flexDirection: "column", children: BROWSER_OPTIONS.map((opt, i) => {
                        const selected = i === selectedIndex;
                        const isCurrent = opt.value === browser;
                        return (_jsxs(Box, { children: [_jsx(Box, { width: 2, children: _jsx(Text, { color: selected && focused ? 'cyan' : 'gray', children: selected ? '▶' : ' ' }) }), _jsx(Text, { color: selected && focused ? 'cyan' : isCurrent ? 'white' : 'gray', bold: isCurrent, children: opt.label }), isCurrent && _jsx(Text, { color: "green", children: " \u25CF" })] }, i));
                    }) }), _jsx(Box, { paddingLeft: 2, marginTop: 1, children: _jsx(Text, { color: "gray", dimColor: true, children: "[\u21B5] select  \u00B7  [Esc] cancel" }) })] }));
    }
    // Sub-view: solution picker
    if (editing === 'solution') {
        const options = [{ label: 'All models (no filter)', value: '' }, ...solutions.map(s => ({ label: s.Name, value: s.Name }))];
        return (_jsxs(Box, { flexDirection: "column", marginTop: 1, children: [_jsx(Text, { color: "gray", dimColor: true, children: "Select a solution filter:" }), _jsx(Box, { marginTop: 1, flexDirection: "column", children: options.map((o, i) => {
                        const selected = i === selectedIndex;
                        const isCurrent = (i === 0 && !filter) || o.value === filter;
                        return (_jsxs(Box, { children: [_jsx(Box, { width: 2, children: _jsx(Text, { color: selected && focused ? 'cyan' : 'gray', children: selected ? '▶' : ' ' }) }), _jsx(Text, { color: selected && focused ? 'cyan' : isCurrent ? 'white' : 'gray', bold: isCurrent, children: o.label }), isCurrent && _jsx(Text, { color: "green", children: " \u25CF" })] }, i));
                    }) }), _jsx(Box, { paddingLeft: 2, marginTop: 1, children: _jsx(Text, { color: "gray", dimColor: true, children: "[\u21B5] select  \u00B7  [Esc] cancel" }) })] }));
    }
    // Sub-view: server text input
    if (editing === 'server') {
        return (_jsxs(Box, { flexDirection: "column", marginTop: 1, paddingLeft: 2, children: [_jsx(Text, { color: "gray", children: "Server URL:" }), _jsxs(Box, { marginTop: 1, children: [_jsx(Text, { color: "cyan", children: textInput }), _jsx(Text, { color: "cyan", children: "\u2588" })] }), _jsx(Box, { marginTop: 1, children: _jsx(Text, { color: "gray", dimColor: true, children: "[\u21B5] save  \u00B7  [Esc] cancel" }) })] }));
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
    return (_jsxs(Box, { flexDirection: "column", marginTop: 1, children: [settings.map((s, i) => {
                const selected = i === selectedIndex;
                return (_jsxs(Box, { children: [_jsx(Box, { width: 2, children: _jsx(Text, { color: selected && focused ? 'cyan' : 'gray', children: selected ? '▶' : ' ' }) }), _jsx(Box, { width: 22, children: _jsx(Text, { color: selected && focused ? 'cyan' : 'white', children: s.label }) }), _jsx(Text, { color: "gray", children: s.value })] }, i));
            }), _jsx(Box, { paddingLeft: 2, marginTop: 1, children: _jsx(Text, { color: "gray", dimColor: true, children: "[\u21B5] change  \u00B7  [\u2191\u2193] navigate" }) })] }));
};
// ═══════════════════════════════════════════════════════════════
// MAIN CONTENT CONTAINER
// ═══════════════════════════════════════════════════════════════
const SECTION_TITLES = {
    models: 'Models', drawings: 'Drawings', compare: 'Compare', activity: 'Activity', audit: 'Audit', export: 'Export', config: 'Configuration',
};
const LockedSection = ({ section }) => (_jsxs(Box, { flexDirection: "column", flexGrow: 1, alignItems: "center", justifyContent: "center", children: [_jsxs(Text, { color: "gray", children: ["\u2298  ", SECTION_TITLES[section], " requires authentication"] }), _jsx(Box, { marginTop: 1, children: _jsx(Text, { dimColor: true, children: "Press [a] to authenticate" }) })] }));
export const MainContent = (props) => {
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
        return (_jsxs(Box, { flexDirection: "column", flexGrow: 1, children: [_jsx(Panel, { title: objectsTitle, focused: listFocused, width: panelW, flexGrow: hasDetail ? undefined : 1, paddingX: 2, children: _jsx(ObjectListCompact, { selectedIndex: selectedIndex, focused: listFocused, termRows: termRows, termCols: props.termCols, showStats: props.showStats, objects: objects, loading: objectsLoading, error: objectsError, viewedObjectId: viewedObjectId, hasDetail: hasDetail }) }), hasDetail && (_jsx(Panel, { title: detailTitle, focused: detailFocused, width: panelW, flexGrow: 1, paddingX: 2, children: detailLoading ? (_jsx(Box, { paddingLeft: 1, marginTop: 1, children: _jsx(Text, { color: "cyan", children: "Loading..." }) })) : detailError ? (_jsx(Box, { paddingLeft: 1, marginTop: 1, children: _jsx(Text, { color: "red", children: detailError }) })) : objectDetail ? (_jsx(ObjectDetailPane, { detail: objectDetail, relationships: objectRelationships, termRows: termRows, detailFocused: detailFocused, relIndex: relIndex })) : null }))] }));
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
        return (_jsxs(Box, { flexDirection: "column", flexGrow: 1, children: [_jsx(Panel, { title: drawingTitle, focused: listFocused, width: panelW, flexGrow: hasDetail ? undefined : 1, paddingX: 2, children: _jsx(DrawingComponentList, { selectedIndex: selectedIndex, focused: listFocused, termRows: termRows, components: props.drawingComponents, loading: props.drawingDetailLoading, error: props.drawingDetailError, hasDetail: hasDetail, viewedDrawingObjectId: viewedDrawingObjectId }) }), hasDetail && (_jsx(Panel, { title: detailTitle, focused: drawingDetailFocused, width: panelW, flexGrow: 1, paddingX: 2, children: drawingObjectDetailLoading ? (_jsx(Box, { paddingLeft: 1, marginTop: 1, children: _jsx(Text, { color: "cyan", children: "Loading..." }) })) : drawingObjectDetailError ? (_jsx(Box, { paddingLeft: 1, marginTop: 1, children: _jsx(Text, { color: "red", children: drawingObjectDetailError }) })) : drawingObjectDetail ? (_jsx(ObjectDetailPane, { detail: drawingObjectDetail, relationships: drawingObjectRelationships, termRows: termRows, detailFocused: drawingDetailFocused, relIndex: drawingRelIndex })) : null }))] }));
    }
    // Audit issue list with detail: two sibling Panels
    if (section === 'audit' && !isLocked && props.auditMode === 'detail' && props.audit.result && props.auditIssueFilter) {
        const { viewedAuditObjectId, auditObjectDetail, auditObjectRelationships, auditDetailLoading, auditDetailError, auditDetailFocused, auditRelIndex } = props;
        const hasDetail = viewedAuditObjectId !== null;
        const filtered = props.audit.result.issues.filter(i => i.issueType === props.auditIssueFilter);
        const issueTitle = `Audit · ${props.audit.result.modelName} · ${ISSUE_LABELS[props.auditIssueFilter] ?? props.auditIssueFilter} (${filtered.length})`;
        const detailTitle = auditObjectDetail ? auditObjectDetail.Name : 'Detail';
        const listFocused = focused && !auditDetailFocused;
        const panelW = props.termCols - 18 - 1 - (props.showStats ? 31 : 0);
        return (_jsxs(Box, { flexDirection: "column", flexGrow: 1, children: [_jsx(Panel, { title: issueTitle, focused: listFocused, width: panelW, flexGrow: hasDetail ? undefined : 1, paddingX: 2, children: _jsx(AuditSection, { selectedIndex: selectedIndex, focused: listFocused, termRows: termRows, termCols: props.termCols, showStats: props.showStats, audit: props.audit, auditExport: props.auditExport, issueFilter: props.auditIssueFilter, mode: props.auditMode, selectedModelIds: props.auditSelectedModelIds, modelFlat: props.modelFlat, modelCounts: props.modelCounts, modelsLoading: props.modelsLoading, modelsError: props.modelsError, hasDetail: hasDetail, viewedAuditObjectId: viewedAuditObjectId }) }), _jsx(Box, { display: hasDetail ? 'flex' : 'none', flexDirection: "column", flexGrow: 1, children: _jsx(Panel, { title: detailTitle, focused: auditDetailFocused, width: panelW, flexGrow: 1, paddingX: 2, children: auditDetailLoading ? (_jsx(Box, { paddingLeft: 1, marginTop: 1, children: _jsx(Text, { color: "cyan", children: "Loading..." }) })) : auditDetailError ? (_jsx(Box, { paddingLeft: 1, marginTop: 1, children: _jsx(Text, { color: "red", children: auditDetailError }) })) : auditObjectDetail ? (_jsx(ObjectDetailPane, { detail: auditObjectDetail, relationships: auditObjectRelationships, termRows: termRows, detailFocused: auditDetailFocused, relIndex: auditRelIndex })) : null }) })] }));
    }
    // Standard single-panel view for all other sections
    let title = SECTION_TITLES[section];
    if (section === 'models' && props.models.length > 0)
        title = `Models (${props.models.length})`;
    else if (section === 'drawings') {
        if (props.viewedDrawingId) {
            const d = props.drawings.find(d => d.DocumentId === props.viewedDrawingId);
            title = d ? `${d.FileName} · Components (${props.drawingComponents.length})` : 'Components';
        }
        else if (props.drawingsModelId) {
            title = `${props.drawingsModelName} · Drawings (${props.drawings.length})`;
        }
        else if (props.models.length > 0) {
            title = `Drawings — select a model`;
        }
    }
    else if (section === 'audit') {
        if (props.auditMode === 'detail' && props.audit.result && props.auditIssueFilter) {
            title = `Audit · ${props.audit.result.modelName} · ${ISSUE_LABELS[props.auditIssueFilter] ?? props.auditIssueFilter}`;
        }
        else if (props.auditMode === 'detail' && props.audit.result) {
            title = `Audit · ${props.audit.result.modelName} · ${props.audit.result.totalIssues} issues`;
        }
        else if (props.auditMode === 'all-results') {
            const done = props.audit.modelResults.size;
            title = props.audit.scanningAll ? `Audit · Scanning (${done} done)` : `Audit · All models (${done})`;
        }
        else if (props.audit.auditing) {
            title = 'Audit · Scanning...';
        }
        else if (props.auditMode === 'select-model') {
            title = 'Audit — select a model';
        }
        else if (props.auditMode === 'select-models') {
            const selCount = props.auditSelectedModelIds.size;
            title = selCount === 0 ? 'Audit — select models' : `Audit — ${selCount} model${selCount !== 1 ? 's' : ''} selected`;
        }
        else {
            title = 'Audit';
        }
    }
    else if (section === 'compare') {
        if (props.compareModelBId)
            title = `Compare · ${props.compareModelAName} vs ${props.compareModelBName}`;
        else if (props.compareModelAId)
            title = `Compare · Select Model B`;
        else
            title = 'Compare — select Model A';
    }
    else if (section === 'export') {
        if (props.exportHook.result)
            title = 'Export · Complete';
        else if (props.exportHook.exporting)
            title = 'Export · Working...';
        else if (props.exportModelId)
            title = `Export · Select format`;
        else
            title = 'Export — select a model';
    }
    else if (section === 'activity') {
        if (props.activity.report && props.activityModelIndex !== null) {
            const m = props.activity.report.models[props.activityModelIndex];
            if (m)
                title = `Activity · ${m.modelName}`;
        }
        else if (props.activity.report) {
            title = `Activity · ${props.activity.report.label}`;
        }
        else if (props.activity.scanning) {
            title = 'Activity · Scanning...';
        }
    }
    const renderSection = () => {
        if (isLocked)
            return _jsx(LockedSection, { section: section });
        switch (section) {
            case 'models':
                return _jsx(ModelList, { selectedIndex: selectedIndex, focused: focused, termRows: termRows, termCols: props.termCols, showStats: props.showStats, modelFlat: props.modelFlat, counts: props.modelCounts, loading: props.modelsLoading, error: props.modelsError });
            case 'drawings':
                if (props.viewedDrawingId) {
                    return _jsx(DrawingComponentList, { selectedIndex: selectedIndex, focused: focused, termRows: termRows, components: props.drawingComponents, loading: props.drawingDetailLoading, error: props.drawingDetailError });
                }
                if (!props.drawingsModelId) {
                    return _jsx(ModelList, { selectedIndex: selectedIndex, focused: focused, termRows: termRows, termCols: props.termCols, showStats: props.showStats, modelFlat: props.modelFlat, counts: props.modelCounts, loading: props.modelsLoading, error: props.modelsError });
                }
                return _jsx(DrawingsList, { selectedIndex: selectedIndex, focused: focused, termRows: termRows, modelName: props.drawingsModelName, drawings: props.drawings, typeMap: props.drawingTypeMap, loading: props.drawingsLoading, error: props.drawingsError });
            case 'audit': return _jsx(AuditSection, { selectedIndex: selectedIndex, focused: focused, termRows: termRows, termCols: props.termCols, showStats: props.showStats, audit: props.audit, auditExport: props.auditExport, issueFilter: props.auditIssueFilter, mode: props.auditMode, selectedModelIds: props.auditSelectedModelIds, modelFlat: props.modelFlat, modelCounts: props.modelCounts, modelsLoading: props.modelsLoading, modelsError: props.modelsError, hasDetail: false, viewedAuditObjectId: null });
            case 'compare': return _jsx(CompareSection, { selectedIndex: selectedIndex, focused: focused, termRows: termRows, termCols: props.termCols, showStats: props.showStats, compare: props.compare, modelAId: props.compareModelAId, modelAName: props.compareModelAName, modelBName: props.compareModelBName, modelBId: props.compareModelBId, modelFlat: props.modelFlat, modelCounts: props.modelCounts, modelsLoading: props.modelsLoading, modelsError: props.modelsError });
            case 'export': return _jsx(ExportSection, { selectedIndex: selectedIndex, focused: focused, exportHook: props.exportHook, exportModelId: props.exportModelId, formats: props.exportFormats, modelFlat: props.modelFlat, modelCounts: props.modelCounts, modelsLoading: props.modelsLoading, modelsError: props.modelsError, termRows: termRows, termCols: props.termCols, showStats: props.showStats, templateExport: props.templateExport, exportTemplatePicking: props.exportTemplatePicking, exportTemplates: props.exportTemplates, exportTemplate: props.exportTemplate, exportTemplateVars: props.exportTemplateVars, exportVarIndex: props.exportVarIndex, exportVarInput: props.exportVarInput, exportVarOptions: props.exportVarOptions, exportVarLoading: props.exportVarLoading });
            case 'activity': return _jsx(ActivitySection, { selectedIndex: selectedIndex, focused: focused, termRows: termRows, termCols: props.termCols, showStats: props.showStats, activity: props.activity, activityExport: props.activityExport, periods: props.activityPeriods, modelIndex: props.activityModelIndex });
            case 'config': return _jsx(ConfigSection, { selectedIndex: selectedIndex, focused: focused, editing: props.configEditing, textInput: props.configTextInput, solutions: props.solutions });
        }
    };
    return (_jsx(Panel, { title: title, focused: focused && !isLocked, flexGrow: 1, paddingX: 2, children: renderSection() }));
};
