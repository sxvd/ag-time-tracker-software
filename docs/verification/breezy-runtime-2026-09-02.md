# Breezy Runtime Verification

Recorded: 2026-09-04  
Release plan: `docs/superpowers/plans/2026-09-02-breezy-runtime.md`  
Route and base path: `/tracker/`  
Database used by the Docker integration run: `ag_time_tracker_test`

## Scope

This release gate covers the Breezy presentation runtime, semantic mascot pools, persisted long-focus and cadence nudges, concurrent claim behavior, explicit acknowledgement, mute and verbosity behavior, modal suppression, responsive layout, and accessibility of the non-blocking notification.

It does not close the separate Profile, Medal, or Breezy Journey work grouped under milestone M7.

## Automated Verification

The generated Nuxt state was removed before running the release gate. Verification exposed that clean-state tests depended on generated Nuxt files; package lifecycle hooks were updated so test commands run Nuxt prepare themselves. The commands below are the successful reruns after that fix.

| Command | Verified result |
| --- | --- |
| `npm run test` | Passed from clean generated state: 29 files, 195 tests. |
| `npm run test:component` | Passed: 11 files, 93 tests. |
| `docker compose -p ag-time-tracker-software -f docker-compose.dev.yml build test` followed by `docker compose -p ag-time-tracker-software -f docker-compose.dev.yml run --rm test` | Fresh image passed 195 unit tests and 54 PostgreSQL integration tests against `ag_time_tracker_test`; six migrations applied and none remained pending. |
| `npm run lint` | Passed. |
| `NUXT_APP_BASE_URL=/tracker/ npm run build` | Passed with the production base path `/tracker/`. |
| `npm run verify:production` | Passed all 16 checks. |
| `git diff --check` | Passed. |

The clean-state gate also exposed mobile page overflow. The responsive grid now uses `minmax(0, 1fr)` and page-level overflow containment; intentionally wide tabular content retains its own internal horizontal scrolling. Regression tests were added for both the clean-state test lifecycle and responsive overflow behavior.

Non-failing output included the known parent-checkout Nuxt tsconfig warning, Node's experimental localStorage warning in component workers, and Prisma's deprecated `package.json#prisma` configuration warning. The fresh Docker `npm ci` audit summary reported four all-dependency findings (three high and one critical); the separately tracked production-only gate remains at three high Prisma-chain findings and no production critical finding. This Breezy plan did not suppress or accept either audit result.

## Desktop Browser Acceptance

The current release was exercised at `/tracker/`.

| Check | Evidence | Result |
| --- | --- | --- |
| Ready and timer lifecycle | Ready, Start, Pause, Resume, and Great-flow save showed their expected human-readable transitions. The timer did not repeat Breezy's message. | Passed |
| Entry workflows | Manual-entry save and entry edit produced their expected Breezy transitions. | Passed |
| Themes | System, Light, and Dark were inspected. No console warning or error was observed. | Passed |
| Verbosity | Gentle showed the locked concise behavior. Chatty added the supportive Ready extension and, after a real entry edit, displayed `Entry updated. Its history and daily rollups were refreshed.` with the Chatty supportive extension. The account was restored to Gentle afterward. | Passed |
| Mascot cadence | During a real two-minute interval, the Ready-pool image changed from `mascot-hello` to `mascot-standard`; both belong to the Ready pool. | Passed |
| Persisted claim and reload | A persisted hydration notification appeared in both signed-in tabs with the same identity. PostgreSQL showed exactly one unacknowledged nudge row. | Passed |
| Explicit acknowledgement | Dismiss was activated from the keyboard. Reloading the other signed-in tab removed the acknowledged notification. | Passed |
| Suppression and restore | Paused, open-modal, Quiet, and Muted states suppressed the notification; the pending notification was restored when eligible without a repeated live announcement. | Passed |
| Console | No browser console warning or error was observed during the acceptance flow. | Passed |

The Task 5 browser run used the same release and additionally verified that an eligible cadence claim produced one toast, that explicit Dismiss persisted acknowledgement across reload, and that the user's settings were restored afterward.

## Responsive And Accessibility Acceptance

At a 390px browser viewport, the content viewport measured 375px. TimerPanel preceded Breezy. The Breezy card and toast each measured 343px and remained within the content viewport; no page-level horizontal scrolling was observed. Wide tables retained local scrolling.

The new nudge notification exposed `role="status"` with `aria-live="polite"`. Its Dismiss control was reached after 20 Tab presses and activated with Enter. After reload, a restored pending notification used `aria-live="off"`, preventing the same message from being announced again. Meaning remained available through text and labels rather than depending on the mascot image or animation.

## Persistence Evidence

Two concurrently signed-in tabs presented the same hydration notification. Direct database inspection showed exactly one unacknowledged row, demonstrating that the server-side claim transaction prevented duplicate persistence across tabs. After keyboard dismissal and acknowledgement, reload in the second tab no longer displayed that notification.

The integration suite covers authenticated ownership, input validation, cadence and long-focus eligibility, working-duration calculations, concurrent claims, alternating hydration/ventilation cadence, acknowledgement, and isolation between users.

## Cleanup

- Nudge cadence restored to 90 minutes.
- Breezy verbosity restored to Gentle.
- Global Breezy mute restored to off.
- No active timer remained.
- The test nudge was acknowledged.

## Evidence Limitations

- The controlled browser reported `prefers-reduced-motion: reduce` as false and did not expose media emulation. Forced reduced-motion visual browser acceptance was therefore not executed. The `prefers-reduced-motion` CSS rule is present and component tests verify celebration motion-key behavior, but they do not replace a forced visual browser check.
- Paused, modal, Quiet, and Muted suppression were exercised in the current release, but not every individual suppression modal was freshly opened with a live pending toast. Unit and component scheduler tests cover every required suppression flag: feedback, idle decision, manual entry, entry editor, new task, share task, and settings save.
- Desktop and responsive screenshots were captured interactively in the Codex browser, but that browser session did not provide a filesystem artifact export. This document therefore records the observed measurements and results without claiming attached screenshot files.
