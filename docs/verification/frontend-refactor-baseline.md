# Frontend Refactor Browser Baseline

Recorded: 2026-08-25  
Route: `/tracker/`  
Purpose: characterize the existing monolithic frontend before extraction. This file records behavior only; Task 0 must not change production frontend code.

## Automated Characterization

- `npm run test:component -- tests/component/app-contract.test.ts`: passed, 5/5 tests.
- Stable contracts cover the unauthenticated/authenticated shell and the main request shapes through the representative fixture.

## Browser Evidence

### Unauthenticated shell

| Check | Desktop (1280 x 720) | Mobile (390 x 844) |
| --- | --- | --- |
| Sign-in heading and work-email/password fields visible | Pass | Pass |
| Continue action visible | Pass | Pass |
| Horizontal document overflow | None | None |
| Console warnings/errors on initial route load | None | None |

The mobile viewport override was reset after verification.

### Authenticated workflows

The seeded Siri account was used only against localhost after action-time approval.

| Check | Evidence | Result |
| --- | --- | --- |
| Password sign-in and session refresh | Authenticated shell loaded; paused active entry and session remained after reload | Pass |
| First-account provisioning and password policy | Covered by provisioning/password-policy unit contracts; this browser pass deliberately reused a seeded account | Automated contract |
| Account and Settings | Account dialog, profile, privacy, Breezy, and full Settings controls reached | Pass |
| Theme | System was the default; Dark override applied; System was restored and followed the OS dark preference | Pass |
| Task/collaboration surfaces | Create-task modal, Share task control, pending-member presentation, and characterized task POST shape reached | Pass |
| Timer lifecycle | Started `Frontend refactor baseline smoke`, paused, refreshed, resumed, stopped, and saved feedback | Pass |
| Idle/context behavior | Prior native browser smoke passed idle handling and a real browser-tab switch; count-only privacy copy remained present | Pass with native evidence |
| Manual/edit surfaces | Manual entry dialog and populated edit-entry dialog reached | Pass |
| Personal dashboard | Hours, category views, AI Insights, medals, and CSV/JSON links reached | Pass |
| Company dashboard | Aggregate-only copy, category time, blockers, shared effort, and company insight reached; no individual ranking copy | Pass |
| Breezy Journey | Timeline/calendar/mood presentation and saved Breezy days reached | Pass |
| Mobile authenticated layout | Track, Account dialog, and Settings checked at 390 x 844 without horizontal overflow | Pass |
| Keyboard/accessibility contract | Controls expose semantic roles and accessible names; automated native Tab traversal was not reliable in the in-app browser | Characterized limitation |
| Reduced motion | Current browser did not request reduced motion; loaded styles contain a `prefers-reduced-motion` rule | Pass |
| Console/runtime failures | No browser console warning/error; web runtime logged no request failure during the flow | Pass |

No fresh invitation was submitted during this baseline because that would notify/alter another local demo user's collaboration state. The existing pending-member state and request contract characterize the surface without adding another invitation.

True OS/app switching and background-tab visibility cannot be reproduced reliably by an automated in-app tab. The production-readiness evidence records that the real browser-tab context-switch smoke passed; desktop application switching is intentionally outside the browser-tab visibility contract.

## Task 1: Shared API Types

- Frontend API type contract: passed, 4/4 tests.
- Existing application contract: passed, 5/5 component tests.
- Nuxt typecheck: passed.
- Production build: passed.
- Browser bootstrap: authenticated shell and persisted entries rendered from PostgreSQL.
- Browser entry editing: the existing entry editor opened with its selected task, time fields, and pause window intact; it was closed without saving.
- Browser console warnings/errors during the focused check: none.

## Task 2: Authenticated API Client

- Base-aware API and URL contracts: passed, 5/5 tests.
- Existing application and Account/Settings contracts: passed, 9/9 component tests.
- Nuxt typecheck: passed.
- Production build: passed.
- Cookie credentials, tab bearer-token precedence, token restore/clear, error propagation, and CSV/JSON export URLs remain characterized without adding retry behavior.

## Task 3: Navigation And Password Authentication

- Navigation and authentication unit contracts: passed, 7/7 tests.
- Authentication/session and application component contracts: passed, 16/16 tests.
- Lint and production build: passed.
- Browser password policy: a seven-character password showed `Password must be at least 8 characters.`
- Browser email policy: a non-company address showed `Please use your @airgradient.com email.`
- Browser automatic registration: created the local smoke account `refactor@airgradient.com`; PostgreSQL recorded the `Refactor` user and its application sessions.
- Browser session lifecycle: registration, reload restoration, logout, and password sign-in all returned the expected shell state.
- Browser navigation: Track, Personal dashboard, Company dashboard, Breezy Journey, Account, and Settings all reached their expected headings without changing labels or ordering.
- Browser console warnings/errors during the focused flow: none.

## Task 4: Account And Settings

- Account-settings orchestration unit contracts: passed, 4/4 tests.
- Account menu, Settings page, shell integration, and application contracts: passed, 39/39 tests.
- Nuxt typecheck and production build: passed.
- Account dialog: identity, Settings, System/Light/Dark, and Log out remained available with the same labels and semantics.
- Dialog interaction: Escape closed the dialog and restored focus to the account trigger; an outside pointer action also closed it.
- Theme: System remained the default, Dark applied immediately, and restoring System followed the current OS dark appearance.
- Settings validation and dependencies: invalid display name disabled Save; activity off disabled idle threshold; location off disabled label editing without removing labels.
- Settings persistence: the local `refactor@airgradient.com` smoke account saved a 91-minute nudge cadence, restored it after refresh, then saved and verified the original 90-minute value in PostgreSQL.
- Responsive check: Settings and Account dialog fit the 390 px override without horizontal document overflow; the override was reset afterward.
- Browser console warnings/errors during the focused flow: none.

## Task 10: Final Shell And Parity Gate

Recorded: 2026-09-01.

- `frontend/app.vue` is 473 lines and retains authentication gating, page composition, bootstrap state, and cross-feature coordination. The only final cleanup was removal of the unreachable `takeBreak()` helper; the motion input supplied to Breezy was retained because it is part of the component contract.
- The duplicate-declaration scan for `interface ApiState`, `function authFetch`, `function syncTimer`, and `function handleVisibility` returned no matches in `frontend/app.vue`.
- `npm run test`: passed, 111/111 unit tests.
- `npm run test:component`: passed, 77/77 component tests.
- `npm run lint` and `npm run build`: passed.
- The exact Docker aggregate command passed. A fresh rebuilt image then confirmed 111/111 unit tests and 32/32 PostgreSQL integration tests with all six migrations applied.
- Desktop (`1280 x 720`) and mobile (`390 x 844`) checks passed with no horizontal overflow. Mobile Track used the one-column layout, the sidebar became static, and Account, Settings, both dashboards, and Breezy Journey fit the viewport. The override was reset to `1280 x 720`.
- Password sign-in, refresh-backed pause restoration, logout, Account, full Settings, System/Light/Dark, task creation/invitation, timer start/pause/reload/resume, a real one-minute idle return, Keep as work, feedback-before-stop, feedback save, manual entry, entry edit, personal/company insights, medals, export URLs, team filtering, and Breezy Journey were exercised against localhost.
- PostgreSQL confirmed the idle threshold was restored to 5 minutes with activity on and location off. It also confirmed one pending local task invitation, the completed timer entry with 76 idle seconds and count-only context value `0`, and a manual entry marked both manual and edited.
- Personal and company insight state remained isolated; the company view retained aggregate-only/process copy and did not render the personal suggestion.
- Browser console warnings/errors were empty. One deliberate edit attempt against a session containing a sub-minute pause returned the existing validation message `pauses[0] must end after it starts.` because the editor represents pause timestamps to minute precision; a pause-free manual entry edit then persisted successfully. This is a pre-existing product edge case and was not changed by the frontend-only refactor.
- The controlled in-app second tab kept the tracker document `visible`, so it could not produce a native `visibilitychange`; the displayed count remained `0`. Task 9's API-assisted persistence evidence and automated serialization/privacy coverage remain the truthful context-switch evidence for this Browser surface.
- API paths, methods, payload bodies, accessible labels, action ordering, and key CSS classes remain covered by the full unit/component contracts; the browser run confirmed the corresponding visible and persisted workflows without adding a network interceptor.
- Reduced-motion rendering could not be force-emulated by this Browser. The unchanged `prefers-reduced-motion` CSS rule and Breezy component motion contract remain the available evidence.

## Cleanup

- Responsive viewport override: reset.
- Theme preference: restored to System.
- Activity tracking remained on, idle threshold was restored to 5 minutes, and location remained off.
- Temporary runtime services: stopped after the browser pass.
