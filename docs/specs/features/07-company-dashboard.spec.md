# 07 Company Dashboard

Source: extracted from the preserved full brief in `docs/spec.md`.

## Summary

The company dashboard shows aggregated process-level patterns across the team. It must help the company improve workflows without exposing individual performance rankings.

## Users

- Company stakeholders looking for process friction.
- Team leads inspecting team-level blocker/category patterns.
- Individual contributors who want confidence that company views remain aggregated.

## Scope

- Aggregated time by category.
- Blocker frequency ranking by count and associated time.
- Aggregated flow/efficiency distribution.
- Context-switch rate trends.
- Trends over time.
- Team filter, for example COMMS, Hardware, Software.
- Shared-task totals may appear if kept collaborative and non-punitive.

## Out Of Scope

- Individual leaderboards.
- Individual performance ranking.
- Salary, earnings, billable hours, or utilization scoring.
- Exposing private notes as company-level detail.

## UI Reference

The original `docs/spec.md` does not include a dedicated company dashboard ASCII mockup. It is specified in the UI/UX requirements and referenced from the main timer navigation.

## Functional Requirements

- Company metrics are aggregated.
- Team filtering changes aggregate scope without exposing individual raw data.
- Blockers are ranked as process issues, not people issues.
- Shared-task per-contributor time is acceptable only within collaborative task context.
- Company dashboard should show category time, blocker ranking, flow/efficiency distribution, context-switch trends, and trend over time.

## Data And API

Relevant target data:

- `users.team`
- `time_entries`
- `tasks`
- `categories`
- `entry_feedback`
- `entry_blockers`
- `task_members`

Relevant current files:

- `backend/utils/store.ts`
- `backend/api/bootstrap.get.ts`
- `backend/api/insights.post.ts`
- `frontend/components/MetricChart.vue`
- `frontend/app.vue`

## Current Implementation

- `buildDashboards` computes company total hours, category rollups, blocker rollups, flow counts, efficiency counts, context-switch trends, and active trackers from persisted entries.
- A team filter is passed through `bootstrap` query and `insights`.
- `frontend/app.vue` renders a company dashboard with category chart, blocker list, team filter, context-switch trend, active tracker list, and company insight button.

## Gaps

- Metrics are backed by PostgreSQL queries.
- Company dashboard rollups are computed server-side from persisted data.
- Aggregated efficiency distribution is not as complete as flow distribution.
- There are no authorization tests proving individual data cannot leak into company responses.
- Team filters depend on persisted users.

## Acceptance Criteria

- Company dashboard contains only aggregated metrics.
- A team filter works without revealing individual raw entries.
- Category time, blocker ranking, flow/efficiency distribution, context-switch trends, and trend over time render correctly.
- No company view ranks individuals by performance.
- Privacy boundaries are tested at the API layer.

## Tests And Verification

- Unit tests for aggregate rollups.
- API tests for aggregate response shape and absence of individual raw data.
- Browser check: switch team filter, confirm aggregate charts/lists update.
