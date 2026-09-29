# 14 Accessibility And Verification

Source: extracted from the preserved full brief in `docs/spec.md`.

## Summary

Accessibility and verification are cross-cutting quality requirements. The app should be usable by keyboard and assistive technology, and feature work should be verified with the fastest useful checks.

## Users

- All app users, including keyboard and screen-reader users.
- Developers and reviewers validating product behavior.

## Scope

- Clear labels for all buttons.
- Keyboard-accessible timer controls.
- Labelled feedback radio groups and blocker checkboxes.
- Active dashboard tab and filter states that are visually and semantically distinguishable.
- Breezy nudges that are dismissable by keyboard and use polite live regions.
- Color must not be the only signal for quality states.
- Respect `prefers-reduced-motion`.
- Unit, component, API/integration, and E2E/browser verification where appropriate.

## Out Of Scope

- Screenshot creation for every test step unless explicitly requested.
- Full accessibility certification as part of every small change.

## UI Reference

This is a quality spec and has no dedicated UI mockup.

## Functional Requirements

- Timer controls support keyboard operation.
- Feedback form fields have associated labels.
- Blockers are selectable by keyboard.
- Main navigation exposes active state.
- Breezy announcements use polite live regions, not disruptive alerts.
- Motion-heavy Breezy effects respect reduced-motion preferences.
- Browser console and network failures are checked during main-flow verification.

## Data And API

Relevant current files:

- `frontend/features/feedback/FeedbackModal.vue`
- `frontend/features/tracking/IdleDecisionModal.vue`
- `frontend/features/tracking/TimerPanel.vue`
- `frontend/features/dashboard/EntryHistory.vue`
- `frontend/features/dashboard/CompanyDashboard.vue`
- `frontend/features/breezy/BreezyCompanion.vue`
- `frontend/features/breezy/BreezyJourney.vue`
- `frontend/components/MetricChart.vue`
- `frontend/app.vue`
- `frontend/assets/main.css`
- `tests/unit/time.test.ts`
- `tests/unit/invitations.test.ts`

## Current Implementation

- Many controls use native buttons, inputs, radios, checkboxes, and labels.
- Entry-history scope controls remain native buttons in a labelled group, and the target company category filter remains a labelled native select sourced from the same categories as Track.
- `BreezyCompanion.vue` uses `aria-live="polite"`; its mute state keeps the image mood label and companion message coherent.
- `BreezyJourney.vue` preserves labelled Journey controls and the existing marker button labels while keeping Journey data personal.
- CSS includes responsive media queries and reduced-motion handling.
- `TimerPanel.vue` preserves native keyboard-operable timer actions, exact accessible labels, task-input focus forwarding, and live timer/stat presentation; `IdleDecisionModal.vue` retains labelled dialog semantics and first-action focus.
- `frontend/app.vue` is the authenticated shell and composes the feature-owned controls without duplicating their interaction logic.
- Unit tests exist for time utilities and invitations.
- Component contracts cover the authenticated/unauthenticated shell, native control labels, dialogs, timer action order/states, feedback fields, dashboard filters, Breezy live/motion markup, and responsive feature boundaries.
- `docs/milestones.md` and `docs/verification/frontend-refactor-baseline.md` record the final desktop/390px browser evidence and known blockers.

## Gaps

- There is no Playwright E2E suite for the full user journey.
- There is no dedicated automated accessibility scanner/certification suite; current evidence is semantic component coverage plus browser inspection.
- Forced `prefers-reduced-motion` rendering is unavailable in the current in-app Browser, although the stylesheet rule and component motion contract are covered separately.
- The controlled Browser cannot emit a native background-tab visibility change; context-switch persistence has API-assisted, unit, and PostgreSQL integration evidence instead.

## Acceptance Criteria

- Core workflows are keyboard accessible.
- Feedback and blocker controls are labelled and operable.
- Active navigation/filter states are clear without relying only on color.
- Breezy nudges are accessible and dismissable.
- Fast useful checks pass before reporting done, or blockers are recorded plainly.

## Tests And Verification

- `npm.cmd run test` for unit tests on Windows.
- Type check/build when touching shared types, Nuxt runtime, or production behavior.
- Component tests for timer, idle decision, feedback, and Breezy Companion/Journey contracts; the timer checks include button labels/states, action order, live values, classes, and task focus, while the Breezy checks include polite announcements, mute state, mood/motion state, and labelled Journey points.
- API tests for auth, tasks, timer, feedback, export, and AI fallback.
- Browser check for sign in, create task, start/pause/resume/stop, feedback, manual entry, personal dashboard, company dashboard, Breezy Journey, export, console, and network failures.
- Final refactor gate on 2026-09-01: 111 unit tests, 77 component tests, 32 PostgreSQL integration tests, Nuxt typecheck, production build, desktop `1280 x 720`, and mobile `390 x 844` passed. Browser controls exposed their expected semantic names and no console warning/error was observed.
- Post-review hardening gate on 2026-09-01: 114 unit tests, 77 component tests, 44 PostgreSQL integration tests, Nuxt typecheck, production build, 16 production-configuration checks, a rebuilt Docker test image, and a built production-runner `/tracker/` health/export smoke passed. No Browser backend was available for a fresh visual rerun, so the prior visual evidence is retained without claiming a new browser pass.
