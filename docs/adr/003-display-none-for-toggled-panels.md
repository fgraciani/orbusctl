# ADR-003: Use display="none" instead of conditional rendering for toggled panels

**Status:** Accepted  
**Date:** 2026-05

## Context

Several panels toggle on and off at runtime (StatsPanel via `s`, modals via their respective triggers). Initially implemented with conditional rendering (`{show && <Component />}`). This caused a visible first-frame border flash on every mount: the inner `<Box borderStyle="round" borderTop={false} flexGrow={1}>` rendered with height=0 before Yoga resolved the flex layout, producing a bare bottom border with no side borders for one frame.

## Decision

Keep toggled components permanently mounted. Control visibility with Ink's `display` prop (`"flex"` / `"none"`), which maps directly to Yoga's `DISPLAY_FLEX` / `DISPLAY_NONE`.

```tsx
<Box display={show ? 'flex' : 'none'}>
  <ToggledComponent />
</Box>
```

For modals (which replace the full screen), the main TUI is kept mounted with `display="none"` while the modal is active. Modals themselves are conditionally rendered since they are simple boxes without the `borderTop={false}` + `flexGrow` combination that causes the flash.

## Consequences

**Positive**
- No first-frame border flash on toggle
- Component state preserved across hide/show cycles
- React never unmounts/remounts the component

**Negative**
- Components with `useInput` hooks remain active even when hidden — callers must guard with an `active` prop or check a shared modal state flag before acting on input
- Slightly more memory usage (hidden components stay in the React tree)

## Alternatives not chosen

- **Conditional rendering**: Caused the first-frame flash described above
- **width={0} to hide**: Hacky, doesn't prevent input handling, causes layout artifacts
