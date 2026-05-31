# CLI Conventions Specification

## Purpose

Define shared patterns for the orbusctl CLI layer so feature specs reference them rather than repeat them.

## Requirements

### Requirement: Entry Point Routing

The `main.ts` entry point SHALL route to CLI mode when `process.argv` contains at least one non-flag argument, and SHALL launch the TUI otherwise.

#### Scenario: CLI dispatch

- GIVEN the user runs `orbusctl <command> [options]`
- WHEN `main.ts` detects a non-flag argument in `process.argv.slice(2)`
- THEN it imports `./cli/index.js` and calls `run()`, never rendering any Ink component

#### Scenario: TUI launch

- GIVEN the user runs `orbusctl` with no non-flag arguments
- WHEN `main.ts` finds no non-flag arguments
- THEN it imports `./tui.js` and mounts the Ink TUI

#### Scenario: Version flag without command

- GIVEN the user runs `orbusctl --version` or `orbusctl -V`
- WHEN no non-flag argument is present
- THEN `main.ts` writes the version string to stdout and exits 0 without launching the TUI

---

### Requirement: --json Flag

All read commands SHALL support a `--json` flag that writes a single JSON value to stdout and suppresses all human-readable output.

#### Scenario: JSON output

- GIVEN a read command is invoked with `--json`
- WHEN the command succeeds
- THEN it writes `JSON.stringify(data, null, 2)` followed by a newline to stdout
- AND no table or tree output is written

#### Scenario: JSON error output

- GIVEN a read command is invoked with `--json`
- WHEN the command throws an error
- THEN `handleError(err, true)` writes `{"error": "<message>"}` to stdout
- AND exits with code 1

---

### Requirement: --force Flag

Write commands and export / doc / activity CLI commands SHALL support a `--force` flag that bypasses the token age pre-flight check.

#### Scenario: Force bypass

- GIVEN a command is invoked with `--force`
- WHEN `checkTokenAge(true)` is called
- THEN the age check is skipped and the command proceeds regardless of token age
- AND the write password gate is NOT bypassed

---

### Requirement: Token Age Pre-flight

The `checkTokenAge` function in `src/cli/preflight.ts` SHALL warn and exit when the saved token is more than 50 minutes old.

#### Scenario: Token too old

- GIVEN `tokenSavedAt` is stored in config and is more than 50 minutes in the past
- WHEN `checkTokenAge(false)` is called
- THEN it writes a warning to stderr including the age and a `--force` hint
- AND exits with code 1

#### Scenario: Token age acceptable

- GIVEN `tokenSavedAt` is 50 minutes or less in the past
- WHEN `checkTokenAge(force)` is called
- THEN it returns without writing anything and the command continues

#### Scenario: Token age unknown

- GIVEN the token was set via the `ORBUS_TOKEN` environment variable (no `tokenSavedAt` in config)
- WHEN `checkTokenAge(force)` is called
- THEN it writes a warning to stderr that age is unknown
- AND returns without exiting

---

### Requirement: Fuzzy Model Resolution

The `resolveModel` function in `src/cli/resolve-model.ts` SHALL resolve a model name or ID to a `{ modelId, modelName }` pair.

#### Scenario: Name match — unique

- GIVEN `--model <name>` is provided
- WHEN `resolveMatch` finds exactly one model whose name contains `<name>` (case-insensitive)
- THEN it returns that model's ID and name

#### Scenario: Name match — ambiguous

- GIVEN `--model <name>` matches multiple model names
- WHEN `resolveMatch` finds more than one partial match
- THEN it writes an error listing the matching names to stderr and exits with code 1

#### Scenario: Name match — not found

- GIVEN `--model <name>` matches no model names
- THEN it writes an error to stderr and exits with code 1

#### Scenario: ID match

- GIVEN `--model-id <guid>` is provided
- WHEN `models.find(m => m.ModelId === guid)` locates the model
- THEN it returns that model's ID and name without fuzzy matching

#### Scenario: Neither provided

- GIVEN neither `--model` nor `--model-id` is present
- THEN the command writes an error to stderr and exits with code 1

---

### Requirement: Error Format

All CLI errors SHALL be written to stderr with exit code 1; `handleError` in `src/cli/errors.ts` SHALL format them consistently.

#### Scenario: Human-readable error

- GIVEN `--json` is not set
- WHEN an error is caught
- THEN `handleError` writes `Error: <message>\n` to stderr and the caller exits with code 1

#### Scenario: JSON mode error

- GIVEN `--json` is set
- WHEN an error is caught
- THEN `handleError` writes `{"error": "<message>"}` (plus optional `"status"` for HTTP errors) to stdout and the caller exits with code 1

#### Scenario: Unauthorized error

- GIVEN the API returns HTTP 401
- WHEN `handleError` receives an `ODataError` with `isUnauthorized === true`
- THEN the message is `Token expired or invalid. Run: orbusctl auth --token <token>`

---

### Requirement: Output Formatting

Human-readable CLI output SHALL use tree prefixes for hierarchical data; `--json` mode SHALL emit raw JSON with no decorative formatting.

#### Scenario: Tree output

- GIVEN `--json` is not set and hierarchical data is rendered
- WHEN `treePrefix(depth, isLast, ancestors)` from `src/cli/output.ts` is called per row
- THEN each row is prefixed with box-drawing characters (`├── `, `└── `, `│   `, `    `) reflecting its position in the hierarchy

#### Scenario: JSON mode suppresses formatting

- GIVEN `--json` is set
- WHEN the command succeeds
- THEN `formatOutput` writes `JSON.stringify(data, null, 2)` to stdout with no tree prefixes or table headers
