# TUI Conventions Specification

## Purpose

Define the four cross-cutting TUI patterns shared by all sections so that feature specs can reference them with a one-liner rather than duplicating scenarios.

## Requirements

### Requirement: Wrap-Around Scrolling

All navigable lists in the TUI SHALL use modulo arithmetic so that ↓ from the last item wraps to the first and ↑ from the first item wraps to the last.

#### Scenario: Down from last item

- GIVEN the cursor is on the last item in a list
- WHEN the user presses ↓ (or `j`)
- THEN the cursor moves to the first item

#### Scenario: Up from first item

- GIVEN the cursor is on the first item in a list
- WHEN the user presses ↑ (or `k`)
- THEN the cursor moves to the last item

#### Scenario: Applies to all lists

- GIVEN any of: model list, object list, drawing list, component list, audit model/issue lists, activity model list, period selector, config settings list, or relationship navigation in a focused detail panel
- WHEN navigation input is received
- THEN the index is computed as `(prev ± 1 + maxItems) % maxItems`

---

### Requirement: Browser Launch `[o]`

The TUI SHALL open a URL or file in the user's configured browser or file handler when `[o]` is pressed and a current item with an associated URL or file path exists.

#### Scenario: Open object in Orbus

- GIVEN the main panel is focused and a viewed object ID is set (models or audit section)
- WHEN the user presses `[o]`
- THEN `getOrbusObjectUrl(objectId)` is called and the result is passed to `openInBrowser(url)`

#### Scenario: Open drawing in Orbus Draw

- GIVEN the main panel is focused and a viewed drawing ID is set but no drawing object is selected (drawings section)
- WHEN the user presses `[o]`
- THEN `getOrbusDrawingUrl(drawingId)` is passed to `openInBrowser(url)`

#### Scenario: Open exported file

- GIVEN an export result is present (audit export, activity export, or model export complete state)
- WHEN the user presses `[o]`
- THEN `openFile(filePath)` is called with the result file path

#### Scenario: Configurable browser

- GIVEN `getBrowser()` returns a non-null browser name
- WHEN `openInBrowser` is called on macOS
- THEN the command is `open -a "{browser}" "{url}"`
- AND on other platforms the command is `"{browser}" "{url}"`

#### Scenario: System default browser

- GIVEN `getBrowser()` returns null or undefined
- WHEN `openInBrowser` is called
- THEN the platform default open command is used (`open` on macOS, `start` on Windows, `xdg-open` on Linux)

#### Scenario: Typing mode guard

- GIVEN `isTypingMode` is true (user is in config server field, write-password field, or export text variable input)
- WHEN the user presses `[o]`
- THEN the key is ignored

---

### Requirement: Help Panel `[?]`

The TUI SHALL toggle the `HelpPanel` component when the user presses `[?]`, showing context-sensitive hint text below the main content area.

#### Scenario: Toggle on

- GIVEN the help panel is hidden (`showHelp` is false)
- WHEN the user presses `[?]`
- THEN `showHelp` becomes true and the `HelpPanel` renders with `display="flex"`

#### Scenario: Toggle off

- GIVEN the help panel is visible (`showHelp` is true)
- WHEN the user presses `[?]`
- THEN `showHelp` becomes false and the `HelpPanel` renders with `display="none"`

#### Scenario: Context-sensitive content

- GIVEN the help panel is visible
- WHEN the active section or sub-state changes
- THEN `HelpPanel` displays up to two hint lines appropriate to the current section and sub-state (e.g. models list vs object detail, activity scanning vs results)

#### Scenario: Placement

- GIVEN the help panel is visible
- THEN it renders below the main content area and above the Footer, distinct from the Footer key hints

#### Scenario: Typing mode guard

- GIVEN `isTypingMode` is true
- WHEN the user presses `[?]`
- THEN the key is ignored

---

### Requirement: Excel Export Overlay `[e]`

The TUI SHALL trigger an Excel export and display an overlay with progress, completion, and error states when `[e]` is pressed and an export hook is active for the current context.

#### Scenario: Trigger export

- GIVEN the audit section is in `all-results` mode with scan complete, or `detail` mode with results
- WHEN the user presses `[e]`
- THEN `auditExport.startExport(results)` is called

#### Scenario: Trigger activity export

- GIVEN the activity section has a completed report
- WHEN the user presses `[e]`
- THEN `activityExport.startExport(report)` is called

#### Scenario: Exporting state

- GIVEN an export is in progress (`exporting` is true)
- THEN the main panel shows "Exporting..." with a phase and optional progress counter

#### Scenario: Complete state

- GIVEN the export hook `result` is set
- THEN the main panel shows "Export complete!", the saved file path, and result counts
- AND pressing `[o]` opens the file

#### Scenario: Error state

- GIVEN the export hook `error` is set
- THEN the main panel shows the error message
- AND pressing `[←/Esc]` resets the export state and returns to the previous view

#### Scenario: Typing mode guard

- GIVEN `isTypingMode` is true
- WHEN the user presses `[e]`
- THEN the key is ignored
