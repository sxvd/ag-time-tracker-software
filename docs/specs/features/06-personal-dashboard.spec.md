# 06 Personal Dashboard

Source: extracted from the preserved full brief in `docs/spec.md`.

## Summary

The personal dashboard helps each user analyze how their selected week was spent across time, focus quality, blockers, and working patterns. This is the private, exportable view of personal work data; task-memory history remains in Breezy Journey.

## Users

- Individual team members.
- Freelancers who want honest insight into working hours and patterns.

## Scope

- Show the selected week's tracked time as human-readable hours and minutes rather than decimal hours.
- Show one primary `Work overview` chart combining daily trend and work breakdown.
- Let the user select a historical Monday-Sunday week, metric (`Tracked time` or `Work entries`), grouping (`Category`, `Task`, or `Flow`), and bar or line presentation.
- Week selection is capped at the current Monday-Sunday week; future weeks are not shown as selectable options.
- Default to the latest week containing tracked work, `Tracked time`, `Category`, and bar presentation.
- Show efficiency and energy distributions.
- Show blocker patterns.
- Show medal collection summary.
- Show the richer blocker-pattern list instead of a duplicate top-blocker summary.
- Provide one `Export CSV` action in the Personal Dashboard header instead of the Track page's `New team task`; do not show a second Raw data card or format chooser in the dashboard content.

## Out Of Scope

- Manager scoring.
- Billing reports.
- Analytics-style executive dashboards.
- Comparisons against coworkers.

## UI Reference

The original `docs/spec.md` includes a dedicated Personal Dashboard ASCII mockup. The dashboard uses this information hierarchy:

1. One distinct full-width selected-week `Your hours` section at the top of the same card as `Work overview`, showing the exact period and tracked duration.
2. One primary `Work overview` chart with a compact side rail for Work signals, Blocker patterns, and Medals in that order.
3. One primary `Export CSV` action in the page header.
4. A compact two-column medal table at the end of the reflection rail, using the shared headers `Medal` and `Status`; each medal's meaning appears as a secondary row directly below that medal.

On desktop, the shared Your hours/Work overview card is the dominant surface. `Your hours` occupies the full card width first, followed by a horizontal divider and the Work overview section. The adjacent reflection rail stacks Work signals, Blocker patterns, and the existing medal table; the rail's total height matches the Work overview card. At narrower widths the overview appears first and the complete reflection rail follows. Controls wrap or the dashboard stacks before any content can overflow its card.

The Work overview chart remains the visual focus. It replaces the separate work-breakdown and weekly-trend charts. The Personal Dashboard is the analytical summary surface, not a task-by-task diary. It does not repeat the top blocker or Breezy day; detailed blocker patterns remain here and completed-task memories remain available through Breezy Journey.

## Functional Requirements

- The dashboard shows only the signed-in user's detailed personal entries.
- Personal raw data belongs to the user and is exportable.
- Metrics update after timer-created entries, manual entries, and edited entries.
- The `Your hours` summary is a distinct full-width labelled section at the top of the same card as `Work overview`, separated from Work overview by a horizontal divider. It is derived from exact accumulated duration seconds for the selected Monday-Sunday week and shows the same explicit date range as the chart.
- Changing the selected week updates the summary, chart, work signals, and blocker patterns together without a page navigation or backend write.
- The summary uses correct singular/plural forms, omits zero-value units, shows `0 minutes` when no time exists, and shows `< 1 minute` for a positive duration below 60 seconds. Remaining seconds are not promoted to another minute.
- The week selector exposes weeks containing the user's completed entries in chronological order, defaults to the latest available week, and supports labelled previous/next-week controls. When no completed week exists, show a neutral empty state.
- The week selector must not expose a week later than the current week.
- The Work overview defaults to `Tracked time` grouped by `Category` and can switch locally between `Tracked time` and `Work entries`, Category/Task/Flow grouping, and bar/line presentation.
- Tracked time uses an adaptive readable unit: minutes when every selected-week daily total is below 1 hour, and hours when any daily total reaches 1 hour or more. Work entries uses completed saved timer/manual-entry counts. Flow grouping excludes skipped feedback for either metric.
- The chart always uses the seven days Monday-Sunday on the X axis. Its title, Y-axis unit, tooltip, legend, accessible description, insight sentence, and empty state update to match the selected metric/grouping/week.
- The visible Y-axis title is `Minutes` or `Hours` for tracked time based on the selected week's 1-hour breakpoint, and `Work entries` for saved-entry count. Tracked-time axis ticks should avoid unclear decimal-hour labels such as `0.1` or `0.2`; short sessions should read as whole minutes.
- Do not render Great flow as a standalone summary card because the Flow chart view owns that detail.
- Work signals show Efficiency and Energy for the selected week as two compact stacked-bar rows under the explanation `How your completed sessions felt this week`.
- Each signal shows its response count once. Every segment has a directly associated text label, session count, and percentage below the bar; session count is primary and percentage is secondary. Each distribution excludes `Skipped` feedback and calculates its own percentages from sessions where that signal was recorded.
- Work-signal values use text labels and numbers as well as color, without repeating the same information in a second vertical list. If a distribution has no recorded feedback, show a calm empty state instead of treating missing feedback as a negative result.
- Blocker patterns show at most the top four blockers for the selected week, ordered by associated tracked hours. Each item shows both the number of affected sessions and associated tracked hours.
- If no blockers were recorded, show the neutral empty state `Clear skies — no blockers logged.`
- Do not render a duplicate Top blocker summary card or a Breezy day card on the Personal Dashboard.
- The Personal Dashboard page header shows one primary `Export CSV` button in place of `New team task`. It downloads the signed-in user's CSV directly and does not open a format chooser.
- Do not render a separate Raw data card or a JSON export action on the Personal Dashboard. The existing JSON API remains available but is intentionally not exposed in the current UI.
- Blockers, work signals, and the Work overview are framed as personal reflection, never as performance judgement.
- Medals use one compact table with the shared headers `Medal` and `Status`. Each medal has a primary name/status row and a secondary meaning row spanning the table directly below it; an unawarded medal uses the status `Waiting`.

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

The dashboard uses per-week, per-day server rollups derived from existing entries, tasks, categories, feedback, and blockers. This design does not require a Prisma schema change.

Relevant current files:

- `backend/utils/store.ts`
- `backend/api/bootstrap.get.ts`
- `frontend/components/MetricChart.vue`
- `frontend/features/dashboard/PersonalDashboard.vue`
- `frontend/features/dashboard/EntryHistory.vue`
- `frontend/features/medals/MedalCollection.vue`

## Current Implementation

- `buildDashboards` returns chronological Monday-Sunday buckets built from the signed-in user's completed Prisma-backed entries, including seven daily Category/Task/Flow series and selected-week signals and blockers.
- `PersonalDashboard.vue` defaults to the latest available week, Tracked time, Category, and bar view; all selected-week reflection cards update together without a backend write.
- The app shell renders `Export CSV` instead of `New team task` while Personal Dashboard is active and performs the existing authenticated blob download directly.
- `WorkOverviewChart.vue` renders multi-series bar or line charts with a visible Minutes/Hours/Work entries Y-axis title, legend, and accessible description.
- `WorkSignalsCard.vue` renders two compact stacked-bar rows with one response total per signal and directly associated labels, session counts, percentages, and empty states.
- `BlockerPatternsCard.vue` renders up to four selected-week blockers by associated tracked time with affected-session counts and a neutral empty state.
- `MedalCollection.vue` renders one semantic two-column table with shared Medal and Status headers; each meaning is associated with and displayed below its medal, and unawarded medals display as Waiting.
- The earlier `WeeklyTrendCard.vue` and `BreezyDayCard.vue` remain available to the codebase but are no longer composed into Personal Dashboard.
- `EntryHistory.vue` renders individual/team entry history and emits owned-entry edit intent to the app-level editor orchestration.

## Known Gaps

- Medals are still a compact summary without a dedicated collection interaction from this dashboard.
- Dedicated browser evidence with completed entries spanning at least two historical weeks is still required after implementation verification.
- Owned completed-entry editing reloads persisted state and refreshes the weekly rollups; a dedicated end-to-end assertion for editing across a week boundary remains a gap.

## Acceptance Criteria

- A signed-in user sees only their own detailed entries and metrics.
- Selected-week tracked time renders as human-readable hours and minutes with the explicit Monday-Sunday date range and specified zero, sub-minute, and singular/plural behavior.
- The dashboard defaults to the latest available week, Tracked time, Category, and bar presentation.
- The user can move between available historical weeks and switch metric, grouping, and bar/line presentation in one Work overview chart.
- The X axis always represents Monday-Sunday and the Y axis explicitly identifies Minutes, Hours, or Work entries.
- The dashboard does not render a standalone Great flow summary card.
- Efficiency and Energy stacked bars exclude `Skipped`, use separate recorded-feedback denominators, and present each response count only once without a duplicate detail list.
- Blocker patterns show no more than four selected-week blockers with affected-session counts and associated hours.
- Top blocker, separate weekly trend, and Breezy day cards are absent from the Personal Dashboard.
- Every secondary surface has a non-judgemental empty state.
- The dashboard shows the medal summary after Blocker patterns in the reflection rail as one two-column table with a shared header and a directly associated meaning row below each medal.
- New timer entries and manual entries update dashboard metrics.
- Edited entries recalculate affected metrics.
- Personal export is available through the single `Export CSV` button in the Personal Dashboard header; no CSV/JSON chooser or duplicate Raw data card is shown.

## Tests And Verification

- Unit tests for Monday-Sunday daily rollups, exact-duration formatting, metric/grouping mapping, work-signal percentages, and blocker ordering.
- API tests for user-scoped dashboard data.
- Component tests for selected-week duration, week navigation, current-week cap, metric/grouping/chart-type switching, dynamic units, segmented work signals, blocker scope, raw export placement, populated/empty states, and removed duplicate cards.
- Browser check: create entries across at least two weeks, open Personal Dashboard, confirm `Export CSV` replaces `New team task`, change week, metric, grouping, and chart type, then confirm summary/signals/blockers update with the chart and the shared-header medal table follows the analytical layout.
