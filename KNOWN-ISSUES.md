# Known Issues

Current limitations and workarounds as of v1.0.0.

## ~~`orbusctl` command not found after `npm install -g`~~ — fixed in v1.0.1

Installing from GitHub (`npm install -g github:fgraciani/orbusctl`) completed without errors but the `orbusctl` binary was not available. The `dist/` folder is not committed to the repo, and without a `prepare` script npm did not build the TypeScript after install.

**Fix:** Added `"prepare": "tsc"` to `package.json` so npm automatically compiles on install.

## Orbus API limitations

### Relationship date filtering is client-side only

`fetchRecentRelationships` cannot use server-side `$filter` on `DateCreated` for Relationships (only Objects support it). The workaround pages with `$orderby=DateCreated desc` and stops when it passes the cutoff date. For models with thousands of relationships, this makes more API calls than necessary.

**Impact:** Activity scans are slower for relationship-heavy models.
**Workaround:** None available on our side. Requires Orbus to add date filtering on the Relationships endpoint.

### `--alias` on relationship create returns HTTP 500

The Orbus API rejects `attributeValues` in the POST body when creating relationships. Alias and other attributes must be set after creation.

**Workaround:** Create the relationship first, then update it:
```bash
orbusctl relationships-create --model-id <id> --lead-id <a> --member-id <b> --type "ArchiMate: Association" --password <pw>
orbusctl relationships-update --relationship-id <id> --set "Alias=my-alias" --password <pw>
```

### Relationship type names require `ArchiMate:` prefix

`resolveRelationshipTypeId()` does exact then case-insensitive matching. Typing `"Association"` fails; must use `"ArchiMate: Association"`. The error message lists all valid type names.

**Workaround:** Use the full name. A future improvement will add automatic prefix fallback.

## Silent error handling

A few API call sites silently return fallback values instead of surfacing errors:

- `fetchObjectNameAndType()` returns `{ name: 'Unknown', typeName: 'Unknown' }` on any failure
- `fetchRelationshipEndpoints()` returns `null` on failure
- Some audit and export detail-fetching loops silently skip failed objects

These are intentional graceful degradation — the tool continues working with partial data rather than aborting. If an object consistently shows as "Unknown", the underlying API call is failing (likely a permissions or deleted-object issue).

## Audit — no recovery after token expiry mid-scan

When running a full audit (all models) from the TUI, if the token expires during the scan, the audit continues silently — failed API calls fall back to empty results rather than surfacing a token error. Once a fresh token is provided, there is no way to resume or re-scan only the models that failed; a full restart is required.

**Impact:** Partial audit results can be exported, and the export shows which models were scanned. However, there is no way to resume from where scanning stopped — a full restart is required to get complete results. A full multi-model audit on large instances can take long enough to reliably hit this.

**Workaround:** Export the partial results to see which models completed, refresh the token, then re-run a targeted single-model audit for any models that were not yet scanned.

**Design options to consider:**
- Detect 401 responses during the scan loop and pause with a "token expired — refresh and resume" prompt, then re-scan from the failed model.
- Track which models completed successfully and offer a "resume scan" action after re-authentication.
- Surface a warning banner on the audit results screen if any models were scanned while the heartbeat was in a failed state.

## Choice attribute IDs are hardcoded

RASCI and Access Operator choice value GUIDs in `src/core/domain/choice-maps.ts` were discovered by trial and error. If Orbus changes these IDs (unlikely but possible), `--set-choice` commands will fail silently or produce wrong values. There is no discovery mechanism in the API.

## Template export — filename not labelled as template

TUI template exports are currently named `{model}_{timestamp}.md` — identical to regular Markdown exports. A future fix should include the template name in the filename (e.g., `{model}_{timestamp}-process-description.md`) so exported files are identifiable without opening them.

## Template export — sub-process depth limited to one level

The `getChildProcesses()` helper in `template-tables.ts` only recurses one level deep (root → direct Business process children, flattening Groupings). Deeply-nested process hierarchies (Process → Sub-process → Task) will not fully appear in tasks tables or RASCI matrices without scope overrides. Two options: (a) add a `template-depth-*` frontmatter field for configurable recursion depth, (b) always recurse fully and de-duplicate. Design decision needed before implementing.

**Workaround:** Use `template-scope-*` frontmatter to explicitly list tasks for each process level.

## Template export — deep process hierarchies

When a model has nested process hierarchies (e.g., Process → Sub-process → Task), the template generators for `roles` and `rasci` only find direct Aggregation children by default. If Business Roles are associated to grandchild tasks, use `template-scope-*` frontmatter overrides to explicitly list which tasks belong to each activity.

See `docs/iteration-5a-plan.md` for details on scope overrides.
