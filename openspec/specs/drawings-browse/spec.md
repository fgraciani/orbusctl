# drawings-browse Specification

## Purpose
Browse drawings (diagrams) within Orbus models, including drill-down into drawing components and their relationships.

## Requirements

### Requirement: Model selection for drawings
The Drawings section SHALL first require the user to select a model before showing drawings.

#### Scenario: Select a model
- GIVEN the Drawings section is active and no model is selected
- THEN display the model list (same as Content section: tree, counts, virtual scroll)
- AND show panel title "Drawings — select a model"
- WHEN the user presses Enter on a model
- THEN fetch drawings for that model via `GET /odata/Documents?$filter=ModelId eq {id}&$select=DocumentId,FileName,DocumentTypeId,DocumentAccessibilityCategory`
- AND fetch document types via `GET /odata/DocumentTypes?$select=DocumentTypeId,Name`

#### Scenario: Back to model selection
- GIVEN drawings for a model are displayed
- WHEN the user presses Esc or ←
- THEN return to the model selection list

---

### Requirement: Drawing list
The app SHALL display drawings for the selected model.

#### Scenario: Drawings loading
- GIVEN a model is selected and the drawings fetch is in progress
- THEN display "Loading drawings in {modelName}..." in cyan

#### Scenario: Drawings error
- GIVEN a model is selected and the drawings fetch fails
- THEN display the error message in red

#### Scenario: Drawings loaded
- GIVEN a model is selected and drawings have loaded
- THEN display drawings sorted alphabetically by filename
- AND show columns: Name (flex width), Type (document type name resolved from `DocumentTypeId`, 28 chars)
- AND show panel title `{ModelName} · Drawings (N)`
- AND apply virtual scrolling with indicators
- Uses wrap-around scrolling (see tui-conventions).

#### Scenario: No drawings
- GIVEN a model has no drawings
- THEN display "No drawings in this model"

---

### Requirement: Drawing component detail view
The app SHALL allow drilling into a drawing to see its placed objects and connectors.

#### Scenario: Drill into drawing
- GIVEN a drawing is selected in the list
- WHEN the user presses Enter or →
- THEN resolve drawing components via `resolveDrawingComponents` (which internally calls `fetchDrawingComponents` then resolves each component's name and type)
- AND display the drawing detail view as a split panel: component list above, detail below
- AND show panel title `{DrawingName} · Components (N)` on the component list panel
- AND `ResolvedComponent.objectId` is populated from `ModelItemId` for all components (objects and relationships)

#### Scenario: Components loading
- GIVEN a drawing has been selected and the component fetch is in progress
- THEN display "Loading components..." in cyan

#### Scenario: Components error
- GIVEN a drawing has been selected and the component fetch fails
- THEN display the error message in red

#### Scenario: Component list display
- GIVEN the drawing detail view is active and components have loaded
- THEN display a summary line "{N} objects, {M} relationships"
- AND display objects sorted by ArchiMate type name then name, followed by relationships appended after all objects
- AND display objects with columns: Name (flex width), ArchiMate Type (22 chars), coloured by ArchiMate layer
- AND display relationships with a `↔` indicator, dimmed colour, and From → To endpoint names
- AND apply virtual scrolling with indicators
- AND show hint `[↵] view detail · [o] open in Draw · [←/Esc] back to drawings · [↑↓] navigate` when no detail panel is open
- Uses wrap-around scrolling (see tui-conventions).

#### Scenario: ArchiMate colouring
- GIVEN a component is displayed in the drawing detail
- THEN colour the entry according to its ArchiMate layer (Strategy, Business, Application, Technology, etc.) using the layer colour mapping from `core/domain/colors.ts`

#### Scenario: Relationship endpoints
- GIVEN a relationship (connector) is displayed in the drawing detail
- THEN show the relationship type and both endpoint object names (From → To)

#### Scenario: Back to drawing list
- GIVEN the drawing detail view is active and no object detail panel is open
- WHEN the user presses Esc or ←
- THEN return to the drawing list for the current model

---

### Requirement: Object detail (split panel)
The app SHALL display full object details for drawing components, reusing the same detail pane as the Models section.

#### Scenario: Open object detail
- GIVEN the drawing component list is active
- WHEN the user presses Enter on a non-relationship component
- THEN fetch object detail and relationships using `useObjectDetail` (same hook as Models)
- AND display a detail Panel below the component list with the object name as title
- AND mark the viewed component with `●` (yellow) in the component list
- AND compress the component list to ~35% of available height to give space to the detail panel

#### Scenario: Enter on relationship — no-op
- GIVEN the drawing component list is active
- WHEN the user presses Enter on a relationship component
- THEN no action is taken (detail panel does not open for relationships)

#### Scenario: Object detail loading
- GIVEN an object component has been selected
- THEN display "Loading..." in cyan in the detail panel while the fetch is in progress

#### Scenario: Object detail error
- GIVEN an object component has been selected and the detail fetch fails
- THEN display the error message in red in the detail panel

#### Scenario: Detail content
- GIVEN an object's detail is loaded in the drawings view
- THEN display: type (ArchiMate colour), version, status
- AND description, metadata (created/modified/author/lock), non-system attributes
- AND relationships list with direction, related object name, relationship type name (with "ArchiMate: " prefix stripped)
- (Identical rendering to the Models object detail pane)

#### Scenario: Switch viewed object
- GIVEN a detail panel is showing for a drawing component
- WHEN the user navigates to a different non-relationship component and presses Enter
- THEN update the detail panel with the new component's object data

#### Scenario: Close detail panel
- GIVEN the drawing component detail panel is open
- WHEN the user presses Esc or ←
- THEN close the detail panel and return to the full-height component list
- (Does NOT navigate back to the drawing list — that requires a second Esc)

---

### Requirement: Relationship navigation from drawing object detail
The user SHALL be able to navigate to related objects from the drawing object detail panel.

#### Scenario: Focus detail panel
- GIVEN the detail panel is showing for a drawing component
- WHEN the user presses Enter on the same component again
- THEN the detail panel border goes cyan (focused)
- AND a `▶` cursor appears on the first relationship

#### Scenario: Navigate relationships
- GIVEN the detail panel is focused
- WHEN the user presses ↑/↓
- THEN the cursor moves between relationships
- Uses wrap-around scrolling within the relationship list (see tui-conventions).

#### Scenario: Jump to related object
- GIVEN a relationship is selected in the focused detail panel
- WHEN the user presses Enter
- THEN load the related object's detail (by `RelatedItem.ObjectId`)
- AND update the detail panel title and content

#### Scenario: Return to component list focus
- GIVEN the detail panel is focused
- WHEN the user presses Esc or ←
- THEN focus returns to the component list panel

---

### Requirement: Browser launch
The app SHALL support opening drawings and objects in the Orbus browser from the drawings section.

#### Scenario: Open drawing in Orbus Draw
- GIVEN the drawing component list is active and no object detail is open
- WHEN the user presses `[o]`
- THEN open the current drawing in the browser via `getOrbusDrawingUrl(viewedDrawingId)`
- Uses configurable browser (see tui-conventions).

#### Scenario: Open object in Orbus browser
- GIVEN an object detail panel is open within the drawings view
- WHEN the user presses `[o]`
- THEN open the viewed object in the browser via `getOrbusObjectUrl(viewedDrawingObjectId)`
- Uses configurable browser (see tui-conventions).

---

### Requirement: Help panel
The drawings section SHALL provide context-sensitive help content.

#### Scenario: Help — model selection state
- GIVEN the drawings section is active and no model has been selected
- WHEN the user presses `[?]`
- THEN the help panel shows: "Drawings and diagrams organised by model." / "[↵] enter model or open drawing · [←/Esc] back · [↑↓] navigate"

#### Scenario: Help — drawing detail state
- GIVEN a drawing's component list is active and no object detail is open
- WHEN the user presses `[?]`
- THEN the help panel shows: "Components of the selected drawing — objects and relationships placed in this diagram." / "[o] open in Orbus Draw · [↵] view object detail · [←/Esc] back · [↑↓] navigate"

#### Scenario: Help — object detail state
- GIVEN an object detail panel is open within the drawings view
- WHEN the user presses `[?]`
- THEN the help panel shows: "Object detail within a drawing — attributes and relationships." / "[o] open in Orbus · [↵] follow relationship · [←/Esc] back · [↑↓] navigate"

---

### Requirement: Escape navigation hierarchy
Pressing Esc unwinds the drawings navigation one level at a time.

#### Scenario: Unfocus detail panel
- GIVEN the detail panel is focused (cyan border)
- WHEN the user presses Esc or ←
- THEN focus returns to the component list (detail panel remains open)

#### Scenario: Close detail panel via Esc
- GIVEN the detail panel is open but not focused
- WHEN the user presses Esc or ←
- THEN the detail panel closes and the component list returns to full height

#### Scenario: Return to drawing list
- GIVEN the component list is active and no detail panel is open
- WHEN the user presses Esc or ←
- THEN return to the drawing list for the current model

#### Scenario: Return to model selection
- GIVEN the drawing list is active
- WHEN the user presses Esc or ←
- THEN return to the model selection list

---

### Requirement: CLI drawings command
The app SHALL provide a `drawings` CLI subcommand for listing drawings and showing drawing detail.

#### Scenario: List drawings for a model
- GIVEN the user runs `orbusctl drawings --model <name>` or `--model-id <guid>`
- THEN resolve the model (see cli-conventions for fuzzy resolution)
- AND fetch drawings and document types in parallel
- AND display a table with columns: FileName (padded), Type name

#### Scenario: Drawing detail mode
- GIVEN the user runs `orbusctl drawings --model <name> --drawing <name>` or `--drawing-id <guid>`
- THEN resolve the drawing by fuzzy name match or exact ID
- AND fetch and resolve all drawing components
- AND display objects grouped first (sorted by type then name), then relationships
- AND display each group with type name and component name

#### Scenario: No drawings found
- GIVEN the model exists but has no drawings
- THEN output "No drawings found."

#### Scenario: JSON output
- GIVEN the user passes `--json`
- THEN output a single JSON object containing `documentId`, `fileName`, `typeName`, and `components` array (for detail mode) or a JSON array of `{documentId, fileName, typeName}` (for list mode)
- Reference cli-conventions for `--json` and error format.

---

### Requirement: Unauthenticated state
The Drawings section SHALL display a locked state when the user is not authenticated.

#### Scenario: Not authenticated
- GIVEN the user is not authenticated
- WHEN the Drawings section is active
- THEN display "⊘ Drawings requires authentication"
