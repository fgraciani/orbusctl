# Export Specification

## Purpose
Export model data to Excel (.xlsx) or Markdown (.md) files, or generate a Markdown document from a template, including objects with attributes, relationships, and drawings metadata.

## Requirements

### Requirement: Model selection for export
The Export section SHALL first require the user to select a model.

#### Scenario: Select a model
- GIVEN the Export section is active
- THEN display the model list (same as Content section: tree, counts, virtual scroll)
- AND show panel title "Export — select a model"
- WHEN the user presses Enter on a model
- THEN proceed to format selection

#### Scenario: Back to model selection
- GIVEN the format selection is displayed
- WHEN the user presses Esc or ←
- THEN return to the model selection list

---

### Requirement: Format selection
The app SHALL allow the user to choose between export formats.

#### Scenario: Format options
- GIVEN a model has been selected
- THEN display a list of three format options: Excel (.xlsx), Markdown (.md), Markdown Template (.md)

#### Scenario: Select Excel or Markdown format
- GIVEN the format list is displayed
- WHEN the user presses Enter on Excel or Markdown
- THEN begin the export process for the selected model and format

#### Scenario: Select Template format
- GIVEN the format list is displayed
- WHEN the user presses Enter on Markdown Template
- THEN open the template picker

---

### Requirement: Excel export
The app SHALL export model data as an Excel workbook with multiple sheets.

#### Scenario: Objects sheet (full details)
- GIVEN an Excel export is in progress with `fetchDetails=true`
- THEN create an "Objects" sheet with columns: Name, iServer365 Id, Type, Description, Status, Version, Created By, Date Created, Last Modified By, Last Modified Date
- AND append one column per custom attribute (attribute names as headers, sorted alphabetically)
- AND filter out system attributes (Name, Description, Type, Created By, Date Created, Last Modified By, Date Last Modified, Metamodel Item Id, Metamodel Item Name, iServer365 Id)

#### Scenario: Objects sheet (fast mode)
- GIVEN an Excel export is in progress with `fetchDetails=false`
- THEN create an "Objects" sheet with only three columns: Name, iServer365 Id, Type

#### Scenario: Relationships sheet
- GIVEN an Excel export is in progress
- THEN create a "Relationships" sheet with columns: Type, From, From Type, To, To Type, Created By, Date Created
- AND append one column per custom relationship attribute (e.g., RASCI, Access Operator)
- AND filter out system relationship attributes

#### Scenario: Drawings sheet
- GIVEN an Excel export is in progress
- THEN create a "Drawings" sheet with columns: Name, Type, Accessibility

---

### Requirement: Markdown export
The app SHALL export model data as a Markdown document.

#### Scenario: Markdown structure
- GIVEN a Markdown export is in progress
- THEN generate a document with YAML frontmatter containing: model, modelId, date, generator (orbusctl vN)
- AND include a Drawings table (Name, Type, Accessibility) if drawings exist
- AND include a Statistics section with object counts by ArchiMate type and relationship counts by type
- AND include an Objects catalog grouped by ArchiMate type (sorted by type then name)
- AND include a Relationships table (Type, From, To, Created By, Date)

---

### Requirement: Template export
The app SHALL export model data by filling in a Markdown template with ORBUS marker blocks and variable interpolation.

#### Scenario: Template picker
- GIVEN the user selects the Template format
- THEN display a list of `.md` files from `~/.orbusctl/templates/`
- AND show "No templates found in ~/.orbusctl/templates/" with instructions if the directory is empty or contains no `.md` files

#### Scenario: Variable input (text)
- GIVEN a template is selected and defines `template-var-*` frontmatter fields without an `objectType`
- THEN prompt the user to enter a text value for each variable in sequence
- AND display the variable prompt and position (N/M) with a text cursor

#### Scenario: Variable input (object-type picklist)
- GIVEN a template variable declares an `objectType`
- THEN fetch all objects of that type from the model and display them as a scrollable picklist
- AND show a loading indicator while options are fetched

#### Scenario: Template export execution
- GIVEN all variables have been provided
- WHEN the user confirms the final variable
- THEN run `performTemplateExport` with the collected variables
- AND process ORBUS:BEGIN/END marker blocks, replacing content between markers on each run
- AND convert legacy ORBUS-TABLE/ORBUS-DIAGRAM one-liner tags to BEGIN/END format
- AND interpolate `{{variable}}` placeholders throughout the document body
- AND save the output to `getExportsDir()` with filename `{sanitized-model-name}_{YYYY-MM-DD-HH-MM}.md`

#### Scenario: Template export result
- GIVEN the template export completes successfully
- THEN display "Template export complete!" with object count, relationship count, and saved file path
- AND show "[o] open  ·  [←/Esc] back" guidance

#### Scenario: Template export error
- GIVEN the template export fails
- THEN display the error message in red
- AND show "[←/Esc] back" guidance

---

### Requirement: Export progress and result
The app SHALL show progress during export and display the result.

#### Scenario: Progress display (Excel with details)
- GIVEN an Excel export is in progress with `fetchDetails=true`
- THEN show progress phases in sequence: "Fetching objects...", "Fetching relationships...", "Fetching drawings...", "Fetching object details... (N/M)", "Writing file..."

#### Scenario: Progress display (Excel fast or Markdown)
- GIVEN an Excel export with `fetchDetails=false` or a Markdown export is in progress
- THEN show progress phases: "Fetching objects...", "Fetching relationships...", "Fetching drawings...", "Writing file..."
- AND Markdown additionally shows "Fetching object details... (N/M)" before the drawings phase

#### Scenario: Export result
- GIVEN the export completes successfully
- THEN display "Export complete!" with counts for objects, relationships, and drawings
- AND display the saved file path
- AND show "[o] open  ·  [←/Esc] back" guidance
- Uses the `[o]` key to open the exported file (see tui-conventions).

#### Scenario: File location
- GIVEN an export completes
- THEN save the file to `~/.orbusctl/exports/` directory
- AND use a datetime-prefixed filename: `{YYYY-MM-DD-HH-MM}-{sanitized-model-name}.xlsx` or `.md`

#### Scenario: Export error
- GIVEN the export fails (network error or file write failure)
- THEN display the error message in red
- AND show "[←/Esc] back" guidance

---

### Requirement: CLI export command
The app SHALL provide a CLI command to export a model without the TUI.

#### Scenario: Excel export via CLI
- GIVEN the user runs `orbusctl export --model <name> --format excel`
- THEN resolve the model by fuzzy name match (see cli-conventions)
- AND perform an Excel export with `fetchDetails=true` by default
- AND write progress phases to stderr
- AND print the file path and counts to stdout on success

#### Scenario: Fast Excel export via CLI
- GIVEN the user runs `orbusctl export --model <name> --format excel --no-details`
- THEN perform an Excel export with `fetchDetails=false` (Name, iServer365 Id, Type only)

#### Scenario: Markdown export via CLI
- GIVEN the user runs `orbusctl export --model <name> --format markdown`
- THEN perform a Markdown export and print the file path and counts to stdout

#### Scenario: JSON output
- GIVEN the user adds `--json`
- THEN output `{ filePath, objectCount, relationshipCount, drawingCount }` as JSON to stdout
- Reference cli-conventions for `--json` flag behaviour.

#### Scenario: Token age pre-flight
- GIVEN the token is older than 50 minutes
- WHEN the export command runs without `--force`
- THEN print a warning to stderr and exit with code 1
- Reference cli-conventions for the `--force` flag and token age pre-flight.

---

### Requirement: Unauthenticated state
The Export section SHALL display a locked state when the user is not authenticated.

#### Scenario: Not authenticated
- GIVEN the user is not authenticated
- WHEN the Export section is active
- THEN display "⊘ Export requires authentication"
