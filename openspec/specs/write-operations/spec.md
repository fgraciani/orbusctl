# Write Operations Specification

## Purpose

All CLI commands that mutate Orbus data are gated behind a scrypt-hashed write password, append to an audit log, and accept a `--dry-run` flag (where implemented) to preview changes without making API calls.

## Requirements

### Requirement: Write Password Gate

The `requireWriteAccess()` function in `src/cli/write-guard.ts` SHALL enforce a valid, unexpired write password before any mutating API call is executed.

#### Scenario: No password configured

- GIVEN no write password hash is stored in config.json
- WHEN a write command is invoked
- THEN the process writes "Error: No write password configured. Set one in the TUI Config section." to stderr and exits with code 1

#### Scenario: Password not supplied on command line

- GIVEN a write password is configured
- WHEN a write command is invoked without `--password`
- THEN the process writes "Error: Write operations require --password. Set a write password in the TUI Config section first." to stderr and exits with code 1

#### Scenario: Password expired

- GIVEN a write password hash exists in config.json with a `writePasswordSetAt` timestamp older than 24 hours
- WHEN `requireWriteAccess(password)` is called
- THEN `isWritePasswordExpired()` returns true, and the process writes "Error: Write password expired (>24h). Renew it in the TUI Config section." to stderr and exits with code 1

#### Scenario: Password invalid

- GIVEN a write password is configured and not expired
- WHEN `requireWriteAccess(password)` is called with a string that does not match the stored scrypt hash
- THEN `verifyWritePassword` returns `'invalid'` and the process writes "Error: Invalid write password." to stderr and exits with code 1

#### Scenario: Password accepted

- GIVEN a write password hash is stored and was set within the last 24 hours
- WHEN `requireWriteAccess(password)` is called with the correct plaintext password
- THEN `verifyWritePassword` returns `'ok'` and execution continues

#### Scenario: Password hashing

- GIVEN the user sets a write password via the Config section
- WHEN `saveWritePassword(hash, salt)` is called
- THEN the password is hashed with `scryptSync` using a random 16-byte salt (64-byte key length), and the hex-encoded hash, salt, and ISO timestamp are stored in config.json (file mode 0o600)

#### Scenario: Config section write-password status display

- GIVEN the Config section is open
- WHEN the Write password row is rendered
- THEN the value column shows:
  - "Not set" when no hash is stored
  - "Expired" when a hash is stored but `isWritePasswordExpired()` is true
  - "Active (Xh Ym ago)" or "Active (Xm ago)" when a hash is stored and not expired and `writePasswordSetAt` is present
  - "Active" when a hash is stored, not expired, and `writePasswordSetAt` is absent

#### Scenario: Config section write-password-log sub-view

- GIVEN the user selects the Write password row and navigates to the log sub-view
- WHEN `editing === 'write-password-log'`
- THEN `getRecentWriteLog(writePasswordSetAt)` is called to retrieve entries since the password was last set, and the last 10 entries are displayed with timestamp, operation, type, name/id, and success indicator

#### Scenario: Config section write-password masked input sub-view

- GIVEN the user confirms from the write-password-log sub-view or enters the write-password edit flow
- WHEN `editing === 'write-password'`
- THEN input characters are rendered as `●` (bullet, not asterisk) followed by a `█` cursor block; Enter saves, Esc cancels

#### Scenario: Clear write password

- GIVEN a write password is set
- WHEN `clearWritePassword()` is called
- THEN `writePasswordHash`, `writePasswordSalt`, and `writePasswordSetAt` are deleted from config.json

---

### Requirement: Write Logging

Every write command SHALL append a structured entry to `~/.orbusctl/logs/write.jsonl` after each attempt, whether or not the API call succeeded.

#### Scenario: Successful write log entry

- GIVEN a write command completes successfully
- WHEN `logWrite(entry)` is called
- THEN a JSONL line is appended to `~/.orbusctl/logs/write.jsonl` containing: `timestamp` (ISO 8601), `operation`, `modelId` (if applicable), `modelName` (if applicable), `objectId` (if applicable), `objectName` (if applicable), `objectType` (if applicable), `relationshipId` (if applicable), `params`, `success: true`, and `user`

#### Scenario: Failed write log entry

- GIVEN a write API call throws an error
- WHEN `logWrite(entry)` is called before the process exits
- THEN a JSONL line is appended with `success: false` and an `error` string field containing the error message

#### Scenario: Log file rotation

- GIVEN `~/.orbusctl/logs/write.jsonl` exceeds 100 MB
- WHEN a new entry is appended
- THEN the file is truncated to the second half of its lines (oldest entries removed) before the new entry is appended

#### Scenario: Log file permissions

- GIVEN the logs directory does not exist
- WHEN the first log entry is written
- THEN `~/.orbusctl/logs/` is created with `mkdirSync({ recursive: true })` and the log file is written with mode 0o600

#### Scenario: Read recent write log

- GIVEN the Config write-password-log sub-view opens
- WHEN `getRecentWriteLog(since)` is called with an ISO timestamp
- THEN it reads all JSONL lines from `write.jsonl`, parses them, and returns only entries whose `timestamp` is after the `since` cutoff; if no `since` is provided, all entries are returned; if the file does not exist, an empty array is returned

---

### Requirement: Token Age Pre-flight

The `checkTokenAge()` function in `src/cli/preflight.ts` SHALL warn and exit before any mutating or long-running API call when the saved bearer token is more than 50 minutes old.

Reference cli-conventions for the shared `--force` bypass pattern.

#### Scenario: Token age within limit

- GIVEN `tokenSavedAt` is present in config and the token is 50 minutes old or younger
- WHEN `checkTokenAge(force)` is called
- THEN execution continues with no output

#### Scenario: Token too old without --force

- GIVEN `tokenSavedAt` indicates the token is older than 50 minutes
- WHEN `checkTokenAge(false)` is called
- THEN a warning is printed to stderr with the age formatted as "Xm" or "Xh Ym" and the process exits with code 1

#### Scenario: Token too old with --force

- GIVEN `tokenSavedAt` indicates the token is older than 50 minutes
- WHEN `checkTokenAge(true)` is called
- THEN the warning is printed to stderr but the process does NOT exit; execution continues

#### Scenario: Token age unknown (environment variable)

- GIVEN `tokenSavedAt` is absent (token was set via `ORBUS_TOKEN` environment variable)
- WHEN `checkTokenAge(force)` is called
- THEN the process writes "Warning: Token age unknown (set via environment variable). It may have expired." to stderr and returns without exiting regardless of `force`

---

### Requirement: Attribute Builder

The `parseSetFlags` and `buildMixedAttributeValues` functions in `src/core/domain/attribute-builder.ts` SHALL convert `--set` and `--set-choice` flag strings into the attribute payload format required by the Orbus OData API.

#### Scenario: Parse text attributes (flat path)

- GIVEN one or more `--set Key=Value` flags
- WHEN `parseSetFlags(sets)` is called and no `--set-choice` flags are present
- THEN it returns a `Record<string, string>` map sent to the API as `attributeValuesFlat`

#### Scenario: Parse mixed attributes (structured path)

- GIVEN at least one `--set-choice` flag is present (with or without `--set` flags)
- WHEN `buildMixedAttributeValues(sets, setChoices)` is called
- THEN text attributes are wrapped as `{ attributeName, attributeCategory: 'Text', textValue: { plainText, richText: null } }` and choice attributes are resolved to `{ attributeName, attributeCategory: 'Choice', attributeConfigurationId, choiceValues: [{ attributeConfigurationChoiceId }] }`; the combined array is sent to the API as `attributeValues`

#### Scenario: Invalid flag format

- GIVEN a `--set` or `--set-choice` value string that contains no `=` character (or `=` is the first character)
- WHEN the parser processes it
- THEN it throws an `Error` with a message describing the invalid format; the command catches it, prints to stderr, and exits with code 1

#### Scenario: Resolve RASCI choice values

- GIVEN `--set-choice RASCI=R,A`
- WHEN `resolveChoiceValues('RASCI', ['R', 'A'])` is called in `src/core/domain/choice-maps.ts`
- THEN it returns the hardcoded `attributeConfigurationId` for RASCI and the two corresponding `attributeConfigurationChoiceId` GUIDs

#### Scenario: Resolve Access Operator choice values

- GIVEN `--set-choice "Access Operator=Read"`
- WHEN `resolveChoiceValues('Access Operator', ['Read'])` is called
- THEN it returns the hardcoded `attributeConfigurationId` for Access Operator and the corresponding GUID for Read

#### Scenario: Unknown choice attribute

- GIVEN a `--set-choice` flag names an attribute not present in `CHOICE_ATTRIBUTES`
- WHEN `resolveChoiceValues` is called
- THEN it throws `Error: Unknown choice attribute: <name>`

#### Scenario: Unknown choice value

- GIVEN a `--set-choice` flag names a known attribute but specifies an option not in its `options` map
- WHEN `resolveChoiceValues` is called
- THEN it throws `Error: Unknown choice value "<v>" for attribute "<name>"`

---

### Requirement: objects-create Command

The `orbusctl objects-create` command SHALL create a single object in a specified model.

#### Scenario: Successful object creation

- GIVEN `--model-id`, `--name`, `--type`, and `--password` are all supplied and valid
- WHEN the command runs
- THEN `requireWriteAccess(password)` passes, `checkTokenAge` passes, `resolveObjectTypeId(type)` resolves the type GUID, `createObject(token, modelId, objectTypeId, name)` posts to `POST /odata/Objects`, and on success the response is parsed for the new `objectId`; `logWrite` records the operation; stdout prints `Created "<name>" (<type>)` and on the next line `  ObjectId: <id>` if available

#### Scenario: JSON output

- GIVEN `--json` is also supplied
- WHEN creation succeeds
- THEN stdout receives `{ "objectId": "<id>|null", "name": "<name>", "type": "<type>", "modelId": "<guid>" }` with no other output

#### Scenario: Unknown object type

- GIVEN `--type` specifies a name not in the type map
- WHEN `resolveObjectTypeId(type)` throws
- THEN the error is passed to `handleError(err, json)` and the process exits with code 1

#### Scenario: API failure

- GIVEN `createObject` throws
- WHEN the error is caught
- THEN `logWrite` records `success: false` with the error message, `handleError` prints to stderr, and the process exits with code 1

---

### Requirement: objects-update Command

The `orbusctl objects-update` command SHALL update one or more attributes of an existing object.

#### Scenario: At least one attribute required

- GIVEN neither `--set` nor `--set-choice` is provided
- WHEN the command runs
- THEN the process writes "Error: At least one of --set or --set-choice is required." to stderr and exits with code 1

#### Scenario: Update with text attributes only (flat path)

- GIVEN only `--set` flags are provided
- WHEN the command runs and auth passes
- THEN `parseSetFlags(sets)` is called and the result is sent via `updateObjectFlat(token, objectId, attributes)` as `PATCH /odata/Objects(<id>)` with body `{ attributeValuesFlat: attributes }`

#### Scenario: Update with choice attributes (structured path)

- GIVEN at least one `--set-choice` flag is provided
- WHEN the command runs and auth passes
- THEN `buildMixedAttributeValues(sets, setChoices)` is called and the result is sent via `updateObjectAttributes(token, objectId, attributeValues)` as `PATCH /odata/Objects(<id>)` with body `{ attributeValues: [...] }`

#### Scenario: Successful output (human)

- GIVEN the PATCH succeeds
- WHEN `--json` is not supplied
- THEN stdout prints `Updated object <id>` followed by one line per `--set` pair showing `  <key> = "<value>"` and one line per `--set-choice` pair showing `  <key> = <values>`

#### Scenario: Successful output (JSON)

- GIVEN the PATCH succeeds and `--json` is supplied
- THEN stdout receives `{ "objectId": "<id>", "attributes": <flat map or structured array> }`

---

### Requirement: objects-delete Command

The `orbusctl objects-delete` command SHALL delete a single object by ID.

#### Scenario: Successful deletion

- GIVEN `--object-id` and `--password` are supplied and auth passes
- WHEN the command runs
- THEN `fetchObjectNameAndType(token, objectId)` is called to retrieve the name and type for logging, `deleteObject(token, objectId)` posts to `DELETE /odata/Objects(<id>)`, `logWrite` records the operation, and stdout prints `Deleted "<name>" (<type>)`

#### Scenario: JSON output

- GIVEN `--json` is also supplied and deletion succeeds
- THEN stdout receives `{ "deleted": true, "objectId": "<id>", "name": "<name>", "type": "<type>" }`

#### Scenario: API failure

- GIVEN `deleteObject` throws
- WHEN the error is caught
- THEN `logWrite` records `success: false`, `handleError` prints to stderr, and the process exits with code 1

---

### Requirement: objects-move Command

The `orbusctl objects-move` command SHALL move all objects from a source model to a target model, recreate intra-model relationships, and save a correlation table.

#### Scenario: Dry run (no API writes)

- GIVEN `--dry-run` is supplied
- WHEN the command runs
- THEN `requireWriteAccess` and `checkTokenAge` are NOT called; the source and target models are fetched, the object and relationship counts are displayed, and no mutations are made

#### Scenario: Object IDs preserved on move

- GIVEN the move API call succeeds
- WHEN `moveObjects(token, objectIds, targetModelId)` posts to `POST /odata/Objects/Move`
- THEN object IDs are preserved by the API; each `CorrelationEntry` for objects uses `status: 'identity'` with `oldId === newId`

#### Scenario: Intra-model relationship recreation

- GIVEN a relationship has both lead and member objects in the source model
- WHEN the move completes
- THEN the relationship is recreated in the target model via `createRelationship`; its `CorrelationEntry` records `status: 'ok'` with the new relationship ID

#### Scenario: Relationship recreation failure — unknown type

- GIVEN a relationship type name cannot be resolved by `resolveRelationshipTypeId`
- WHEN the recreation loop processes it
- THEN a `CorrelationEntry` is recorded with `status: 'failed'` and `error: 'Unknown relationship type: <name>'`; the move continues to the next relationship

#### Scenario: Relationship attributes copied

- GIVEN a relationship has `AttributeValues` with non-auto attribute names and non-null `StringValue`
- WHEN the relationship is recreated
- THEN those attribute values are passed to `createRelationship` as `{ attributeName, stringValue }` entries; auto-managed fields (Name, Description, iServer365 Id, Created By, Date Created, Last Modified By, Date Last Modified, Metamodel Item Id, Metamodel Item Name, Type) are excluded

#### Scenario: Correlation table saved

- GIVEN the move operation completes (with or without relationship failures)
- WHEN `saveCorrelationTable(table)` is called
- THEN a JSON file is written to `getExportsDir()` with filename `correlation-move-<YYYY-MM-DD-HH-MM>.json` containing the full `CorrelationTable` object (timestamp, operation, source, target, entries)

#### Scenario: Human-readable output

- GIVEN `--json` is not supplied and the move succeeds
- THEN stdout prints: source → target arrow line, object count, relationship attempt/recreated/failed counts, individual failure lines for each failed relationship, and the correlation table file path

#### Scenario: JSON output

- GIVEN `--json` is supplied and the move succeeds
- THEN stdout receives `{ source, target, objectsMoved, relationshipsAttempted, relationshipsRecreated, relationshipsFailed, correlationTable }` where `correlationTable` is the file path

---

### Requirement: relationships-create Command

The `orbusctl relationships-create` command SHALL create a relationship between two existing objects.

#### Scenario: Successful relationship creation

- GIVEN `--model-id`, `--lead-id`, `--member-id`, `--type`, and `--password` are all supplied and valid
- WHEN the command runs
- THEN `requireWriteAccess` and `checkTokenAge` pass, `resolveRelationshipTypeId(type)` resolves the type GUID, `createRelationship(token, modelId, relTypeId, leadId, memberId)` posts to `POST /odata/Relationships`, and the new relationship ID is extracted from the response; `logWrite` records the operation; stdout prints the type, lead, member, and relationship ID

#### Scenario: JSON output

- GIVEN `--json` is supplied and creation succeeds
- THEN stdout receives `{ "relationshipId": "<id>|null", "type": "<type>", "modelId": "<guid>", "leadId": "<guid>", "memberId": "<guid>" }`

#### Scenario: Unknown relationship type

- GIVEN `--type` specifies a name not in the type map
- WHEN `resolveRelationshipTypeId(type)` throws
- THEN `handleError` prints to stderr and the process exits with code 1

---

### Requirement: relationships-update Command

The `orbusctl relationships-update` command SHALL update one or more attributes of an existing relationship.

#### Scenario: At least one attribute required

- GIVEN neither `--set` nor `--set-choice` is provided
- WHEN the command runs
- THEN the process writes "Error: At least one of --set or --set-choice is required." to stderr and exits with code 1

#### Scenario: Update with text attributes only (flat path)

- GIVEN only `--set` flags are provided and auth passes
- WHEN the command runs
- THEN `parseSetFlags(sets)` is called and the result is sent via `updateRelationshipFlat(token, relationshipId, attributes)` as `PATCH /odata/Relationships(<id>)` with body `{ attributeValuesFlat: attributes }`

#### Scenario: Update with choice attributes (structured path)

- GIVEN at least one `--set-choice` flag is provided and auth passes
- WHEN the command runs
- THEN `buildMixedAttributeValues(sets, setChoices)` is called and the result is sent via `updateRelationshipAttributes(token, relationshipId, attributeValues)` as `PATCH /odata/Relationships(<id>)` with body `{ attributeValues: [...] }`

#### Scenario: Successful output (human)

- GIVEN the PATCH succeeds
- WHEN `--json` is not supplied
- THEN stdout prints `Updated relationship <id>` followed by one line per `--set` pair and per `--set-choice` pair

#### Scenario: Successful output (JSON)

- GIVEN the PATCH succeeds and `--json` is supplied
- THEN stdout receives `{ "relationshipId": "<id>", "attributes": <flat map or structured array> }`

---

### Requirement: relationships-delete Command

The `orbusctl relationships-delete` command SHALL delete a single relationship by ID.

#### Scenario: Successful deletion

- GIVEN `--relationship-id` and `--password` are supplied and auth passes
- WHEN the command runs
- THEN the relationship type and lead/member names are fetched via OData expand (best-effort; silently skipped if fetch fails), `deleteRelationship(token, relationshipId)` posts to `DELETE /odata/Relationships(<id>)`, `logWrite` records the operation, and stdout prints `Deleted relationship "<lead> → <member>" (<type>)` when names are available or `Deleted relationship <id>` otherwise

#### Scenario: JSON output

- GIVEN `--json` is also supplied and deletion succeeds
- THEN stdout receives `{ "deleted": true, "relationshipId": "<id>", "type": "<type>", "name": "<lead> → <member>" }`

#### Scenario: Pre-delete fetch fails silently

- GIVEN the OData fetch for relationship metadata throws
- WHEN the delete proceeds
- THEN the error is swallowed (the inner try/catch ignores it) and the delete continues with empty type/name values

---

### Requirement: Correlation Table

The `saveCorrelationTable` function in `src/core/domain/correlation.ts` SHALL persist the result of a move operation to a JSON file in the exports directory.

#### Scenario: File naming

- GIVEN a `CorrelationTable` with a timestamp
- WHEN `saveCorrelationTable(table)` is called
- THEN the filename is `correlation-<operation>-<YYYY-MM-DD-HH-MM>.json` where the date/time portion comes from the first 16 characters of `table.timestamp` with `T` and `:` replaced by `-`

#### Scenario: File content

- GIVEN a completed move operation
- WHEN the correlation table is written
- THEN the JSON file contains: `timestamp`, `operation` ("move" or "copy"), `source` (`{ modelId, name }`), `target` (`{ modelId, name }`), and `entries` — each entry has `type` ("object" or "relationship"), `name`, `typeName`, `oldId`, `newId` (string or null), `status` ("ok" | "identity" | "failed"), and optional `error`

#### Scenario: Object entries use identity status

- GIVEN the Orbus API preserves object IDs when moving
- WHEN the object entries are constructed
- THEN every object `CorrelationEntry` has `status: 'identity'` and `oldId === newId`

#### Scenario: Relationship entries reflect recreation outcome

- GIVEN intra-model relationships were recreated after the move
- WHEN relationship entries are added
- THEN successfully recreated relationships have `status: 'ok'` and a non-null `newId`; relationships whose type could not be resolved or whose API call failed have `status: 'failed'` and `newId: null` with an `error` string

---

### Requirement: --dry-run Flag (objects-move)

The `--dry-run` flag on `orbusctl objects-move` SHALL preview the move operation without making any write API calls.

#### Scenario: Dry run skips auth and mutation

- GIVEN `--dry-run` is supplied
- WHEN the command runs
- THEN `requireWriteAccess` is not called (no `--password` required), `checkTokenAge` is not called, `moveObjects` is never called, and no correlation table is written

#### Scenario: Dry run output (human)

- GIVEN `--dry-run` is supplied without `--json`
- WHEN the command completes
- THEN stdout prints: "Dry run — no changes will be made", source model name and ID, target model name and ID, object count, and intra-model relationship count

#### Scenario: Dry run output (JSON)

- GIVEN `--dry-run` and `--json` are both supplied
- THEN stdout receives `{ "dryRun": true, "source": { "modelId", "name" }, "target": { "modelId", "name" }, "objectCount": N, "relationshipCount": N }`
