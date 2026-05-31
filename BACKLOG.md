# Backlog

Items at the top are next. Items at the bottom are future/someday.

## Next up

- **CLI: `audit` command** — `orbusctl audit --model "X" [--json]`. Run audit from CLI, output issues. The core `performAudit()` function already exists.
- **CLI: `compare` command** — `orbusctl compare --model-a "X" --model-b "Y" [--json]`. Side-by-side diff from CLI. The core `useCompare` logic exists in a hook; extract to domain function.
- **Doc refresh** (`orbusctl doc refresh <file.md>`) — selective update: re-pull Orbus data inside ORBUS:BEGIN/END markers, add new sections for new model elements (e.g., new subprocess), warn about removed elements. Preserves human narrative outside markers.
- **Doc validate** (`orbusctl doc validate <file.md>`) — check document structure against template. Missing sections = warning, structural deviations = error, `--force` to override.
- **TUI template export** — add "Template" as third format in the Export section with template picker and variable input (plan exists at `docs/tui-template-export-plan.md`).

## Improvements

- **Export history in TUI** — show previously exported files in the Export section or a dedicated Files section. Implementation options: (a) simple `readdirSync` on `~/.orbusctl/exports/`, (b) richer `exports.jsonl` log appended on each export (model, format, template, date). Design question: filter by current model or show all? Integrates with `[o]` to open file.
- **Markdown viewer config** — add a config key (separate from `browser`) specifying which app opens `.md` files when pressing `[o]` on template export results. Candidates: System default, VS Code, Obsidian, Typora, custom path. Mirrors the existing browser picker in Config section.
- **Backup & restore** — object-level snapshot before destructive writes (delete, update). Options: (a) embed `snapshot` field in `write.jsonl` entries for destructive ops, (b) sidecar `.json` files in `~/.orbusctl/backups/`. Add `orbusctl objects-restore --object-id <guid> --from <timestamp>`. Priority use case: undo for `objects-delete` and accidental `objects-update`. See CLAUDE.md for write safety constraints.
- **Relationship type shortnames** — `resolveRelationshipTypeId()` currently requires full `ArchiMate: Association` prefix. Add fallback that prepends `ArchiMate: ` and retries.
- **Admin auto-scan** — if user is admin, on first TUI launch of the day, run audit + activity scan in background. Save snapshots to `~/.orbusctl/snapshots/YYYY-MM-DD/` for time-series data.
- **Remote version checking** — `version` command checks GitHub for updates (was in 0.9.0, deferred to 1.1.0).
- **`objects copy` command** — correlation table already supports `operation: 'copy'`. Similar to move but creates copies instead of moving.

## Document generation pipeline

- **`{{FOR_EACH_SUBPROCESS}}` loops** — iterate over sub-processes in templates for section-per-process generation.
- **Doc publish** (`orbusctl doc publish <file.md> --format word`) — pandoc pipeline: markdown to Word with a reference .docx for styles.
- **Word comments workflow** — feedback from Word review maps back to markdown sections. Architect updates narrative, regenerates.
- **Agent-assisted narrative** — LLM drafts initial narrative between ORBUS markers based on model data and document context.

## Platform / future

- **MCP server** — register `core/` functions as MCP tools. Same API layer, different frontend. Enables LLM agents to query Orbus directly.
- **Cross-model search** — search and filter objects/relationships across all models.
- **Cross-model queries** — "what changed between Release N and N+1".
- **`lint` / `validate` subcommand** — ArchiMate style guide checks. AG governance gateway. Defer until style guide is mature.
- **Choice attribute discovery** — currently hardcoded GUIDs in `choice-maps.ts`. Make configurable or discoverable from API.
- **Workspace and View listing** — Phase 1 remainder from original roadmap.
- **Bi-directional sync** — markdown to Orbus (push narrative back to model descriptions).
- **`diagrams migrate`** — rewrite diagram XML with correlation table IDs (blocked on Orbus diagram API).
- **zsh tab completion** — auto-complete for commands and flags.
