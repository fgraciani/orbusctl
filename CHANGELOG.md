# Changelog

All notable changes to orbusctl are documented in this file.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
This project uses [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.0.1] - 2026-06-01

### Fixed

- **Excel export — worksheet name collisions:** Activity and Audit multi-model exports threw `"Worksheet name already exists"` when model names shared a long common prefix and differed only at the end (e.g. release wave suffix). Replaced the naive 31-char slice with a collision-aware `buildSheetNameMap()` that ellipsis-truncates long names preserving both the start and end (`Prefix…Wave 3`), with a `~N` numeric fallback for any remaining collisions.
- **Global install — `orbusctl` command not found:** Installing via `npm install -g github:fgraciani/orbusctl` succeeded but left no runnable binary because `dist/` is not committed and npm did not build TypeScript automatically. Added `prepare` script so npm compiles on install.

## [1.0.0] - 2026-05-31

### Added

- **Full terminal UI (TUI)** built with Ink 4 + React 18: sidebar navigation, dual-panel layout, virtual scrolling, keyboard-driven.
- **TUI sections:** Content (models/objects), Drawings, Compare, Activity, Audit, Export, Config.
- **CLI layer** with Commander.js: 16 subcommands (`auth`, `models`, `objects`, `drawings`, `export`, `activity`, `config`, `version`, `doc generate`, `objects-create`, `objects-update`, `objects-delete`, `objects-move`, `relationships-create`, `relationships-update`, `relationships-delete`).
- **Compare section:** side-by-side object diff between two models, matched by name and type.
- **Audit section:** data quality scanning — empty descriptions, HTML in names/descriptions, objects without relationships, objects not in any diagram. Exportable as Excel.
- **Activity Excel export:** export activity reports from TUI.
- **Audit Excel export:** export audit results from TUI.
- **Template-based document generation** (`orbusctl doc generate`): enriched markdown with ORBUS:BEGIN/END markers, 5 table generators (tasks, IO, roles, RASCI, lifecycle), diagram embedding, variable interpolation, scope overrides.
- **Write operations:** create, update, delete objects and relationships. Move objects between models with relationship recreation and correlation table.
- **Write password system:** user-set password via TUI, scrypt hash with random salt, 24-hour expiry, write log displayed on renewal.
- **Write logging:** JSONL log at `~/.orbusctl/logs/write.jsonl` (100MB rotation) with operation, object name/type, success/failure, user.
- **Browser launch:** `[o]` key opens objects in Orbus web UI, drawings in Orbus Draw. Configurable browser preference.
- **API call tracking:** session statistics with startup/heartbeat/user categories, per-method sparkline charts in info panel.
- **Heartbeat:** 10-second background token validation with connection status indicator.
- **Token age pre-flight:** CLI warns and aborts if token >50 minutes old before long operations. `--force` to override.
- **Session summary:** exit screen showing session stats and API usage, printed to stdout after TUI exit.
- **Context-sensitive help panel:** toggled with `[?]`, shows guidance for the current section and view.
- **Wrap-around scrolling:** all list navigation wraps from last to first and vice versa.
- **Model count highlighting:** selected model's object/relationship/drawing counts highlighted in white.
- **Centralized version:** single `src/version.ts` imported everywhere, no hardcoded version strings.
- **Config file security:** `~/.orbusctl/config.json` written with `0o600` permissions + `chmodSync`.
- **`--json` flag** on all CLI commands for machine-readable output.
- **Modular architecture:** shared `src/core/` layer (API, domain, export) used by both TUI and CLI (ADR-006).

### Changed

- **Architecture:** rewritten from oclif + Inquirer (0.9.0) to Ink/React TUI + Commander.js CLI. Single `src/main.ts` entry point routes to TUI or CLI based on arguments.
- **Write password:** per-user with daily expiry, replaces hardcoded hash from 0.9.0.
- **Logging:** 100MB rotation (was 5MB), bearer token no longer stored in auth log.
- **Markdown export:** objects now include full descriptions (fetched via object detail API).

### Fixed

- HTML tags in descriptions stripped for terminal display (Bug 4).
- OData injection via solution filter escaped (Bug 9).
- Math.max() on empty arrays guarded with floor values (Bug 8).
- Misleading "Token expired" errors replaced with `ODataError` class (Bug 7).
- Write hash/salt duplication eliminated — centralized in `src/core/auth.ts` (Bug 10).

### Known limitations

- Relationship date filtering is client-side only — Orbus API does not support `$filter` on `DateCreated` for Relationships (Bug 6).
- `--alias` on `relationships-create` removed — Orbus API returns HTTP 500 when `attributeValues` is passed on relationship POST. Workaround: create then update with `--set "Alias=..."`.
- Choice attribute IDs (RASCI, Access Operator) are hardcoded GUIDs.
- Relationship type names require `ArchiMate:` prefix (e.g., `"ArchiMate: Association"`).

## [0.9.0] - 2026-05-04

### Added

- Markdown export (`orbusctl export --format markdown`) with model metadata, statistics, per-diagram detail, object-diagram coverage, and audit sections.
- Template-based Markdown export (`--template`) with `ORBUS-TABLE` and `ORBUS-DIAGRAM` directives, scope overrides, SVG embedding, and missing-asset warnings.
- ID-based scripting flags for direct lookups: `--model-id`, `--object-id`, and `--drawing-id` across object, drawing, and export workflows.
- `objects update` and `relationships update` commands for text attributes, plus `--set-choice` support for registry-backed Choice attributes such as RASCI and Access Operator.
- `objects move` command with dry-run support, object movement, relationship recreation, and a saved JSON correlation table for follow-up copy/migration workflows.
- API helpers for direct model/drawing fetches, object and relationship counts, object moves, relationship recreation, and attribute updates.

### Changed

- `createRelationship` now accepts arbitrary relationship attributes instead of only an `Alias` string, preserving custom relationship values during recreation.
- `auth` now accepts tokens through `--token` only; the positional token argument was removed to keep scripted usage explicit.
- README and CLAUDE.md now describe current behavior only, with version-by-version history kept in this changelog.

### Fixed

- RASCI template tables now read from the `RASCI` attribute instead of `Alias` and render compact codes such as `SC` and `RA`.

## [0.8.0] - 2026-05-03

### Added

- Structured logging system
- Relationship alias display
- Relationship attribute browsing

## [0.7.0] - 2026-05-02

### Added

- Write commands for creating objects (`orbusctl create object`)
- Write commands for creating relationships (`orbusctl create relationship`)

## [0.6.1] - 2026-05-01

### Fixed

- Greedy name matching: model, object, and drawing matching now uses three-tier resolution (exact match, single partial match, or error with disambiguation list). Fixes silent wrong results when multiple items match a search string.
- ANSI colour codes are suppressed when stdout is not a TTY or `NO_COLOR` is set. Fixes garbled output when piped or captured by other tools.

## [0.6.0] - 2026-04-27

### Added

- `orbusctl drawings` command: list and inspect drawing components with ArchiMate colour coding
- `orbusctl export` command: full `.xlsx` export with Objects, Relationships, and Drawings sheets
- Export `--details` mode: per-drawing object sheets, Audit - No Diagram, and Audit - No Relationship sheets
- Drawing counts in `models --detail` and interactive menu

## [0.5.0] - 2026-04-27

### Added

- `--json` flag on all subcommands for machine-readable output

## [0.4.0] - 2026-04-26

### Added

- Activity report: scans all visible models for recently created/modified objects and relationships
- Summary view with per-model counts, drill-down to per-user changes with object names and timestamps
- Reports auto-saved as markdown to `~/.orbusctl/reports/`

## [0.3.0] - 2026-04-26

### Added

- `orbusctl version` command with GitHub update check
- ArchiMate 3.2 layer colour coding for all object types

## [0.2.1] - 2026-04-26

### Changed

- Updated README and CLAUDE.md to document v0.2.0 features

## [0.2.0] - 2026-04-26

### Added

- Object listing in a model with type, last modified by/date
- Object detail with description, attributes, lock status
- Relationships loaded in parallel
- Tree-structured model picker for interactive mode

## [0.1.0] - 2026-04-26

### Added

- Interactive CLI and scriptable subcommands for the Orbus (iServer) API
- Token authentication with validation against `/odata/Me`
- Model listing with hierarchy tree, solution filtering, and detail counts
- Persistent config at `~/.orbusctl/config.json`

[Unreleased]: https://github.com/fgraciani/orbusctl/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/fgraciani/orbusctl/compare/v0.9.0...v1.0.0
[0.9.0]: https://github.com/fgraciani/orbusctl/compare/v0.8.0...v0.9.0
[0.8.0]: https://github.com/fgraciani/orbusctl/compare/v0.7.0...v0.8.0
[0.7.0]: https://github.com/fgraciani/orbusctl/compare/v0.6.1...v0.7.0
[0.6.1]: https://github.com/fgraciani/orbusctl/compare/v0.6.0...v0.6.1
[0.6.0]: https://github.com/fgraciani/orbusctl/compare/v0.5.0...v0.6.0
[0.5.0]: https://github.com/fgraciani/orbusctl/compare/v0.4.0...v0.5.0
[0.4.0]: https://github.com/fgraciani/orbusctl/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/fgraciani/orbusctl/compare/v0.2.1...v0.3.0
[0.2.1]: https://github.com/fgraciani/orbusctl/compare/v0.2.0...v0.2.1
[0.2.0]: https://github.com/fgraciani/orbusctl/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/fgraciani/orbusctl/releases/tag/v0.1.0
