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

- `frontend/components/FeedbackModal.vue`
- `frontend/components/BreezyCompanion.vue`
- `frontend/components/MetricChart.vue`
- `frontend/app.vue`
- `frontend/assets/main.css`
- `tests/unit/time.test.ts`
- `tests/unit/invitations.test.ts`

## Current Implementation

- Many controls use native buttons, inputs, radios, checkboxes, and labels.
- `BreezyCompanion.vue` uses `aria-live="polite"`.
- CSS includes responsive media queries and reduced-motion handling.
- Unit tests exist for time utilities and invitations.
- `docs/milestones.md` records prior browser verification and known blockers.

## Gaps

- There are no component tests for timer controls or feedback form.
- There are no API/integration tests for most backend routes.
- There is no Playwright E2E suite for the full user journey.
- Accessibility has not been documented as an automated check.
- Some verification steps are blocked by external setup such as GitHub CLI or PostgreSQL availability.

## Acceptance Criteria

- Core workflows are keyboard accessible.
- Feedback and blocker controls are labelled and operable.
- Active navigation/filter states are clear without relying only on color.
- Breezy nudges are accessible and dismissable.
- Fast useful checks pass before reporting done, or blockers are recorded plainly.

## Tests And Verification

- `npm.cmd run test` for unit tests on Windows.
- Type check/build when touching shared types, Nuxt runtime, or production behavior.
- Component tests for timer and feedback.
- API tests for auth, tasks, timer, feedback, export, and AI fallback.
- Browser check for sign in, create task, start/pause/resume/stop, feedback, manual entry, personal dashboard, company dashboard, Breezy Journey, export, console, and network failures.
