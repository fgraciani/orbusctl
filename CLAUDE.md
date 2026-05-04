# CLAUDE.md

## Project overview

orbusctl is a CLI tool for interacting with the Orbus (iServer) API, built with TypeScript and oclif. It provides both an interactive terminal menu and scriptable subcommands.

## Current version: 0.9.0

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
- `GET /odata/Models({key})` — get single model by ID; supports `$select`
- `GET /odata/Documents({key})` — get single document; supports `$expand=Components($expand=Object(...),Relationship(...))`
- `GET /odata/DocumentTypes` — list document types; supports `$select`, `$top`, `$skip`
- `POST /odata/Objects` — create object; body: `{modelId, objectTypeId, attributeValuesFlat: {Name}}` — returns `{success, successMessage: {messageDefinition: {objectId}}}`
- `POST /odata/Relationships` — create relationship; body: `{modelId, relationshipTypeId, leadModelItemId, memberModelItemId}` — returns `{success, successMessage: {messageDefinition: {relationshipId}}}`; supports optional `attributeValues: [{attributeName, stringValue}]` to set relationship attributes on creation
- `PATCH /odata/Objects({key})` — update object attributes; body: `{attributeValuesFlat: {Name, Description, ...}}` for Text attributes — returns `{success, operationType: "Update", successMessage: {messageDefinition: {objectId, name, updatedObjectIds}}}`
- `PATCH /odata/Relationships({key})` — update relationship attributes; body: `{attributeValuesFlat: {Alias, ...}}` for Text attributes — returns `{success, operationType: "Update", successMessage: {messageDefinition: {relationshipId}}}`
- `PATCH` (both Objects and Relationships) also supports `{attributeValues: [{attributeName, attributeCategory: "Choice", choiceValues: [{attributeConfigurationChoiceId}]}]}` for known Choice attributes. `attributeValuesFlat` does NOT work for Choice attributes (returns `AttributeDoesNotExistByKey`). Choice IDs are mapped in `src/choice-maps.ts`.

### OData patterns

- Pagination: `$top=50&$skip=0`, increment `$skip` until a page returns fewer than 50 results
- Count without data: `$count=true&$top=0` returns `@odata.count` in the response
- Filter models by solution: `$filter=Solutions/any(s: s/Name eq 'ArchiMate 3.1')`
- Filter objects/relationships by model: `$filter=ModelId eq <uuid>`
- Direct object lookup: `/odata/Objects(<uuid>)` — returns object directly, not wrapped in `value` array
- Nested expands: `$expand=RelatedObjects($expand=RelatedItem($select=Name;$expand=ObjectType($select=Name)))` — do NOT add AttributeValues inside nested Relationship expand (3-level depth crashes the API)
- Object relationships with attributes: use `/odata/Relationships?$filter=LeadModelItemId eq <uuid> or MemberModelItemId eq <uuid>` with flat `$expand=RelationshipType,LeadObject,MemberObject,AttributeValues` instead
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
- Write commands (objects create/update/move, relationships create/update) are password-protected with a separate scrypt hash

### Object detail notes

- Object descriptions live in `AttributeValues` (AttributeName: "Description"), not as a direct field
- `Detail.Status` is the object source: "Original", "Reuse", or "Variant"
- `Detail.OriginalObjectId` points to the original object for Reuse/Variant — use it to look up the source model
- System attributes to filter from display: Name, Description, iServer365 Id, Created By, Date Created, Date Last Modified, Last Modified By, Metamodel Item Id, Metamodel Item Name
- `LockedOn`/`LockedBy` indicate content locks — show in red when locked
- Object relationships are fetched via `/odata/Relationships` filtered by LeadModelItemId/MemberModelItemId (not via RelatedObjects expand) to allow flat AttributeValues expansion
- Direction is computed from lead/member: if the object is lead → "Leads", if member → "Member of"
- Relationship attributes use the same `AttributeValue` shape as object attributes — filter system attributes from display

## Architecture

```
src/
  commands/       Command logic (oclif commands)
    index.ts      Interactive menu (default when no subcommand given)
    auth.ts       orbusctl auth
    models.ts     orbusctl models
    objects/
      index.ts    orbusctl objects
      create.ts   orbusctl objects create (password-protected)
      update.ts   orbusctl objects update (password-protected)
      move.ts     orbusctl objects move (password-protected)
    relationships/
      create.ts   orbusctl relationships create (password-protected)
      update.ts   orbusctl relationships update (password-protected)
    drawings.ts   orbusctl drawings
    export.ts     orbusctl export (Excel/Markdown export of objects, relationships, drawings)
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
  log.ts          Structured JSONL logging (~/.orbusctl/logs/)
  type-maps.ts    ArchiMate 3.1 object type and relationship type ID maps
  choice-maps.ts  Known Choice attribute value maps (RASCI, Access Operator) with human-readable value resolution
  correlation.ts  CorrelationTable types and saveCorrelationTable helper for move/copy operations
  update.ts       Version check against GitHub remote
  utils/
    resolve.ts    resolveMatch() — three-tier fuzzy name matching for models/objects/drawings
  markdown-export.ts   Markdown export logic (frontmatter, stats, objects catalogue, diagram detail, coverage matrix, audit)
  template-export.ts   Template-based markdown export (ORBUS-TABLE/ORBUS-DIAGRAM tag processing, scope overrides, SVG embedding)
```

### JSON output

All subcommands (except the interactive menu) support `--json` via oclif's built-in `enableJsonFlag`. When active, `this.log()` and `this.warn()` are suppressed and the return value of `run()` is serialized as JSON to stdout. Each command returns camelCase keys. Maps are converted to arrays.

## Git and versioning

- **Semantic versioning**: MAJOR.MINOR.PATCH. New features bump MINOR, bug fixes bump PATCH. Pre-1.0, breaking changes also bump MINOR.
- **Version source of truth**: `package.json` version field. Keep `package-lock.json`, the "Current version" line in this file, and the Status line in `README.md` in sync with it.
- **CHANGELOG.md**: follows [Keep a Changelog](https://keepachangelog.com/) format. This is the only place that describes what changed per version.
  - **`[Unreleased]` section**: every code change gets a line added under `## [Unreleased]` immediately, even before committing. This keeps a running draft of what will become the next version. Use Added/Changed/Fixed/Removed sub-sections.
  - **On release**: rename `[Unreleased]` to `[X.Y.Z] - YYYY-MM-DD`, add a fresh empty `## [Unreleased]` above it, update the comparison links at the bottom, and bump `package.json`.
- **Git tags**: create a tag `vX.Y.Z` for every release. Push tags with `git push --tags`.
- **Commit granularity**: prefer smaller, focused commits over mega-commits. A feature can span 2-3 commits (data layer, UI, docs). Tag the final one.
- **Commit messages**: imperative mood title, blank line, then body explaining what and why. Keep the version tag `(vX.Y.Z)` in the title of version-bump commits.

### What goes where (no duplication)

| File | Purpose | Update when |
|---|---|---|
| `CHANGELOG.md` | Version history: what changed, when | Every version bump |
| `README.md` | What the tool does today, how to install and use it | Commands, flags, or behaviour change |
| `CLAUDE.md` | Architecture, API patterns, rules for working on the code | Files, endpoints, or conventions change |

Do NOT duplicate changelog content into README or CLAUDE.md. README and CLAUDE.md describe current state only — no version-by-version narratives. When a feature is added or changed, update the relevant sections in README/CLAUDE.md to reflect the new current state, and record the version history exclusively in CHANGELOG.md.

## Rules

- Keep command logic (src/commands/) separate from terminal presentation code (src/ui/).
- Keep the implementation boring, clean, and minimal.
- API calls go in src/api.ts, not in commands.
- Config access goes through src/config.ts functions, not direct file reads.
- Auth JSONL logs intentionally include full local bearer tokens for token-behavior analysis; future versions may switch to token hashes.
- Before committing, update README.md, CLAUDE.md, and CHANGELOG.md as needed (see "What goes where" above).

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
orbusctl objects --model-id <guid>                           # skip name resolution

# Show full details for a specific object
orbusctl objects --model "Airports" --object "DWH"
orbusctl objects --model-id <guid> --object-id <guid>        # by GUID

# List drawings in a model (partial name match)
orbusctl drawings --model "EA Practice"
orbusctl drawings --model-id <guid>

# Show components of a specific drawing
orbusctl drawings --model "EA Practice" --drawing "2025 EA Objectives"
orbusctl drawings --model-id <guid> --drawing-id <guid>      # by GUID

# Export model to Excel (objects + relationships + drawings sheets)
orbusctl export --model "EA Practice"
orbusctl export --model-id <guid>                            # skip name resolution
orbusctl export --model "EA Practice" --no-details          # fast: Name/Id/Type only
orbusctl export --model "EA Practice" --output ~/Desktop    # custom output directory

# Export model to Markdown (vanilla: metadata, stats, objects catalogue with descriptions, diagram detail, coverage matrix, audit)
orbusctl export --model "EA Practice" --format markdown
orbusctl export --model "EA Practice" --format markdown --output ~/Desktop

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

# Create an object (requires write password)
orbusctl objects create --model-id <guid> --name "My Object" --type "Business role" --password <pw>

# Update object attributes (requires write password)
orbusctl objects update --object-id <guid> --set "Name=New name" --set "Description=New desc" --password <pw>

# Create a relationship (requires write password)
orbusctl relationships create --model-id <guid> --lead-id <guid> --member-id <guid> --type "ArchiMate: Association" --password <pw>
orbusctl relationships create --model-id <guid> --lead-id <guid> --member-id <guid> --type "ArchiMate: Association" --alias "R" --password <pw>

# Update relationship attributes (requires write password)
orbusctl relationships update --relationship-id <guid> --set "Alias=R" --password <pw>

# Update Choice attributes with human-readable values (requires write password)
orbusctl relationships update --relationship-id <guid> --set-choice "RASCI=R,A" --password <pw>
orbusctl relationships update --relationship-id <guid> --set-choice "Access Operator=Read" --password <pw>
orbusctl objects update --object-id <guid> --set-choice "Access Operator=Read" --password <pw>

# Move objects between models (requires write password)
orbusctl objects move --source-id <guid> --target-id <guid> --dry-run --password <pw>
orbusctl objects move --source-id <guid> --target-id <guid> --password <pw>

# Template-based export (custom document layout)
orbusctl export --model-id <guid> --format markdown --template path/to/template.md --output path/to/output

# Write commands also accept password via env var
ORBUSCTL_WRITE_KEY=<pw> orbusctl objects create --model-id <guid> --name "My Object" --type "Business role"

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
orbusctl export --model "EA Practice" --format markdown --json
orbusctl objects create --model-id <guid> --name "Test" --type "Business role" --password <pw> --json
orbusctl relationships create --model-id <guid> --lead-id <guid> --member-id <guid> --type "ArchiMate: Association" --password <pw> --json
orbusctl relationships create --model-id <guid> --lead-id <guid> --member-id <guid> --type "ArchiMate: Association" --alias "R" --password <pw> --json
orbusctl objects update --object-id <guid> --set "Name=New name" --password <pw> --json
orbusctl relationships update --relationship-id <guid> --set "Alias=R" --password <pw> --json
orbusctl relationships update --relationship-id <guid> --set-choice "RASCI=R,A" --password <pw> --json
orbusctl export --model-id <guid> --format markdown --template path/to/template.md --json
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
  "tokenSavedAt": "2025-05-03T10:00:00.000Z",
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
