# 05 Idle Detection, Context Switches, And Settings

Source: extracted from the preserved full brief in `docs/spec.md`.

## Summary

Passive tracking gives users a fuller picture of a session without collecting invasive activity details. The app detects idle time, counts context switches, and lets users control related settings.

## Users

- Individuals who want honest but privacy-preserving work-session data.
- Company dashboard viewers using aggregated context-switch trends.

## Scope

- Detect idle time with a configurable threshold, defaulting to 5 minutes.
- On return from idle, offer keep, discard, or split-as-break.
- Count context switches via browser tab visibility.
- Store context-switch counts only.
- Never store destination URLs, app names, website names, or private activity details.
- Provide settings for idle threshold, nudge cadence, Breezy verbosity, mute, location opt-in, activity opt-in, and location labels.

## Out Of Scope

- Browser history collection.
- Desktop activity monitoring.
- Screenshots.
- Keystroke logging.
- Automatic productivity scoring.

## UI Reference

The original `docs/spec.md` does not include a dedicated ASCII mockup for this feature. It is represented across the main timer, Settings/Profile area, and dashboard requirements.

## Functional Requirements

- Idle threshold is configurable per user.
- Default idle threshold is 5 minutes.
- Returning from idle should let the user choose keep, discard, or split-as-break.
- Context switches are counted when the tab becomes hidden.
- Activity tracking can be disabled.
- Location labels are opt-in and user-controlled.
- Settings persist for future sessions.
- Idle seconds and context-switch counts appear in exports and dashboards where relevant.

## Data And API

Relevant target data:

- `settings`
- `time_entries.idle_seconds`
- `time_entries.context_switches`
- `time_entries.location_label`
- `entry_pauses`

Relevant current files:

- `backend/api/settings.patch.ts`
- `backend/utils/store.ts`
- `shared/utils/time.ts`
- `frontend/app.vue`

## Current Implementation

- `settings` persists idle threshold, nudge cadence, Breezy verbosity, mute, location/activity flags, and location labels.
- `settings.patch.ts` updates settings through Prisma.
- `frontend/app.vue` listens for `visibilitychange` to increment context switch count.
- `frontend/app.vue` listens to mouse and keyboard activity and increments idle seconds when activity resumes after the threshold.
- `shared/utils/time.ts` includes `applyIdleDecision` and `countContextSwitches`.
- Exports include idle seconds, context switches, and location label.

## Gaps

- Settings are persisted to PostgreSQL at runtime.
- There is no user-facing keep/discard/split-as-break decision flow.
- `applyIdleDecision` is tested but not fully wired into the UI.
- Context-switch counting is browser-tab based only, which matches privacy requirements but should be documented as a browser limitation.
- Location label editing is minimal and not a full settings workflow.

## Acceptance Criteria

- The app detects idle time after the configured threshold.
- On return, the user can keep idle time, discard it, or split it as a break.
- Context switches are counted without storing destinations.
- Settings persist across sessions.
- Exports include idle seconds, context switches, location label, and manual flag.

## Tests And Verification

- Unit tests for idle decisions and context-switch counting.
- Component or browser tests for idle-return decision UI.
- API tests for settings update and persistence.
- Browser check: configure threshold, trigger idle, select decision, switch tabs, stop session, confirm saved counts.
