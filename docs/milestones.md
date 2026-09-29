# Milestones

Status last updated: 2026-09-28.

- [x] M0: Repository initialized, `.gitignore` added, `AGENTS.md` present, full spec saved to `docs/spec.md`, baseline project starts or builds, `.env.example` provided.
- [x] M1: Nuxt 3 + PostgreSQL + auth scaffolded with AirGradient-style shell, responsive layout, and working start/stop timer writing to `time_entries`.
- [ ] M2: Tasks, editable categories, clients/projects, manual and retroactive entries, history log. Task/manual/history flows exist; user-defined category editing and full client/project management remain deferred.
- [x] M3: End-of-session feedback form and multi-select blocker tagging, stored as discrete fields.
- [ ] M4: Idle detection (keep/discard/break) and context-switch counting; settings page; opt-in location. Server-side activity decisions and consent enforcement are implemented. Browser tab hiding and browser-window focus loss now count with blur/visibility de-duplication; an explicit timer location-label selector and native desktop app identification remain intentionally unavailable/deferred.
- [x] M5: Personal dashboard (selected-week hours, one configurable Monday-Sunday Work overview, segmented efficiency/energy, blocker patterns, medals, and export) with seeded data. The dashboard uses private Prisma-backed daily rollups and non-judgemental populated/empty states.
- [ ] M6: Company dashboard and shared tasks. The category-scoped, privacy-safe Company Dashboard is implemented. Track-page `New team task` now requires an existing teammate, creates pending invitations, and shows the owner the shared task in Team entries immediately without starting the timer. Full collaborator management remains deferred, so M6 stays open.
- [ ] M7: Breezy companion (mood, encouragement, break/hydration/ventilation nudges, praise), medals, profile settings without reporting-team assignment, and the Breezy Journey (month labels, one point per week, single visualisation). The Breezy Companion runtime is implemented and verified, including persisted cadence nudges, mute/verbosity behavior, accessible dismissal, Great-flow celebration, and concurrent-tab deduplication. M7 remains open for unrelated Profile/Medal/Journey gaps, including legacy Team removal and stable calendar-week Journey aggregation.
- [x] M8: AI Insights is deferred. Personal/company panels, the API route, runtime key, environment documentation, and AI-specific tests have been removed from the current product.
- [ ] M9: CSV/JSON raw export, accessibility pass, tests across all layers, README with run instructions and demo script. Bearer-authenticated CSV/JSON export and layered tests exist; automated accessibility scanning and full Playwright E2E remain deferred.
- [ ] M10: GitHub issue/PR comments reviewed with `gh` and actionable feedback addressed.
- [ ] M11: Browser verification completed end-to-end and screenshot/evidence captured. Broad desktop/390px evidence exists, but native visibility-change and forced reduced-motion scenarios remain unverified in the controlled browser.

## Blockers

- M10 was not evaluated in this scoped implementation. The `gh` executable is available, but GitHub issue/PR review was not requested or performed.
- M2, M4, M6, M7, M9, and M11 remain intentionally open for the explicit deferrals recorded above; implemented subsets are not treated as full milestone completion.
- Task 9A's final production dependency gate remains blocked by three high-severity findings in `deepmerge-ts@7.1.5` through `prisma@6.19.3` and `@prisma/config@6.19.3`. On 2026-09-10, newly published `svgo@4.0.2` findings temporarily raised the count from three to four; the compatible `svgo@4.1.0` transitive patch restored it to three. Stable Prisma `7.10.0` still pins `@prisma/config@7.10.0` to the affected `deepmerge-ts@7.1.5`, so a Prisma major upgrade would add breaking changes without fixing the advisory. No high-severity finding is accepted as risk, and no prerelease, `--force`, override, suppression, or dependency reclassification has been applied.

## Verification Log

### Team-task creation and focus-loss context switches (2026-09-28)

- Changed the Track header action to `New team task`. Its dialog requires at least one signed-in teammate, and the API independently rejects collaboration-mode creation when no valid invitee resolves. Individual timer-draft tasks remain supported.
- Newly created shared tasks remain unloaded until the user selects `Track task`, while the owner can see the task immediately under `Today's entries` → `Team` before recipients accept.
- Added browser-window `blur` counting alongside tab visibility, with a 1.5-second de-duplication window so one app/tab switch does not create two counts. Only the count is persisted; destination details remain unavailable and unrecorded.
- Verification passed: 20 focused unit tests, 27 focused component tests, 11 PostgreSQL integration tests, Nuxt typecheck, `git diff --check`, and an authenticated desktop browser smoke confirming the teammate requirement and disabled/enabled submit states. The initial unauthenticated bootstrap produced the expected 401 before sign-in; no framework overlay appeared.

### Company Dashboard aggregate Work overview (2026-09-10)

- Replaced the legacy team-scoped bootstrap dashboard with authenticated `GET /api/company-dashboard`, scoped through canonical `tasks.category_id`. The route returns aggregate-only weekly data and validates category, Monday week start, metric, and grouping before it queries entries.
- The UI now has one Monday-Sunday Work overview with category scope, Metric, Group by, prior/next week, and Bar/Line controls. It shows selected-week Company hours, an anonymous active shared-session count, recorded-only Work signals, and blocker patterns; no people, task details, raw entries, notes, locations, or separate context-switch trend are rendered.
- No Prisma migration was needed. The feature adds no stored fields, and Docker `EXPLAIN (ANALYZE, BUFFERS)` on the 13-entry verification database found only tiny sequential scans; this is insufficient evidence for a speculative index migration. Reassess with representative production volume.
- Verification passed: 221 unit tests, 99 component tests, 57 PostgreSQL integration tests in a freshly rebuilt Docker image across all seven migrations, Nuxt typecheck, production build, and `git diff --check`. Browser smoke still requires the current worktree server because the existing localhost tab is serving an older instance.

### Production dependency re-audit (2026-09-10)

- Re-ran the production audit after the Personal Dashboard work. Newly published `svgo@4.0.2` advisories raised the production result from three to four high findings; the compatible lockfile-only update to `svgo@4.1.0` (with `css-select@6.0.0` and `css-what@7.0.0`) removed that newly actionable finding.
- Regenerated the dependency lock with the Docker image's npm 10 runtime after the host npm 11 lock initially failed clean `npm ci`. A rebuilt clean test image resolves `svgo@4.1.0`, applied all seven migrations with none pending, and passed 221 unit plus 55 PostgreSQL integration tests.
- Component tests passed 104/104, Nuxt typecheck passed, the production build passed, production configuration passed all 18 checks, and `git diff --check` passed.
- `npm run audit:production` still exits non-zero with exactly three high findings and no reported critical finding. Stable Prisma `7.10.0` still resolves the affected `deepmerge-ts@7.1.5`, so Task 9A and the final release candidate remain blocked pending an upstream-compatible Prisma release.

### Personal Dashboard selected-week Work overview (2026-09-10)

- Replaced the separate all-time breakdown, top-blocker summary, weekly trend, and Breezy-day card with one selected-week Work overview and compact Medals, Work signals, Blocker patterns, and Raw data surfaces.
- Added private Monday-Sunday API buckets derived from completed Prisma-backed entries. Each week contains exact total seconds, seven daily Category/Task/Flow series, session counts, recorded-only Efficiency/Energy distributions, and up to four blocker patterns. No Prisma schema or migration change was required.
- The UI defaults to the latest week, Tracked time, Category, and Bar; week, metric, grouping, and Bar/Line controls update the summary and all selected-week reflection cards together.
- Refined the desktop composition against the approved visual reference: widened the application rail, restored a dominant tall Work overview, increased chart contrast, replaced text navigation/chart controls with labelled Heroicons, and added a responsive single-column contract before content can overflow.
- Moved Work signals and Blocker patterns into the top-right reflection rail and changed Medals to one full-width semantic table with shared Medal, What it means, and Status headers after the chart. The latest spec follow-up places Raw data directly after Blocker patterns in that rail, before Medals; the 1000-pixel layout preserves this reading order in one column without horizontal overflow.
- Integrated the selected-week `Your hours` summary as a distinct full-width section at the top of the Work overview card, followed by a horizontal divider and the Work overview section, matching the latest ASCII mock without changing dashboard data or controls.
- Simplified Personal Dashboard Work signals into two compact stacked-bar rows with one response total per signal and directly associated labels, session counts, and percentages. Removed the duplicate vertical detail lists and fixed the first segment to use the defined AirGradient blue token so every segment remains visible in dark mode.
- Replaced the Personal Dashboard header's `New task` action with one direct `Export CSV` action and removed the duplicate Raw data card plus CSV/JSON chooser. The authenticated JSON API remains available but is intentionally not exposed in the current UI.
- Verification passed with 221 unit tests, 104 component tests, Nuxt typecheck, production build, and a rebuilt Docker test image running 221 unit plus 55 PostgreSQL integration tests against all seven migrations.
- The visual-refinement rerun passed 222 unit tests, 104 component tests, Nuxt typecheck, production build, 18 production-configuration checks, `git diff --check`, authenticated desktop browser geometry/interaction checks, and a post-restart browser console check with no new warning or error.
- The block-order follow-up passed the focused 7 responsive and 18 dashboard component checks, the full 104-test component suite, Nuxt typecheck, `git diff --check`, and authenticated browser inspection at 1280 × 720 and 1000 × 900 with no console warning/error.
- Authenticated in-app-browser verification passed week selection/navigation, Tracked time → Sessions, Category → Flow, Bar → Line, selected-week signal updates, dynamic Hours/Sessions labelling, Raw data placement, and a console check with no errors. Visual QA evidence is recorded in `design-qa.md` with `final result: passed`.

### Personal Dashboard human-readable total time (2026-09-09)

- Added an exact `totalSeconds` personal-dashboard API field backed by persisted entry durations and a shared formatter for full English hours/minutes, including zero, sub-minute, singular/plural, and incomplete-minute behavior. No Prisma schema or migration change was required.
- Verification passed with 203 unit tests, 94 component tests, 55 PostgreSQL integration tests against all seven migrations, Nuxt typecheck, production build, and an authenticated browser check showing `13 minutes` from the local database with no warning/error.

### Personal Dashboard selectable breakdown (2026-09-09)

- Replaced the fixed category chart with one local Category/Task/Flow selector. Category remains the default; Category and Task use tracked hours, while Flow excludes skipped feedback and displays completed-session counts with recorded-feedback percentages.
- Removed the standalone Great flow summary card and added view-specific chart titles, units, accessible summaries, tick precision, and empty states without changing the dashboard API or database.
- Verification passed with 202 unit tests, 94 component tests, Nuxt typecheck, production build, and an authenticated browser interaction through Category → Task → Flow with no warning/error.

### AI Insights deferral (2026-09-09)

- Removed the personal/company AI panels, app request orchestration, Nitro API route, runtime key, Docker/deployment environment wiring, README setup, and AI-specific component tests.
- Added dashboard absence contracts and production configuration guards. Verification passed with 200 unit tests, 92 component tests, Nuxt typecheck, all 18 production-configuration checks, production build, authenticated Personal/Company Dashboard browser smoke, working Company team filtering, and no browser warning/error.
- The former `/tracker/api/insights` path now falls through to Nuxt's HTML application response rather than exposing a JSON API route; the production build contains no insights route chunk.

### Task-estimate removal (2026-09-09)

- Task estimates and the personal Estimate-vs-actual panel were removed from the current frontend, API contract, Prisma model, seed, and dashboard rollup. Migration `0008_remove_task_estimates` drops `tasks.estimate_minutes`; the preserved original brief remains historical, while feature specs explicitly defer estimates.
- Verification passed with 199 unit tests, 95 component tests, 54 PostgreSQL integration tests against all seven migrations, Nuxt typecheck, production build, live database-column inspection, and authenticated browser checks with no console errors.

### Current verification (2026-09-04)

- Breezy runtime release verification passed from a clean generated state: 29 unit files/195 tests on the host, 11 component files/93 tests, and a freshly rebuilt Docker aggregate with 195 unit plus 54 PostgreSQL integration tests against `ag_time_tracker_test`. All six migrations applied with none pending.
- Breezy verification also passed lint, the `/tracker/` production build, all 16 production-configuration checks, and `git diff --check`. The test scripts now invoke Nuxt prepare through package lifecycle hooks so clean generated state is reproducible.
- Current-release desktop acceptance covered Ready, Start, Pause, Resume, Great flow, Manual entry, Edit entry, Gentle/Chatty verbosity, System/Light/Dark themes, and a real two-minute Ready-pool mascot change from `hello` to `standard`; no browser console warning or error was observed.
- Current-release responsive acceptance at 390px kept Timer before Breezy and contained the 343px Breezy card/toast inside the 375px content viewport. Dismiss was reached with 20 Tab presses and activated with Enter; a new notification used `role="status"` and `aria-live="polite"`.
- Two signed-in tabs displayed the same persisted hydration nudge, while PostgreSQL showed exactly one unacknowledged row. Keyboard Dismiss followed by reload in the other tab removed it. Paused, modal, Quiet, and Muted suppression and restored-pending behavior were also verified in the same release cycle.
- Browser-test preferences were restored to a 90-minute cadence, Gentle verbosity, and unmuted state. No active timer remained, and the test nudge was acknowledged.
- Verification exposed and fixed two release defects: test scripts now prepare Nuxt-generated state through package lifecycle, and the mobile layout uses `minmax(0, 1fr)` plus page-level overflow containment while preserving internal table scrolling. Regression tests cover both changes.
- The controlled browser reported `prefers-reduced-motion: reduce` as false and has no media-emulation capability, so forced reduced-motion visual acceptance was not executed. The CSS media rule is present and component tests cover celebration motion-key behavior, but do not replace a forced visual browser check. Not every suppression modal was freshly exercised with a live toast in the browser; scheduler and component tests cover every required suppression flag.
- Screenshots were captured interactively during desktop and responsive acceptance, but the controlled browser did not provide a filesystem artifact export. Detailed evidence is in `docs/verification/breezy-runtime-2026-09-02.md`.

- Nuxt is pinned to `3.21.10`; the patched dependency tree previously passed the production audit before the 2026-08-25 advisories were published.
- The spec-aligned frontend feature refactor is complete without a commit: `frontend/app.vue` is now a 473-line authenticated shell and timer lifecycle has one coordinator.
- Final whole-worktree review hardening closed all eight Important findings: consent-aware location writes, authoritative entry edits, bearer blob exports, owner/member/company privacy, idle idempotency/overlap/settings enforcement, serialized timer transitions, actual-break Breezy semantics, and immutable-SHA deployment.
- Final re-review artifact hardening moved production dumps/checksums to a protected external directory, removed unused checkout-local version output, made backup/deploy Git-cleanliness executable regression contracts, and aligned README deployment guidance with the mandatory reviewed-SHA runbook.
- `npm run test`: passed, 119 unit tests.
- `npm run test:component`: passed, 77 component tests.
- PostgreSQL integration suite: passed, 44 tests against all six migrations.
- `npm run lint`: passed.
- `npm run build`: passed.
- `npm run verify:production`: passed all 16 production configuration checks, including immutable reviewed-SHA verification before migration and startup.
- Docker aggregate `test` service: passed after rebuilding with npm 10, including 119 unit tests, all six migrations, and 44 PostgreSQL integration tests. The test-only image now includes Git so the real repository-boundary deployment checks also run in Docker; the production runner remains unchanged by that package.
- The root Vue runtime is pinned to `3.5.41`, matching Nuxt's required runtime range; this fixed a built-Nitro 500 caused by an incomplete split Vue bundle. The rebuilt production runner served `/tracker/api/health`, and a two-session smoke proved bearer-scoped exports even when each request carried the other session's cookie.
- Final desktop and actual 390px browser parity covered password sign-in/logout, Account, System/Light/Dark, Settings save/restore, local task invitation, timer pause/reload/resume, a one-minute idle decision, feedback-before-stop, feedback, manual/edit flows, dashboards, isolated insights, medals, export URLs, and Breezy Journey. No horizontal overflow or browser console warning/error was observed.
- No Browser backend was available for a fresh visual rerun after final-review hardening. Component contracts cover the visible editor/export/company changes, but no new browser-pass claim is added; M11 remains open.
- The controlled in-app second tab did not change the tracker document's visibility state, so no new native context increment is claimed for this run. Task 9's API-assisted persistence check, 4 context-switch unit tests, 14 idle/activity unit tests, and 6 PostgreSQL context-switch integration tests remain the current evidence; desktop application switching remains out of scope.
- The persisted test account was restored to a 5-minute idle threshold, activity tracking enabled, and location tracking disabled after verification.
- A deliberate edit attempt exposed the existing sub-minute-pause precision edge case and returned `pauses[0] must end after it starts.`; a pause-free manual entry edit persisted successfully. The refactor did not change this out-of-scope behavior.
- The account-menu/full-settings change did not add or modify the Prisma schema or migrations.
- The earlier `nanoid@3.3.18` remediation passed 76 unit tests, 34 component tests, Nuxt typecheck, production build, 13 production configuration checks, a clean Docker npm 10 install, all six migrations on an isolated test database, and 32 PostgreSQL integration tests.
- The most recent normal `npm run audit:production` remains blocked with exactly three Prisma-chain high findings and no production critical finding. The Vue alignment and subsequent `svgo@4.1.0` remediation did not suppress, override, force, prerelease, reclassify, or accept those advisories; Task 9A and Task 10 remain incomplete until the high-severity production count returns to zero.

### Historical baseline (2026-07-02)

- `npm.cmd install --no-audit --no-fund`: passed after removing an interrupted partial `node_modules` install.
- `npx.cmd nuxi prepare`: passed.
- `$env:DATABASE_URL='postgresql://postgres:postgres@localhost:5432/ag_time_tracker?schema=public'; npx.cmd prisma validate`: passed after PostgreSQL runtime schema updates.
- `$env:DATABASE_URL='postgresql://postgres:postgres@localhost:5432/ag_time_tracker?schema=public'; npx.cmd prisma generate`: passed.
- `$env:DATABASE_URL='postgresql://postgres:postgres@localhost:5432/ag_time_tracker?schema=public'; npx.cmd prisma migrate status`: failed with Prisma schema engine error before applying migrations.
- `npm.cmd run test`: passed, 9 unit tests.
- `npm.cmd run lint`: passed.
- `$env:NUXT_IGNORE_LOCK='1'; npm.cmd run build`: passed. Nuxt/Nitro production build completed with Node deprecation warnings from dependencies.
- Previous browser verification before the PostgreSQL runtime migration, against built Nitro server at `http://127.0.0.1:3000`: passed desktop workflow with sign in, create task, start/pause/resume/stop, feedback and blocker save, manual entry, personal dashboard, company dashboard, Breezy Journey, history, AI fallback, CSV export, and JSON export. No console errors or failed requests.
- Previous mobile smoke check before the PostgreSQL runtime migration, at 390px width: passed with no console errors.
- Previous screenshots: `docs/browser-verification.png`, `docs/browser-mobile.png`.
