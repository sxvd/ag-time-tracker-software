# Company Dashboard Aggregate Work Overview Plan

**Status:** Implemented and verified on 2026-09-10; M6 remains open for shared-task collaboration work.  
**Related specs:** `docs/spec.md` § Company dashboard; `docs/specs/features/07-company-dashboard.spec.md`  
**Scope:** M6 Company Dashboard only. Do not include shared-task collaboration management or removal of the legacy `users.team` column from unrelated profile workflows.

## Goal

Replace the legacy, team-scoped Company Dashboard with one privacy-safe, category-scoped aggregate `Work overview`. The chart shows one selected Monday-Sunday week and can change Metric, Group by, week, and Bar/Line presentation. It must not expose people, task titles, raw entries, notes, locations, or activity destinations.

## Confirmed Product Contract

| Area | Decision |
| --- | --- |
| Scope | `All categories` or one canonical `categories.id`; never `users.team` |
| Default view | Latest available week, `Tracked time`, `Category`, Bar |
| Metrics | `Tracked time` (Hours), `Sessions` (Sessions), `Context switches` (Switches) |
| Grouping | `Category`, `Flow`, `Efficiency` |
| Time axis | Monday through Sunday of one selected historical week |
| Feedback grouping | Exclude entries without a recorded, non-`Skipped` value and say so in accessible copy/empty state |
| Supporting data | Selected-week hours, anonymous active shared-session count, Work signals, up to five Blocker patterns |
| Excluded UI | Separate 8-week context-switch chart, raw-data export, people/task drill-down, ranking |

`Context switches` means the aggregate count recorded for completed entries on each day. It is deliberately not labelled as an average or a performance score.

## Target API Boundary

Create one authenticated, aggregate-only route:

```text
GET /api/company-dashboard
  ?categoryId=<canonical category id | omitted>
  &weekStart=<YYYY-MM-DD Monday | omitted>
  &metric=trackedTime|sessions|contextSwitches
  &groupBy=category|flow|efficiency
```

`chartType` remains temporary client UI state and is not sent to the server. If `weekStart` is omitted, the server chooses the latest available Monday-Sunday week for the selected category scope. Invalid enum values, non-Monday dates, and unknown category IDs return `400` before aggregation.

The response contains only:

```ts
{
  categoryId: string | null,
  availableCategories: Array<{ id: string, name: string }>,
  week: { start: string, end: string, label: string },
  totalSeconds: number,
  activeSharedSessionCount: number,
  overview: {
    metric: 'trackedTime' | 'sessions' | 'contextSwitches',
    groupBy: 'category' | 'flow' | 'efficiency',
    days: Array<{
      date: string,
      label: string,
      series: Array<{ name: string, value: number }>
    }>
  },
  flow: Array<{ name: string, count: number }>,
  efficiency: Array<{ name: string, count: number }>,
  blockers: Array<{ name: string, count: number, seconds: number }>
}
```

No response field may identify a user, task, entry, note, location, destination URL, app, or browser tab.

## Implementation Order

### 1. Lock down aggregate contracts and regression tests

**Files:**

- Create `tests/integration/company-dashboard.test.ts`
- Modify `frontend/types/api.ts`
- Modify/replace Company Dashboard component tests

**Work:**

1. Add failing server tests for category-ID validation, selected-week boundaries, all supported Metric/Group by combinations, and omitted-week defaulting.
2. Seed at least two categories, several calendar days, recorded and skipped feedback, blockers, context-switch counts, and an active shared task.
3. Add privacy assertions that recursively reject user IDs, names, emails, task IDs/titles, entry IDs, notes, locations, and active-user labels.
4. Add focused type contracts for the new aggregate-only payload.

**Checkpoint:** The new tests fail for missing route/service behavior; existing personal dashboard tests remain unchanged.

### 2. Build the server-side aggregate service

**Files:**

- Modify `backend/utils/store.ts`, or extract the Company-specific query to `backend/utils/company-dashboard.ts`
- Create `backend/api/company-dashboard.get.ts`
- Modify `backend/api/bootstrap.get.ts`

**Work:**

1. Parse and validate `categoryId`, `weekStart`, `metric`, and `groupBy` at the route boundary.
2. Load canonical categories from PostgreSQL. Validate the selected ID before querying time entries; fall back to `All categories` only when the client refreshes after a deleted selection.
3. Query completed `time_entries` for the selected inclusive Monday-Sunday date range through `task.categoryId`.
4. Build daily aggregate series on the server. Calculate seconds, completed-session count, or context-switch count according to Metric; calculate labels according to Group by.
5. Build Work signals and blocker rollups from the same scoped selected-week entry set. Flow/Efficiency must use their own recorded-feedback denominators.
6. Count active shared sessions through `tracking_presence.task.categoryId`, returning only one integer.
7. Stop passing `team` to `publicState()`/`buildDashboards()` for the Company Dashboard path. Keep personal bootstrap data intact.

**Checkpoint:** Integration tests pass against PostgreSQL, and the route response contains only the documented aggregate contract.

### 3. Apply database-query hardening only when evidence requires it

**Files:**

- Potentially modify `backend/prisma/schema.prisma`
- Potentially create one new Prisma migration under `backend/prisma/migrations/`

**Work:**

1. Run the selected-category and All-categories aggregate queries against seeded representative data with PostgreSQL `EXPLAIN (ANALYZE, BUFFERS)`.
2. If the plan shows avoidable scans at realistic volume, add migration-backed indexes, with the expected candidates:
   - `tasks(category_id)` for canonical category scope;
   - `time_entries(task_id, started_at)` for category-scoped weekly entries;
   - `time_entries(started_at)` for All-categories weekly entries.
3. Re-run the query plan and integration suite after migration.

**Decision rule:** Do not create an empty or speculative migration. Existing columns already hold all required facts; an index is a production performance safeguard, not a feature prerequisite.

**Checkpoint:** Either documented query-plan evidence supports a new migration, or the plan records why no schema change is needed.

### 4. Replace legacy Company UI state and rendering

**Files:**

- Modify `frontend/app.vue`
- Modify `frontend/features/dashboard/CompanyDashboard.vue`
- Modify `frontend/features/dashboard/company-dashboard-view.ts`
- Reuse/adapt `frontend/components/MetricChart.vue`
- Modify component tests and fixtures

**Work:**

1. Replace `teamFilter` and `/api/bootstrap?team=...` with Company Dashboard query state: category ID, selected week, metric, group by, and local chart type.
2. Request the dedicated route on opening Company Dashboard and every server-backed filter change. Preserve previous aggregate data while loading or after a failure; announce status in an accessible live region.
3. Remove the old category-total chart and separate context-switch trend. Render one dominant selected-week chart with direct title, Y-axis unit, legend/series labels, data summary, and neutral empty state.
4. Keep Work signals and Blocker patterns in the adjacent rail using the shared Personal Dashboard presentation pattern with company/orange styling.
5. Render only the integer `activeSharedSessionCount`; remove the synthetic `activeTrackers`/task-title representation from the Company surface.
6. Ensure desktop uses the approved dominant chart + reflection rail composition; before content can overflow, stack controls/cards into the mobile reading order: summary, chart, signals, blockers.

**Checkpoint:** Component tests cover default, every control, populated, empty, loading, failure, deleted-category fallback, and absence of individual identifiers.

### 5. Remove Company Dashboard's legacy-team dependency and update documentation

**Files:**

- Modify Company Dashboard tests/fixtures that reference `availableTeams`, `team`, or `?team=`
- Modify `docs/spec.md`, `docs/specs/features/07-company-dashboard.spec.md`, and `docs/milestones.md` only if implementation reveals a contract change

**Work:**

1. Remove `availableTeams`, `team`, `contextSwitchTrend`, and company `byCategory` from the Company API/type path once their replacements are live.
2. Retain `users.team` as explicitly marked legacy data for unrelated account/settings compatibility; do not query it for Company Dashboard results.
3. Update milestone evidence truthfully and record any deferred legacy-profile cleanup separately.

**Checkpoint:** A repository search confirms Company Dashboard runtime/API/tests no longer use `users.team`, `availableTeams`, or `?team=`.

### 6. Verify the full contract

Run, in order:

```bash
npm run test -- tests/unit tests/integration/company-dashboard.test.ts
npm run test:component -- tests/component/dashboards-supporting-features.test.ts
npm run typecheck
npm run build
git diff --check
```

Then perform an authenticated browser smoke test:

1. Open Company Dashboard and confirm category options match Track.
2. Confirm the latest selected week, `Tracked time`, `Category`, and Bar defaults.
3. Change category, historical week, Metric, Group by, and Bar/Line; check title, visible series, and Y-axis unit each time.
4. Confirm Flow/Efficiency grouping excludes unrecorded feedback rather than treating it as negative.
5. Confirm active shared sessions is a number only; inspect Network response and verify no individual/task/entry/private fields exist.
6. Test loading, a failed request, an empty selected week, keyboard focus through all controls, and narrow layout.

## Non-goals and follow-up work

- Removing the `users.team` column, registration default, and Settings editor is a separate legacy-cleanup migration after all remaining consumers have been removed.
- Shared-task collaborator management and per-contributor effort remain outside this dashboard change.
- No raw-data export is added to Company Dashboard.
- No browser/app/site identity is collected for context switches.

## Completion Criteria

The plan is complete only when the Company Dashboard reads canonical task category data through the dedicated aggregate API, renders the approved one-chart weekly interaction model, proves privacy at API level, and has migration/query-plan evidence appropriate to the database change actually made.

## Implementation Record

- Implemented `GET /api/company-dashboard` and category-scoped Prisma aggregation in `backend/utils/store.ts`.
- Removed the legacy Company Dashboard bootstrap/team/type/fixture path. `users.team` remains legacy data for unrelated settings work only.
- No Prisma migration was created: the feature needs no new columns, and `EXPLAIN (ANALYZE, BUFFERS)` against the Docker verification database (13 completed entries) showed tiny sequential scans, which do not justify a speculative index. Reassess at representative production volume before adding indexes.
- Verification passed: 221 unit tests, 99 component tests, 57 PostgreSQL integration tests in a freshly rebuilt Docker test image, Nuxt typecheck, production build, and `git diff --check`.
