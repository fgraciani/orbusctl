# ADR-005: Partial OrbusInfinity API coverage

**Status:** Accepted  
**Date:** 2026-05

## Context

The OrbusInfinity API (`spec/orbus-infinity-api.json`) exposes 92 paths across 17 tag groups. orbusctl v1.0 is a read-heavy browsing and auditing tool — it does not need to cover the full API surface. Implementing unused endpoints adds maintenance burden with no user value.

The spec is Swagger 2.0 (not OpenAPI 3.x). `openapi-typescript` supports both formats, so code generation is unaffected.

## Decision

Implement only the endpoints required by orbusctl's defined capabilities. All others are deliberately out of scope.

### In scope for v1.0

| Tag | Endpoints used | Purpose |
|-----|---------------|---------|
| **Me** | `GET /odata/Me` | Resolve logged-in username for welcome modal and header |
| **Models** | `GET /odata/Models`, `GET /odata/Models({key})` | List and browse models |
| **Objects** | `GET /odata/Objects`, `GET /odata/Objects({key})` | Browse objects within a model |
| **Relationships** | `GET /odata/Relationships`, `GET /odata/Relationships({key})` | Browse relationships |
| **MergeRequests** | `GET /odata/MergeRequests`, `GET /odata/MergeRequests({key})` | Compare section |
| **ObjectTypes** | `GET /odata/ObjectTypes` | Type labels in object browsing |
| **RelationshipTypes** | `GET /odata/RelationshipTypes` | Type labels in relationship browsing |
| **Objects (write)** | `POST /odata/Objects`, `PATCH /odata/Objects({key})`, `DELETE /odata/Objects({key})`, `POST /odata/Objects/Move` | Create, update, delete, and move objects |
| **Relationships (write)** | `POST /odata/Relationships`, `PATCH /odata/Relationships({key})`, `DELETE /odata/Relationships({key})` | Create, update, and delete relationships |

### Deferred (future versions)

| Tag | Reason deferred |
|-----|----------------|
| Attributes / ObjectTypes / RelationshipTypes (write) | Admin functionality, v2+ |
| Solutions | Model organisation feature, v2+ |
| ModelItems | Reuse/restore workflows, v2+ |
| Documents / DocumentTypes | Out of scope for v1 |
| Webhooks | Server-side integration, not CLI concern |
| RecycleBin | Out of scope for v1 |
| Configuration / Metadata / OData Batch | Infrastructure, not user-facing |

## Consequences

**Positive**
- `src/api/` stays small and focused — one file per in-scope domain
- Generated types from the full spec are available if needed later; no code changes required to expand coverage
- Clear contract: if there is no file in `src/api/`, the feature is not implemented

**Negative**
- Any change to in-scope endpoints requires updating this ADR
