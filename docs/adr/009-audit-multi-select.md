# ADR-009: Audit multi-select for subset audits

**Status:** Implemented  
**Date:** 2026-05-26

## Context

The Audit section provided two modes: audit a single model or audit all models. Users frequently needed to audit a specific subset (e.g., models in a particular domain, recently modified models, or models being prepared for a governance review). Without multi-select, users had to either run single audits repeatedly (losing batch context) or audit all 50+ models and manually filter results (wasteful and slow).

## Decision

Add a third audit mode: **"Audit selected models"** with Space-to-toggle multi-select that feeds into the existing `startScanAll` batch pipeline.

**State management:**
- Extend `auditMode` union: `'menu' | 'select-model' | 'select-models' | 'all-results' | 'detail'`
- Track selections in `auditSelectedModelIds: Set<string>` (O(1) toggle checks, natural deduplication)
- Reset selections on all `setAuditMode('menu')` transitions (9 locations)

**UI interaction:**
- Space bar toggles selection for model at cursor position
- Visual indicators: `▶` (cyan cursor), `●` (green bullet for selected), bold white text
- Status line shows count: "N models selected" (green) or "Select at least one model" (yellow)
- Enter starts batch audit (disabled when count = 0)
- Escape returns to menu and clears selections

**Implementation choices:**
- **Why `Set<string>` not `string[]`?** O(1) has/add/delete vs. O(n) includes/push/filter
- **Why separate mode not embedded in `select-model`?** Different UX paradigm (toggle-based vs. immediate drill-down)
- **Why reuse `startScanAll`?** Already accepts `Model[]` array — no domain logic changes needed
- **Why reset on menu return?** Prevents stale selections when switching sections; matches user mental model

## Consequences

**Positive**
- Users can audit 5 models instead of 50 (80% time reduction for subset scenarios)
- Batch context preserved — results view shows all selected models in one scan
- Space-to-toggle is familiar pattern (file managers, IDEs)
- Type-safe: union prevents invalid mode transitions

**Negative**
- Selection state is session-only (cleared on menu return, not persisted)
- No "select all" / "deselect all" shortcuts (can be added if users request)
- No pattern-based selection ("audit all hidden models") — deferred for now

**Neutral**
- Three menu items vs. two (still fits in small terminals)
- No changes to `useAudit.ts` or `audit.ts` domain logic
