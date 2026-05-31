# orbusctl

## Critical: Write operation safety

**NEVER run write operations against any model except the designated test models:**
- **`[TEST] NM Admins`** — primary test model for all write operations (create, update, delete)
- **`[RES] NM Sandbox`** — secondary test model, use only for move commands that need a source/target pair

This is a **production Orbus instance** shared with other teams. Writing to the wrong model corrupts real enterprise architecture data.

**Write endpoints that MUST be restricted to test models:**
- `POST /odata/Objects` (create)
- `PATCH /odata/Objects({id})` (update)
- `POST /odata/Objects/Move` (move)
- `POST /odata/Relationships` (create)
- `PATCH /odata/Relationships({id})` (update)
- Any `DELETE` endpoint

**When testing write features:** only the user tests manually. Never execute write API calls from automated tests or during development. Use mocks for automated testing. Describe what to test and let the user do it.

## Git workflow

**Branching model: main + develop**
- **`main`** — stable releases only. Every commit on main is a tagged release.
- **`develop`** — day-to-day work. All feature work, bug fixes, and improvements go here.
- When ready to release: merge develop → main, tag, push.

**Rules:**
- NEVER commit directly to `main` — always work on `develop` (or a feature branch off develop).
- NEVER force-push to `main`.
- When starting a new session, verify you are on `develop` before making changes.

## Build & run

- `npm run build` — TypeScript compilation to `dist/`
- `npm run dev` — development mode via tsx
- `node dist/main.js` — TUI (no args) or CLI (`node dist/main.js <command>`)
- ESM project (`"type": "module"`), all imports use `.js` extensions

## Architecture

- `src/core/` — shared business logic (API, domain, export). Used by both TUI and CLI.
- `src/components/` — Ink/React TUI components
- `src/hooks/` — React hooks for TUI state
- `src/cli/` — Commander.js CLI commands
- `src/main.ts` — entry point routing (TUI vs CLI)
