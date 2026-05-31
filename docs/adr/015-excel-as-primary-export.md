# ADR-015: Excel as the primary structured export format

**Status:** Accepted  
**Date:** 2026-05

## Context

Architects routinely need to share Orbus model data with stakeholders who have no access to the platform: governance reviews, capability audits, programme status reports, and change-impact summaries. The target audience — portfolio managers, steering committees, senior architects — works in Excel and Word, not in JSON or CSV. A useful export must be openable without conversion steps.

orbusctl needed at least one structured export format that could carry model content (objects, relationships, drawings), audit findings (quality issues per model), and activity data (who changed what, in which model, over a time period). These are fundamentally tabular datasets, and each export involves multiple logically distinct tables that belong together in a single file.

## Decision

Use **xlsx via the exceljs library** as the primary structured export format, with distinct workbook layouts per export type:

**Model export** (`src/core/export/excel.ts`)  
Three sheets per workbook: Objects, Relationships, Drawings. Relationships always include full attribute columns. The Objects sheet operates in two modes controlled by a `fetchDetails` flag:
- `fetchDetails: true` — fetches one API call per object to retrieve full attribute values; produces columns for Name, iServer365 Id, Type, Description, Status, Version, Created By, Date Created, Last Modified By, Last Modified Date, plus any non-system custom attributes discovered dynamically across the model
- `fetchDetails: false` — fast path for large models; objects sheet is name-only (Name, iServer365 Id, Type), no per-object API calls

**Audit export** (`src/core/export/audit-excel.ts`)  
Single-model exports produce one issues sheet directly. Multi-model exports add a Summary sheet (one row per model, issue-type breakdown columns) followed by per-model detail sheets (Object Name, Object Type, Issue Type, Detail, Last Modified By, Last Modified Date), sorted by issue type then object name within each sheet.

**Activity export** (`src/core/export/activity-excel.ts`)  
Always multi-sheet: a Summary sheet (one row per model: Objects Created, Objects Modified, Relationships Created, Users) plus one detail sheet per model (Action, Name, Type, User, Date), with object rows sorted by type then name and relationship rows sorted by date descending.

All sheets use a consistent dark-blue header style (ARGB `FF2B5797`, white bold text). Files are written to the configured exports directory with a `YYYY-MM-DDTHH-MM` timestamp prefix and a sanitised model/label name.

Markdown (`src/core/export/markdown.ts`) is retained as a secondary export format, targeting version-controlled documentation. It always fetches full object details and produces a single `.md` file with YAML frontmatter, statistics tables, an object catalogue, and a relationships table.

## Consequences

**Positive**
- Stakeholders can open exported files directly in Excel without any import or conversion step
- Multi-sheet workbooks keep related data together in one file — no need to distribute and re-join multiple CSVs
- Audit and activity exports match the tabular structure of governance reporting templates already in use
- Dynamic attribute column discovery means custom ArchiMate attributes appear automatically without configuration
- The `fetchDetails: false` fast path makes large-model exports practical when full attribute data is not required

**Negative**
- xlsx is a binary format — exports are not diffable in git and cannot be reviewed as plain text
- exceljs adds approximately 2 MB to the bundle
- The `fetchDetails: true` path issues one HTTP request per object; large models with hundreds of objects take proportionally longer to export

## Alternatives not chosen

- **CSV**: Simpler to produce and fully plain-text, but limited to a single sheet per file. Stakeholders would receive multiple files and need to import and re-join them manually. No support for column widths, header styling, or typed numeric cells.
- **JSON**: Machine-readable and diffable, but not stakeholder-friendly. Requires a separate tool or script to view in any useful form. Appropriate for API consumers, not governance audiences.
- **Google Sheets API**: Would produce a shareable, always-online spreadsheet, but requires OAuth credentials, a Google Cloud project, and an external dependency. Adds operational overhead that is not justified for a tool targeting single-user CLI/TUI use.
