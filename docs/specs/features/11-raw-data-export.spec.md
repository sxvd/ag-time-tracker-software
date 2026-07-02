# 11 Raw Data Export

Source: extracted from the preserved full brief in `docs/spec.md`.

## Summary

Raw data export reinforces personal ownership. Users can export their own detailed time tracking data in CSV or JSON at any time.

## Users

- Individuals and freelancers exporting personal work records.

## Scope

- Export CSV.
- Export JSON.
- Include tags, categories, client/project, feedback, blockers, durations, idle seconds, context switches, location label, and manual flag.
- Keep export user-scoped.
- Record export metadata.

## Out Of Scope

- Company-wide raw export of individual data.
- Billing exports.
- Payroll integrations.

## UI Reference

The original `docs/spec.md` references export from the main timer navigation and dashboard, but does not include a dedicated export ASCII mockup.

## Functional Requirements

- A user can export their own raw data at any time.
- Exports include all required fields.
- Export responses are downloadable as CSV or JSON.
- Export must not include another user's private entries unless explicitly allowed by shared-task membership rules and personal ownership boundaries.
- Export logs record format and timestamp.

## Data And API

Relevant target data:

- `exports`
- `time_entries`
- `tasks`
- `categories`
- `clients`
- `projects`
- `entry_feedback`
- `entry_blockers`

Relevant current files:

- `backend/api/export.get.ts`
- `backend/utils/store.ts`
- `shared/utils/time.ts`
- `frontend/app.vue`

## Current Implementation

- `export.get.ts` requires a session and returns CSV or JSON.
- `exportRows` maps persisted user entries to export rows.
- Exports include task, tags/category, client, project, timestamps, duration, idle seconds, context switches, location label, manual flag, feedback, note, and blockers.
- `exportData` records a persisted export event.
- `frontend/app.vue` provides CSV and JSON download links.

## Gaps

- Export data and export logs are persisted to PostgreSQL.
- Date range filters are not implemented in the current API.
- Export does not include an edited flag because edited entries are not implemented.
- Export authorization should be rechecked after moving to database-backed shared-task access.
- There are no API tests for CSV/JSON shapes.

## Acceptance Criteria

- CSV and JSON exports download successfully.
- Exports are scoped to the signed-in user.
- Required fields are present.
- Export metadata is recorded.
- Manual and edited records are clearly distinguishable once edit support exists.

## Tests And Verification

- API tests for CSV content type, JSON content type, field shape, and auth.
- Browser check: export CSV and JSON after creating timer and manual entries.
