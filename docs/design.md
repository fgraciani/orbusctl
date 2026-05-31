# orbusctl TUI Design Guidelines

Design principles and implementation patterns for the orbusctl terminal user interface.

## Panel system

### Custom top border

Every panel uses a custom-rendered top border with an inline title, followed by a native Ink `<Box>` with `borderTop={false}` for the remaining three sides. This produces the signature appearance:

```
╭─ Panel Title ─────────────────────────╮
│                                       │
│  content                              │
│                                       │
╰───────────────────────────────────────╯
```

The top border is a `<Text>` element rendering `╭─ Title ─╮` padded with `─` to fill the available width. See ADR-002 for the rationale.

### Width modes

Panels operate in two width modes:

- **Flex panels** — use `measureElement` to determine their rendered width at runtime. The main content panel and sidebar use this mode. `measureElement` requires one extra render frame, which is acceptable.
- **Stacked (fixed) panels** — use a computed width from a known constant. The Info panel (30 chars) and sidebar (18 chars) use this mode. The computed width avoids `measureElement` overhead for panels that never resize.

### Focus indication

The focused panel has a **cyan** border. All unfocused panels use **gray** borders. Only one panel is focused at a time. Tab cycles focus between sidebar and main content.

## Colour palette

### Brand

| Element | Colour | Usage |
|---------|--------|-------|
| Background | `#0E2A35` | Terminal background, set via OSC escape on launch |
| Accent | cyan | Focused panel borders, selected items, links |
| Dimmed | gray | Unfocused borders, secondary text |

### ArchiMate layer colours

Objects are coloured by their ArchiMate layer, mapped in `core/domain/colors.ts`:

| Layer | Colour | Examples |
|-------|--------|----------|
| Strategy | yellow | Resource, Capability, Course of Action |
| Business | yellow | Business Process, Business Service, Business Role |
| Application | cyan | Application Component, Application Service |
| Technology | green | Node, Artifact, Technology Service |
| Motivation | magenta | Stakeholder, Driver, Goal, Requirement |
| Implementation | red | Work Package, Deliverable |
| Other/Composite | white | Grouping, Location, Junction |

These colours are used consistently in: object lists, drawing component views, audit results, activity entries, compare diffs, and export context.

### License colours

User license types are colour-coded in the Info panel and role lists:

| License | Colour | Hex |
|---------|--------|-----|
| Admin | salmon | `#e88a7a` |
| Author | gold | `#d4a053` |
| Viewer | green | `#6cb886` |

## Keyboard model

### Primary layer (shown in footer)

Arrow keys are the primary navigation method, always visible in the footer hints:

| Key | Action |
|-----|--------|
| ↑ / ↓ | Navigate within lists |
| → / Enter | Drill into / select |
| ← / Esc | Back out / cancel |
| Tab | Cycle panel focus |

### Undocumented layer (vim keys)

Vim-style keys work everywhere but are never shown in the footer (progressive disclosure for power users):

| Key | Equivalent |
|-----|-----------|
| j | ↓ |
| k | ↑ |
| h | ← |
| l | → |

### Global keys

Available regardless of focused panel, except when a modal is active:

| Key | Action |
|-----|--------|
| q | Open exit confirmation |
| Ctrl+C | Immediate exit |
| s | Toggle Info panel |
| a | Open auth modal |
| 1-7 | Jump to section by number |

## Virtual scrolling

All list views use virtual scrolling to handle datasets larger than the terminal viewport.

### Viewport height

The viewport height is computed from the terminal height minus the fixed chrome (header, footer, panel borders, title lines). This value updates on terminal resize.

### Scroll indicators

When the list extends beyond the viewport, directional indicators appear:

- **▲** at the top when items exist above the visible area
- **▼** at the bottom when items exist below the visible area

### Padded strings

All list entries are padded to fixed column widths with trailing spaces. This prevents Ink overflow artifacts ("ghost characters") that appear when a shorter string replaces a longer one at the same position without clearing the remaining characters.

### Selection padding

The selected row maintains 2 rows of padding from the viewport edges. When the selection moves within 2 rows of the top or bottom, the viewport scrolls to maintain this buffer.

## Info panel

The Info panel is a fixed 30-character-wide panel on the right side, toggled with the `s` key.

### Sections

1. **Session** — live duration counter (ticking every second), start time, token age
2. **License** — `Admin | Author | Viewer` on one line, each coloured by license type
3. **Roles** — sorted alphabetically, each coloured by its associated license type
4. **API** — heartbeat status with braille pulse animation, latency in ms, call counts by category (startup/heartbeat/user), per-HTTP-method sparkline charts

### Heartbeat pulse

The heartbeat indicator uses a braille spinner animation (`⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏`) cycling at 80ms per frame during each heartbeat check. Between checks, it shows a static dot:
- `●` green — connected (with latency)
- `✕` red — unauthorized or offline
- `~` yellow — timeout

### Sparkline charts

The API section includes miniature sparkline charts (using block characters) showing recent API call frequency per HTTP method. Data is collected by `useApiChart` from the counter categories.

## Modal pattern

### Always-mounted TUI

The main TUI layout is always mounted in the React tree. When a modal is active, the TUI receives `display="none"` rather than being conditionally unmounted. This prevents the border flash that occurs when Ink components mount for the first time (the first render frame draws borders at default width before `measureElement` provides the correct width). See ADR-003.

### Modal types

| Modal | Trigger | Content |
|-------|---------|---------|
| WelcomeModal | Startup, `a` key | ASCII art logo, token input, validation |
| ConfirmModal | `q` key | Session summary + exit confirmation |

Both modals render as full-width boxes centred in the terminal.

## Exit flow

The exit flow uses a **unified confirm+summary pattern**: the exit confirmation modal IS the session summary. There is no separate summary screen.

### In-TUI confirm box

When the user presses `q`:
1. Screen clears
2. A bordered box appears: `╭─ ORBUSCTL v1.0.0 ─── Session Summary ─╮`
3. Two-column layout inside:
   - Left: Duration, Start datetime, End datetime, Tokens remaining
   - Right: Calls (total), Startup, Heartbeat, User, per-method GET (sage green)
4. Bottom line: `Exit ORBUSCTL? [y/↵] yes  [Esc/n] cancel` in yellow

### Stdout output on exit

When the user confirms (`y` or Enter):
1. Terminal clears
2. The identical two-column summary box prints to stdout via `exitSummary.ts`
3. The bottom line reads `Goodbye, {username}!` instead of the confirmation prompt
4. Process exits

This means the session summary persists in the terminal scrollback after orbusctl closes.

## Header

### Layout

```
ORBUSCTL · ORGNAME                              ● username   v1.0.0
```

- **Left**: `ORBUSCTL` in bold, separator `·`, organisation name extracted from the server URL pattern (`{orgname}-api.iserver365.com`) via `getOrgName()` in `core/config.ts`
- **Right**: heartbeat dot (● green when connected, coloured by status), username
- **Footer**: version number (`v1.0.0`) displayed in the footer bar, not the header
