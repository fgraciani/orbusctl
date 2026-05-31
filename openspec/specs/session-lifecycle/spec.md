# Session Lifecycle Specification

## Purpose
Define the full lifecycle of an orbusctl session — from launch through exit.

## Requirements

### Requirement: Terminal setup
The app SHALL configure the terminal on launch and restore it on exit.

#### Scenario: Background colour
- WHEN the app launches
- THEN set the terminal background to `#0E2A35` via OSC escape sequence `\x1b]11;#0E2A35\x07`
- WHEN the app exits (exit, SIGINT, SIGTERM)
- THEN restore the terminal background via `\x1b]111\x07`

---

### Requirement: Welcome modal
The app SHALL show a full-screen welcome modal before the TUI is accessible.

#### Scenario: Authenticated welcome
- GIVEN a valid token is found at startup
- WHEN the welcome modal renders
- THEN display the ORBUSCTL ASCII art (from `src/assets/logo.ts`)
- AND display "● Welcome, {username}!" in green
- AND display "Auth token valid" in dimmed gray
- AND display "Press any key to enter"
- AND dismiss on any keypress

#### Scenario: Auth required welcome
- GIVEN no valid token at startup
- WHEN the welcome modal renders
- THEN display the ORBUSCTL ASCII art
- AND show a token input (see auth-session spec for details)

#### Scenario: Authentication failure
- GIVEN the token input is visible
- WHEN the user submits a token that fails validation
- THEN display "Authentication failed — check your token" in red below the token field
- AND keep the modal open for re-entry

#### Scenario: Session-expiry re-entry
- GIVEN the heartbeat detects an unauthorized response mid-session
- WHEN no modal is currently active
- THEN force `auth.status` to `expired`
- AND re-show the welcome modal with the expired-session prompt

---

### Requirement: Layout
The TUI SHALL render a persistent layout filling the full terminal height.

#### Scenario: Panel dimensions
- GIVEN the welcome modal is dismissed
- THEN render: Header (1 line + margin), sidebar Menu panel (fixed 18 chars), main content panel(s) (flex width), optional Info panel (fixed 30 chars, toggled with `[s]`), Footer (1 line)

#### Scenario: Modal mount strategy
- GIVEN any modal is active (`showModal || showExitConfirm`)
- THEN set the main TUI to `display="none"` rather than unmounting it
- AND on modal dismiss restore `display="flex"`
- AND this prevents the border-flash that occurs on first mount

---

### Requirement: Global session keys
The app SHALL respond to global key bindings that modify session state.

#### Scenario: Help panel toggle
- GIVEN the TUI is active and `isTypingMode` is false
- WHEN the user presses `[?]`
- THEN toggle the HelpPanel component between `display="none"` and `display="flex"`
- AND see tui-conventions for HelpPanel content and states

#### Scenario: Re-authenticate
- GIVEN the TUI is active and `isTypingMode` is false
- WHEN the user presses `[a]`
- THEN show the welcome modal
- AND preserve all current navigation state

#### Scenario: Browser launch
- GIVEN the TUI is active and a current item has an associated URL
- WHEN the user presses `[o]` in the main panel
- THEN open the item in the configured browser
- AND see tui-conventions for context-sensitive `[o]` behaviour

#### Scenario: Stats panel toggle
- GIVEN the TUI is active and `isTypingMode` is false
- WHEN the user presses `[s]`
- THEN toggle the Info panel visibility

#### Scenario: Ctrl+C instant exit
- GIVEN the TUI is active (including during modal display)
- WHEN the user presses Ctrl+C
- THEN call `audit.reset()` and exit immediately via Ink's `exit()`
- AND do NOT show the exit confirmation modal
- AND do NOT print a session summary to stdout

#### Scenario: Typing mode guard
- GIVEN the user is editing a text field (config server, write-password, or export variable text input)
- WHEN any of `[q]`, `[a]`, `[s]`, `[?]` is pressed
- THEN suppress the global shortcut (text input takes priority)

---

### Requirement: Exit confirmation and session summary
The app SHALL show a unified exit/summary box when the user requests exit. The confirm modal IS the session summary — a single bordered box serves both purposes.

#### Scenario: Exit screen layout
- GIVEN the user presses `[q]` and `isTypingMode` is false
- THEN render ConfirmModal inline within the Ink layout (no screen clear at this stage)
- AND display a bordered box with title `╭─ ORBUSCTL v{VERSION} ─── Session Summary ─╮`
- AND display a two-column layout inside the box
- AND left column shows: Duration, Start datetime, End datetime, Tokens
- AND right column shows: Calls (total API calls), Startup (count, dimmed), Heartbeat (count, dimmed), User (count), per-method user call counts in sage green (`#6cb886`)
- AND bottom line shows `Exit ORBUSCTL? [y/↵] yes  [Esc/n] cancel` in yellow

#### Scenario: Token refresh display
- GIVEN the user has re-authenticated one or more times during the session
- WHEN the exit summary renders
- THEN the Tokens field shows `{N} ({N-1} refresh)` or `{N} ({N-1} refreshes)` for multiple refreshes
- AND when no re-authentication has occurred it shows `1`

#### Scenario: User confirms exit
- GIVEN the exit screen is showing
- WHEN the user presses `[y]` or Enter
- THEN clear the terminal screen (`\x1b[2J\x1b[H`)
- AND print the same two-column summary layout to stdout with `Goodbye, {username}!` replacing the confirmation prompt
- AND exit the process

#### Scenario: User cancels exit
- GIVEN the exit screen is showing
- WHEN the user presses Esc or `[n]`
- THEN dismiss the exit screen and return to the TUI

---

### Requirement: Info panel
The Info panel (toggled with `[s]`) SHALL display session information.

#### Scenario: Info panel content
- GIVEN the Info panel is visible
- WHEN the panel renders
- THEN display sections: Session (duration counter ticking every second), License (Admin|Author|Viewer on one line, colour-coded), Roles (sorted alphabetically, colour-coded by license type), API (heartbeat status with braille pulse animation, latency, per-method sparkline charts)

---

### Requirement: CLI entry path
The app SHALL route to CLI mode when command arguments are present.

#### Scenario: CLI invocation
- GIVEN the user runs `orbusctl <command> [options]`
- WHEN `main.ts` detects a non-flag argument in `process.argv`
- THEN import and run the CLI layer (Commander.js)
- AND never render any Ink TUI components
- AND see cli-conventions for full CLI routing and flag conventions

#### Scenario: TUI invocation
- GIVEN the user runs `orbusctl` with no arguments
- WHEN `main.ts` detects no non-flag arguments
- THEN import `tui.js` and launch the Ink TUI
