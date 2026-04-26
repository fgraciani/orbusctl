# CLAUDE.md

## Project overview

orbusctl is a CLI tool for interacting with the Orbus (iServer) API, built with TypeScript and oclif. It provides both an interactive terminal menu and scriptable subcommands.

## Current version: 0.2.1

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
- `GET /odata/Relationships` — list relationships; supports `$filter` by `ModelId`, `$count=true&$top=0` for count-only

### OData patterns

- Pagination: `$top=50&$skip=0`, increment `$skip` until a page returns fewer than 50 results
- Count without data: `$count=true&$top=0` returns `@odata.count` in the response
- Filter models by solution: `$filter=Solutions/any(s: s/Name eq 'ArchiMate 3.1')`
- Filter objects/relationships by model: `$filter=ModelId eq <uuid>`
- Direct object lookup: `/odata/Objects(<uuid>)` — returns object directly, not wrapped in `value` array
- Nested expands: `$expand=RelatedObjects($expand=RelatedItem($select=Name;$expand=ObjectType($select=Name)))`

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
    config.ts     orbusctl config
  ui/             Terminal presentation
    banner.ts     ASCII logo
    menu.ts       Interactive menu choices
    table.ts      Object table and boxed detail card (uses boxen)
    tree.ts       Model hierarchy tree formatter and model chooser
  api.ts          All API calls (fetch functions)
  config.ts       Config file read/write (~/.orbusctl/config.json)
```

## Rules

- Keep command logic (src/commands/) separate from terminal presentation code (src/ui/).
- Keep the implementation boring, clean, and minimal.
- API calls go in src/api.ts, not in commands.
- Config access goes through src/config.ts functions, not direct file reads.

## Subcommands (for scripts and LLMs)

```sh
# Authenticate (interactive)
orbusctl auth

# Authenticate (non-interactive, for scripts)
orbusctl auth --token <bearer-token>

# List models (uses saved config for filters)
orbusctl models

# List models with object and relationship counts
orbusctl models --detail

# List objects in a model (partial name match)
orbusctl objects --model "Airports"

# Show full details for a specific object
orbusctl objects --model "Airports" --object "DWH"

# Show current config
orbusctl config

# Change settings via flags
orbusctl config --solution "ArchiMate 3.1"
orbusctl config --solution ""               # clear filter, show all models
orbusctl config --show-hidden               # include deactivated models
orbusctl config --no-show-hidden            # hide deactivated models
orbusctl config --reset                     # reset to defaults

# Environment variable override (token only, for CI/scripts)
ORBUS_TOKEN=<token> orbusctl models
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
