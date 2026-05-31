# Audit Specification

## Purpose
Model quality inspector — audit individual models or scan all models for common quality issues such as missing descriptions, HTML in content, orphan objects, and objects not placed in any diagram.

## Requirements

### Requirement: Audit mode selection
The Audit section SHALL present a menu to choose between auditing a single model, all models, or a selected subset of models.

#### Scenario: Audit menu
- GIVEN the Audit section is active
- THEN display a menu with three options: "Audit single model", "Audit all models", and "Audit selected models"

#### Scenario: Select audit mode
- GIVEN the audit menu is displayed
- WHEN the user presses Enter on an option
- THEN proceed to the selected audit mode

---

### Requirement: Single model audit
The app SHALL allow the user to select a model and perform a full quality audit.

#### Scenario: Model selection
- GIVEN "Audit single model" is selected
- THEN display the model list (same as Content section: tree, counts, virtual scroll)
- AND show panel title "Audit — select a model"

#### Scenario: Full audit execution
- GIVEN a model is selected
- THEN fetch all model data in multiple phases: Fetching objects, Fetching relationships, Fetching drawings, Checking diagrams (per drawing), then Auditing objects (one `fetchObjectDetail` call per object)
- AND display phase progress during the audit (e.g., "Auditing objects... (15/230)")
- AND perform all quality checks on each object

#### Scenario: Audit summary
- GIVEN the audit of a single model is complete
- THEN display a summary showing: model name, last modified by and date, total objects, total relationships, total drawings, and issue counts per check type

#### Scenario: Drill into issue type
- GIVEN the audit summary is displayed
- WHEN the user presses Enter on an issue type (e.g., "No Description (42)")
- THEN display a list of all affected objects with: name, ArchiMate type, last modified by, last modified date

#### Scenario: Back from issue detail
- GIVEN an issue type detail list is displayed
- WHEN the user presses Esc or ←
- THEN return to the audit summary

---

### Requirement: Audit all models
The app SHALL scan all models sequentially in tree order and show progressive results.

#### Scenario: Sequential scan
- GIVEN "Audit all models" is selected
- THEN scan each model sequentially in tree order (same order as sidebar)
- AND display progressive results as each model completes

#### Scenario: All-models results table
- GIVEN the scan is in progress or complete
- THEN display a table with one row per model showing columns: model name (flex width), Issues (total), NoDesc (empty description count), NoRel (no relationships count), NoDiag (not in any diagram count), HTML (HTML in name or description count)
- AND apply virtual scrolling with indicators
- AND highlight rows with issues

#### Scenario: Drill into model from all-models view
- GIVEN the all-models results table is displayed
- WHEN the user presses Enter on a model row
- THEN display the full audit detail for that model (same as single model audit summary)

#### Scenario: Back from all-models detail
- GIVEN a model detail is displayed from the all-models view
- WHEN the user presses Esc or ←
- THEN return to the all-models results table

---

### Requirement: Audit selected models
The app SHALL allow the user to select multiple models and perform a batch audit on the selected subset.

#### Scenario: Multi-select model list
- GIVEN "Audit selected models" is selected
- THEN display the model list (same as Content section: tree, counts, virtual scroll)
- AND show panel title "Audit — select models" or "Audit — N models selected"
- AND show status line "Select at least one model" (yellow) or "N models selected" (green)

#### Scenario: Toggle model selection
- GIVEN the multi-select model list is displayed
- WHEN the user presses Space on a model row
- THEN toggle the selection state of that model
- AND show a green bullet (●) indicator for selected models
- AND display selected model names in bold white text

#### Scenario: Navigate while selecting
- GIVEN the multi-select model list is displayed
- WHEN the user navigates with arrow keys or j/k
- THEN move the cursor without affecting selection state
- AND preserve all existing selections

#### Scenario: Start batch audit
- GIVEN the multi-select model list is displayed with N models selected (N ≥ 1)
- WHEN the user presses Enter
- THEN start a batch audit of only the selected models
- AND proceed to the all-models results view

#### Scenario: Prevent empty audit
- GIVEN the multi-select model list is displayed with 0 models selected
- WHEN the user presses Enter
- THEN do not start an audit (no action)

#### Scenario: Cancel multi-select
- GIVEN the multi-select model list is displayed
- WHEN the user presses Esc
- THEN return to the audit menu
- AND clear all selections

#### Scenario: Selections cleared on menu return
- GIVEN selections exist in multi-select mode
- WHEN returning to the audit menu (via Esc or after scan completion)
- THEN clear all selections (session-only state)

#### Scenario: Visual feedback
- GIVEN a model is selected in multi-select mode
- THEN show green bullet (●) indicator in the second column
- AND display model name and counts in bold white text
- AND show cursor (▶) in cyan for the current row

---

### Requirement: Quality checks
The audit SHALL perform the following checks on each object.

#### Scenario: Empty description check
- GIVEN an object is being audited
- WHEN the object has no description or an empty description
- THEN flag it as "No Description"

#### Scenario: HTML in name check
- GIVEN an object is being audited
- WHEN the object name contains HTML tags or non-printable control characters (matched by `UGLY_CHARS = /[\x00-\x08\x0B\x0C\x0E-\x1F]/`)
- THEN flag it as "HTML in Name"

#### Scenario: HTML in description check
- GIVEN an object is being audited
- WHEN the object description contains HTML tags or non-printable control characters
- THEN flag it as "HTML in Description"

#### Scenario: No relationships check
- GIVEN an object is being audited
- WHEN the object has no relationships (neither source nor target)
- THEN flag it as "No Relationships"

#### Scenario: Not in any diagram check
- GIVEN an object is being audited
- WHEN the object is not placed in any drawing/diagram
- THEN flag it as "Not in Diagram"

---

### Requirement: Audit detail display
The audit summary SHALL display model-level provenance data, and each issue object SHALL display per-object provenance.

#### Scenario: Model-level summary data
- GIVEN the audit summary banner is displayed
- THEN show: total objects count, total relationships count, total drawings count as model-level fields from `AuditSummary`

#### Scenario: Per-object provenance in issue list
- GIVEN an object appears in an issue type detail list
- THEN display: object name, ArchiMate type, last modified by (user), last modified date

---

### Requirement: Object detail side panel
The app SHALL load full object detail when the user selects an object from the issue detail list.

#### Scenario: Load object detail
- GIVEN an issue type detail list is displayed
- WHEN the user presses Enter on an object row for the first time
- THEN set `viewedAuditObjectId` to the object's ID and load its full detail via `useObjectDetail`
- AND display the detail in a side panel showing name, description, and relationships

#### Scenario: Focus object detail panel
- GIVEN an object detail side panel is loaded
- WHEN the user presses Enter on the same object row again
- THEN activate `auditDetailFocused` and focus navigates into the detail panel
- AND relationship navigation uses `auditRelIndex` with ↑/↓ keys

#### Scenario: Navigate relationships in detail panel
- GIVEN `auditDetailFocused` is true
- WHEN the user presses Enter on a relationship
- THEN load the related object's detail in the side panel

#### Scenario: Detail panel loading state
- GIVEN `viewedAuditObjectId` is set
- WHEN `useObjectDetail` is fetching
- THEN show a loading indicator in the side panel

#### Scenario: Detail panel error state
- GIVEN `viewedAuditObjectId` is set
- WHEN `useObjectDetail` returns an error
- THEN show the error message in red in the side panel

---

### Requirement: Audit scan cancellation
The app SHALL cancel an in-progress scan when the user navigates away.

#### Scenario: Cancel scan on navigation
- GIVEN a scan (single model or all-models) is in progress
- WHEN the user presses Esc from the all-results view or switches sections
- THEN call `audit.reset()` which sets `cancelRef.current = true`
- AND the scan loop breaks at the next model boundary

---

### Requirement: Audit Excel export
The app SHALL export audit results to an Excel workbook from both `all-results` and `detail` modes.

Uses the Excel export overlay (see tui-conventions).

#### Scenario: Trigger export from all-results
- GIVEN `auditMode` is `all-results` and at least one model result exists and no scan is in progress
- WHEN the user presses `[e]`
- THEN call `auditExport.startExport` with all completed `AuditSummary` values
- AND show the export overlay with progress

#### Scenario: Trigger export from detail
- GIVEN `auditMode` is `detail` and a single model audit result exists
- WHEN the user presses `[e]`
- THEN call `auditExport.startExport` with that single `AuditSummary`
- AND show the export overlay with progress

#### Scenario: Single-model workbook
- GIVEN export is triggered for a single model
- THEN produce a workbook with one sheet named after the model
- AND the sheet columns are: Object Name, Object Type, Issue Type, Detail, Last Modified By, Last Modified Date
- AND rows are sorted by issue type then object name

#### Scenario: Multi-model workbook
- GIVEN export is triggered for multiple models
- THEN produce a workbook with a Summary sheet plus one issue sheet per model
- AND the Summary sheet columns are: Model, Total Objects, Total Relationships, Total Drawings, Total Issues, Empty Description, HTML in Name, HTML in Description, No Relationships, Not in Diagram

#### Scenario: Export file naming
- GIVEN export completes
- THEN save the file to the exports directory with name `{YYYY-MM-DD-HH-MM}-audit-{model-name}.xlsx` (single model) or `{YYYY-MM-DD-HH-MM}-audit-all.xlsx` (multi-model)
- AND display the file path in the export overlay

#### Scenario: Open exported file
- GIVEN the export overlay shows a completed result
- WHEN the user presses `[o]`
- THEN open the exported `.xlsx` file via `openFile(filePath)`

#### Scenario: Export error
- GIVEN export is in progress
- WHEN `performAuditExcelExport` throws an error
- THEN display the error message in the export overlay
- AND the user can press `[←/Esc]` to dismiss

---

### Requirement: Browser launch from issue list
The app SHALL open an audit object in the Orbus browser when the user presses `[o]` from the issue detail list.

Uses browser launch (see tui-conventions).

#### Scenario: Open object in browser
- GIVEN `viewedAuditObjectId` is set and `auditExport.result` is null
- WHEN the user presses `[o]`
- THEN call `openInBrowser(getOrbusObjectUrl(viewedAuditObjectId))`

---

### Requirement: Audit list scrolling
All audit list states use wrap-around scrolling (see tui-conventions).

---

### Requirement: Unauthenticated state

#### Scenario: Audit locked when unauthenticated
- GIVEN the user is not authenticated
- WHEN the Audit section is active
- THEN display "⊘ Audit requires authentication"
