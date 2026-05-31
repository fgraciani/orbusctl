# orbusctl Architecture

## Stack

| Layer | Technology | Why |
|-------|-----------|-----|
| TUI framework | Ink 4 + React 18 | Component model, hooks, declarative layout — see [ADR-001](adr/001-ink-react-for-tui.md) |
| Language | TypeScript | Type safety across API layer and UI state |
| Layout engine | Yoga (via Ink) | Flexbox in the terminal, responsive to resize |
| API client | fetch (tracked) | All calls go through `trackedFetch` for counting and categorisation — see [ADR-006](adr/006-shared-core-architecture.md) |
| Auth | Bearer token (manual) | Orbus API uses short-lived tokens (~1h); user provides on startup |
| Config | JSON file | `~/.orbusctl/config.json` — server URL, token, solution filter — see [ADR-007](adr/007-configurable-server.md) |
| API spec | Swagger 2.0 | `spec/orbus-infinity-api.json` — 92 paths, orbusctl uses ~14. See [ADR-005](adr/005-partial-api-coverage.md) |

## Source structure

```
src/
  main.ts                      — entry point: routes to TUI or CLI
  tui.tsx                      — TUI launcher (side effects, render)
  index.tsx                    — TUI root component, state orchestration
  types.ts                     — shared types
  version.ts                   — centralized version string
  exitSummary.ts               — post-exit terminal summary (stdout output)
  demo.tsx                     — demo/dev component

  assets/
    logo.ts                    — ASCII art

  cli/                         — Commander.js CLI commands
    index.ts                   — command registration
    commands.ts                — shared COMMAND_LIST constant
    errors.ts                  — handleError(), requireToken()
    output.ts                  — formatOutput(), treePrefix()
    preflight.ts               — checkTokenAge() for long operations
    resolve-model.ts           — shared model resolution by name or ID
    write-guard.ts             — requireWriteAccess() password verification
    commands/
      auth.ts                  — orbusctl auth
      models.ts                — orbusctl models
      objects.ts               — orbusctl objects
      drawings.ts              — orbusctl drawings
      export.ts                — orbusctl export
      activity.ts              — orbusctl activity
      config.ts                — orbusctl config
      version.ts               — orbusctl version
      doc.ts                   — orbusctl doc generate
      objects-create.ts        — orbusctl objects-create
      objects-update.ts        — orbusctl objects-update
      objects-delete.ts        — orbusctl objects-delete
      objects-move.ts          — orbusctl objects-move
      relationships-create.ts  — orbusctl relationships-create
      relationships-update.ts  — orbusctl relationships-update
      relationships-delete.ts  — orbusctl relationships-delete

  components/                  — Ink components
    Panel.tsx                  — bordered panel with custom top border (╭─ Title ─╮)
    Header.tsx                 — ORBUSCTL · ORGNAME (left), heartbeat dot + username (right)
    Footer.tsx                 — context-sensitive key hints
    Sidebar.tsx                — section navigation, lock indicators
    MainContent.tsx            — section views routed by sidebar selection
    StatsPanel.tsx             — toggleable Info panel (right side, 30 chars)
    ApiChart.tsx               — per-method sparkline charts for API monitoring
    WelcomeModal.tsx           — auth gate on startup, token input
    ConfirmModal.tsx           — unified exit confirmation + session summary box
    HelpPanel.tsx              — context-sensitive help panel (toggled with ?)
    SessionSummaryScreen.tsx   — session summary screen (not currently used — exit summary is in exitSummary.ts)

  hooks/                       — React hooks
    useModels.ts               — model list with tree, solution filter
    useObjects.ts              — object list for a model
    useObjectDetail.ts         — single object detail with relationships
    useDrawings.ts             — drawing list for a model
    useDrawingDetail.ts        — drawing components and connectors
    useActivity.ts             — time-period activity scanning
    useAudit.ts                — model quality inspection
    useCompare.ts              — side-by-side model diff
    useExport.ts               — Excel/Markdown export orchestration
    useApiCounter.ts           — API call counter state
    useApiChart.ts             — sparkline data for API monitoring
    useHeartbeat.ts            — 10s polling, connection status, braille pulse
    useSolutions.ts            — solution list for config/filter
    useActivityExport.ts       — hook for activity Excel export
    useAuditExport.ts          — hook for audit Excel export
    useTemplateExport.ts       — hook for template-based export

  core/
    config.ts                  — ~/.orbusctl/config.json read/write, getServer(), getOrgName()
    auth.ts                    — hashPassword(), verifyWritePassword()
    browser.ts                 — getOrbusObjectUrl(), getOrbusDrawingUrl(), openInBrowser()
    log.ts                     — JSONL write/auth/error logging, getRecentWriteLog()

    api/
      client.ts                — trackedFetch, odata(), odataList(), odataCount(), ODataError, getBaseUrl() (configurable via config — ADR-007)
      counter.ts               — API call counter with categories (startup/heartbeat/user)
      me.ts                    — fetchMe(), fetchMeWithRoles()
      models.ts                — fetchModels(), fetchSolutions(), fetchModelDetailCounts()
      objects.ts               — fetchObjects(), fetchObjectDetail(), fetchObjectRelationships(), fetchAllRelationships(), fetchObjectNameAndType()
      drawings.ts              — fetchDrawings(), fetchDocumentTypes(), fetchDrawingComponents(), resolveDrawingComponents()
      activity.ts              — fetchRecentObjects(), fetchRecentRelationships()
      write.ts                 — createObject, updateObject, deleteObject, moveObjects, createRelationship, updateRelationship, deleteRelationship

    domain/
      tree.ts                  — buildTree(), flattenTree() — model hierarchy from BaselineModelId
      colors.ts                — ArchiMate layer → Ink colour mapping
      type-maps.ts             — 60+ ArchiMate type ID → name mappings
      resolve.ts               — three-tier fuzzy name matching (exact → normalized → Levenshtein)
      activity.ts              — time periods, scanActivity(), summarizeReport()
      audit.ts                 — performAudit(), quality checks — see ADR-008
      attribute-builder.ts     — parseSetFlags(), buildMixedAttributeValues() for --set/--set-choice
      choice-maps.ts           — RASCI and Access Operator choice value resolution
      correlation.ts           — CorrelationTable type and save for move operations

    export/
      excel.ts                 — performExcelExport() — multi-sheet .xlsx with objects, relationships, drawings
      markdown.ts              — performMarkdownExport() — frontmatter, stats, catalog, relationship table
      template.ts              — performTemplateExport(), parseTemplateVariables(), listTemplates()
      template-tables.ts       — 5 ORBUS-TABLE generators + ORBUS-DIAGRAM handler
      activity-excel.ts        — performActivityExcelExport()
      audit-excel.ts           — performAuditExcelExport()
```

## Component map

```
App (index.tsx)
├── WelcomeModal          — auth gate on startup, token input
├── ConfirmModal          — unified exit confirmation + session summary
└── TUI layout (always mounted, display="none" when modals active — ADR-003)
    ├── Header            — ORBUSCTL · ORGNAME (left), heartbeat dot + username (right), version in footer
    ├── Sidebar           — 7 sections: Content, Drawings, Compare, Activity, Audit, Export, Config
    ├── MainContent       — section views, multi-level drill-down with virtual scrolling
    │   └── Panel         — reusable bordered panel with inline title (ADR-002)
    ├── StatsPanel        — toggleable Info panel: session, license, roles, API charts
    └── Footer            — context-sensitive key hints
```

## Data flow

```
Orbus API  →  trackedFetch  →  api/{domain}.ts  →  hooks  →  component state  →  TUI render
                  ↑                                    ↑
             Bearer token                         counter.ts (startup/heartbeat/user categories)
             (from config)                        getBaseUrl() (from config — ADR-007)
```

All API calls flow through `trackedFetch` in `client.ts`, which:
1. Adds the Bearer token header
2. Increments the call counter with the appropriate category
3. Records the HTTP method for sparkline chart data
4. Uses the configurable base URL from `getServer()`

## Key architectural decisions

- **Shared core layer** — `src/core/` owns all business logic, API communication, and domain knowledge. The TUI is a presentation layer on top. See [ADR-006](adr/006-shared-core-architecture.md).
- **Configurable API server** — `getBaseUrl()` reads from config, not hardcoded. Org name extracted from URL pattern for header display. See [ADR-007](adr/007-configurable-server.md).
- **API call counter with categories** — every `trackedFetch` call is categorised as startup, heartbeat, or user. The Info panel shows totals and per-method sparklines. See `core/api/counter.ts`.
- **Panel border technique** — custom `╭─ Title ─╮` top line + `borderTop={false}` native Ink box for sides/bottom. See [ADR-002](adr/002-panel-border-technique.md).
- **`display="none"` for toggled panels** — prevents first-frame border flash when panels mount. See [ADR-003](adr/003-display-none-for-toggled-panels.md).
- **`measureElement` for flex panels** — Panel uses `measureElement` to determine available width for flex-width content, computed width for stacked (fixed) panels.
- **Virtual scrolling** — computed viewport height, scroll indicators (▲/▼), padded fixed-width strings prevent Ink overflow ghost characters.
- **Unified exit flow** — the confirm modal IS the session summary. Same two-column layout prints to stdout after exit via `exitSummary.ts`.
- **Audit as quality inspector** — model quality checks (empty descriptions, HTML content, orphan objects, undiagrammed objects). See [ADR-008](adr/008-audit-as-quality-inspector.md).

## Key constraints

- **Partial API coverage** — orbusctl implements ~14 of 92 API paths. See [ADR-005](adr/005-partial-api-coverage.md) for the inventory and rationale.
- **Activity is computed, not fetched** — scan objects/relationships with date filters, group by model and user. Relationships do NOT support server-side date filtering.
- **Object detail requires separate call** per object (no batch detail endpoint). This makes audit-all-models API-heavy.
- **Terminal minimum size** — 80x24. Below that, layout degrades but does not crash.
- **Config file** — `~/.orbusctl/config.json` stores token, tokenSavedAt, username, server URL, solution filter. No other persistent storage.
- **Exports directory** — files saved to `~/.orbusctl/exports/`.
