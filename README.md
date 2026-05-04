# orbusctl

Unofficial Orbus administration CLI built by Francisco Graciani.

This is not an official Orbus tool.

## Status

**v0.9.0** — See [CHANGELOG.md](CHANGELOG.md) for version history.

## Prerequisites

- Node.js 20.12+ (or Node.js 22.13+)
- npm

## Install

```sh
npm install
npm run build
```

Or install directly from GitHub:

```sh
npm install -g github:fgraciani/orbusctl
```

## Run

```sh
./bin/run.js
```

### Link globally

To make `orbusctl` available as a command anywhere in your terminal:

```sh
npm link
```

Then run:

```sh
orbusctl
```

To unlink later:

```sh
npm unlink -g orbusctl
```

## Features

### Interactive mode

Running `orbusctl` with no arguments starts an interactive session with a menu:

- **List models** — display models as a tree using the baseline model hierarchy, sorted alphabetically
- **List models (detail)** — same tree but with object, relationship, and drawing counts per model
- **List objects in model** — pick a model from a tree-structured list, browse objects sorted by type, drill into any object for full details
- **List drawings in model** — pick a model, browse drawings with type and component count, drill into any drawing to see placed objects (with ArchiMate colour coding) and relationships
- **Export model to Excel** — create a workbook with objects, relationships, drawings, and audit sheets
- **Activity report** — review recent object and relationship changes across visible models
- **Configuration** — view and change settings (auth, solution filter, hidden models)
- **Exit** — clear the terminal and quit

On startup, if a saved token exists it is validated against the API. If expired, you are prompted for a new one immediately.

### Object detail view

Selecting an object shows a boxed detail card with:

- Description (pulled from attributes, shown prominently)
- Object ID, model, type, source (Original/Reuse/Variant with originating model)
- Version, created/modified dates with authors
- Lock status (shown in red when locked)
- All non-empty attributes
- Relationships with direction, related object name and type, relationship type, and relationship attributes (if any)

### Excel export

`orbusctl export --model "My Model"` exports a model's full content to an `.xlsx` file saved in `~/.orbusctl/exports/` (or a custom path via `--output`). The file is named `YYYY-MM-DD-HH-MM-ModelName.xlsx` and contains three sheets:

- **Objects** — one row per object; fixed columns (Name, iServer365 Id, Type, Description, Status, Version, Created By, Date Created, Last Modified By, Last Modified Date, Locked By, Locked On) followed by all custom attributes found in the model, sorted alphabetically. In `--details` mode, also generates per-drawing sheets (`DRAW - DrawingName`) listing which objects appear in each diagram, plus two audit sheets: **Audit - No Diagram** (objects not placed in any drawing) and **Audit - No Relationship** (objects with no relationships).
- **Relationships** — one row per relationship with Relationship Type, From, To, Created By, Date Created
- **Drawings** — one row per drawing with Name, Type, Accessibility, and component count

Use `--no-details` to skip per-object attribute fetching — exports only Name, iServer365 Id, and Type. Much faster for large models.

### Markdown export

`orbusctl export --model "My Model" --format markdown` exports a model to a `.md` file with YAML frontmatter. The file contains:

- **Model Information** — model ID, baseline model, hidden status
- **Diagrams** — table of all drawings with type, accessibility, and component count
- **Statistics** — object counts by type, relationship counts by type (ArchiMate prefix stripped)
- **Diagram Detail** — one section per drawing with tables of contained objects and relationships
- **Object-Diagram Coverage** — matrix of all objects × all drawings; orphaned objects (on no diagram) shown in bold
- **Audit** — objects without diagrams; objects without relationships

Pipe characters in values are replaced with `/` to keep tables valid. Descriptions are rendered as-is (including any HTML tags stored in Orbus). Cell values over 200 characters are truncated with ` [...]`.

### Template-based export

`orbusctl export --model "My Model" --format markdown --template path/to/template.md` uses a user-supplied Markdown template with embedded directives:

- `<!-- ORBUS-TABLE: type="tasks" process="..." -->` -- task list from model
- `<!-- ORBUS-TABLE: type="io" process="..." direction="input|output|all" -->` -- inputs/outputs from Access relationships and Operator attribute
- `<!-- ORBUS-TABLE: type="roles" process="..." -->` -- associated roles
- `<!-- ORBUS-TABLE: type="rasci" process="..." -->` -- RASCI matrix from Association relationships
- `<!-- ORBUS-TABLE: type="lifecycle" process="..." -->` -- lettered sub-process list
- `<!-- ORBUS-DIAGRAM: name="..." caption="..." -->` -- embedded SVG image (`![caption](../assets/filename.svg)`)

Templates support scope overrides via frontmatter (`template-scope-ProcessName: "Task1, Task2"`) to explicitly map processes to tasks when model-level Aggregation is ambiguous.

SVG diagram files should be placed in an `assets/` folder next to the template. `orbusctl` warns at export time if any referenced SVG is missing.

### ArchiMate colour coding

Object types are colour-coded in the terminal based on the ArchiMate 3.2 layer colours:

| Layer | Standard colour | Hex | Terminal colour |
|---|---|---|---|
| **Strategy** | Cream/tan | `#F5DEAA` | Bright yellow |
| **Business** | Yellow | `#FFFFB5` | Yellow |
| **Application** | Light blue | `#B5FFFF` | Cyan |
| **Technology** | Green | `#C9E7B7` | Green |
| **Physical** | Green | `#C9E7B7` | Bright green |
| **Motivation** | Lavender | `#CCCCFF` | Magenta |
| **Implementation & Migration** | Pink/salmon | `#FFE0E0` | Red |
| **Composite** | Grey | `#E0E0E0` | White |

### Subcommands (for scripts and LLMs)

Every feature is also available as a non-interactive subcommand:

```sh
# Authenticate
orbusctl auth                        # interactive prompt
orbusctl auth --token <bearer-token> # non-interactive

# List models
orbusctl models                      # standard tree view
orbusctl models --detail             # with object and relationship counts

# List objects in a model
orbusctl objects --model "Airports"                  # list all objects (partial name match)
orbusctl objects --model "Airports" --object "DWH"   # show object detail (partial name match)
orbusctl objects --model-id <guid>                   # list objects by model GUID
orbusctl objects --model-id <guid> --object-id <guid> # object detail by GUID

# List drawings in a model
orbusctl drawings --model "EA Practice"                              # list all drawings
orbusctl drawings --model "EA Practice" --drawing "2025 EA"         # show drawing components
orbusctl drawings --model-id <guid>                                  # list drawings by model GUID
orbusctl drawings --model-id <guid> --drawing-id <guid>             # drawing detail by GUID

# Export model to Excel (.xlsx)
orbusctl export --model "EA Practice"                                # full export (all attributes)
orbusctl export --model "EA Practice" --no-details                  # fast: Name, Id, Type only
orbusctl export --model "EA Practice" --output ~/Desktop            # custom output directory
orbusctl export --model-id <guid>                                    # export by model GUID

# Export model to Markdown (.md)
orbusctl export --model "EA Practice" --format markdown
orbusctl export --model "EA Practice" --format markdown --output ~/Desktop

# Template-based export (custom document layout with ORBUS-TABLE/ORBUS-DIAGRAM tags)
orbusctl export --model-id <guid> --format markdown --template path/to/template.md --output path/to/output

# Configuration
orbusctl config                      # view current settings
orbusctl config --solution "ArchiMate 3.1"
orbusctl config --solution ""        # clear filter, show all models
orbusctl config --show-hidden        # include deactivated models
orbusctl config --no-show-hidden     # hide deactivated models
orbusctl config --reset              # reset to defaults

# Create an object (requires write password)
orbusctl objects create --model-id <guid> --name "My Object" --type "Business role" --password <pw>

# Create a relationship (requires write password)
orbusctl relationships create --model-id <guid> --lead-id <guid> --member-id <guid> --type "ArchiMate: Association" --password <pw>
orbusctl relationships create --model-id <guid> --lead-id <guid> --member-id <guid> --type "ArchiMate: Association" --alias "R" --password <pw>

# Update object attributes (requires write password)
orbusctl objects update --object-id <guid> --set "Name=New name" --set "Description=New desc" --password <pw>

# Update relationship attributes (requires write password)
orbusctl relationships update --relationship-id <guid> --set "Alias=R" --password <pw>

# Update Choice attributes (RASCI, Access Operator) with human-readable values
orbusctl relationships update --relationship-id <guid> --set-choice "RASCI=R,A" --password <pw>
orbusctl relationships update --relationship-id <guid> --set-choice "Access Operator=Read" --password <pw>

# Move objects between models (requires write password)
orbusctl objects move --source-id <guid> --target-id <guid> --dry-run --password <pw>
orbusctl objects move --source-id <guid> --target-id <guid> --password <pw>

# Activity report (admin only — requires password)
orbusctl activity --password <pw>                # last 7 days (default)
orbusctl activity --password <pw> --days 30      # last 30 days
orbusctl activity --password <pw> --hours 24     # last 24 hours
orbusctl activity --password <pw> --user "NAME"  # filter by user

# Version and update check
orbusctl version

# Help
orbusctl --help
orbusctl models --help
orbusctl objects --help
```

### JSON output (for scripts and LLMs)

Add `--json` to any subcommand for machine-readable JSON output. Progress messages are suppressed and only clean JSON is written to stdout.

```sh
orbusctl version --json
orbusctl auth --token <bearer-token> --json
orbusctl config --json
orbusctl models --json
orbusctl models --detail --json
orbusctl objects --model "Airports" --json
orbusctl objects --model "Airports" --object "DWH" --json
orbusctl objects --model-id <guid> --json
orbusctl objects --model-id <guid> --object-id <guid> --json
orbusctl drawings --model "EA Practice" --json
orbusctl drawings --model "EA Practice" --drawing "2025 EA" --json
orbusctl drawings --model-id <guid> --json
orbusctl drawings --model-id <guid> --drawing-id <guid> --json
orbusctl activity --password <pw> --json
orbusctl export --model "EA Practice" --json
orbusctl export --model "EA Practice" --no-details --json
orbusctl export --model-id <guid> --json
orbusctl export --model "EA Practice" --format markdown --json
orbusctl export --model-id <guid> --format markdown --template path/to/template.md --json
orbusctl objects create --model-id <guid> --name "Test" --type "Business role" --password <pw> --json
orbusctl relationships create --model-id <guid> --lead-id <guid> --member-id <guid> --type "ArchiMate: Association" --password <pw> --json
orbusctl relationships create --model-id <guid> --lead-id <guid> --member-id <guid> --type "ArchiMate: Association" --alias "R" --password <pw> --json
orbusctl objects update --object-id <guid> --set "Name=New name" --password <pw> --json
orbusctl relationships update --relationship-id <guid> --set "Alias=R" --password <pw> --json
orbusctl relationships update --relationship-id <guid> --set-choice "RASCI=R,A" --password <pw> --json
```

Example:

```sh
# Pipe model data to jq for filtering
orbusctl models --detail --json | jq '.models[] | select(.counts.objects > 100)'

# Get all objects as JSON for analysis
orbusctl objects --model "Airports" --json | jq '.objects'
```

### Scripting with IDs

Name-based flags (`--model`, `--object`, `--drawing`) use partial matching and are convenient for interactive use. For scripts, prefer the ID-based flags (`--model-id`, `--object-id`, `--drawing-id`) — they skip name resolution, avoid ambiguity, and align with the Orbus OData API. All JSON output includes IDs, so pipelines can chain commands:

```sh
MODEL_ID=$(orbusctl models --json | jq -r '.models[0].modelId')
orbusctl objects --model-id "$MODEL_ID" --json | jq '.objects[] | {name, objectId}'
```

### Authentication

Tokens are validated against the Orbus API (`/odata/Me`) before being saved. On success, the user's name and email are stored alongside the token in `~/.orbusctl/config.json`.

### Environment variable override

Scripts and CI pipelines can set the token via environment variable:

```sh
ORBUS_TOKEN=your-token orbusctl models
ORBUSCTL_WRITE_KEY=your-password orbusctl objects create --model-id <guid> --name "Test" --type "Business role"
```

`ORBUS_TOKEN` takes priority over the saved token. `ORBUSCTL_WRITE_KEY` is used when `--password` is omitted.

### Configuration defaults

- **Solution filter:** ArchiMate 3.1
- **Hidden models:** hidden/excluded

## Test

```sh
npm test
```

## License

MIT
