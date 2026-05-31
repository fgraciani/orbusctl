# ADR-013: Browser launch from TUI — [o] keybinding with configurable browser

**Status:** Accepted  
**Date:** 2026-05

## Context

The TUI lets users browse objects, drawings, audit results, and export files. A common next step after finding something in the TUI is to open it in the Orbus web UI — to edit it, share a link, or view a richer rendering. Without a direct shortcut, users have to note the object name, switch to a browser, navigate to Orbus manually, and search again. For drawings, the URL is non-obvious and cannot easily be reconstructed by hand.

A secondary friction point is corporate environments (Eurocontrol in particular) that enforce Microsoft Edge as the default browser. macOS and Windows both honour the OS-level default, but users who want a specific browser have no way to override it per-application without changing the system default.

## Decision

A single `[o]` keybinding, active whenever the main panel has a selected item, launches the relevant resource in a browser. The dispatch logic is context-sensitive:

- **Models section, object detail open** — `openInBrowser(getOrbusObjectUrl(viewedObjectId))`
- **Drawings section, drawing selected (no component detail)** — `openInBrowser(getOrbusDrawingUrl(viewedDrawingId))`
- **Drawings section, component detail open** — `openInBrowser(getOrbusObjectUrl(viewedDrawingObjectId))` (the placed object, not the diagram)
- **Audit section, object detail open** — `openInBrowser(getOrbusObjectUrl(viewedAuditObjectId))`
- **Export / Audit export / Activity export, result ready** — `openFile(filePath)` (opens the exported file with the OS default application)

URL construction lives in `src/core/browser.ts`. `getOrbusObjectUrl` derives the browser-facing hostname by stripping `-api.` from the API server hostname configured in `~/.orbusctl/config.json`. `getOrbusDrawingUrl` uses the same derivation with a `/draw/{id}` path.

Browser selection is stored as `browser` in `~/.orbusctl/config.json` and is configurable from the Settings panel (Browser row → sub-menu). Options are:

| Label | Stored value |
|---|---|
| System default | *(key absent)* |
| Microsoft Edge | `"Microsoft Edge"` |
| Google Chrome | `"Google Chrome"` |
| Firefox | `"Firefox"` |
| Safari | `"Safari"` |

`openInBrowser` reads the stored value via `getBrowser()`. When a browser name is set, it uses `open -a "<browser>" "<url>"` on macOS and `"<browser>" "<url>"` on other platforms. When no browser is set it falls back to `open` (macOS), `start` (Windows), or `xdg-open` (Linux). `openFile` always uses the OS default application for the file type.

Both functions call `exec` fire-and-forget — no promise is awaited and no result is surfaced back to the TUI.

## Consequences

**Positive**
- Zero friction to cross from the TUI into the Orbus web UI — one keypress, no copying, no manual navigation
- Context-sensitive dispatch means `[o]` always does the right thing regardless of which section or sub-view is active
- Corporate environments that mandate Edge can configure it once in Settings and never think about it again
- `openFile` re-uses the same keybinding for export results, keeping the mental model consistent: `[o]` means "open the thing I'm looking at"
- URL derivation is centralised in `src/core/browser.ts`, making it easy to update if the Orbus URL scheme changes

**Negative**
- Browser launch is fire-and-forget: if the browser is misconfigured (e.g. a stored name that does not match an installed application), the command silently fails with no feedback in the TUI
- The URL derivation assumes the API hostname follows the `{org}-api.iserver365.com` pattern; non-standard server URLs may not produce a valid browser URL
- `[o]` is a no-op when no item is selected, which may be slightly surprising if the user presses it in an empty or unselected state

## Alternatives not chosen

- **Copy URL to clipboard**: Puts the URL on the clipboard but gives no visual feedback in the terminal and requires the user to switch to the browser and paste manually. Less discoverable and more steps than a direct launch.
- **Display URL, let user open manually**: Shows the URL in a status line or modal so the user can read it. Extra steps with no benefit — if the user is already in the TUI, they want the browser opened, not a URL to transcribe.
