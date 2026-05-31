# tui-navigation Specification

## Purpose
Define the keyboard navigation model across all TUI panels.

## Requirements

### Requirement: Panel focus
The TUI SHALL maintain a single focused panel at all times, indicated by a cyan border. Unfocused panels use gray borders.

#### Scenario: Switch focus between sidebar and main
- GIVEN the TUI is active
- AND the current section is not locked (`isLocked` is false)
- WHEN the user presses Tab
- THEN focus cycles: sidebar → main → sidebar

#### Scenario: Tab blocked when section is locked
- GIVEN the current section is locked (`isLocked` is true)
- WHEN the user presses Tab
- THEN focus does not change

#### Scenario: Enter main panel from sidebar
- GIVEN focus is on the sidebar and the selected section has items
- WHEN the user presses Enter or →
- THEN focus moves to the main content panel

#### Scenario: Return to sidebar
- GIVEN focus is on the main content panel at the top navigation level
- WHEN the user presses Esc or ←
- THEN focus returns to the sidebar

---

### Requirement: Sidebar navigation
The sidebar (titled "Menu") SHALL allow navigating between sections.

#### Scenario: Navigate sections
- GIVEN focus is on the sidebar
- WHEN the user presses ↑ or ↓
- THEN the selected section changes using wrap-around (see tui-conventions)
- AND the main content resets to the section's top-level view

#### Scenario: Available sections
- GIVEN the TUI is active
- WHEN the sidebar is rendered
- THEN it displays these sections in order: Content, Drawings, Compare, Activity, Audit, Export, Config

#### Scenario: Locked sections
- GIVEN the user is not authenticated (auth status is `none` or `expired`)
- WHEN any section requiring authentication is selected
- THEN show ⊘ prefix instead of ▶
- AND the main panel shows "⊘ {Section} requires authentication"

---

### Requirement: Main panel navigation
The main content panel SHALL support multi-level drill-down navigation.

#### Scenario: List navigation
- GIVEN a list view is active (models, objects, drawings, etc.)
- WHEN the user presses ↑/↓
- THEN the selection moves within the list using wrap-around (see tui-conventions)
- AND virtual scrolling keeps the selection visible (2 rows of padding from edges)

#### Scenario: Drill into / back out
- GIVEN a list item is selected
- WHEN the user presses Enter or →
- THEN drill into the next level (model → objects, objects → detail)
- WHEN the user presses Esc or ←
- THEN return to the previous level

---

### Requirement: Detail panel focus
The object detail panel SHALL be a separate focus target for relationship navigation. This pattern applies to models (`detailFocused`), drawings (`drawingDetailFocused`), and audit (`auditDetailFocused`) sections.

#### Scenario: Enter detail focus
- GIVEN the detail panel is showing an object
- WHEN the user presses Enter on the same object a second time
- THEN the detail panel becomes focused (cyan border)
- AND the objects list panel becomes unfocused (gray border)

#### Scenario: Navigate relationships in focused detail
- GIVEN the detail panel is focused
- WHEN the user presses ↑/↓
- THEN the selected relationship changes using wrap-around (see tui-conventions)

#### Scenario: Jump to related object
- GIVEN the detail panel is focused and a relationship is selected
- WHEN the user presses Enter or →
- THEN the viewed object changes to the related object (by its ObjectId)
- AND the relationship index resets to 0

#### Scenario: Exit detail focus
- GIVEN the detail panel is focused
- WHEN the user presses Esc or ←
- THEN focus returns to the objects list panel

---

### Requirement: Global keys
The following keys SHALL work regardless of focused panel (except during modals). Single-character keys (q, a, s, ?) are suppressed when `isTypingMode` is active.

| Key | Action |
|-----|--------|
| q | Open exit confirmation modal |
| Ctrl+C | Immediate exit (no confirmation) |
| s | Toggle Info panel |
| a | Open auth modal |
| ? | Toggle help panel |
| o | Browser launch / open file (context-sensitive, main panel only) |
| e | Trigger Excel export (context-sensitive, main panel only) |
| Space | Toggle multi-select in audit select-models mode |
| Tab | Cycle panel focus (blocked when `isLocked`) |

#### Scenario: Open exit confirmation
- GIVEN `isTypingMode` is false
- WHEN the user presses q
- THEN the exit confirmation modal is shown

#### Scenario: Immediate exit
- GIVEN any state
- WHEN the user presses Ctrl+C
- THEN the app exits immediately with no confirmation and no summary

#### Scenario: Toggle help panel
- GIVEN `isTypingMode` is false
- WHEN the user presses ?
- THEN the HelpPanel is toggled (see tui-conventions)

#### Scenario: Browser launch / open file
- GIVEN focus is on the main panel
- WHEN the user presses o
- THEN the context-sensitive action fires:
  - Export section with template export result → open exported file
  - Export section with excel/markdown export result → open exported file
  - Audit section with export result → open exported audit file
  - Activity section with export result → open exported activity file
  - Models section with a viewed object → open object in Orbus browser
  - Drawings section with a viewed drawing object → open that object in Orbus browser
  - Drawings section with a viewed drawing → open drawing in Orbus Draw
  - Audit section with a viewed audit object → open object in Orbus browser

#### Scenario: Excel export trigger
- GIVEN focus is on the main panel
- WHEN the user presses e
- THEN the context-sensitive export fires:
  - Audit all-results mode with results available and not already exporting → start audit Excel export
  - Audit detail mode with a result → start audit Excel export for that result
  - Activity section with a report and not already exporting → start activity Excel export

#### Scenario: Multi-select toggle
- GIVEN the active section is audit and the audit mode is select-models
- WHEN the user presses Space on a model row
- THEN the model's selection is toggled (added if not selected, removed if selected)

---

### Requirement: isTypingMode guard
The app SHALL suppress single-character global keys (q, a, s, ?) while the user is entering text.

#### Scenario: Typing mode active
- GIVEN the user is editing the server URL field, the write-password field, or an export variable text input (not a picklist)
- WHEN any of q, a, s, or ? is pressed
- THEN the key is ignored by the global shortcut handler
- AND the character is processed by the active text field instead

---

### Requirement: Footer
The footer SHALL display context-sensitive key hints.

#### Scenario: Sidebar focused
- GIVEN the TUI is active and focus is on the sidebar
- THEN show `[Tab] focus [↑↓] nav [→/↵] open [s] stats [a] auth [?] help [q] quit`

#### Scenario: Main panel focused
- GIVEN the TUI is active and focus is on the main panel
- THEN show `[Tab] focus [↑↓] nav [Esc/←] back [↵] select [s] stats [a] auth [?] help [q] quit`

---

### Requirement: Vim keybindings
The app SHALL support vim-style navigation as undocumented power-user keys: j/k for ↑/↓, h/l for ←/→. These are NOT shown in the footer (progressive disclosure).

#### Scenario: Vim keys active
- GIVEN the TUI is active
- WHEN the user presses j, k, h, or l
- THEN the action is identical to ↓, ↑, ←, or → respectively in the current context
