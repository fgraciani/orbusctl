# ADR-001: Use Ink + React for the TUI framework

**Status:** Accepted  
**Date:** 2026-05

## Context

orbusctl needs a terminal UI framework. The main candidates were:
- **Ink 4** (React for CLIs, Node.js)
- **Blessed / Neo-blessed** (low-level terminal widgets, Node.js)
- **Bubbletea** (Go, component model)
- **Textual** (Python, CSS-like layout)

The team is already comfortable with React and TypeScript. The existing Orbus CLI codebase is Node.js.

## Decision

Use **Ink 4 with React 18 and TypeScript**.

## Consequences

**Positive**
- Familiar component model — same mental model as web React
- Flexbox layout via Yoga — responsive to terminal resize without manual coordinate math
- Strong TypeScript integration
- Hooks (`useInput`, `useApp`, `useStdout`) cover all TUI interaction patterns cleanly
- Stays in the Node.js ecosystem with the existing CLI

**Negative**
- Ink is less battle-tested than Blessed for very complex layouts
- `measureElement` required for dynamic-width panels (one extra render frame)
- Some CSS concepts (absolute positioning, z-index, overlays) not available — modals require full-screen swap pattern

## Alternatives not chosen

- **Blessed**: More control but imperative, no component model, harder to maintain
- **Bubbletea**: Would require Go rewrite of existing Node.js codebase
- **Textual**: Python, different ecosystem, adds a runtime dependency
