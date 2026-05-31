# ADR-008: Audit as model quality inspector

**Status:** Accepted  
**Date:** 2026-05

## Context

The "Audit" section was initially a placeholder for activity logging — displaying who did what, when, to which model. However, activity tracking was better served by the dedicated Activity section with its time period scanning approach. Meanwhile, there was no tooling for assessing model quality within Orbus, leaving architects without visibility into common hygiene issues.

## Decision

Redefine the Audit section as a **model quality inspector** that checks objects for common issues:

- **Empty description** — objects with no description or blank descriptions
- **HTML in name** — object names containing HTML markup (usually a data entry error)
- **HTML in description** — descriptions with raw HTML instead of plain text
- **No relationships** — orphan objects with no source or target relationships
- **Not in any diagram** — objects that exist in the model but are not placed in any drawing

The audit supports two modes:

1. **Single model audit** — select one model, fetch all object details (one API call per object), display a summary with issue counts and drill-down into each issue type
2. **Audit all models** — scan every model sequentially in tree order, display a progressive results table with per-model issue columns, drill into any model for full detail

## Consequences

**Positive**
- Provides actionable quality insights — architects can identify and fix hygiene issues
- Progressive scan gives visibility even while running against large repositories
- Issue categories are orthogonal — each check catches a distinct class of problem
- Drill-down from summary to affected objects makes remediation straightforward

**Negative**
- Scan-all mode is API-heavy: requires one API call per object per model to fetch full details (descriptions, relationships, diagram placements)
- Large repositories with thousands of objects across many models can take several minutes to complete a full scan
- Quality checks are opinionated — what counts as an "issue" may vary between organisations (e.g., some may consider description-less objects acceptable for certain types)
