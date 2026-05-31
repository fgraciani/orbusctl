# ADR-014: ORBUS marker format for document generation and selective refresh

**Status:** Accepted  
**Date:** 2026-05

## Context

orbusctl can generate architecture documents from Orbus models using markdown templates. A generated document is not meant to be read-only: authors add prose, context, and caveats around the machine-generated tables and diagrams. When the underlying model changes, those sections need to be refreshed without discarding the surrounding hand-written content.

Two properties are required simultaneously:

1. The refresh pass must know exactly which lines it owns and which belong to the human author.
2. The document must remain a single coherent markdown file — not a pair of generated and hand-edited files that have to be merged externally.

A convention for marking machine-managed regions inside the file was therefore needed, along with a way to carry template configuration (variable defaults, scope overrides) in the file itself so that a refresh can reproduce the original generation parameters without prompting the user again.

## Decision

Machine-managed regions are delimited by HTML comment markers embedded in the markdown:

```
<!-- ORBUS:BEGIN type="tasks" process="Manage Airspace" -->
...generated content...
<!-- ORBUS:END -->
```

On refresh, the processor scans the document line by line. When it encounters an `ORBUS:BEGIN` marker it reads the attributes, regenerates the content by querying the live model, emits the new content, skips forward past all existing lines until `ORBUS:END`, then resumes copying lines verbatim. Everything outside a `BEGIN`/`END` pair is passed through unchanged.

The `ORBUS:BEGIN` attribute string uses the same `key="value"` syntax throughout. The `type` attribute selects the content generator:

- `type="tasks"` — task list for a process (two-column name/description table)
- `type="io"` with `direction="input|output|all"` — business objects accessed by a process
- `type="roles"` — business roles associated with a process
- `type="rasci"` — RASCI matrix, either scoped to a process or global across the model
- `type="lifecycle"` — alphabetic sub-process list for a process
- `type="diagram"` — inline SVG image reference

YAML frontmatter carries two categories of template metadata. Keys prefixed `template-var-` declare user-supplied variables with an optional prompt string and object-type hint (`template-var-scope: "Scope object|Business process"`). Keys prefixed `template-scope-` override which child processes are resolved for a given parent process, allowing the document to pin a specific task list that differs from the current model hierarchy (`template-scope-Manage Airspace: "Task A, Task B"`). Both categories are preserved verbatim in the generated output frontmatter so subsequent refreshes replay the same configuration.

A legacy one-liner format (`<!-- ORBUS-TABLE: ... -->` and `<!-- ORBUS-DIAGRAM: ... -->`) is recognised on read and automatically upgraded to the `BEGIN`/`END` form on the next generate or refresh pass. No separate migration step is required.

## Consequences

**Positive**
- Documents survive multiple regeneration cycles: human prose, section headings, footnotes, and editorial additions are never touched by the refresh pass
- Machine generation and human curation coexist in a single file with no external merge tool
- Template configuration travels with the document in frontmatter, so a refresh anywhere has everything it needs
- Scope overrides let authors lock a task list to a snapshot without freezing the whole document
- Legacy one-liner markers are converted transparently, giving older documents a zero-effort migration path

**Negative**
- ORBUS markers are visible in the markdown source; document authors must learn what they mean and must not delete or reorder the `BEGIN`/`END` pairs
- Content between markers is unconditionally overwritten on refresh — any edits made inside a marked region are silently discarded
- The attribute syntax (`key="value"` inside an HTML comment) is not standard markdown and will not be rendered or highlighted by generic markdown tooling

## Alternatives not chosen

- **Full regeneration each run**: Simplest implementation — regenerate the entire document from the template on every run. Ruled out because it destroys hand-edited content; authors cannot safely add prose to a generated document if any refresh would erase it.
- **Separate files for generated and hand-written content**: Keep a machine-owned file and a human-owned file, combined at render time. Ruled out because it splits a single logical document across two files, complicates the editing workflow, and makes it harder to produce a self-contained output (e.g. for Word export or sharing).
