# 06 Personal Dashboard

Source: extracted from the preserved full brief in `docs/spec.md`.

## Summary

The personal dashboard gives each user detailed insight into their own time, quality, blockers, trends, and Breezy state. This is the private, exportable view of personal work data.

## Users

- Individual team members.
- Freelancers who want honest insight into working hours and patterns.

## Scope

- Show total hours.
- Break down time by task, category, and day.
- Show flow, efficiency, and energy distributions.
- Show blocker patterns.
- Show estimate vs actual.
- Show week-on-week trend.
- Show Breezy's current mood and a link into Breezy Journey.
- Show medal collection summary.
- Support raw-data export from the personal data area.

## Out Of Scope

- Manager scoring.
- Billing reports.
- Analytics-style executive dashboards.
- Comparisons against coworkers.

## UI Reference

The original `docs/spec.md` does not include a dedicated personal dashboard ASCII mockup. It references the dashboard through top-level navigation and UI/UX requirements.

## Functional Requirements

- The dashboard shows only the signed-in user's detailed personal entries.
- Personal raw data belongs to the user and is exportable.
- Metrics update after timer-created entries, manual entries, and edited entries.
- Estimate-vs-actual uses task estimates and actual entry duration.
- Blockers and feedback are shown as personal reflection, not judgement.
- Breezy mood and medals are visible from the dashboard.

## Data And API

Relevant target data:

- `time_entries`
- `tasks`
- `categories`
- `entry_feedback`
- `entry_blockers`
- `breezy_days`
- `user_medals`
- `exports`

Relevant current files:

- `backend/utils/store.ts`
- `backend/api/bootstrap.get.ts`
- `frontend/components/MetricChart.vue`
- `frontend/app.vue`

## Current Implementation

- `buildDashboards` computes personal total hours, category rollups, task rollups, blocker rollups, flow/efficiency/energy counts, weekly trend, and estimate variance from persisted entries.
- `frontend/app.vue` renders the personal dashboard with charts, export actions, insight button, medal preview, profile, and settings.
- `MetricChart.vue` renders bar/line charts with Chart.js.

## Gaps

- Metrics are generated from PostgreSQL-backed Prisma queries.
- Time by day is not a distinct first-class chart in the current UI.
- Edited entry recalculation is not supported because entry editing is not implemented.
- There are no component/API tests for dashboard metrics.
- Personal dashboard authorization uses database-backed scoped queries.

## Acceptance Criteria

- A signed-in user sees only their own detailed entries and metrics.
- The dashboard shows hours by task/category/day, feedback distributions, blockers, estimate-vs-actual, trend, Breezy mood, and medal summary.
- New timer entries and manual entries update dashboard metrics.
- Edited entries recalculate affected metrics.
- Personal export is available from the dashboard or nearby navigation.

## Tests And Verification

- Unit tests for rollup calculations.
- API tests for user-scoped dashboard data.
- Browser check: create a session with feedback/blockers, add manual entry, confirm personal dashboard updates.
