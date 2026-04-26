# orbusctl

Unofficial Orbus administration CLI built by Francisco Graciani.

This is not an official Orbus tool.

## Status

**v0.2.1** — Interactive menu and scriptable subcommands for authentication, model listing with hierarchy and detail counts, object browsing with detail views and relationships, and configuration management.

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
- **List models (detail)** — same tree but with object and relationship counts per model
- **List objects in model** — pick a model from a tree-structured list, browse objects sorted by type, drill into any object for full details
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

# Configuration
orbusctl config                      # view current settings
orbusctl config --solution "ArchiMate 3.1"
orbusctl config --solution ""        # clear filter, show all models
orbusctl config --show-hidden        # include deactivated models
orbusctl config --no-show-hidden     # hide deactivated models
orbusctl config --reset              # reset to defaults

# Help
orbusctl --help
orbusctl models --help
orbusctl objects --help
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
