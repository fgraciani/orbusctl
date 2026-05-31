# compare Specification

## Purpose
Side-by-side comparison of objects between two models, highlighting objects unique to each model and objects shared by both.

## Requirements

### Requirement: Model selection
The Compare section SHALL require the user to select two models (Model A and Model B) before showing the diff.

#### Scenario: Select Model A
- GIVEN the Compare section is active and no models are selected
- THEN display the model list (same as Content section: tree, counts, virtual scroll)
- AND show panel title "Compare — select Model A"
- WHEN the user presses Enter on a model
- THEN set it as Model A and proceed to Model B selection

#### Scenario: Select Model B
- GIVEN Model A has been selected
- THEN display the model list again
- AND show panel title "Compare · Select Model B"
- AND highlight Model A in the list with a ● yellow marker to prevent selecting the same model
- WHEN the user presses Enter on a different model
- THEN set it as Model B and begin comparison

#### Scenario: Back from Model B selection
- GIVEN Model B selection is active (Model A is set, Model B is not)
- WHEN the user presses Esc or ←
- THEN clear Model A and return to Model A selection

---

### Requirement: Side-by-side diff display
The app SHALL display a two-column diff of objects between the selected models.

#### Scenario: Diff layout
- GIVEN both models are selected and objects have been fetched
- THEN display panel title "Compare · {modelAName} vs {modelBName}"
- AND display two columns divided by a vertical separator (│)
- AND left column header shows Model A name
- AND right column header shows Model B name

#### Scenario: Row sort order
- GIVEN the diff is displayed
- THEN all rows (both, left-only, and right-only) are sorted together by ObjectType.Name then Name

#### Scenario: Objects only in Model A
- GIVEN an object exists in Model A but not in Model B (matched by name + ArchiMate type)
- THEN display the object name in green on the left column
- AND display a blank dimmed entry on the right column

#### Scenario: Objects only in Model B
- GIVEN an object exists in Model B but not in Model A (matched by name + ArchiMate type)
- THEN display a blank dimmed entry on the left column
- AND display the object name in green on the right column

#### Scenario: Objects in both models
- GIVEN an object exists in both Model A and Model B (matched by name + ArchiMate type)
- THEN display the object name on both left and right columns without color emphasis

#### Scenario: Summary line
- GIVEN the diff is displayed
- THEN show a summary line: `+N only in A · +N only in B · N in both`

#### Scenario: Loading state
- GIVEN Model B has been selected
- WHEN the comparison fetch is in progress
- THEN display "Comparing models..." in cyan

#### Scenario: Error state
- GIVEN Model B has been selected
- WHEN the API call to fetch objects fails
- THEN display the error message in red

#### Scenario: Empty diff
- GIVEN both models are selected and the fetch completes with zero rows
- THEN fall through to the model selector (no dedicated empty-diff view is shown)

---

### Requirement: Virtual scrolling
The diff view SHALL support virtual scrolling for large model comparisons.

#### Scenario: Virtual scroll in diff
- GIVEN the diff has more rows than the viewport height
- THEN apply virtual scrolling with scroll indicators (▲/▼)
- AND keep the selected row visible with 2 rows of padding from edges

Uses wrap-around scrolling (see tui-conventions).

---

### Requirement: Navigation
The app SHALL allow navigating within the diff and returning to model selection.

#### Scenario: Navigate diff rows
- GIVEN the diff is displayed
- WHEN the user presses ↑/↓
- THEN the selection moves within the diff rows

#### Scenario: Back from diff to Model B selection
- GIVEN the diff is displayed
- WHEN the user presses Esc or ←
- THEN clear Model B and return to Model B selection (Model A remains set)

#### Scenario: Back from Model B selection to Model A selection
- GIVEN Model B selection is active
- WHEN the user presses Esc or ←
- THEN clear Model A and return to Model A selection

---

### Requirement: Help panel
The Compare section SHALL provide context-sensitive help (see tui-conventions).

#### Scenario: Help content
- GIVEN the Compare section is active
- WHEN the user opens the help panel
- THEN display: "Side-by-side object comparison between two models, matched by name and type."
- AND display: "[↵] select Model A then Model B · [←/Esc] change selection · [↑↓] scroll"

---

### Requirement: Unauthenticated state
The app SHALL display a locked state when the user is not authenticated.

#### Scenario: Locked
- GIVEN the user is not authenticated
- WHEN the Compare section is active
- THEN display "⊘  Compare requires authentication"

---

### Requirement: CLI scope
There is no CLI command for compare. Compare is TUI-only.
