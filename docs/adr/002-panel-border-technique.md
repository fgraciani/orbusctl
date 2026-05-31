# ADR-002: Panel border with custom top line + borderTop={false}

**Status:** Accepted  
**Date:** 2026-05

## Context

The TUI uses titled panels (╭─ Title ──╮) throughout. Ink's native `borderStyle="round"` places the title inside the box as content, creating an inconsistent gap between the title and the top border. We needed the title inline with the top border line — a standard TUI convention.

## Decision

Render each panel as two stacked elements:
1. A `<Text>` node with a hand-built `╭─ {title} {fill}╮` string at the computed panel width
2. An Ink `<Box borderStyle="round" borderTop={false}>` for the sides and bottom border

The fill formula: `fill = width - title.length - 5` (accounts for `╭─ `(3) + ` `(1) + `╮`(1)).

Fixed-width panels (sidebar=18, stats=24) use the `width` prop directly. Flex panels (main content) use `measureElement` after the first render to get the actual width.

## Consequences

**Positive**
- Title appears inline with the top border, matching standard TUI conventions
- Ink owns the side and bottom borders — they stretch correctly to full panel height
- No manual `│` character rendering needed

**Negative**
- Fixed-width panels must have their width known at design time
- Flex panels have a one-frame measurement delay on initial mount (unavoidable with Ink's layout model)

## Alternatives not chosen

- **Title inside box with divider line**: Visible gap between title and border, inconsistent look
- **Fully manual borders**: All four sides rendered as Text — side borders don't stretch vertically in Ink
