# Frontend Feature Refactor Implementation Plan

**Goal:** Refactor the current 1,345-line `frontend/app.vue` into spec-aligned feature slices while preserving every visible, accessible, API, persistence, and state-transition behavior.

**Architecture:** Keep `app.vue` as the authenticated application shell. Use Vue composables plus typed props/events instead of adding global state. Feature directories own code that changes together; `useTrackerApi` becomes the only frontend HTTP boundary. Keep `frontend/assets/main.css` as one file throughout this refactor to minimize visual drift.

**Tech stack:** Nuxt 3.21.10, Vue 3, TypeScript, Nitro `$fetch`, Vue Test Utils, Nuxt Test Utils, Vitest, Happy DOM.

## Refreshed Baseline — 2026-08-25

- `frontend/app.vue`: 1,345 lines; `frontend/assets/main.css`: 1,751 lines.
- Password sign-in and automatic exact-domain `@airgradient.com` registration are the accepted authentication behavior. External identity-provider authentication is out of scope.
- Account menu, full Settings, System/Light/Dark theme, idle decisions, and server-authoritative context-switch persistence are already implemented and must be preserved.
- Existing focused units: `AccountMenu.vue`, `SettingsPage.vue`, `IdleDecisionModal.vue`, `BreezyCompanion.vue`, `EntryEditModal.vue`, `FeedbackModal.vue`, `MetricChart.vue`, `useTheme.ts`, the theme bootstrap plugin, and `auth-error.ts`.
- Verified automated baseline: 76 unit tests, 34 component tests, 32 PostgreSQL integration tests, Nuxt typecheck, production build, and 13 production configuration checks.
- The production dependency gate remains blocked by an upstream Prisma configuration advisory. This blocks release approval, not structural frontend work, and must not be described as resolved by this refactor.

## Global Constraints

- Refactor frontend only. Do not change Nitro behavior, Prisma schema, migrations, API paths, HTTP methods, payloads, response shapes, or persistence semantics.
- Preserve visible copy, accessible names, DOM interaction order, CSS classes, desktop/mobile layout, and light/dark appearance.
- Preserve password registration, safe authentication errors, persisted sessions, Account/Settings, timer, idle, context-switch, dashboard privacy, export, and Breezy behavior exactly.
- Production base URL remains `/tracker/`; Docker network alias remains `tracker`.
- Do not add Pinia or another runtime dependency.
- Company views remain aggregate, process-focused, and non-ranking. Context-switch storage remains count-only.
- Do not split `main.css` during this plan.
- Do not create empty directories.
- Do not commit. Execute one numbered step at a time, verify it, summarize it, and stop until the user types `next`.

## Target Structure

```text
frontend/
├── app.vue
├── assets/main.css
├── components/
│   └── MetricChart.vue
├── composables/
│   ├── useAppNavigation.ts
│   ├── useTheme.ts
│   └── useTrackerApi.ts
├── plugins/theme.client.ts
├── types/api.ts
├── utils/auth-error.ts
└── features/
    ├── auth/
    ├── settings/
    ├── tasks/
    ├── tracking/
    ├── feedback/
    ├── dashboard/
    ├── breezy/
    ├── medals/
    ├── export/
    └── insights/
```

`settings` is one code slice jointly owned by Feature 01 and Feature 05; it is not a new numbered product feature. Timer-time idle and visibility listeners remain in `tracking`. `MetricChart.vue` remains shared because both personal and company dashboards use it.

---

### Task 0: Capture The Current Parity Baseline

**Files:**
- Create: `tests/component/app-contract.test.ts`
- Create: `tests/component/app-fixture.test.ts`
- Create: `tests/component/helpers/app-fixture.ts`
- Create: `docs/verification/frontend-refactor-baseline.md`
- Read without modifying: `frontend/app.vue`
- Read without modifying: `frontend/assets/main.css`

- [x] **Step 1: Create a representative application fixture**

Build one typed bootstrap fixture containing an authenticated user, settings, an active entry with pause/context values, a completed entry, tasks, an invitation, personal/company dashboard data, Breezy days, and medal states. Stub `$fetch` and mount the unchanged app with `mountSuspended`.

Verify the helper itself with one smoke test that proves the fixture reaches the authenticated shell; feature assertions remain in Step 2.

- [x] **Step 2: Characterize stable shell and feature contracts**

Assert current headings, navigation labels, Account dialog, Settings route, timer readout and actions, dashboards, Journey, exports, sign-in form, feedback/manual/edit modals, and aggregate-only company copy. Capture exact request URL/method/body for sign-in, bootstrap, task, timer, idle, context switch, settings, insights, and export.

Minimum shell assertions:

```ts
expect(wrapper.text()).toContain('Current Tracking Task')
expect(wrapper.text()).toContain('Private detail')
expect(wrapper.find('[aria-haspopup="dialog"]').exists()).toBe(true)
expect(wrapper.findAll('.nav-item').length).toBeGreaterThanOrEqual(5)
expect(wrapper.find('.timer-readout').text()).toMatch(/^\d{2}:\d{2}:\d{2}$/)
```

- [x] **Step 3: Run the unchanged-app characterization tests**

```bash
npm run test:component -- tests/component/app-contract.test.ts
```

Expected: pass against the monolith. Document a genuine pre-existing failure instead of weakening an assertion.

- [x] **Step 4: Record desktop and 390 px browser evidence**

At `/tracker/`, record password sign-in/registration and refresh; Account/Settings/theme; task create/share/invite; start/pause/refresh/resume/tab context switch/idle decisions/stop/feedback; manual entry/edit; dashboards; Journey/medals/insights/export; keyboard flow; reduced motion; console; and failed network requests. Restore settings and stop temporary services.

- [x] **Step 5: Review checkpoint**

```bash
git diff --check
git status --short
```

Expected: only baseline tests/evidence change; production frontend remains untouched.

### Task 1: Extract Shared Frontend API Types

**Files:**
- Create: `frontend/types/api.ts`
- Create: `tests/unit/frontend-api-types.test.ts`
- Modify: `frontend/app.vue`
- Modify: `frontend/components/EntryEditModal.vue`
- Modify: `tests/component/helpers/app-fixture.ts`

- [x] **Step 1: Add type-contract tests**

Cover active/completed entries, pause windows, settings, invitations, tasks, dashboards, Journey, and medals without replacing meaningful fields with `any`.

- [x] **Step 2: Move `ApiState` and nested shapes verbatim**

Create named interfaces such as `ApiUser`, `ApiTask`, `ApiEntry`, `ApiInvitation`, and dashboard types. Preserve nullable fields and unions. Update the fixture and entry editor to import these types.

- [x] **Step 3: Verify types without behavior changes**

```bash
npm test -- tests/unit/frontend-api-types.test.ts
npm run test:component -- tests/component/app-contract.test.ts
npm run lint
npm run build
git diff --check
```

Browser-check only bootstrap rendering and entry editing; no markup should change.

### Task 2: Extract The Base-Aware Authenticated API Client

**Files:**
- Create: `frontend/composables/useTrackerApi.ts`
- Create: `tests/unit/tracker-api.test.ts`
- Modify: `frontend/app.vue`

- [x] **Step 1: Write failing HTTP-boundary tests**

Cover `/tracker/` URL construction, `credentials: 'include'`, bearer tab-token behavior, sessionStorage restore/clear, error propagation, and CSV/JSON export URLs.

- [x] **Step 2: Extract the existing boundary exactly**

Move `appBaseUrl`, tab-token key, headers, `authFetch`, token save/clear, and `exportUrl`. Do not change cookie/bearer precedence or retry behavior.

- [x] **Step 3: Verify**

```bash
npm test -- tests/unit/tracker-api.test.ts tests/unit/url.test.ts
npm run test:component -- tests/component/app-contract.test.ts tests/component/app-account-settings.test.ts
npm run lint
npm run build
git diff --check
```

Browser-check sign-in, refresh, logout, CSV, JSON, console, and network paths.

### Task 3: Extract Navigation And Password Authentication

**Files:**
- Create: `frontend/composables/useAppNavigation.ts`
- Create: `frontend/features/auth/SignInPanel.vue`
- Create: `frontend/features/auth/useSession.ts`
- Create: `tests/unit/app-navigation.test.ts`
- Create: `tests/component/auth-session.test.ts`
- Modify: `frontend/app.vue`

- [x] **Step 1: Characterize navigation and session transitions**

Test Track, personal dashboard, company dashboard, Journey, Settings, restoration loading, opening the password form, existing-user success/failure, automatic registration success, refresh, and logout reset.

- [x] **Step 2: Extract navigation state**

Move audience/section/page title/subtitle/eyebrow and navigation actions without changing labels, active classes, or ordering.

- [x] **Step 3: Extract password authentication**

Move current sign-in/restoration/logout state and markup. Preserve the one-form flow, exact-domain and password error copy, input labels, autocomplete values, application-session behavior, and `signInErrorMessage` mapping.

- [x] **Step 4: Verify**

```bash
npm test -- tests/unit/app-navigation.test.ts tests/unit/auth-error.test.ts
npm run test:component -- tests/component/auth-session.test.ts tests/component/app-contract.test.ts
npm run lint
npm run build
git diff --check
```

Browser-check password policy errors, registration, sign-in, refresh, logout, and all navigation destinations.

### Task 4: Consolidate The Existing Account And Settings Slice

**Files:**
- Move: `frontend/components/AccountMenu.vue` to `frontend/features/settings/AccountMenu.vue`
- Keep: `frontend/features/settings/SettingsPage.vue`
- Create: `frontend/features/settings/useAccountSettings.ts`
- Move/modify: existing account/settings component tests
- Modify: `frontend/app.vue`

- [x] **Step 1: Preserve current tested contracts**

Keep all existing Account dialog, System/Light/Dark, validation, dependency disabling, atomic payload, uncertain-response reconciliation, focus, live-region, and mobile contracts.

- [x] **Step 2: Move the focused component and extract orchestration**

Move only the file/import first. Then move Settings draft synchronization, validation-message mapping, atomic save, and reconciliation from the shell into `useAccountSettings`. Keep `useTheme.ts` and the theme plugin unchanged.

- [x] **Step 3: Verify**

```bash
npm run test:component -- tests/component/account-menu.test.ts tests/component/settings-page.test.ts tests/component/app-account-settings.test.ts tests/component/app-contract.test.ts
npm run lint
npm run build
git diff --check
```

Browser-check Account, theme, full Settings save/refresh, Escape/outside close, focus restoration, and 390 px layout.

### Task 5: Extract Tasks And Collaboration

**Files:**
- Create: `frontend/features/tasks/TaskComposer.vue`
- Create: `frontend/features/tasks/CreateTaskModal.vue`
- Create: `frontend/features/tasks/ShareTaskModal.vue`
- Create: `frontend/features/tasks/useTasks.ts`
- Create: `tests/component/tasks.test.ts`
- Modify: `frontend/app.vue`

- [x] **Step 1: Add task behavior tests**

Cover draft changes, category selection, inline creation before timer start, reset behavior, owner-only sharing, invitation status/acceptance, and current task helpers.

- [x] **Step 2: Extract state/API orchestration, then markup**

Move current task state, computed values, helpers, request bodies, and template blocks without changing defaults, labels, classes, or event order.

- [x] **Step 3: Verify**

Run focused component tests, full unit/component suites, typecheck, build, and browser task create/share/invite checks before continuing.

### Task 6: Extract Feedback, Manual Entry, And Entry Editing

**Files:**
- Move: `frontend/components/FeedbackModal.vue` to `frontend/features/feedback/FeedbackModal.vue`
- Move: `frontend/components/EntryEditModal.vue` to `frontend/features/feedback/EntryEditModal.vue`
- Create: `frontend/features/feedback/ManualEntryModal.vue`
- Create: `frontend/features/feedback/useEntries.ts`
- Create: `tests/component/entries-feedback.test.ts`
- Modify: `frontend/app.vue`

- [x] **Step 1: Add payload and error contracts**

Cover feedback save/skip, stop-to-feedback ordering, manual entry dates/blockers, owned-entry edit, pause edits, safe error rendering, and draft reset.

- [x] **Step 2: Move existing files before extracting new markup**

Preserve current public props/events, markup, classes, focus, and validation. Move entry API coordination only after the moved-component tests pass.

- [x] **Step 3: Verify**

Run focused/full tests, typecheck, build, and browser stop/feedback/manual/edit workflows.

### Task 7: Extract Dashboards, Medals, Export, And Insights

**Files:**
- Create: `frontend/features/dashboard/PersonalDashboard.vue`
- Create: `frontend/features/dashboard/CompanyDashboard.vue`
- Create: `frontend/features/dashboard/EntryHistory.vue`
- Create: `frontend/features/medals/MedalCollection.vue`
- Create: `frontend/features/export/ExportActions.vue`
- Create: `frontend/features/insights/InsightPanel.vue`
- Create: `tests/component/dashboards-supporting-features.test.ts`
- Modify: `frontend/app.vue`

- [x] **Step 1: Add display, event, and privacy tests**

Assert metric text/order, history edit events, medal states, export URLs/download attributes, team filter/refresh, insight fallback, aggregate company labels, and absence of private notes or raw user-entry rows from company components.

- [x] **Step 2: Extract presentation before orchestration**

Preserve chart labels/colors, list limits, sorting, empty states, copy, classes, and aggregate-only inputs. Keep shared API coordination at the narrowest owner.

- [x] **Step 3: Verify**

Run focused/full tests, typecheck, build, desktop/mobile dashboard checks, export downloads, and aggregate privacy review.

### Task 8: Extract Breezy Companion And Journey

**Files:**
- Move: `frontend/components/BreezyCompanion.vue` to `frontend/features/breezy/BreezyCompanion.vue`
- Create: `frontend/features/breezy/BreezyJourney.vue`
- Create: `tests/component/breezy.test.ts`
- Modify: `frontend/app.vue`

- [x] **Step 1: Add companion and Journey contracts**

Cover polite announcements, mute, motion key, mood, empty Journey, saved-day count, latest-ten order, month labels, clarity copy, and reduced-motion compatibility.

- [x] **Step 2: Move/extract markup exactly**

Preserve image paths, array slicing, point classes/positioning, copy, and CSS classes.

- [x] **Step 3: Verify**

Run focused/full tests, typecheck, build, and Track/Journey desktop/mobile/reduced-motion browser checks.

### Task 9: Extract Tracking Last

**Files:**
- Move: `frontend/components/IdleDecisionModal.vue` to `frontend/features/tracking/IdleDecisionModal.vue`
- Create: `frontend/features/tracking/TimerPanel.vue`
- Create: `frontend/features/tracking/useTimerSession.ts`
- Create: `frontend/features/tracking/useIdleActivity.ts`
- Create: `tests/unit/timer-session.test.ts`
- Create: `tests/unit/idle-activity.test.ts`
- Create: `tests/component/timer-panel.test.ts`
- Modify: `frontend/app.vue`

- [x] **Step 1: Add transition and cleanup tests**

Use fake timers to cover active-entry restoration, elapsed time, pause restoration, start/pause/resume ordering, refresh persistence, serialized visibility requests, replacement-entry protection, one idle prompt per interval, all idle decisions, feedback-before-stop behavior, and listener/interval cleanup.

- [x] **Step 2: Extract timer and activity composables without moving markup**

Run focused/full automated and browser timer workflows before touching the timer template.

- [x] **Step 3: Move Idle dialog and timer markup**

Preserve button labels/states, stats, task input focus, live values, classes, and accessibility behavior.

- [x] **Step 4: Verify against PostgreSQL**

Run focused/full unit/component/integration tests, typecheck, build, and browser start/pause/refresh/resume/browser-tab context-switch/idle/stop/feedback flows. Compare final entry, pause, idle-decision, and context-switch rows in PostgreSQL.

### Task 10: Reduce `app.vue` To The Shell And Prove Parity

**Files:**
- Modify: `frontend/app.vue`
- Modify: `tests/component/app-contract.test.ts`
- Modify: `docs/verification/frontend-refactor-baseline.md`
- Modify only when evidence changes: `docs/specs/features/14-accessibility-verification.spec.md`
- Modify: `docs/milestones.md`

- [x] **Step 1: Remove only proven dead duplication**

The shell retains authentication gating, page composition, shared bootstrap state, and cross-feature coordination. Remove declarations only after their extracted owner is tested.

- [x] **Step 2: Run static and complete automated gates**

```bash
rg -n "interface ApiState|function authFetch|function syncTimer|function handleVisibility" frontend/app.vue
npm run test
npm run test:component
npm run lint
npm run build
docker compose -p ag-time-tracker-software -f docker-compose.dev.yml run --rm test
git diff --check
```

- [x] **Step 3: Repeat the complete browser parity matrix**

Repeat Task 0 at desktop and 390 px. Compare visible copy, accessible names, action order, API URL/method/body, persisted results, console, network failures, and key CSS classes.

- [x] **Step 4: Record truthful evidence and stop without committing**

Update baseline/milestone/accessibility documentation only for checks that passed. Keep the upstream Prisma audit explicitly blocked until a compatible fix exists.

### Post-plan whole-worktree hardening addendum (2026-09-01)

The frontend-only extraction above completed before the final whole-worktree review. That review found cross-cutting defects outside the original refactor scope, so the subsequent fixes intentionally include backend, API, production configuration, and one direct runtime-version alignment. They do not retroactively change the extraction goal, but they mean the final dirty worktree must not be described as frontend-only.

- [x] Enforce location consent for timer, manual, edit, and export paths.
- [x] Keep idle totals/decisions, context counts, and split-as-break pauses server-authoritative during edits.
- [x] Fetch exports as per-tab bearer-authenticated blobs and prove two-session row/audit isolation.
- [x] Keep detailed entries owner-only, give accepted members reduced collaborative summaries, and make company presence anonymous and source-task-free.
- [x] Enforce Activity off, interval overlap prevention, and idempotent idle retries.
- [x] Serialize pause/resume/idle/stop transitions and calculate stop duration from freshly locked state.
- [x] Derive Breezy and Sustainable Pace from persisted pause/rest seconds through one shared runtime/seed implementation.
- [x] Require and repeatedly verify an immutable reviewed deployment SHA, with the runbook using no-pull deploy mode.
- [x] Keep raw production backups in a protected external directory, remove unused checkout version output, and keep simulated backup/deploy procedures Git-clean.
- [x] Pin root Vue `3.5.41` to Nuxt's runtime requirement after production-runner smoke exposed an incomplete split bundle; regenerate the lock with Docker's npm 10 for reproducible `npm ci`.
- [x] Reconcile milestones/specs with explicit deferrals and current automated evidence.

Post-review automated gates pass at 119 unit, 77 component, and 44 PostgreSQL integration tests, plus typecheck, production build, 16 production-configuration checks, Docker aggregate tests, and production-runner `/tracker/` health/export smoke. The added five deployment regression cases cover external protected backup output, Git cleanliness, and truthful README invocation. A fresh visual Browser backend was unavailable, so the earlier desktop/mobile evidence is retained without a new browser claim. Production release remains blocked by exactly three unsuppressed High Prisma-chain advisories.

## Completion Criteria

- Every feature directory maps to the approved feature/spec table.
- `app.vue` is a focused shell; timer lifecycle has one coordinator.
- Password auth, Account/Settings, `/tracker/`, API contracts, database results, dashboard privacy, context-switch count-only privacy, copy, accessibility, CSS, and responsive behavior match the baseline.
- All unit, component, PostgreSQL integration, typecheck, build, and browser parity gates pass.
- For Tasks 1–10 of the extraction itself, no backend, Prisma schema, migration, product behavior, runtime dependency, or commit was included. The later addendum above intentionally changed cross-cutting runtime behavior and the direct Vue pin to close final-review defects; no commit was created.
- Production readiness remains blocked until Task 9A's Prisma advisory reaches zero High findings.
