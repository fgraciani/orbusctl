# ADR-004: Adopt OpenSpec for spec-driven development

**Status:** Accepted  
**Date:** 2026-05

## Context

orbusctl is being built alongside an existing Orbus CLI. Functionality will be ported incrementally. With AI-assisted development, specifications drift from implementation unless there is a formal mechanism to keep them aligned. We also want requirements and scenarios to survive beyond individual chat sessions.

## Decision

Adopt **OpenSpec** as the spec-driven development framework. Structure:

```
openspec/
├── vision.md         — product goals and scope
├── architecture.md   — component map, tech decisions
├── specs/            — living capability specs (requirements + scenarios)
└── changes/          — per-change proposals, design, tasks (OpenSpec workflow)

docs/
└── adr/              — architecture decision records (numbered, append-only)
```

ADRs live in `docs/adr/` (conventional location, separate from OpenSpec) and are referenced from `openspec/architecture.md` and change `design.md` files as needed.

## Consequences

**Positive**
- Specs persist across sessions — AI assistant reads them before touching code
- Change proposals capture intent before implementation begins
- ADRs preserve the *why* behind decisions that would otherwise be lost
- OpenSpec installs slash commands in Claude Code for `/opsx:propose`, `/opsx:apply`, `/opsx:explore`, `/opsx:archive`

**Negative**
- Discipline required to keep specs updated as the codebase evolves
- Initial investment to write baseline specs for existing functionality

## Alternatives not chosen

- **No formal spec process**: Context lost between sessions, AI produces inconsistent results
- **Plain markdown docs**: No structured workflow for change management
