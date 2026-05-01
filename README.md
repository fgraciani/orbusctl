# orbusctl

Unofficial Orbus administration CLI built by Francisco Graciani.

This is not an official Orbus tool.

## Status

**v0.6.1** — Interactive menu and scriptable subcommands for authentication, model listing with hierarchy and detail counts, object browsing with detail views and relationships, drawing browsing with component details, Excel export of model content (with per-drawing and audit sheets), ArchiMate colour coding, version check, configuration management, and machine-readable JSON output on all commands. Includes smart disambiguation for model/object/drawing name matching and automatic ANSI colour suppression in non-TTY environments.

## Prerequisites

- Node.js >= 18
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
- Relationships with direction, related object name and type, and relationship type

### Excel export

`orbusctl export --model "My Model"` exports a model's full content to an `.xlsx` file saved in `~/.orbusctl/exports/` (or a custom path via `--output`). The file is named `YYYY-MM-DD-HH-MM-ModelName.xlsx` and contains three sheets:

- **Objects** — one row per object; fixed columns (Name, iServer365 Id, Type, Description, Status, Version, Created By, Date Created, Last Modified By, Last Modified Date, Locked By, Locked On) followed by all custom attributes found in the model, sorted alphabetically. In `--details` mode, also generates per-drawing sheets (`DRAW - DrawingName`) listing which objects appear in each diagram, plus two audit sheets: **Audit - No Diagram** (objects not placed in any drawing) and **Audit - No Relationship** (objects with no relationships).
- **Relationships** — one row per relationship with Relationship Type, From, To, Created By, Date Created
- **Drawings** — one row per drawing with Name, Type, Accessibility, and component count

Use `--no-details` to skip per-object attribute fetching — exports only Name, iServer365 Id, and Type. Much faster for large models.

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

# List drawings in a model
orbusctl drawings --model "EA Practice"                              # list all drawings
orbusctl drawings --model "EA Practice" --drawing "2025 EA"         # show drawing components

# Export model to Excel (.xlsx)
orbusctl export --model "EA Practice"                                # full export (all attributes)
orbusctl export --model "EA Practice" --no-details                  # fast: Name, Id, Type only
orbusctl export --model "EA Practice" --output ~/Desktop            # custom output directory

# Configuration
orbusctl config                      # view current settings
orbusctl config --solution "ArchiMate 3.1"
orbusctl config --solution ""        # clear filter, show all models
orbusctl config --show-hidden        # include deactivated models
orbusctl config --no-show-hidden     # hide deactivated models
orbusctl config --reset              # reset to defaults

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
orbusctl drawings --model "EA Practice" --json
orbusctl drawings --model "EA Practice" --drawing "2025 EA" --json
orbusctl activity --password <pw> --json
orbusctl export --model "EA Practice" --json
orbusctl export --model "EA Practice" --no-details --json
```

Example:

```sh
# Pipe model data to jq for filtering
orbusctl models --detail --json | jq '.models[] | select(.counts.objects > 100)'

# Get all objects as JSON for analysis
orbusctl objects --model "Airports" --json | jq '.objects'
```

### Authentication

Tokens are validated against the Orbus API (`/odata/Me`) before being saved. On success, the user's name and email are stored alongside the token in `~/.orbusctl/config.json`.

### Environment variable override

Scripts and CI pipelines can set the token via environment variable:

```sh
ORBUS_TOKEN=your-token orbusctl models
```

The environment variable takes priority over the saved config.

### Configuration defaults

- **Solution filter:** ArchiMate 3.1
- **Hidden models:** Hidden

## Test

```sh
npm test
```

## License

MIT
