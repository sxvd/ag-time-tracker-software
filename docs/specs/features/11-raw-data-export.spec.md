# 11 Raw Data Export

Source: extracted from the preserved full brief in `docs/spec.md`.

## Summary

Raw data export reinforces personal ownership. The current UI gives users one direct CSV export action; the authenticated JSON endpoint remains available internally but is not presented as a format choice for now.

## Users

- Individuals and freelancers exporting personal work records.

## Scope

- Export CSV from the Personal Dashboard header.
- Retain the existing JSON API without exposing a JSON UI action.
- Include tags, categories, client/project, feedback, blockers, durations, idle seconds, context switches, location label, and manual flag.
- Keep export user-scoped.
- Record export metadata.

## Out Of Scope

- Company-wide raw export of individual data.
- Billing exports.
- Payroll integrations.

## UI Reference

The Personal Dashboard ASCII mock in `docs/spec.md` shows one `Export CSV` action in the page header and no separate Raw data card or format chooser.

## Functional Requirements

- A user can export their own raw data through one direct `Export CSV` action in the Personal Dashboard header.
- Exports include all required fields.
- The UI downloads CSV directly without a format chooser. The API continues to support authenticated CSV and JSON responses.
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
- `frontend/features/dashboard/PersonalDashboard.vue`
- `frontend/app.vue`

## Current Implementation

- `export.get.ts` requires a session and returns CSV or JSON.
- `exportRows` maps persisted user entries to export rows.
- Exports include task, tags/category, client, project, timestamps, duration, idle seconds, context switches, location label, manual and edited flags, feedback, note, and blockers.
- `exportData` records a persisted export event.
- While Personal Dashboard is active, the app shell replaces `New team task` with `Export CSV` and fetches the CSV blob through the same bearer-authenticated per-tab boundary as other requests before creating a local download URL.

## Gaps

- Export data and export logs are persisted to PostgreSQL.
- Date range filters are not implemented in the current API.
- The JSON endpoint remains supported but its UI action is intentionally deferred.
- Entry editing is implemented and exports include its `edited` flag; the history UI also visibly marks edited entries.
- User-scoped export rows and audit records have PostgreSQL coverage for two distinct initiating users; two-tab unit/component contracts prove that each blob request carries its own bearer, and a built-Nitro smoke check proved bearer precedence even when the request also carried the other session's cookie.
- Unit/component contracts prove per-tab bearer headers and blob response mode; direct route content-type coverage remains outstanding.

## Acceptance Criteria

- The Personal Dashboard `Export CSV` action downloads successfully without a format chooser.
- The authenticated JSON endpoint remains functional even though it is not exposed in the current UI.
- Exports are scoped to the signed-in user.
- Required fields are present.
- Export metadata is recorded.
- Manual and edited records are clearly distinguishable once edit support exists.

## Tests And Verification

- API tests for CSV content type, JSON content type, field shape, and auth.
- Current automated evidence includes two-session bearer blob isolation plus user-scoped row/audit persistence; a built-Nitro two-session check additionally covered the real route and opposite-cookie precedence. Direct automated content-type route tests remain deferred.
- Browser check: export CSV from the Personal Dashboard header after creating timer and manual entries; confirm no JSON chooser is displayed.
