# Config Specification

## Purpose
In-app configuration management — edit server URL, solution filter, display settings, authentication, write password, and browser preference from within the TUI.

## Requirements

### Requirement: Settings list
The Config section SHALL display a list of six configurable settings.

#### Scenario: Settings displayed
- GIVEN the Config section is active
- THEN display a list of settings: Server (current URL), Solution filter (current selection), Show hidden models (toggle state), Auth token (Set ● or Not set), Write password (Not set / Expired / Active), Browser (current selection or System default)
- AND each setting shows its current value

---

### Requirement: Server URL setting
The app SHALL allow editing the API server URL inline.

#### Scenario: Edit server URL
- GIVEN the Config section is active
- WHEN the user presses Enter on the Server setting
- THEN activate an inline text editor pre-filled with the current server URL

#### Scenario: Save server URL
- GIVEN the inline text editor is active for the Server setting
- WHEN the user presses Enter
- THEN save the new URL to `~/.orbusctl/config.json` via `saveServer()` which strips trailing slashes
- AND reset all dependent state (compare, audit, export, drawings) so subsequent API calls use the new server

#### Scenario: Cancel server URL edit
- GIVEN the inline text editor is active for the Server setting
- WHEN the user presses Esc
- THEN discard the edit and return to the settings list

---

### Requirement: Solution filter setting
The app SHALL allow selecting a solution to filter models.

#### Scenario: Open solution filter
- GIVEN the Config section is active
- WHEN the user presses Enter on the Solution filter setting
- THEN display a select list with "All models (no filter)" as the first option, followed by solution names fetched via `fetchSolutions`
- AND mark the currently active solution with a ● indicator

#### Scenario: Select solution
- GIVEN the solution select list is displayed
- WHEN the user presses Enter on a solution
- THEN save the selection to config via `saveSolutionFilter`
- AND the model list is immediately filtered to the selected solution

#### Scenario: Clear solution filter
- GIVEN the solution select list is displayed
- WHEN the user selects "All models (no filter)"
- THEN remove the solution filter from config
- AND all models become visible

#### Scenario: Cancel solution picker
- GIVEN the solution select list is displayed
- WHEN the user presses Esc
- THEN return to the settings list without changing the selection

#### Scenario: fetchSolutions API failure
- GIVEN the Config section is active and the user has no auth token
- WHEN the user presses Enter on the Solution filter setting
- THEN the solution list opens empty (fetchSolutions call is silently suppressed when token is null)

---

### Requirement: Show hidden models setting
The app SHALL allow toggling visibility of hidden models.

#### Scenario: Toggle hidden models
- GIVEN the Config section is active
- WHEN the user presses Enter on the "Show hidden models" setting
- THEN toggle the boolean value in config via `saveShowHiddenModels`
- AND the change takes effect immediately in the model list

---

### Requirement: Auth token setting
The app SHALL allow re-authenticating from the Config section.

#### Scenario: Token set display
- GIVEN the user is authenticated
- THEN the Auth token row displays "Set ●"

#### Scenario: Token not set display
- GIVEN the user has no auth token
- THEN the Auth token row displays "Not set"

#### Scenario: Open auth from config
- GIVEN the Config section is active
- WHEN the user presses Enter on the "Auth token" setting
- THEN open the authentication modal (same as pressing [a] globally)

---

### Requirement: Write password setting
The app SHALL display the write password status and allow setting or viewing recent write operations.

#### Scenario: Write password not set
- GIVEN no write password has been saved in config
- THEN the Write password row displays "Not set"

#### Scenario: Write password expired
- GIVEN a write password hash exists in config
- AND more than 24 hours have elapsed since `writePasswordSetAt`
- THEN the Write password row displays "Expired"

#### Scenario: Write password active
- GIVEN a write password hash exists in config
- AND fewer than 24 hours have elapsed since `writePasswordSetAt`
- THEN the Write password row displays "Active (Xh Ym ago)" where X and Y are hours and minutes since the password was set

#### Scenario: Open write password log
- GIVEN a write password hash exists (Not set path is skipped)
- WHEN the user presses Enter on the Write password setting
- THEN display the write-password-log sub-view showing up to the last 10 write operations since the password was set
- AND each entry shows timestamp, operation, object type, object name or ID, and success/failure indicator
- AND guidance reads "[↵] set new password  ·  [Esc] cancel"

#### Scenario: Open write password input directly
- GIVEN no write password hash exists in config
- WHEN the user presses Enter on the Write password setting
- THEN display the masked write password input sub-view immediately

#### Scenario: Transition from log to password input
- GIVEN the write-password-log sub-view is displayed
- WHEN the user presses Enter
- THEN transition to the masked write password input sub-view

#### Scenario: Save write password
- GIVEN the masked write password input is displayed
- WHEN the user types a password and presses Enter
- THEN hash the password with scrypt and save hash, salt, and `writePasswordSetAt` timestamp to config via `saveWritePassword`
- AND return to the settings list

#### Scenario: Cancel write password input
- GIVEN the masked write password input is displayed
- WHEN the user presses Esc
- THEN discard input and return to the settings list

---

### Requirement: Browser setting
The app SHALL allow selecting the browser used for "open in Orbus" actions.

#### Scenario: Open browser picker
- GIVEN the Config section is active
- WHEN the user presses Enter on the Browser setting
- THEN display a picker with options: System default, Microsoft Edge, Google Chrome, Firefox, Safari
- AND mark the currently selected browser with ●

#### Scenario: Select browser
- GIVEN the browser picker is displayed
- WHEN the user presses Enter on an option
- THEN save the selection via `saveBrowser`
- AND the Browser row displays the selected option (or "System default" for the system default)

#### Scenario: Cancel browser picker
- GIVEN the browser picker is displayed
- WHEN the user presses Esc
- THEN return to the settings list without changing the selection

---

### Requirement: Immediate effect
All configuration changes SHALL take effect without requiring a restart.

#### Scenario: Config changes are live
- GIVEN any setting is changed in the Config section
- THEN `writeConfig()` is called synchronously and the change is persisted to `~/.orbusctl/config.json` immediately
- AND settings that affect model visibility (solution filter, show hidden models) take effect the next time models are rendered
- AND the server URL change resets all section state so the next API call uses the new server
