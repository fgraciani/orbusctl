# Activity Specification

## Purpose
Display recent activity across all models — objects and relationships created or modified within a selectable time window, scanned sequentially from the API.

## Requirements

### Requirement: Time period selection
The Activity section SHALL first present a time period selector before scanning.

#### Scenario: Time period options
- GIVEN the Activity section is active and no scan has been performed
- THEN display a list of time period options: 24h, 7d, past week (Mon–Sun), 30d, past month
- AND each option shows a human-readable label with the date range

#### Scenario: Select time period
- GIVEN the time period selector is displayed
- WHEN the user presses Enter on a time period
- THEN begin scanning all models for activity within that period

---

### Requirement: Sequential model scanning
The app SHALL scan all visible models sequentially, showing progress.

#### Scenario: Scanning progress
- GIVEN a time period has been selected
- THEN display "Scanning models for activity..." with the current model name and position (e.g., "Model 3 of 12: ModelName")
- AND scan each model in parallel for objects and relationships via `fetchRecentObjects` and `fetchRecentRelationships`

#### Scenario: Scan completes
- GIVEN all models have been scanned
- THEN call `summarizeReport` and display the activity results summary

#### Scenario: Per-model scan error (silent skip)
- GIVEN a model fails to return data during scanning
- THEN silently catch the error, report zero objects and zero relationships for that model via `onProgress`, and continue scanning the next model

#### Scenario: Scan cancellation
- GIVEN the Activity section is in scanning state
- WHEN the user presses Esc
- THEN cancel the in-progress scan and return to the time period selector

---

### Requirement: Activity results summary
The app SHALL display a summary of activity across all scanned models.

#### Scenario: Model list with counts
- GIVEN scanning is complete and at least one model has activity
- THEN display a list of models that had activity, sorted alphabetically by model name
- AND show three columns per row: model name (flexGrow), combined "X obj, Y rel" count, and "N users" count
- AND apply virtual scrolling with ▲/▼ indicators

#### Scenario: No activity found
- GIVEN scanning is complete and no model had any activity
- THEN display "No activity found in this period"

#### Scenario: Per-user grouping
- GIVEN the summary is computed from `summarizeReport`
- THEN each `ModelActivity` entry groups activity by user (`users: UserActivity[]`)
- AND the "N users" column in the summary shows the number of distinct users who had activity in that model

---

### Requirement: Model activity detail
The app SHALL allow drilling into a model to see individual activity entries.

#### Scenario: Drill into model
- GIVEN the activity results summary is displayed
- WHEN the user presses Enter on a model
- THEN display a per-user detail view for that model

#### Scenario: Activity entry display
- GIVEN the model activity detail is displayed
- THEN show a summary header: "{totalObjects} objects, {totalRels} relationships · N users"
- AND show entries sorted: objects first (by ArchiMate type then name), relationships at end (sorted by date descending)
- AND each entry shows: action (Created in green / Modified in yellow), name, ArchiMate type (color-coded), user, datetime
- AND relationships show their RelationshipId GUID as the name and "Relationship" as the type (dimmed gray)

#### Scenario: Back to summary
- GIVEN the model activity detail is displayed
- WHEN the user presses Esc or ←
- THEN return to the activity results summary

---

### Requirement: Back to time period selector
The app SHALL allow returning to the time period selector from the results.

#### Scenario: Re-scan with different period
- GIVEN the activity results summary is displayed
- WHEN the user presses Esc or ←
- THEN return to the time period selector

---

### Requirement: Excel export
The Activity section SHALL support exporting the current activity report to an Excel workbook.

Uses the Excel export overlay (see tui-conventions).

#### Scenario: Trigger export from model list
- GIVEN the activity results summary is displayed
- WHEN the user presses [e]
- THEN invoke `useActivityExport` and begin generating the workbook via `performActivityExcelExport`

#### Scenario: Trigger export from model detail
- GIVEN the model activity detail is displayed
- WHEN the user presses [e]
- THEN invoke `useActivityExport` and begin generating the workbook

#### Scenario: Export progress
- GIVEN an export is in progress
- THEN display "Exporting activity report..." with the current phase (e.g., "Building summary...", "Writing details... (2/5)", "Writing file...")

#### Scenario: Export complete
- GIVEN the export finishes successfully
- THEN display: "Export complete!" with model count, entry count, and saved file path
- AND show guidance "[o] open · [←/Esc] back"
- AND the workbook contains a Summary sheet (columns: Model, Objects Created, Objects Modified, Relationships Created, Users) plus one detail sheet per model (columns: Action, Name, Type, User, Date)
- AND the filename follows the pattern `{YYYY-MM-DD-HH-MM}-activity-{label}.xlsx` in `~/.orbusctl/exports/`

#### Scenario: Export error
- GIVEN the export fails
- THEN display the error message in red
- AND show guidance "[←/Esc] back"

---

### Requirement: Unauthenticated state
The Activity section SHALL display a locked state when the user is not authenticated.

#### Scenario: Locked display
- GIVEN the user is not authenticated
- WHEN the Activity section is active
- THEN display "⊘ Activity requires authentication"
- AND display "Press [a] to authenticate"

---

### Requirement: Activity CLI command
The CLI SHALL provide an `activity` subcommand for listing recent activity.

Reference cli-conventions for `--json`, `--force`, and error format.

#### Scenario: Default tabular output
- GIVEN the user runs `orbusctl activity [--period <period>]`
- THEN print a header line: "Activity: {label} ({since} – {until})"
- AND for each model with activity, print the model name followed by per-user rows showing created count, modified count, and relationship count
- AND print a totals footer: "Total: N created, M modified, R relationships across K models"

#### Scenario: Period flag
- GIVEN the user passes `--period <value>`
- THEN accept one of: 24h, 7d, past-week, 30d, past-month (default: 7d)
- AND exit with an error message to stderr if the value is not in the allowed set

#### Scenario: JSON output
- GIVEN the user passes `--json`
- THEN output a single JSON object to stdout containing: label, since, until, totalCreated, totalModified, totalRels, totalObjects, and the full models array
- AND scanning progress is written to stderr (not stdout)

#### Scenario: Token age pre-flight
- GIVEN the saved token is older than 50 minutes and `--force` is not passed
- THEN exit with a warning before scanning begins
- GIVEN `--force` is passed
- THEN skip the token age check and proceed with scanning
