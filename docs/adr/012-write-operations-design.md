# ADR-012: Write operations design — password gating, JSONL logging, dry-run, correlation table

**Status:** Accepted  
**Date:** 2026-05

## Context

orbusctl operates against a production OrbusInfinity instance shared by multiple teams. Every write endpoint — `POST /odata/Objects`, `PATCH /odata/Objects({id})`, `POST /odata/Objects/Move`, `POST /odata/Relationships`, `PATCH /odata/Relationships({id})`, and all `DELETE` endpoints — modifies live enterprise architecture data that other teams depend on.

Before 1.0.0 the CLI had no write operations. Adding them in 1.0.0 introduced four risks:

1. **Accidental writes**: a mistyped command or copy-paste error in a pipeline corrupts real data.
2. **Unattributed changes**: no record of who ran what, making post-incident recovery guesswork.
3. **Irreversible bulk moves**: `objects-move` relocates every object in a model; a mistake with no audit trail is very hard to undo.
4. **Non-expert delegation**: power users may hand the CLI to colleagues or scripts; those callers must be unable to write without explicit authorisation.

The OrbusInfinity API offers no write-scoped token or OAuth scope to restrict access at the API level. A purely informational convention ("only run write commands carefully") is insufficient.

## Decision

All write commands implement a three-layer safety stack plus a correlation mechanism for bulk moves.

### Layer 1 — scrypt write password with 24-hour expiry

A write password is set once in the TUI Config section. `src/core/auth.ts` hashes it with `crypto.scryptSync` (N=16384, r=8, p=1) and stores `writePasswordHash`, `writePasswordSalt`, and `writePasswordSetAt` in `~/.orbusctl/config.json` (mode 0600).

Every write command calls `requireWriteAccess(opts.password)` (`src/cli/write-guard.ts`) before any API interaction. The guard rejects with a clear stderr message in three cases:

| Condition | Exit message |
|-----------|-------------|
| No `--password` flag | `Write operations require --password. Set a write password in the TUI Config section first.` |
| No password configured | `No write password configured. Set one in the TUI Config section.` |
| Hash mismatch | `Invalid write password.` |
| `writePasswordSetAt` older than 24 hours | `Write password expired (>24h). Renew it in the TUI Config section.` |

The 24-hour expiry forces a daily re-acknowledgement that write access is intentional. Renewal requires visiting the TUI, which is a deliberate friction point.

`--dry-run` bypasses the password gate entirely — dry runs perform no API calls and carry no risk.

### Layer 2 — append-only JSONL write log

`src/core/log.ts` writes one JSON line per write attempt to `~/.orbusctl/logs/write.jsonl` (mode 0600, auto-created). The `WriteLogEntry` schema records:

```
timestamp    ISO-8601
operation    e.g. "create-object", "move-objects", "delete-relationship"
modelId      target or source model
modelName    human-readable model name
objectId     affected object (if applicable)
objectName   human-readable name
objectType   ArchiMate type string
params       full command parameters
success      boolean
result       API response excerpt (on success)
error        error message (on failure)
user         display name from config.user
```

Both success and failure paths are logged. The log is written after the API call, so a process crash before `logWrite` means no entry — this is acceptable because the write log is a convenience audit trail, not a transaction log.

**Rotation**: when `write.jsonl` exceeds 100 MB the logger keeps the second half of lines and discards the first. This bounds disk usage at the cost of losing the oldest history.

The same `appendLine` helper and rotation logic also cover `auth.jsonl` (login/logout events) and `error.jsonl` (unhandled errors).

### Layer 3 — `--dry-run` flag on all write commands

Every write command (`objects-create`, `objects-update`, `objects-delete`, `objects-move`, `relationships-create`, `relationships-update`, `relationships-delete`) accepts `--dry-run`. In dry-run mode the command:

1. Skips `requireWriteAccess` — no password needed.
2. Fetches the read-only data it would operate on.
3. Prints what would change (object count, relationship count, attribute patches, etc.) in human or `--json` form.
4. Makes no `POST`, `PATCH`, or `DELETE` calls.
5. Writes no log entry (no write occurred).

This allows safe inspection, pipeline testing, and CI validation without risk.

### Correlation table for `objects-move`

`POST /odata/Objects/Move` moves all supplied objects atomically. The Orbus API preserves object IDs on move (no new IDs are issued), but intra-model relationships are not moved — they must be recreated in the target model, receiving new relationship IDs.

After a live `objects-move` the command calls `saveCorrelationTable` (`src/core/domain/correlation.ts`), which writes a timestamped JSON file to `~/.orbusctl/exports/correlation-move-<datetime>.json`. The file contains:

```json
{
  "timestamp": "...",
  "operation": "move",
  "source": { "modelId": "...", "name": "..." },
  "target": { "modelId": "...", "name": "..." },
  "entries": [
    { "type": "object",       "name": "...", "typeName": "...", "oldId": "...", "newId": "...", "status": "identity" },
    { "type": "relationship", "name": "...", "typeName": "...", "oldId": "...", "newId": "...", "status": "ok" },
    { "type": "relationship", "name": "...", "typeName": "...", "oldId": "...", "newId": null,  "status": "failed", "error": "..." }
  ]
}
```

`status` values:
- `identity` — object ID unchanged (API preserves it)
- `ok` — relationship recreated, `newId` is the new relationship ID
- `failed` — relationship recreation failed; `error` explains why

The correlation table is the primary recovery artefact for a move: it maps every old relationship ID to its replacement (or flags failures) so downstream consumers can update references.

## Consequences

**Positive**
- Every write is attributed (user name, timestamp, model, parameters) and queryable after the fact via `getRecentWriteLog`
- The correlation table makes bulk moves recoverable — old/new ID mapping is immediately available for reference updates
- `--dry-run` enables safe pipeline construction and CI integration without any production risk
- The 24-hour expiry gate makes it difficult to accidentally run write operations from a cached shell session
- Config file and logs are mode 0600 — the password hash and write history are not world-readable

**Negative**
- The 24-hour expiry creates friction for power users who run multiple write sessions in a day; they must renew via the TUI each day
- Log rotation (keep second half at 100 MB) silently discards older entries; there is no archive step, so long-term audit history requires external backup
- The correlation table only covers `objects-move`; other write commands do not produce an equivalent artefact (their entries are in the JSONL log but not in a structured before/after form)
- `--password` on the command line is visible in `ps` output and shell history; users operating in shared environments should use shell history suppression (`HISTIGNORE`) or a wrapper script

## Alternatives not chosen

- **No gating (trust the user)**: Rejected because the CLI is intended to be delegatable to non-experts and usable in scripts; a silent write with no audit trail is too risky on a shared production instance
- **OAuth write scope / token-scoped write permission**: The OrbusInfinity API does not offer write-scoped tokens or OAuth scopes; the read token used for all API calls also authorises writes, so access control must be enforced client-side
- **Interactive password prompt (no `--password` flag)**: Would block non-interactive use (scripts, CI, AI agents); the flag approach is explicit and scriptable
- **Separate write token stored in config**: Would require a second authentication step against the API; the OrbusInfinity API has no mechanism to issue or validate a write-only token
