# CLAUDE.md

## Project overview

orbusctl is a CLI tool for interacting with the Orbus (iServer) API, built with TypeScript and oclif. It provides both an interactive terminal menu and scriptable subcommands.

## Current version: 0.6.1

## API

Base URL: `https://eurocontrol-api.iserver365.com`

Swagger: `https://eurocontrol-api.iserver365.com/rest/api/oapi2/swagger/v1/swagger.json`

Authentication is via Azure AD bearer tokens passed in the `Authorization` header. Tokens expire frequently (typically within an hour).

### Key endpoints used

- `GET /odata/Me` — validate token, returns user name and email
- `GET /odata/Models` — list models; supports `$top`, `$skip`, `$filter`, `$select`, `includeDeactivated`; max 50 per page
- `GET /odata/Solutions` — list solutions (used for filtering models)
- `GET /odata/Objects` — list objects; supports `$filter` by `ModelId`, `$count=true&$top=0` for count-only; max 50 per page
- `GET /odata/Objects({key})` — get single object by ID; supports `$expand` for ObjectType, AttributeValues, Detail, CreatedBy, LastModifiedBy, LockedBy, Model, RelatedObjects
- `GET /odata/Relationships` — list relationships; supports `$filter` by `ModelId`, `$count=true&$top=0` for count-only; supports `$expand` for RelationshipType, LeadObject, MemberObject, CreatedBy
- `GET /odata/Documents` — list drawings; supports `$filter` by `ModelId`, `$count=true&$top=0` for count-only; max 50 per page
- `GET /odata/Documents({key})` — get single document; supports `$expand=Components($expand=Object(...),Relationship(...))`
- `GET /odata/DocumentTypes` — list document types; supports `$select`, `$top`, `$skip`

### OData patterns

- Pagination: `$top=50&$skip=0`, increment `$skip` until a page returns fewer than 50 results
- Count without data: `$count=true&$top=0` returns `@odata.count` in the response
- Filter models by solution: `$filter=Solutions/any(s: s/Name eq 'ArchiMate 3.1')`
- Filter objects/relationships by model: `$filter=ModelId eq <uuid>`
- Direct object lookup: `/odata/Objects(<uuid>)` — returns object directly, not wrapped in `value` array
- Nested expands: `$expand=RelatedObjects($expand=RelatedItem($select=Name;$expand=ObjectType($select=Name)))`
- Filter documents by model: `$filter=ModelId eq <uuid>` — only returns Draw documents (Visio docs have null ModelId)
- Drawing components expand: `$expand=Components($expand=Object($select=Name;$expand=ObjectType($select=Name)),Relationship($select=RelationshipTypeId))`
- `RepresentationSituationId` in Components: 0/null = Object, 1 = Connector, 2 = Containment, 3 = Overlap

### Activity tracking notes

- Objects support server-side date filtering: `$filter=DateCreated gt <iso> or LastModifiedDate gt <iso>`
- Relationships do NOT support date filtering — use `$orderby=DateCreated desc` and stop paging when past cutoff
- No audit log, activity feed, or user-list endpoints exist in the API
- Users are discovered from `CreatedBy`/`LastModifiedBy` on objects/relationships
- Activity reports are auto-saved as markdown to `~/.orbusctl/reports/`
- The activity command is password-protected (scrypt hash embedded in source code)

### Object detail notes

- Object descriptions live in `AttributeValues` (AttributeName: "Description"), not as a direct field
- `Detail.Status` is the object source: "Original", "Reuse", or "Variant"
- `Detail.OriginalObjectId` points to the original object for Reuse/Variant — use it to look up the source model
- System attributes to filter from display: Name, Description, iServer365 Id, Created By, Date Created, Date Last Modified, Last Modified By, Metamodel Item Id, Metamodel Item Name
- `LockedOn`/`LockedBy` indicate content locks — show in red when locked
- `RelatedObjects` expand returns relationships with DirectionDescription, RelatedItem, and Relationship.RelationshipType

## Architecture

```
src/
  commands/       Command logic (oclif commands)
    index.ts      Interactive menu (default when no subcommand given)
    auth.ts       orbusctl auth
    models.ts     orbusctl models
    objects.ts    orbusctl objects
    drawings.ts   orbusctl drawings
    export.ts     orbusctl export (Excel export of objects, relationships, drawings)
    config.ts     orbusctl config
    version.ts    orbusctl version
    activity.ts   orbusctl activity (admin-only activity report)
  ui/             Terminal presentation
    activity.ts   Activity report formatting (terminal + markdown)
    banner.ts     ASCII logo
    colors.ts     ArchiMate 3.2 layer colour coding for object types
    drawings.ts   Drawing table, boxed detail card, and picker choices
    menu.ts       Interactive menu choices
    table.ts      Object table and boxed detail card (uses boxen)
    tree.ts       Model hierarchy tree formatter and model chooser
  api.ts          All API calls (fetch functions)
  config.ts       Config file read/write (~/.orbusctl/config.json)
  update.ts       Version check against GitHub remote
```

### JSON output

All subcommands (except the interactive menu) support `--json` via oclif's built-in `enableJsonFlag`. When active, `this.log()` and `this.warn()` are suppressed and the return value of `run()` is serialized as JSON to stdout. Each command returns camelCase keys. Maps are converted to arrays.

## Rules

- Keep command logic (src/commands/) separate from terminal presentation code (src/ui/).
- Keep the implementation boring, clean, and minimal.
- API calls go in src/api.ts, not in commands.
- Config access goes through src/config.ts functions, not direct file reads.
- Before committing, always update README.md and CLAUDE.md to reflect any new features, commands, files, or API endpoints.

## Subcommands (for scripts and LLMs)

```sh
# Authenticate (interactive)
orbusctl auth

# Authenticate (non-interactive, for scripts)
orbusctl auth --token <bearer-token>

# List models (uses saved config for filters)
orbusctl models

# List models with object, relationship, and drawing counts
orbusctl models --detail

# List objects in a model (partial name match)
orbusctl objects --model "Airports"

# Show full details for a specific object
orbusctl objects --model "Airports" --object "DWH"

# List drawings in a model (partial name match)
orbusctl drawings --model "EA Practice"

# Show components of a specific drawing
orbusctl drawings --model "EA Practice" --drawing "2025 EA Objectives"

# Export model to Excel (objects + relationships + drawings sheets)
orbusctl export --model "EA Practice"
orbusctl export --model "EA Practice" --no-details          # fast: Name/Id/Type only
orbusctl export --model "EA Practice" --output ~/Desktop    # custom output directory

# Show current config
orbusctl config

# Change settings via flags
orbusctl config --solution "ArchiMate 3.1"
orbusctl config --solution ""               # clear filter, show all models
orbusctl config --show-hidden               # include deactivated models
orbusctl config --no-show-hidden            # hide deactivated models
orbusctl config --reset                     # reset to defaults

# Version and update check
orbusctl version

# Activity report (admin only — requires password)
orbusctl activity --password <pw>                # last 7 days (default)
orbusctl activity --password <pw> --days 30      # last 30 days
orbusctl activity --password <pw> --hours 24     # last 24 hours
orbusctl activity --password <pw> --user "GRACIANI"  # filter by user

# Environment variable override (token only, for CI/scripts)
ORBUS_TOKEN=<token> orbusctl models

# JSON output (add --json to any command for machine-readable output)
orbusctl version --json
orbusctl auth --token <bearer-token> --json
orbusctl config --json
orbusctl models --json
orbusctl models --detail --json
orbusctl objects --model "Airports" --json
orbusctl objects --model "Airports" --object "DWH" --json
orbusctl drawings --model "EA Practice" --json
orbusctl drawings --model "EA Practice" --drawing "2025 EA Objectives" --json
orbusctl activity --password <pw> --json
orbusctl export --model "EA Practice" --json
orbusctl export --model "EA Practice" --no-details --json
```

## Config file

Stored at `~/.orbusctl/config.json`:

```json
{
  "token": "eyJ0eXA...",
  "user": {
    "name": "GRACIANI Francisco",
    "accountName": "francisco.graciani@eurocontrol.int",
    "emailAddress": "francisco.graciani@eurocontrol.int"
  },
  "solutionFilter": "ArchiMate 3.1",
  "showHiddenModels": false
}
```

Defaults: solution filter is "ArchiMate 3.1", hidden models are hidden.

## Build and run

```sh
npm install
npm run build
./bin/run.js
```

## Test

```sh
npm test
```
