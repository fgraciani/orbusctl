# api-monitoring Specification

## Purpose
Track, categorize, and visualize all API calls made during a session. Provide real-time feedback on API activity and connection health.

## Requirements

### Requirement: API call counter
The app SHALL automatically record every outbound HTTP call at the fetch layer with zero changes to individual API functions.

#### Scenario: Call recording
- GIVEN any API call is made via `odata()` or `trackedFetch()`
- THEN record: HTTP method, timestamp (ms), response status, latency (ms), URL, category
- AND store in an append-only in-memory array via `recordCall()`

#### Scenario: Call categories
- GIVEN a call is made before `markStartupComplete()` fires
- THEN categorize it as `startup` regardless of the current category flag
- AND GIVEN a call is made by the heartbeat hook
- THEN categorize it as `heartbeat` (the hook sets `setCallCategory('heartbeat')` before the call and resets to `user` after)
- AND GIVEN any other call is made after startup completes
- THEN categorize it as `user`

#### Scenario: Reactive listener API
- GIVEN a subscriber registers via `onCall(fn)`
- WHEN a call is recorded
- THEN invoke `fn` with the new `ApiCallRecord`
- AND the subscriber can unsubscribe by calling the returned cleanup function

---

### Requirement: Connection heartbeat
The app SHALL poll the API every 10 seconds to confirm connectivity and token validity.

#### Scenario: Heartbeat check
- GIVEN the user is authenticated and no modal is active
- WHEN the 10-second interval fires
- THEN fire `GET /odata/Me`, categorize the call as `heartbeat`, and update latency on success

#### Scenario: Idle pre-connection state
- GIVEN the token is null (no authentication)
- THEN heartbeat status is `idle` (symbol ○, color gray in Header bar)
- AND the heartbeat timer does not start until a token is provided

#### Scenario: Status display
- GIVEN a heartbeat check completes or fails
- THEN the Header bar SHALL show one of:
  - `● connected` (green) — on 2xx response (label omitted, latency shown in Info panel)
  - `✕ unauthorized` (red, label "unauthorized") — on 401/403
  - `~ timeout` (yellow, label "timeout") — no response within 5s
  - `✕ offline` (red, label "offline") — network error
  - `○` (gray, no label) — idle, before first check

#### Scenario: Heartbeat pulse animation
- GIVEN the user is authenticated
- WHEN a heartbeat check completes
- THEN play a braille spinner animation (`⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏` at 80ms per frame) on the status symbol in the Header bar
- AND after the animation ends the symbol returns to `●` (connected) or the error symbol

#### Scenario: Heartbeat pauses
- GIVEN a modal is active (`showModal || showExitConfirm`)
- WHEN the modal becomes active
- THEN clear the heartbeat timer; resume it when the modal is dismissed

---

### Requirement: API call counter display
The Info panel SHALL show call counts broken down by category.

#### Scenario: Counter layout
- GIVEN the Info panel is visible
- THEN display an "API" section with rows:
  - `Calls (total)` — all calls across all categories (white value)
  - `Startup` — calls made during startup (gray value)
  - `Heartbeat` — heartbeat polling calls (gray value)
  - `User` — user-driven calls total (white value)
  - Per method below User: `GET` (green), `POST` (yellow), `PATCH` (cyan), `DELETE` (red), each showing its count and sparkline lane

#### Scenario: Latency display
- GIVEN the last heartbeat returned a 2xx response
- THEN display `Latency: Xms` above the call counts in the API section

---

### Requirement: API activity chart
The Info panel SHALL show a real-time sparkline chart of user-driven API activity, inline within the API counter section.

#### Scenario: Chart specification
- GIVEN at least one user-category call has been made and startup is complete
- THEN render one sparkline lane per HTTP method that has been used: GET (green), POST (yellow), PATCH (cyan), DELETE (red)
- AND use eighth-block characters (`▁▂▃▄▅▆▇█`) with one row per lane
- AND use a 22-minute scrolling window where 1 column = 1 minute
- AND align bucket boundaries to clock minutes (`Math.floor(now/60000)*60000`) to prevent jitter
- AND refresh display every second; shift window left on each new clock minute
- AND show only user-category calls (startup and heartbeat excluded)

#### Scenario: Startup suppression
- GIVEN `isStartupComplete()` returns false
- WHEN the chart tick fires
- THEN return early without computing or updating the chart state
- AND the chart does not render until `markStartupComplete()` has been called

#### Scenario: Scale
- GIVEN a minute bucket has N user calls
- THEN use 1:1 scale up to 8 calls/minute (1 call = `▁`, 8 calls = `█`)
- AND above 8 calls/minute auto-scale to fit using ceiling division (`Math.max(8, ...values)`)
- AND minimum visible level is `▁` for any non-zero value (never blank for active minutes)
- AND zero calls in a bucket renders as a space (no bar)

#### Scenario: Collapsible lanes
- GIVEN no POST, PATCH, or DELETE calls have been made in the current window
- THEN hide that method's lane
- WHEN the first call of that method occurs
- THEN the lane appears automatically

#### Scenario: ApiChart component
- The `src/components/ApiChart.tsx` component implements an alternate standalone sparkline renderer with abbreviated method labels (PST/PAT/DEL) and a fully-relative scale algorithm (max-relative with `Math.round`, not the 8-call ceiling).
- The TUI Info panel (StatsPanel.tsx) uses its own inline `sparkline()` function — ApiChart.tsx is not used in the current TUI and appears unused.

---

### Requirement: Session summary (exit screen)
The session summary SHALL display API call statistics on exit.

#### Scenario: Exit confirm summary content
- GIVEN the user presses `q` and confirms exit
- THEN the ConfirmModal SHALL show a two-column layout with:
  - Left column: Duration, Start, End, Tokens
  - Right column: Calls (total), Startup (gray), Heartbeat (gray), User; indented per-method user breakdown in sage green

#### Scenario: Stdout exit summary
- GIVEN the user confirms exit (presses `y` or Enter in ConfirmModal)
- THEN after Ink unmounts, `printExitSummary()` writes to stdout:
  - Screen clear (`\x1b[2J\x1b[H`)
  - Bordered box with Duration, Start, End, Tokens in left column
  - Calls (total), Startup, Heartbeat, User breakdown in right column
  - Per-method user call counts in sage green
  - `Goodbye, {username}!` closing line

<!-- FUTURE: session stats persistence to ~/.orbusctl/stats.json, cumulative lifetime stats -->
<!-- NOTE: SessionSummaryScreen.tsx (with 5s auto-exit countdown) is defined but currently unused; the exit flow uses ConfirmModal + printExitSummary -->
