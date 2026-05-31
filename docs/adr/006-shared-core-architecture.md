# ADR-006: Shared core layer with TUI and CLI as presentation layers

**Status:** Accepted  
**Date:** 2026-05

## Context

orbusctl has two user-facing modes:

1. **CLI** — Commander.js subcommands for scriptable, one-shot operations (existing in 0.9.0)
2. **TUI** — Ink-based interactive terminal UI (new in 1.0.0)

The 0.9.0 codebase already has reasonable separation (commands / UI / API), but business logic is partially tangled into command handlers and the API layer is a 700-line monolith (`api.ts`). The TUI cannot reuse this code without importing framework-specific modules.

The vision calls for **capability parity** between TUI and CLI — every action reachable from both modes, with the experience differing to match each mode's strengths. This requires a shared foundation.

## Decision

Introduce a `src/core/` layer that owns all business logic, API communication, and domain knowledge. Neither the TUI nor the CLI may call the Orbus API directly.

```
src/
├── core/                     ← framework-agnostic, no Ink or Commander imports
│   ├── api/
│   │   ├── client.ts         ← base fetch, auth headers, OData pagination
│   │   ├── models.ts         ← model list, detail, solution filter
│   │   ├── objects.ts        ← object list, detail, attribute values
│   │   ├── relationships.ts  ← relationship list, detail
│   │   ├── drawings.ts       ← drawings and document types
│   │   └── me.ts             ← token validation, user info
│   ├── domain/
│   │   ├── type-maps.ts      ← ArchiMate 3.2 type ID → name mappings (60+)
│   │   ├── choice-maps.ts    ← RASCI, access operator choice attributes
│   │   ├── tree.ts           ← model hierarchy from BaselineModelId
│   │   ├── activity.ts       ← activity report: scan objects/rels by date, group by user
│   │   ├── resolve.ts        ← three-tier fuzzy name matching
│   │   └── colors.ts         ← ArchiMate layer → terminal colour mapping
│   ├── export/
│   │   ├── excel.ts          ← Excel workbook (objects, relationships, drawings, audit sheets)
│   │   ├── markdown.ts       ← Markdown with frontmatter, stats, coverage matrix
│   │   └── template.ts       ← Template-based export (ORBUS-TABLE, ORBUS-DIAGRAM)
│   ├── config.ts             ← ~/.orbusctl/config.json read/write
│   └── log.ts                ← JSONL structured logging
│
├── components/               ← Ink presentation layer (React components)
├── hooks/                    ← Ink presentation layer (React hooks)
├── tui.tsx                   ← TUI root entry point
│
├── cli/                      ← Commander.js presentation layer
│   └── commands/
│
└── main.ts                   ← no args → TUI, subcommand → CLI
```

### Extraction from 0.9.0 (complete)

This extraction was completed for the 1.0.0 release. The table below records what moved where.

| 0.9.0 source | Became | Notes |
|--------------|--------|-------|
| `src/api.ts` (700 lines) | `core/api/*.ts` | Split by domain; preserved OData pagination, expand limits, quirks |
| `src/type-maps.ts` | `core/domain/type-maps.ts` | Direct copy |
| `src/choice-maps.ts` | `core/domain/choice-maps.ts` | Direct copy |
| `src/utils/resolve.ts` | `core/domain/resolve.ts` | Direct copy |
| `src/ui/tree.ts` | `core/domain/tree.ts` | Extracted hierarchy builder; formatting left to presentation |
| `src/ui/colors.ts` | `core/domain/colors.ts` | ArchiMate layer mapping; both TUI and CLI use this |
| `src/ui/activity.ts` | `core/domain/activity.ts` | Extracted aggregation logic; rendering left to presentation |
| `src/commands/export.ts` + `markdown-export.ts` + `template-export.ts` | `core/export/*.ts` | Extracted data pipeline; both modes trigger exports |
| `src/config.ts` | `core/config.ts` | Direct copy; both modes read/write config |
| `src/log.ts` | `core/log.ts` | Direct copy; both modes log |
| `src/commands/*.ts` | `cli/commands/*.ts` | Thin wrappers calling core; API logic stripped |
| `src/ui/menu.ts` | Retired | Replaced by Ink TUI |
| `src/ui/table.ts`, `src/ui/drawings.ts` | `cli/` formatters or retired | TUI has its own rendering |

### Key API knowledge to preserve

The 0.9.0 `api.ts` encodes hard-won patterns:

- **Pagination**: `$top=50&$skip=0`, loop until `value.length < 50`
- **Solution filter**: `Solutions/any(s: s/Name eq '{name}')`
- **Nested expands cap at 2–3 levels** — deeper nesting crashes the API
- **Activity is computed, not fetched** — scan objects/relationships with date filters, group by user
- **Object detail requires separate call** per object (no batch detail endpoint)
- **Relationships do NOT support date filtering** — unlike objects
- **Drawing components use RepresentationSituationId** (0=placed, 1=connector, 2=containment, 3=overlap)
- **Write responses nest IDs** in `successMessage.messageDefinition.objectId`
- **Direct object lookup** (`/odata/Objects(<uuid>)`) returns unwrapped (not in `value` array)

## Consequences

**Positive**
- Any feature added to `core/` is immediately available in both TUI and CLI
- `core/` is testable without Ink or Commander — pure TypeScript with fetch
- OData quirks documented in one place, not scattered across commands
- Migration path is incremental: extract one domain at a time

**Negative**
- Initial extraction required restructuring ~1,500 lines of 0.9.0 code
- `main.ts` routing logic adds a small layer of complexity
- Two presentation layers to maintain (but they share all business logic)

## Alternatives not chosen

- **Fork 0.9.0 and add Ink on top**: Would leave business logic tangled in Commander commands; TUI couldn't reuse it cleanly
- **TUI-only, drop CLI**: Loses scriptability and AI agent access; violates the capability parity vision
- **Monorepo with packages**: Overhead not justified for a single-team project
