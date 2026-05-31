# ADR-011: Commander.js for the CLI layer

**Status:** Accepted  
**Date:** 2026-05

## Context

orbusctl needs a CLI framework to route subcommands (`models`, `objects`, `export`, `activity`, write commands, etc.) and handle flags, help text, and argument parsing. ADR-006 already named Commander.js as the CLI presentation layer, but the framework choice over alternatives such as oclif was not explicitly recorded.

The CLI must coexist with an Ink-based TUI: `main.ts` dispatches to the TUI when no subcommand is present and to the CLI otherwise. The framework needs to fit cleanly into this split-entry-point design without imposing its own lifecycle or binary conventions.

The project has ~16 commands at the time of the 1.0.0 release. All business logic lives in `src/core/`; CLI command files are thin wrappers that parse flags, call core functions, and write output to stdout. The framework's job is purely argument parsing and help generation.

## Decision

Use **Commander.js** (`commander` ^14) as the CLI argument-parsing framework.

Each subcommand is registered as a `register*Command(program: Command)` function in `src/cli/commands/`. The root `Command` instance is created in `src/cli/index.ts` and populated by calling each register function, then exported as `run()` which calls `program.parseAsync(process.argv)`.

`src/main.ts` handles top-level routing manually — `--version` and `--help` with no subcommand are intercepted before Commander is loaded, so the TUI launch path never imports Commander at all. When a subcommand is detected, `run()` is dynamically imported and called.

Each command defines its flags with `.option()` and its handler with `.action()`. There are no generated files, no config manifests, and no decorators — the full program structure is assembled at runtime from the register calls.

## Consequences

**Positive**
- Lightweight: Commander adds no generated scaffolding or plugin runtime; the only artifact is `node_modules/commander`
- The `register*Command(program)` pattern keeps each command file self-contained and easy to add or remove
- Dynamic import of `./cli/index.js` in `main.ts` means the TUI path never pays the cost of loading CLI code
- `.option()` / `.action()` API is straightforward to read and produces correct `--help` output per subcommand automatically
- No framework-imposed binary or manifest format; `bin` in `package.json` points directly to `dist/main.js`

**Negative**
- Help text and flag descriptions must be written by hand in every `.option()` call; there are no decorators to derive them from type annotations
- No built-in plugin or hook system; extending the command set requires editing `src/cli/index.ts` to call the new register function
- Top-level `--version` and `--help` (no subcommand) are handled manually in `main.ts` rather than delegated to Commander, to avoid loading the CLI module on the TUI path

## Alternatives not chosen

- **oclif**: Plugin architecture, decorator-based command classes, and generated manifest files are well-suited to large multi-team CLIs distributed via npm. For a single-binary tool with ~16 commands all living in one repo, this overhead is not justified. oclif also imposes its own entry-point conventions that would complicate the TUI/CLI split in `main.ts`.
- **yargs**: Comparable weight to Commander and capable of the same patterns. Commander's fluent chaining API (`program.command().option().action()`) is more readable for per-command registration files than yargs's builder callbacks, and Commander's TypeScript types are straightforward without requiring additional configuration.
