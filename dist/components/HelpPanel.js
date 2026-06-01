import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Box, Text } from 'ink';
import { Panel } from './Panel.js';
function getHelpLines(props) {
    const { section, modelsView, viewedObjectId, viewedDrawingId, viewedDrawingObjectId, auditMode, configEditing, activityHasReport, activityScanning, activityModelIndex, exportModelId, exportDone, exportInProgress, } = props;
    switch (section) {
        case 'models':
            if (modelsView.level === 'list')
                return [
                    'All models in the repository. Counts: objects, relationships, drawings.',
                    '[↵] browse objects  ·  [↑↓] navigate  ·  [Tab] focus sidebar',
                ];
            if (viewedObjectId)
                return [
                    'Object detail — type, description, status, version, attributes, and relationships.',
                    '[o] open in Orbus  ·  [↵] follow relationship  ·  [←/Esc] back  ·  [↑↓] navigate',
                ];
            return [
                'Objects in the selected model, sorted by type then name.',
                '[↵] view detail  ·  [←/Esc] back to models  ·  [↑↓] navigate',
            ];
        case 'drawings':
            if (viewedDrawingObjectId)
                return [
                    'Object detail within a drawing — attributes and relationships.',
                    '[o] open in Orbus  ·  [↵] follow relationship  ·  [←/Esc] back  ·  [↑↓] navigate',
                ];
            if (viewedDrawingId)
                return [
                    'Components of the selected drawing — objects and relationships placed in this diagram.',
                    '[o] open in Orbus Draw  ·  [↵] view object detail  ·  [←/Esc] back  ·  [↑↓] navigate',
                ];
            return [
                'Drawings and diagrams organised by model.',
                '[↵] enter model or open drawing  ·  [←/Esc] back  ·  [↑↓] navigate',
            ];
        case 'compare':
            return [
                'Side-by-side object comparison between two models, matched by name and type.',
                '[↵] select Model A then Model B  ·  [←/Esc] change selection  ·  [↑↓] scroll',
            ];
        case 'activity':
            if (activityScanning)
                return [
                    'Scanning all models for recent changes across objects and relationships.',
                    '[Esc] cancel',
                ];
            if (activityHasReport && activityModelIndex !== null)
                return [
                    'Per-user activity detail — created and modified objects and relationships.',
                    '[e] export report as Excel  ·  [←/Esc] back to model list  ·  [↑↓] scroll',
                ];
            if (activityHasReport)
                return [
                    'Models with activity in the selected period, sorted alphabetically.',
                    '[↵] view per-user detail  ·  [e] export as Excel  ·  [←/Esc] change period  ·  [↑↓] navigate',
                ];
            return [
                'Scan all models for recent changes. Select a time period to start.',
                '[↵] start scan  ·  [↑↓] select period',
            ];
        case 'audit':
            if (auditMode === 'menu')
                return [
                    'Audit models for data quality: empty descriptions, HTML in names, missing relationships, not in any diagram.',
                    '[↵] select audit scope  ·  [↑↓] navigate',
                ];
            if (auditMode === 'all-results')
                return [
                    'Audit results across all scanned models — issue counts per model.',
                    '[↵] drill into model  ·  [e] export as Excel  ·  [←/Esc] back  ·  [↑↓] navigate',
                ];
            if (auditMode === 'detail')
                return [
                    'Issue summary for this model — select a type to see the affected objects.',
                    '[↵] view objects  ·  [e] export as Excel  ·  [←/Esc] back  ·  [↑↓] navigate',
                ];
            return [
                'Select a model to audit.',
                '[↵] select  ·  [←/Esc] back  ·  [↑↓] navigate',
            ];
        case 'export':
            if (exportDone)
                return [
                    'Export complete — file saved to ~/.orbusctl/exports/.',
                    '[o] open file  ·  [←/Esc] export another model',
                ];
            if (exportInProgress)
                return [
                    'Export in progress — fetching objects, relationships, and drawings.',
                    'Please wait...',
                ];
            if (exportModelId)
                return [
                    'Choose format. Excel includes full attribute columns; Markdown is a lightweight catalog.',
                    '[↵] start export  ·  [←/Esc] change model  ·  [↑↓] navigate',
                ];
            return [
                'Export a model to Excel (.xlsx) or Markdown (.md).',
                '[↵] select model  ·  [↑↓] navigate',
            ];
        case 'config':
            if (configEditing === 'write-password' || configEditing === 'write-password-log')
                return [
                    'Write password gates all CLI write operations. Stored as a scrypt hash, expires after 24 hours.',
                    '[↵] save  ·  [Esc] cancel',
                ];
            if (configEditing)
                return [
                    'Editing setting.',
                    '[↵] save  ·  [Esc] cancel',
                ];
            return [
                'Server, solution filter, hidden models, auth token, write password, and browser preference.',
                '[↵] change setting  ·  [↑↓] navigate',
            ];
        default:
            return ['', ''];
    }
}
export const HelpPanel = (props) => {
    const [line1, line2] = getHelpLines(props);
    return (_jsx(Panel, { title: "Help", focused: false, flexGrow: 1, children: _jsxs(Box, { paddingX: 1, flexDirection: "column", children: [_jsx(Box, { children: _jsx(Text, { color: "gray", children: line1 }) }), _jsx(Box, { children: _jsx(Text, { color: "gray", dimColor: true, children: line2 }) })] }) }));
};
