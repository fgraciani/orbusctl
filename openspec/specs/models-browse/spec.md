# models-browse Specification

## Purpose
List and browse Orbus EA models, drill into objects, view object details, and navigate between related objects.

## Requirements

### Requirement: Model list
The app SHALL display all accessible models in a hierarchical tree with counts.

#### Scenario: Models loaded
- GIVEN the user is authenticated
- WHEN the Models section is active
- THEN fetch models via `GET /odata/Models?includeDeactivated=true` with solution filter and hidden model logic from config
- AND display a tree with indentation (2 spaces per depth level) based on `BaselineModelId` hierarchy
- AND show columns: Name (flex width, padded), Objects, Rels, Draws (right-aligned, fixed 8-char columns)
- AND show `Models (N)` in the panel title
- AND apply virtual scrolling when the list exceeds the viewport height
- AND show `▲ N more above` / `▼ N more below` scroll indicators

Uses wrap-around scrolling (see tui-conventions).

#### Scenario: Model counts
- GIVEN models are displayed
- THEN fetch object, relationship, and drawing counts per model in parallel via `GET /odata/{entity}?$filter=ModelId eq {id}&$count=true&$top=0`
- AND show `…` while counts are loading, then replace with actual numbers

#### Scenario: No models available
- GIVEN the API returns an empty model list
- THEN display "No models found"

#### Scenario: Models fetch error
- GIVEN the API call to `fetchModels` throws
- THEN display a red error string in place of the model list

#### Scenario: Hidden models
- GIVEN `showHiddenModels` is false in config
- THEN exclude models where `IsHidden` is true
- GIVEN `showHiddenModels` is true
- THEN show hidden models with dimmed text

---

### Requirement: Object list (drill-down)
The user SHALL be able to drill into a model to browse its objects.

#### Scenario: Enter a model
- GIVEN a model is selected in the model list
- WHEN the user presses Enter or →
- THEN fetch objects via `GET /odata/Objects?$filter=ModelId eq {id}&$expand=ObjectType,LastModifiedBy`
- AND display the object list sorted by type name then object name
- AND show columns: Name (flex width, padded), Type (ArchiMate colour-coded, 22 chars), Modified (time ago, 10 chars)
- AND update panel title to `{ModelName} · Objects (N)`
- AND apply virtual scrolling with indicators

Uses wrap-around scrolling (see tui-conventions).

#### Scenario: Empty model
- GIVEN the API returns zero objects for the selected model
- THEN display "No objects in this model"

#### Scenario: Back to model list
- GIVEN the user is viewing an object list
- WHEN the user presses Esc or ←
- THEN return to the model list

---

### Requirement: Object detail (split panel)
The app SHALL display object details in a separate panel below the object list.

#### Scenario: Load object detail
- GIVEN the user is viewing an object list
- WHEN the user presses Enter on an object
- THEN fetch detail via `GET /odata/Objects({id})?$expand=ObjectType,AttributeValues,Detail,CreatedBy,LastModifiedBy,LockedBy,Model`
- AND fetch relationships via `GET /odata/Relationships?$filter=LeadObjectId eq {id} or MemberObjectId eq {id}&$expand=RelationshipType,LeadObject,MemberObject,AttributeValues`
- AND display in a separate Panel below the object list with the object name as panel title
- AND the objects list Panel remains visible above (split view, two sibling panels)
- AND mark the viewed object with `●` (yellow) in the list, selected with `▶`

#### Scenario: Detail loading state
- GIVEN the user has pressed Enter on an object
- WHEN the detail fetch is in progress
- THEN display a cyan "Loading…" indicator in the detail panel

#### Scenario: Detail error state
- GIVEN the detail fetch throws
- THEN display a red error string in the detail panel

#### Scenario: Detail content
- GIVEN an object's detail is loaded
- THEN display: object type (ArchiMate colour), version, status on the first line
- AND description (default white text, HTML stripped via `stripHtml()`); nothing is rendered when the description attribute is absent
- AND metadata: created/modified time and author, lock status if locked (red)
- AND non-system attributes (filtered: excludes Name, Description, Type, Created By, Date Created, Last Modified By, Date Last Modified, Metamodel Item Id, Metamodel Item Name, iServer365 Id)
- AND relationships with direction (Leads/Member of), related object name, relationship type

#### Scenario: Switch viewed object
- GIVEN a detail panel is showing
- WHEN the user navigates to a different object and presses Enter
- THEN update the detail panel with the new object's data

---

### Requirement: Browser launch
The app SHALL open the current object in the Orbus browser when requested.

Uses the `[o]` browser-launch key (see tui-conventions).

#### Scenario: Open object in browser
- GIVEN an object detail panel is open (viewed object is set)
- WHEN the user presses `[o]`
- THEN call `openInBrowser(getOrbusObjectUrl(objectId))`
- AND open the object's URL in the configured browser

---

### Requirement: Relationship navigation
The user SHALL be able to navigate to related objects from the detail panel.

#### Scenario: Focus detail panel
- GIVEN the detail panel is showing an object
- WHEN the user presses Enter on the same object again (second Enter)
- THEN the detail panel border goes cyan (focused)
- AND the objects list panel border goes gray (unfocused)
- AND a `▶` cursor appears on the first relationship

Uses wrap-around scrolling within the relationship list (see tui-conventions).

#### Scenario: Navigate relationships
- GIVEN the detail panel is focused
- WHEN the user presses ↑/↓
- THEN the cursor moves between relationships
- AND the selected relationship shows in cyan, others in default colour

#### Scenario: Jump to related object
- GIVEN a relationship is selected in the focused detail panel
- WHEN the user presses Enter
- THEN load the related object's detail (by its ObjectId)
- AND update the detail panel title and content

#### Scenario: Related object not found
- GIVEN a relationship is selected
- WHEN the user presses Enter and the related object cannot be fetched
- THEN display a red error string in the detail panel

#### Scenario: Return to object list
- GIVEN the detail panel is focused
- WHEN the user presses Esc or ←
- THEN focus returns to the objects list panel (cyan border)
- AND the detail panel border goes gray

---

### Requirement: Help panel
The app SHALL provide context-sensitive help for the models section.

Uses the `[?]` help panel toggle (see tui-conventions).

#### Scenario: Help content — model list
- GIVEN the user is at the model list level
- WHEN the help panel is open
- THEN display hints for browsing models (Enter/→ to drill in, ↑↓ to navigate)

#### Scenario: Help content — object list without detail
- GIVEN the user is viewing an object list with no detail panel open
- WHEN the help panel is open
- THEN display hints for drilling into objects and opening in Orbus browser (`[o] open in Orbus`)

#### Scenario: Help content — object list with detail
- GIVEN the user is viewing an object list with a detail panel open
- WHEN the help panel is open
- THEN display hints for relationship navigation and `[o] open in Orbus`

---

### Requirement: CLI — models command
The `orbusctl models` command SHALL list all models as a tree in the terminal.

Reference cli-conventions for `--json`, fuzzy resolution, error format, and tree-prefix output.

#### Scenario: List models (human-readable)
- GIVEN the user runs `orbusctl models`
- THEN print each model on one line with a tree prefix (depth-based, `treePrefix()` from `src/cli/output.ts`)
- AND apply the same hidden-model filter as the TUI (respects `showHiddenModels` config)

#### Scenario: List models with counts
- GIVEN the user runs `orbusctl models --detail`
- THEN fetch object/relationship/drawing counts via `fetchModelDetailCounts`
- AND append `(N obj, N rel, N drw)` to each model line

#### Scenario: List models as JSON
- GIVEN the user runs `orbusctl models --json`
- THEN output a JSON array where each entry includes `name`, `modelId`, `depth`, `isHidden`
- AND include `objects`, `relationships`, `drawings` fields when `--detail` is also set

---

### Requirement: CLI — objects command
The `orbusctl objects` command SHALL list objects in a model or show object detail.

Reference cli-conventions for `--json`, fuzzy resolution, error format.

#### Scenario: List objects (human-readable)
- GIVEN the user runs `orbusctl objects --model <name>` or `--model-id <guid>`
- THEN resolve the model, fetch objects, sort by type then name
- AND print each object as a row with Type, Name, Last Modified date, Last Modified By

#### Scenario: No objects found (CLI)
- GIVEN the resolved model contains no objects
- THEN print "No objects found."

#### Scenario: List objects as JSON
- GIVEN the user runs `orbusctl objects --model <name> --json`
- THEN output a JSON array with `name`, `objectId`, `type`, `lastModifiedDate`, `lastModifiedBy` per object

#### Scenario: Show object detail (human-readable)
- GIVEN the user runs `orbusctl objects --model <name> --object <name>` or `--object-id <guid>`
- THEN resolve the model and object, fetch detail and relationships in parallel
- AND print Name, Type, Model, Created, Modified, Status, Version
- AND print non-empty attribute values in a labelled table
- AND print relationships sorted by direction then relationship type, with arrow (→ for Leads, ← for Member of), related object name and type, and relationship type (with "ArchiMate: " prefix stripped)

#### Scenario: Show object detail as JSON
- GIVEN the user runs `orbusctl objects --object-id <guid> --json`
- THEN output a JSON object merging the full detail record with a `relationships` array

#### Scenario: Missing model flag (CLI)
- GIVEN the user runs `orbusctl objects` without `--model` or `--model-id`
- THEN print an error to stderr and exit with code 1

---

### Requirement: Unauthenticated state
The models section SHALL show a locked state when the user is not authenticated.

#### Scenario: Not authenticated
- GIVEN the user is not authenticated
- WHEN the Models section is active
- THEN display "⊘ Models requires authentication"
- AND display "Press [a] to authenticate"
