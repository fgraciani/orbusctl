# orbusctl

A CLI and interactive TUI for Orbus Infinity (iServer365). Browse models, audit data quality, track activity, export to Excel/Markdown, and generate architecture documents — all from the terminal.

## Install

```bash
# From the package directory (local development)
npm install
npm run build
npm link

# Or install globally from npm (once published)
npm install -g orbusctl
```

Requires Node.js 18+.

## Quick start

```bash
orbusctl                          # launch TUI
orbusctl auth --token <token>     # save your Orbus bearer token
orbusctl models                   # list models
orbusctl --help                   # show all commands
```

## TUI sections

| Section | What it does |
|---------|-------------|
| Content | Browse models, drill into objects, view attributes and relationships |
| Drawings | Browse diagrams and their components |
| Compare | Side-by-side object diff between two models |
| Activity | Recent changes across models by user, exportable as Excel |
| Audit | Data quality scan (empty descriptions, missing relationships, HTML in names) |
| Export | Export a model to Excel (.xlsx) or Markdown (.md) |
| Config | Server URL, solution filter, write password, browser preference |

## CLI commands

| Command | Description |
|---------|-------------|
| `auth` | Save authentication token |
| `models` | List models |
| `objects` | List or inspect objects in a model |
| `drawings` | List or inspect drawings in a model |
| `export` | Export a model to Excel or Markdown |
| `activity` | Show recent activity across models |
| `config` | Show current configuration |
| `version` | Show version |
| `doc` | Document generation (`doc generate`) |
| `objects-create` | Create an object in a model |
| `objects-update` | Update object attributes |
| `objects-move` | Move objects between models |
| `relationships-create` | Create a relationship |
| `relationships-update` | Update relationship attributes |
| `objects-delete` | Delete an object by ID |
| `relationships-delete` | Delete a relationship by ID |

Run `orbusctl <command> --help` for options.

## Write operations

Write commands require a write password set via the TUI Config section. The password expires every 24 hours.

**Always pass `--password <pw>`:**
```bash
orbusctl objects-create --model-id <guid> --name "My Object" --type "Business Process" --password <pw>
orbusctl objects-update --object-id <guid> --set "Description=Updated" --password <pw>
orbusctl relationships-create --model-id <guid> --lead-id <id1> --member-id <id2> --type "Association" --password <pw>
```

**Write safety:** This tool connects to a production Orbus instance. Only test write operations against designated test models. Define your test models in `CLAUDE.md` or your team's agent instructions. All write operations are logged to `~/.orbusctl/logs/write.jsonl`.

## Document generation

Generate architecture documents from markdown templates with live Orbus data:

```bash
orbusctl doc generate \
  --model "Architecture Management Process" \
  --template process-description \
  --var "process_name=Architecture Management Process"
```

Templates live in `~/.orbusctl/templates/`. Use `<!-- ORBUS:BEGIN type="tasks" process="{{process_name}}" -->` markers in templates to embed live Orbus data. The tool fetches objects and relationships from the model and generates tables for tasks, roles, RASCI matrices, I/O flows, and diagrams.

## Configuration

All state is stored in `~/.orbusctl/config.json` (permissions: 0600).

| Key | Description |
|-----|-------------|
| `server` | Orbus API base URL |
| `token` | Bearer token (set via `orbusctl auth`) |
| `solutionFilter` | Filter models by solution (e.g. ArchiMate 3.1) |
| `showHiddenModels` | Include hidden models in lists |
| `writePasswordHash` / `writePasswordSalt` | Scrypt hash of write password |
| `browser` | Preferred browser for "open in Orbus" (`[o]` key) |

Exports and reports: `~/.orbusctl/exports/`, `~/.orbusctl/reports/`
Templates: `~/.orbusctl/templates/`
Write log: `~/.orbusctl/logs/write.jsonl`

## Keyboard shortcuts

| Key | Action |
|-----|--------|
| `Tab` | Switch focus between sidebar and main panel |
| `↑` / `↓` | Navigate (wraps around) |
| `↵` | Select / drill in |
| `Esc` / `←` | Back |
| `o` | Open current object in Orbus web UI |
| `e` | Export current results (Audit, Activity sections) |
| `s` | Toggle API stats panel |
| `?` | Toggle context-sensitive help panel |
| `a` | Open auth modal |
| `q` | Quit |
