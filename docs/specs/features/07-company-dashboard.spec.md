# 07 Company Dashboard

Source: extracted from the preserved full brief in `docs/spec.md`.

## Summary

The company dashboard shows aggregated process-level patterns across work categories. It uses the same canonical Category records as Track and must help the company improve workflows without exposing individual performance rankings.

## Users

- Company stakeholders looking for process friction.
- Company stakeholders inspecting category-level blocker and work-signal patterns.
- Individual contributors who want confidence that company views remain aggregated.

## Scope

- Allow every authenticated AirGradient user to view the same company-level aggregate surface.
- Show a server-provided category filter with `All categories` as the default.
- Show selected-week aggregate tracked hours and an anonymous active shared-session count.
- Show one configurable Monday-Sunday aggregate Work overview chart.
- Week selection is capped at the current Monday-Sunday week.
- Show aggregated Flow and Efficiency percentages from recorded feedback only.
- Show up to five blocker patterns by associated time with affected-session counts.
- Include context switches as a selectable Work overview metric, not a separate trend chart.

## Out Of Scope

- Individual leaderboards.
- Individual performance ranking.
- Salary, earnings, billable hours, or utilization scoring.
- Exposing private notes as company-level detail.

## UI Reference

The original `docs/spec.md` includes a dedicated Company Dashboard ASCII mockup. The dashboard uses this hierarchy:

1. A tall main card on the left: `Company overview` begins with Category scope and selected-week aggregate hours; a horizontal divider then introduces the dominant, configurable Monday-Sunday `Work overview`.
2. A right-side column contains three separate cards: anonymous Active shared sessions first, compact Work signals below it, then Blocker patterns. They are visually separate blocks, not sections inside one shared card.
3. The main card and the first side card start at the same vertical position. The summary is not a separate full-width card, so it cannot create unused space above the chart.

The company surface reuses the Personal Dashboard card, chart, signal-distribution, blocker-list, loading, and empty-state patterns but uses the orange aggregate accent. Its control model intentionally matches Personal Dashboard: Metric, Group by, week navigation, and Bar/Line. It must never introduce a people table, contributor ranking, or drill-down into private entries.

## Functional Requirements

- Company metrics are aggregated.
- Every authenticated AirGradient user can open the company dashboard; there is no manager-only UI gate.
- The category filter defaults to `All categories`. Its options come from canonical persisted Category records supplied by the server and are the same options used by Track; they are not hardcoded independently in the dashboard.
- Opening Company Dashboard refreshes category options and aggregate data so a long-lived browser session cannot keep an obsolete option list.
- Category selection and API filtering use the stable category ID, not the display name. Changing category refreshes all company aggregates together. The selected category stays visible while loading; on failure the previous data remains visible and a clear error appears beside the filter.
- If the selected category no longer exists, fall back to `All categories`, refresh all aggregates, and announce the change without rendering an invalid selection.
- Aggregate tracked hours use the explicit `h` unit and never imply billing, utilisation, or performance scoring.
- `Work overview` always shows the selected Monday-Sunday week. It defaults to the latest available week, `Tracked time`, `Category`, and a Bar presentation; users can select an available historical week, Metric (`Tracked time`, `Work entries`, or `Context switches`), Group by (`Category`, `Flow`, or `Efficiency`), and Bar or Line without navigating away.
- The next-week control is disabled on the current week, and direct future API requests resolve to the current week.
- The X axis always shows Monday-Sunday. The Y-axis title is `Hours` for Tracked time, `Work entries` for saved timer/manual-entry counts, and `Switches` for Context switches; the title and accessible description state the active metric, grouping, category scope, and week.
- Flow and Efficiency grouping excludes entries without recorded feedback and states that qualification in the chart's accessible description and empty state. The category scope applies before all chart calculations.
- Flow and Efficiency each exclude `Skipped` and calculate percentages from their own recorded-feedback denominator. Labels, counts, and percentages remain available without relying on color alone.
- Blocker patterns are process issues, not people issues. Show no more than five, ordered by associated tracked hours, then affected-session count.
- Do not render a separate context-switch trend or an eight-week chart. Context switches are one selectable weekly Work overview metric, with the explicit `Switches` unit.
- Shared activity appears as its own side card and shows only the anonymous number of active shared-task sessions whose task belongs to the selected category scope. Do not expose source task IDs/titles, contributor names, user IDs, individual time, or `tracking now` labels on this dashboard.
- Every chart/list has a neutral empty state. Missing feedback is not interpreted as a negative signal.
- The company dashboard does not provide raw-data export or navigation into individual records.

## Data And API

Relevant target data:

- `categories.id`
- `categories.name`
- `time_entries`
- `tasks`
- `categories`
- `entry_feedback`
- `entry_blockers`
- `task_members`

Relevant current files:

- `backend/utils/store.ts`
- `backend/api/bootstrap.get.ts`
- `frontend/components/MetricChart.vue`
- `frontend/features/dashboard/CompanyDashboard.vue`

Required aggregate API shape:

- `totalSeconds`
- selected Monday-Sunday `week` (`start`, `end`, `label`)
- daily aggregate `overview` series keyed by date, grouping key, and selected Metric
- `blockers`
- `flow`
- `efficiency`
- selected `categoryId` (`null` means all categories)
- `availableCategories`
- anonymous `activeSharedSessionCount`

## Target Implementation

- The target payload returns stable category IDs and names in `availableCategories`, accepts an optional category ID, and rejects unknown or inaccessible category IDs before aggregate queries run.
- The target summary row shows category scope, aggregate tracked hours, and one anonymous active shared-session count.
- The target overview payload accepts selected week, metric, grouping, and category ID. It returns daily Monday-Sunday buckets plus only the aggregate group labels and values needed by the active configuration; it returns no individual or task-level rows.
- The target Company Work signals and Blocker patterns reuse the same presentational components as Personal Dashboard with company-specific data, copy, and orange accent supplied through props.
- Opening Company Dashboard refreshes the options and current aggregates. Category-specific requests scope completed entries and active shared-task presence through `task.categoryId`.

## Current Implementation

- The authenticated `GET /api/company-dashboard` route is the sole Company Dashboard data boundary. It validates category IDs, Monday week starts, metric, and grouping before querying aggregate data, and clamps future week requests to the current Monday-Sunday week.
- Company aggregation scopes completed entries and active shared-task presence by `tasks.category_id`; it does not query `users.team`, return `availableTeams`, or use the bootstrap query for company data.
- The UI defaults to the latest available week, Tracked time, Category, and Bar. It refreshes on dashboard open and retains previous aggregate results during a failed refresh.
- The dashboard renders one selected-week Work overview. There is no separate context-switch trend, raw export, people list, task list, or individual drill-down.
- Work signals and blockers use shared dashboard presentation components and only receive aggregate data. AI suggestions remain deferred.

## Gaps

- Full collaborator-management and per-contributor effort UI for opt-in shared tasks remains part of the broader shared-task milestone, not this aggregate dashboard surface.
- `users.team` remains a required legacy column and the current Settings UI can still edit it; both must be removed from the production workflow before a later migration drops the column.
- Query-plan evidence from the small Docker verification dataset does not justify a speculative index migration. Reassess `tasks(category_id)` and date-range indexes with representative production volume before adding a migration.

## Acceptance Criteria

- Company dashboard contains only aggregated metrics.
- A category filter works without revealing individual raw entries.
- Category options reflect the same canonical persisted Category records used by Track, refresh when the dashboard opens, and reject invalid category IDs server-side.
- The selected-week Work overview renders the configured daily aggregate correctly; its title, Y-axis unit, accessible description, and empty state match the selected metric, grouping, category scope, and week.
- Blocker patterns and Flow/Efficiency distributions render correctly beside the one chart.
- Active shared activity remains an anonymous aggregate count.
- Loading, failure, and empty states preserve the aggregate privacy boundary.
- No company view ranks individuals by performance.
- Privacy boundaries are tested at the API layer.

## Tests And Verification

- Unit tests for daily selected-week aggregate rollups for every supported Metric/Group by combination, recorded-feedback percentages, blocker ordering, and category-option mapping.
- API tests cover aggregate response shape, absence of individual raw data/names/source task titles, member boundaries, unrelated viewers, and category-filtered active counts.
- Component tests cover populated, empty, loading, and failed-filter states without individual identifiers.
- Browser check: open the dashboard after Category records change, confirm options refresh, switch `All categories` → a persisted category, change week, metric, grouping, and chart type, confirm every aggregate updates together, and verify no individual detail appears.
