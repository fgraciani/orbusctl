# v1.0.0 Release Checklist

## Manual review (before git release)

- [ ] `CHANGELOG.md` — verify 1.0.0 entry is accurate and complete
- [ ] `BACKLOG.md` — verify priorities make sense, nothing missing
- [ ] `KNOWN-ISSUES.md` — verify issues are current, workarounds correct
- [ ] `README.md` — verify install instructions, feature list, keyboard shortcuts
- [ ] `CLAUDE.md` — verify write safety rules, test model names, build instructions
- [ ] `docs/architecture.md` — verify matches current source structure and data flow
- [ ] `docs/vision.md` — verify scope and success criteria reflect 1.0.0 reality
- [ ] `package.json` — verify name, version, bin, dependencies

## Implementation (before tagging)

- [ ] TUI template export implemented and tested (plan at `docs/tui-template-export-plan.md`)
- [ ] All docs reviewed and approved
- [ ] `npm run build` passes clean
- [ ] TUI launches and all sections work
- [ ] CLI `--help` lists all commands
- [ ] Write commands gated by password

## Git release

- [ ] Code moved into the `github:fgraciani/orbusctl` repo
- [ ] Tag `v1.0.0`
- [ ] Set up branching (main for releases, develop for work)
- [ ] Verify `npm install -g github:fgraciani/orbusctl` works
