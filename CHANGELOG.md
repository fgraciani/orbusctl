# Changelog

All notable changes to orbusctl are documented in this file.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
This project uses [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
- Uses oclif's built-in `enableJsonFlag`; `this.log()` auto-suppressed in JSON mode
- Each command returns camelCase JSON

## [0.4.0] - 2026-04-26

### Added

- Activity report: scans all visible models for recently created/modified objects and relationships
- Summary view with per-model counts, drill-down to per-user changes with object names and timestamps
- Reports auto-saved as markdown to `~/.orbusctl/reports/`
- Available as interactive menu option and scriptable subcommand (`orbusctl activity --password <pw> --days 7`)
- Admin-only access gated by scrypt-hashed password

## [0.3.0] - 2026-04-26

### Added

- `orbusctl version` command with GitHub update check
- Startup update notification in interactive mode
- ArchiMate 3.2 layer colour coding for all object types (object lists, detail box, relationships)

## [0.2.1] - 2026-04-26

### Changed

- Updated README and CLAUDE.md to document v0.2.0 features

## [0.2.0] - 2026-04-26

### Added

- Object listing in a model with type, last modified by/date
- Object detail box with description, attributes, lock status
- Relationships loaded in parallel, shown inside detail box
- Object source display for Reuse/Variant objects
- Tree-structured model picker for interactive mode
- Subcommand: `orbusctl objects --model <name> [--object <name>]`
- System/metadata attributes filtered from detail view

## [0.1.0] - 2026-04-26

### Added

- Interactive CLI and scriptable subcommands for the Orbus (iServer) API
- Token authentication with validation against `/odata/Me`
- Model listing with hierarchy tree, solution filtering, and detail counts
- Persistent config at `~/.orbusctl/config.json`

[Unreleased]: https://github.com/fgraciani/orbusctl/compare/v0.9.0...HEAD
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
