# ADR-010: Reuse ObjectDetailPane and useObjectDetail in the Drawings section

**Status:** Accepted  
**Date:** 2026-05

## Context

The Drawings section lets users browse diagrams and their placed components (objects and connectors). Before this change, pressing Enter on a component did nothing — the component list was a dead end. Users had to leave the Drawings section and switch to Models to look up an object's type, description, attributes, and relationships.

The Models section already has a full object detail implementation:
- `useObjectDetail` hook — calls `fetchObjectDetail` + `fetchObjectRelationships` by ObjectId
- `ObjectDetailPane` component — renders type, version, status, description, attributes, relationships with cursor navigation
- Split-panel layout — two sibling `Panel` components, list above, detail below

The question was whether to build a parallel implementation for Drawings or to reuse what exists.

## Decision

Reuse `useObjectDetail` and `ObjectDetailPane` directly in the Drawings section, using the same split-panel layout pattern as Models.

The key insight enabling this: `DrawingComponent.ModelItemId` is the ObjectId of the placed object. Once `resolveDrawingComponents` populates `ResolvedComponent.objectId` from `ModelItemId`, the existing detail infrastructure works without modification.

The only new wiring is in `index.tsx` (three state variables, one hook call, updated Enter/Escape handlers) and `MainContent.tsx` (drawings split-panel early return, updated `DrawingComponentList` for `hasDetail` mode).

Relationship navigation from the drawing detail panel works identically to Models: a second Enter focuses the detail panel, ↑/↓ moves the cursor between relationships, Enter jumps to the related object by `RelatedItem.ObjectId`.

The Escape hierarchy unwinds one level at a time: detail focused → detail open → component list → drawing list → model selection.

## Consequences

**Positive**
- Zero duplication: detail rendering, relationship loading, and focus management are shared
- Behaviour is immediately familiar to users who have used the Models section
- The `objectId` field on `ResolvedComponent` is available for any future drawing-level feature (e.g. highlight all instances of an object across drawings)
- Relationship navigation in drawings follows the same model as Models, so related objects can be chased without leaving the Drawings context

**Negative**
- Relationships fetched are the full set for the object — not filtered to the current drawing. A related object shown in the detail panel may not be present in the current diagram. This is consistent with how Models works and is not disorienting, but it is a distinction from a "drawing-scoped" view.
- `ResolvedComponent.objectId` is populated for relationships too (set to the relationship's `ModelItemId`), but the Enter handler only opens detail for non-relationship components. The field is unused for relationships at present.

## Alternatives not chosen

- **Separate DrawingObjectDetailPane component**: Would duplicate the rendering logic. ObjectDetailPane is parameterised on data, not on how it was reached, so duplication adds no value.
- **Navigate to Models when pressing Enter on a component**: Would lose drawing context and require the user to re-navigate back. The split-panel keeps the component list visible.
- **Drawing-scoped relationship view**: Show only relationships present in the current drawing. More complex to implement (requires cross-referencing the component list against relationship endpoints) and less useful — users typically want the full object context, not just what's visible in one diagram.
