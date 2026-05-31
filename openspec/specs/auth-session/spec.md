# auth-session Specification

## Purpose
Manage bearer token lifecycle — from startup through mid-session refresh to exit. Fetch user identity, roles, and license types.

## Requirements

### Requirement: Token check at startup
The app SHALL read the saved token from `~/.orbusctl/config.json` on launch and validate it against the API (no hardcoded expiry assumption).

#### Scenario: Token found — optimistic load
- GIVEN a saved token exists in config
- WHEN the app launches
- THEN assume the token is valid (optimistic)
- AND show the welcome modal with the user's name and "Auth token valid"
- AND show "Press any key to enter"

#### Scenario: Background validation
- GIVEN the app has shown the welcome modal with an optimistic token
- WHEN the background `GET /odata/Me?$expand=Roles,FeaturePermissions` call completes
- THEN if validation succeeds: extract roles and licenses, set auth status to authenticated
- AND if validation fails: set auth to expired and open the token input prompt

#### Scenario: Token validated successfully
- GIVEN the background validation succeeds
- THEN extract roles (sorted alphabetically) and licenses (Author/Viewer from `LicenseTypeCategoryId`)
- AND determine admin status from `HasModelAdministrationPermission`
- AND show `● {username}` in green in the header

#### Scenario: Token validation fails
- GIVEN the background validation returns 401 or fails
- THEN show the welcome modal with a token input prompt
- AND display a yellow warning "Session expired — enter a new bearer token (previous token: Xm)"

#### Scenario: No token saved
- GIVEN no token exists in config
- WHEN the app launches
- THEN show the welcome modal with a token input prompt
- AND display "Enter your bearer token to authenticate"

#### Scenario: ORBUS_TOKEN env var override
- GIVEN `ORBUS_TOKEN` is set in the environment
- WHEN `getToken()` is called
- THEN return the env var value instead of reading `config.json`
- AND note: `hasToken()` does NOT check `ORBUS_TOKEN` — only `readConfig().token`; an env-var-only auth state skips the optimistic load path

---

### Requirement: Token input
The app SHALL allow the user to paste a bearer token in the welcome modal using a custom input handler (not ink-text-input).

#### Scenario: Token pasted
- GIVEN the welcome modal is showing a token input
- WHEN the user pastes a token (> 20 characters)
- THEN display a truncated preview: first 20 chars + `…` (Unicode ellipsis) + last 10 chars + char count
- AND wait for Enter to submit

#### Scenario: Token submitted
- GIVEN a token has been pasted
- WHEN the user presses Enter
- THEN show "Validating token..."
- AND call `GET /odata/Me?$expand=Roles,FeaturePermissions`
- AND on success: save token + user info to config, extract roles (sorted alphabetically) and licenses (Author/Viewer from `LicenseTypeCategoryId`), determine admin status from `HasModelAdministrationPermission`, dismiss modal
- AND on failure: show "Authentication failed — check your token", return to input

#### Scenario: Empty token submitted
- GIVEN the token input is empty
- WHEN the user presses Enter
- THEN the field is inert — no submission occurs and no error is displayed (the `useInput` guard checks `token.length > 0` before calling `handleSubmit`)

---

### Requirement: Skip authentication
The app SHALL allow the user to enter the TUI without authenticating.

#### Scenario: User skips auth
- GIVEN the welcome modal is showing a token input
- WHEN the user presses Esc
- THEN enter the TUI with no auth
- AND show `○ no auth` in red (dimmed) in the header
- AND show all sections as locked with "⊘ {Section} requires authentication"

---

### Requirement: Mid-session re-authentication
The app SHALL allow the user to re-authenticate at any point during a session.

#### Scenario: User triggers re-auth
- GIVEN the user is in the TUI
- WHEN the user presses [a]
- THEN show the welcome modal with a token input
- AND preserve all current navigation state

#### Scenario: Re-auth fails
- GIVEN the user has submitted a token via the re-auth modal
- WHEN the API call returns an error
- THEN display "Authentication failed — check your token" in the modal
- AND return the user to the token input prompt with previous auth state unchanged

---

### Requirement: Heartbeat and automatic expiry detection
The app SHALL poll the API every 10 seconds to detect token expiry.

#### Scenario: Heartbeat detects expired token
- GIVEN the user has an active session
- WHEN the heartbeat `GET /odata/Me` returns 401/403
- THEN set auth status to expired
- AND automatically open the welcome modal with "Session expired" warning

#### Scenario: Heartbeat pauses during modals
- GIVEN a modal is active (`showModal || showExitConfirm`)
- THEN the heartbeat timer SHALL pause
- AND resume when the modal is dismissed

#### Scenario: Heartbeat idle when no token
- GIVEN token is null (no auth or skipped auth)
- THEN heartbeat status is `idle` and no polling occurs

---

### Requirement: Connection status display
The Info panel SHALL display the heartbeat status with a visual indicator.

#### Scenario: Connected
- GIVEN the heartbeat returns 2xx
- THEN show `● connected` in green with latency in ms
- AND play a braille spinner animation (`⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏` at 80ms per frame) on each heartbeat check

#### Scenario: Unauthorized
- GIVEN the heartbeat returns 401/403
- THEN show `✕ unauthorized` in red

#### Scenario: Timeout
- GIVEN the heartbeat does not respond within 5 seconds
- THEN show `~ timeout` in yellow

#### Scenario: Offline
- GIVEN the heartbeat fails with a network error
- THEN show `✕ offline` in red

---

### Requirement: Token age display
The Info panel SHALL display how old the current token is.

#### Scenario: Token age in Info panel
- GIVEN the user is authenticated
- AND the Info panel is visible
- THEN display the token age as elapsed time since `tokenSavedAt` (e.g., "Token age: 23m")
- AND update the display live alongside the session duration counter

#### Scenario: Token age missing
- GIVEN `tokenSavedAt` is absent from config (e.g., token set via `ORBUS_TOKEN` env var)
- THEN `formatTokenAge()` returns `null` and the token age field is omitted from display

---

### Requirement: Configurable server URL
The app SHALL read the API server URL from `~/.orbusctl/config.json` via `getServer()`/`getBaseUrl()`.

#### Scenario: Server URL from config
- GIVEN a server URL is stored in config
- WHEN the app makes API calls
- THEN use the configured server URL as the base for all API requests

#### Scenario: Default server
- GIVEN no server URL is configured
- THEN fall back to the default Orbus API URL

#### Scenario: Mid-session server URL change
- GIVEN the user edits the server URL in the Config section and presses Enter
- THEN `saveServer()` persists the new URL (stripping any trailing slash)
- AND all dependent state is reset: export hook, compare selections, audit state, navigation index
- AND subsequent API calls use the new server URL

---

### Requirement: Config file security
The app SHALL protect the config file with restricted permissions.

#### Scenario: Config written with restricted permissions
- GIVEN `writeConfig()` is called
- THEN the file is written with mode `0o600` and `chmodSync` enforces `0o600`
- AND the config directory `~/.orbusctl/` is created if absent

---

### Requirement: User identity display
The app SHALL display the authenticated user's identity, roles, and license types.

#### Scenario: Info panel content
- GIVEN the user is authenticated
- THEN the header shows `● {username}` in green (top-right)
- AND the Info panel shows: session duration (live counter), token age (live counter), license types on one line (`Admin | Author | Viewer` colour-coded: Admin=#e88a7a, Author=#d4a053, Viewer=#6cb886), roles sorted alphabetically and colour-coded by license type
- AND Admin status is derived from `FeaturePermissions.HasModelAdministrationPermission`

---

### Requirement: CLI auth command
The CLI SHALL provide an `auth` command to save a bearer token without launching the TUI.

#### Scenario: Token saved via CLI
- GIVEN the user runs `orbusctl auth --token <token>`
- THEN call `GET /odata/Me` (via `fetchMe`, not `fetchMeWithRoles`)
- AND on success: call `saveAuth(token, user)` to persist token, `tokenSavedAt`, and user info to config
- AND print `Authenticated as {name} ({account})` to stdout
- AND with `--json`: output `{"status":"ok","user":"...","account":"...","email":"..."}` to stdout

#### Scenario: CLI auth failure
- GIVEN the user runs `orbusctl auth --token <token>` with an invalid token
- THEN print error to stderr and exit with code 1
- AND with `--json`: output `{"error":"..."}` to stderr

#### Scenario: Token age pre-flight (CLI write/export commands)
- GIVEN `tokenSavedAt` is more than 50 minutes old
- WHEN a write command, export, doc generate, or activity CLI command runs
- THEN `checkTokenAge()` prints a warning to stderr and exits with code 1
- AND `--force` bypasses this check (see cli-conventions)
- AND if `tokenSavedAt` is absent (token from `ORBUS_TOKEN` env var): print a warning but do not exit
