# Doc Generation Specification

## Purpose

Generate enriched markdown documents from Orbus model data using template files with ORBUS marker blocks, YAML frontmatter variable declarations, and `{{variable}}` interpolation.

## Requirements

### Requirement: CLI Command

The `orbusctl doc generate` command SHALL accept `--template <name-or-path>`, `--model <name>` or `--model-id <guid>`, and optional `--output <dir>`, `--var <key=value>` (repeatable), `--json`, and `--force` flags.

#### Scenario: Successful generation

- GIVEN a valid token and a resolved model
- WHEN the user runs `orbusctl doc generate --template <name> --model <name>`
- THEN the engine fetches objects and relationships, processes the template, writes the output file, and prints `Generated <template> for <modelName>` with object count, relationship count, and file path to stdout
- AND progress phases are written to stderr during execution

#### Scenario: Template resolved by name

- GIVEN `--template mytemplate` is provided without a path separator and without `.md` extension
- WHEN the command resolves the template
- THEN it looks up `~/.orbusctl/templates/mytemplate.md`; if not found it exits with an error message to stderr and code 1

#### Scenario: Template resolved by path

- GIVEN `--template` value contains `/` or ends with `.md`
- WHEN the command resolves the template
- THEN it treats the value as a filesystem path and exits with an error if the file does not exist

#### Scenario: Missing model flag

- GIVEN neither `--model` nor `--model-id` is provided
- THEN the command writes `Error: --model or --model-id is required.` to stderr and exits with code 1

#### Scenario: JSON output

- GIVEN `--json` is passed
- WHEN generation completes
- THEN stdout contains a single JSON object with `filePath`, `objectCount`, and `relationshipCount`; no other output goes to stdout

References cli-conventions for `--json`, `--force`, token age pre-flight, fuzzy model resolution, and error format.

---

### Requirement: Template Format

A template file SHALL be a markdown file with optional YAML frontmatter, `{{variable}}` interpolation, `<!-- ORBUS:BEGIN ... -->` / `<!-- ORBUS:END -->` block markers, and optionally legacy `<!-- ORBUS-TABLE: ... -->` / `<!-- ORBUS-DIAGRAM: ... -->` one-liner markers.

#### Scenario: ORBUS:BEGIN / ORBUS:END block processing

- GIVEN a template body contains `<!-- ORBUS:BEGIN <attrs> -->` followed by content and `<!-- ORBUS:END -->`
- WHEN the engine processes the template
- THEN it replaces the content between the markers with freshly generated content
- AND the `<!-- ORBUS:BEGIN ... -->` and `<!-- ORBUS:END -->` lines are preserved verbatim in the output

#### Scenario: Legacy one-liner upgrade

- GIVEN a template contains `<!-- ORBUS-TABLE: <attrs> -->` or `<!-- ORBUS-DIAGRAM: <attrs> -->`
- WHEN the engine encounters such a line
- THEN it converts the one-liner to a `<!-- ORBUS:BEGIN ... -->` / generated content / `<!-- ORBUS:END -->` triple in the output

#### Scenario: Hand-edited content preserved

- GIVEN an output file from a previous run contains hand-edited text outside ORBUS marker blocks
- WHEN the template is re-processed
- THEN only the content between ORBUS marker pairs is regenerated; content outside the markers is preserved

#### Scenario: YAML frontmatter parsing

- GIVEN the template starts with `---` and contains a closing `---`
- WHEN the engine parses the file
- THEN only keys prefixed with `template-` are extracted as template fields; the body is the text after the closing `---`

---

### Requirement: Built-in Variables

The engine SHALL automatically inject `model_name` and `model_id` into the variable map before interpolating user-supplied variables.

#### Scenario: Automatic variable injection

- GIVEN `performTemplateExport` is called with `modelId` and `modelName`
- WHEN the engine builds the variable map
- THEN `{{model_name}}` resolves to the model name and `{{model_id}}` resolves to the model GUID in any part of the template body
- AND user-supplied `--var` values (CLI) or `exportTemplateVars` values (TUI) are merged in, with user values taking precedence over auto-injected names if keys collide

#### Scenario: Variable interpolation syntax

- GIVEN the template body contains `{{someVar}}`
- WHEN the engine processes the body
- THEN it replaces `{{someVar}}` with the value from the variable map, or leaves the placeholder unchanged if the variable is not defined

#### Scenario: Declared variables via frontmatter

- GIVEN a template frontmatter contains `template-var-<name>: <prompt>[|<objectType>]`
- WHEN `parseTemplateVariables` reads the file
- THEN it returns an entry with `name` set to `<name>`, `prompt` set to the text before `|`, and `objectType` set to the text after `|` (or `undefined` if absent)

#### Scenario: Scope override via frontmatter

- GIVEN a template frontmatter contains `template-scope-<processName>: task1, task2`
- WHEN the engine resolves tasks for that process
- THEN it uses the explicit comma-separated task list instead of traversing ArchiMate:Aggregation relationships

---

### Requirement: Table and Diagram Generation

The engine SHALL generate markdown content for ORBUS-TABLE and ORBUS-DIAGRAM tags using model relationship data fetched at export time.

#### Scenario: Tasks table

- GIVEN an ORBUS-TABLE tag with `type="tasks"` and either `process="<name>"` or `tasks="<name1>,<name2>"`
- WHEN the engine processes the tag
- THEN it outputs a `| Task | Description |` markdown table with rows sorted alphabetically by task name

#### Scenario: IO table

- GIVEN an ORBUS-TABLE tag with `type="io"`, `process="<name>"`, and `direction="input"`, `"output"`, or `"all"`
- WHEN the engine processes the tag
- THEN it outputs a `| Name | Description |` markdown table of Business objects connected via ArchiMate:Access relationships, filtered by direction using the Access Operator attribute value

#### Scenario: Roles table

- GIVEN an ORBUS-TABLE tag with `type="roles"` and optional `process="<name>"`
- WHEN the engine processes the tag
- THEN it outputs a `| Role | Description |` markdown table of Business roles associated via ArchiMate:Association to the process scope (or all Business processes if no process specified)

#### Scenario: RASCI table

- GIVEN an ORBUS-TABLE tag with `type="rasci"` and optional `process="<name>"`
- WHEN the engine processes the tag
- THEN it outputs a markdown table with Task (and Activity when no process scoped) rows and Role columns, populated with abbreviated RASCI values from the RASCI attribute on ArchiMate:Association relationships

#### Scenario: Lifecycle list

- GIVEN an ORBUS-TABLE tag with `type="lifecycle"` and `process="<name>"`
- WHEN the engine processes the tag
- THEN it outputs an alphabetically sorted bulleted list of direct child Business processes, labelled `(a)`, `(b)`, etc.

#### Scenario: Diagram reference

- GIVEN an ORBUS-DIAGRAM tag or ORBUS:BEGIN block with `type="diagram"`, `name="<name>"`, and optional `caption="<caption>"`
- WHEN the engine processes the tag
- THEN it outputs `![<caption>](<assetRelPath>/<sanitized-name>.svg)` where the name is lowercased and non-alphanumeric characters replaced with hyphens
- AND if the SVG file is not present in the `assets/` subdirectory, a warning is written to stderr

#### Scenario: Unknown table type error

- GIVEN an ORBUS-TABLE tag with an unrecognised `type` attribute
- WHEN the engine processes the tag
- THEN it outputs `<!-- ERROR: Unknown table type "<type>" -->` inline in the document

#### Scenario: Missing process error

- GIVEN an ORBUS-TABLE tag that requires `process="..."` but the named process is not found in the model
- WHEN the engine processes the tag
- THEN it outputs `<!-- ERROR: Process "<name>" not found in model -->` inline in the document

---

### Requirement: Output File

The engine SHALL write the generated document to `<outputDir>/<sanitizedModelName>_<YYYY-MM-DD-HH-MM>.md` and prepend a YAML frontmatter block containing generation metadata.

#### Scenario: Output file naming

- GIVEN `modelName` is `My Model` and the current timestamp is `2026-05-31T14:30:00`
- WHEN the engine writes the output file
- THEN the filename is `My_Model_2026-05-31-14-30.md` in the output directory

#### Scenario: Output frontmatter fields

- GIVEN a successful template generation run
- WHEN the output file is written
- THEN its YAML frontmatter includes `model`, `model-id`, `generated-by`, `generated-at`, `template`, `orbusctl-version`, `format: template`, and all original `template-*` fields from the source template

#### Scenario: Output directory creation

- GIVEN the output directory does not exist
- WHEN the engine is about to write the file
- THEN it creates the directory (including parent directories) before writing

#### Scenario: Default output directory

- GIVEN `--output` is not supplied (CLI) or `outputDir` is not overridden (TUI)
- WHEN the engine determines the output path
- THEN it uses `~/.orbusctl/exports/`

---

### Requirement: Generate and Refresh Lifecycle

The engine SHALL support a generate-then-refresh workflow where ORBUS-marked sections are regenerated on each run while content outside those sections is preserved.

#### Scenario: First run — generate

- GIVEN a template file with ORBUS marker blocks and no prior output file
- WHEN `orbusctl doc generate` is run
- THEN a new output file is created containing interpolated body text with all ORBUS blocks populated with live model data

#### Scenario: Subsequent run — refresh

- GIVEN an existing output file that was previously generated and may contain hand-edited prose outside ORBUS blocks
- WHEN `orbusctl doc generate` is run again with the same template
- THEN a new timestamped file is written with refreshed ORBUS block content
- AND the hand-edited content outside the marker blocks is unchanged relative to the template (note: the output is a new file each run, not an in-place update of the previous output)

#### Scenario: Fetch phases

- GIVEN a template export is triggered
- WHEN the engine fetches data
- THEN it reports progress phases in order: `Fetching objects...`, `Fetching object details... (N/M)` (once per object), then `Processing template...`

---

### Requirement: TUI Template Export Flow

The TUI Export section SHALL provide a template picker, per-variable prompting, and an export-in-progress overlay driven by the `useTemplateExport` hook.

#### Scenario: Template picker entry

- GIVEN the user is in the Export section, has selected a model, and selects "Template" in the format picker
- WHEN the format is confirmed with Enter
- THEN the TUI shows a list of templates from `~/.orbusctl/templates/` (`.md` files, sorted alphabetically by name)

#### Scenario: No templates available

- GIVEN `~/.orbusctl/templates/` is empty or does not exist
- WHEN the template picker is displayed
- THEN the TUI shows `No templates found in ~/.orbusctl/templates/` with a hint to add `.md` files
- AND `[←/Esc]` returns to the format picker

#### Scenario: Variable text input

- GIVEN a template declares `template-var-<name>: <prompt>` without an `objectType`
- WHEN the variable prompt is reached during the TUI flow
- THEN the TUI shows the prompt text and a text input field; `isTypingMode` is active; global hotkeys `q/a/s/?` are suppressed

#### Scenario: Variable object-type picklist

- GIVEN a template declares `template-var-<name>: <prompt>|<objectType>`
- WHEN the variable prompt is reached
- THEN the TUI fetches all objects of that type from the model and presents a scrollable pick list; `isTypingMode` is not active during the pick list state

#### Scenario: Variable loading state

- GIVEN an objectType variable is being loaded
- WHEN objects are being fetched
- THEN the TUI shows `Loading options for <prompt>...`

#### Scenario: Multi-variable progression

- GIVEN a template declares two or more variables
- WHEN the user confirms each variable value with Enter
- THEN the TUI advances to the next variable prompt, showing `(<current>/<total>)` progress
- AND after the last variable, Enter triggers the export

#### Scenario: Export in progress

- GIVEN the user has completed variable input and the export is running
- WHEN `templateExport.exporting` is true
- THEN the TUI shows `Generating template...` with the current progress phase

#### Scenario: Export complete

- GIVEN the template export finishes successfully
- WHEN `templateExport.result` is set
- THEN the TUI shows `Template export complete!` with object count, relationship count, and the output file path
- AND `[o]` opens the output file and `[←/Esc]` returns to the format picker

#### Scenario: Export error

- GIVEN the template export fails
- WHEN `templateExport.error` is set
- THEN the TUI shows the error message in red
- AND `[←/Esc]` returns to the format picker

Uses wrap-around scrolling on the template picker list and variable pick lists (see tui-conventions).
References tui-conventions for `[o]` to open the output file.
