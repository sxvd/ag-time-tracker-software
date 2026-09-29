# 05 Idle Detection, Context Switches, And Settings

Source: extracted from the preserved full brief in `docs/spec.md`.

## Summary

Passive tracking gives users a fuller picture of a session without collecting invasive activity details. The app detects idle time, counts context switches, and lets users control related settings.

User-facing copy uses `inactive time`, `no activity`, and `inactivity threshold` because they are clearer than `idle`. Internal types, API fields, and database columns retain `idle` terminology for compatibility.

## Users

- Individuals who want honest but privacy-preserving work-session data.
- Company dashboard viewers using aggregated context-switch trends.

## Scope

- Detect idle time with a configurable threshold, defaulting to 5 minutes.
- On return from idle, offer keep, discard, or split-as-break.
- Count context switches when the browser tab becomes hidden or the browser window loses focus.
- De-duplicate the paired blur/visibility events browsers commonly emit for one switch.
- Store context-switch counts only.
- Never store destination URLs, app names, website names, or private activity details.
- Provide settings for profile details, idle threshold, activity opt-in, location opt-in, and location labels. Appearance stays in the account popover, while Breezy nudge cadence and message style are system-managed for now.

## Out Of Scope

- Browser history collection.
- Native desktop activity monitoring or identifying which application received focus.
- Screenshots.
- Keystroke logging.
- Automatic productivity scoring.

## UI Reference

The original `docs/spec.md` does not include a dedicated ASCII mockup for this feature. It is represented across the main timer, Settings/Profile area, and dashboard requirements.

### 2026-08-07 Design Extension

This extension records the approved account entry point and full Settings layout without changing the preserved original brief.

```text
Sidebar
+------------------------+
| Main navigation        |
|                        |
|                        |
| [M] Mog             >  |  <- account trigger
|     Software           |
+------------------------+
             |
             v
Account popover
+----------------------------+
| Mog                        |
| mog@airgradient.com        |
| Software                   |
+----------------------------+
| Settings                >  |
| Theme                      |
| [System] [Light] [Dark]    |
+----------------------------+
| Log out                    |
+----------------------------+
```

```text
Settings
Manage your profile, preferences, and privacy.

+ Profile ------------------------------------------------+
| Display name  [ Mog                  ]                  |
| Team          [ Software            v]                  |
+----------------------------------------------------------+

+ Activity & Privacy ------------------------------------+
| Track activity signals                             [On] |
| Ask me after no activity for        [ 5 ] minutes       |
| Privacy guardrail: switch counts only; no URLs,         |
| app names, titles, screenshots, or keystrokes.          |
| Use location labels on entries                    [Off] |
| Manage location labels [ Add a label, e.g. Home office] |
+----------------------------------------------------------+

                              [Save changes]
```

The account trigger is a keyboard-accessible button. Its non-modal popover uses labelled dialog semantics because it contains navigation, a theme radio group, and Log out rather than only menu commands. Click, Enter, or Space opens it; Escape and outside pointer interaction close it; Escape restores focus to the trigger.

Theme uses `system`, `light`, or `dark`. System is the default, follows `prefers-color-scheme` in real time, and can be overridden locally. Theme applies immediately and stays browser-local so it can resolve before authentication and first render.

All current Settings UI saves use one `Save changes` action and one authenticated `PATCH /api/account-settings` request. The server validates the profile and Activity & Privacy payload, then enforces system-managed Breezy defaults before writing profile plus settings in one Prisma transaction. A network-uncertain response is reconciled through bootstrap and the mutation is not retried automatically.

Field limits and dependencies:

- Display name is required after trimming and is at most 100 characters.
- Team is required and uses the same canonical list as task categories: Software, Hardware, Firmware, Communication, Research, Commerce, Production, Other.
- `Ask me after no activity for` is an integer from 1 through 240 minutes in the UI and remains `idleThresholdMinutes` in persisted data.
- Breezy nudge cadence is system-managed at 50 minutes by default and remains persisted for compatibility. Client-supplied cadence values are ignored by current account-settings saves.
- Breezy message style and mute remain stored for compatibility but are not exposed in the current Settings page. Client-supplied values are ignored and reset to `gentle` / unmuted by current account-settings saves.
- Activity and location preferences are Boolean.
- Location labels contain at most 20 unique non-empty trimmed values, each at most 100 characters.
- Activity off disables idle-threshold editing and suppresses new idle/context-switch events without deleting the saved threshold or historical counts.
- Location off prevents labels from being applied to entries without blocking label-list editing or deleting saved labels.
- Save is disabled when unchanged, invalid, or saving; errors are associated with fields, server errors use an alert, and success uses a polite live region.

## Functional Requirements

- Idle threshold is configurable per user.
- Default idle threshold is 5 minutes.
- Returning from idle should let the user choose keep, discard, or split-as-break.
- Context switches are counted when the tab becomes hidden or the browser window loses focus.
- A blur immediately followed by a visibility change counts as one switch, not two.
- Activity tracking can be disabled.
- Location labels are opt-in and user-controlled.
- Settings persist for future sessions.
- Profile and settings persist atomically from one Settings page Save action.
- System is the default appearance and Light/Dark remain explicit browser-local overrides.
- Idle seconds and context-switch counts appear in exports and dashboards where relevant.

## Data And API

Relevant target data:

- `settings`
- `time_entries.idle_seconds`
- `time_entries.excluded_idle_seconds`
- `time_entries.context_switches`
- `time_entries.location_label`
- `entry_pauses`
- `entry_idle_decisions`

Settings fields are stored in `settings`; profile identity remains in `users`. Theme preference is intentionally not stored in PostgreSQL.

Relevant current files:

- `backend/api/account-settings.patch.ts`
- `backend/api/settings.patch.ts` (legacy-compatible route)
- `backend/utils/store.ts`
- `backend/utils/account-settings.ts`
- `shared/utils/time.ts`
- `shared/utils/theme.ts`
- `frontend/features/settings/AccountMenu.vue`
- `frontend/features/settings/SettingsPage.vue`
- `frontend/features/settings/useAccountSettings.ts`
- `frontend/features/tracking/IdleDecisionModal.vue`
- `frontend/features/tracking/useIdleActivity.ts`
- `frontend/composables/useTheme.ts`
- `frontend/app.vue`

## Current Implementation

- `settings` persists idle threshold, nudge cadence, Breezy verbosity, mute, location/activity flags, and location labels.
- The current Settings page exposes profile and Activity & Privacy in responsive desktop/mobile layouts. System/Light/Dark stays in the account popover. Breezy cadence/message preferences are system-managed and hidden from Settings for now.
- `account-settings.patch.ts` derives identity from the authenticated session, validates current Settings fields, enforces system-managed Breezy defaults, and persists profile plus settings in one Prisma transaction. The older `settings.patch.ts` remains legacy-compatible for Activity & Privacy fields, ignores hidden Breezy fields, and is not used by the current Settings UI.
- `useAccountSettings.ts` reconciles network-uncertain saves through authenticated bootstrap without repeating the mutation.
- Activity off disables the inactivity threshold and suppresses new idle/context-switch events; Location labels off prevents labels from being applied to entries while preserving and still allowing edits to the saved label list.
- System theme follows OS appearance changes; existing Light/Dark values remain explicit local overrides and the head bootstrap prevents an initial wrong-theme flash.
- `frontend/features/tracking/useIdleActivity.ts` owns the `visibilitychange`, window `blur`, mouse, and keyboard listeners; de-duplicates paired focus-loss events; serializes count-only context-switch requests; ignores replacement-entry responses; and opens one idle prompt when activity resumes after the threshold.
- `frontend/features/tracking/IdleDecisionModal.vue` explains that no keyboard or mouse activity was detected, offers keyboard-accessible Keep as work, Exclude this time, and Save as break actions, and focuses the first decision.
- `timer-idle.post.ts` validates ownership and idle intervals before persisting an idempotent decision.
- Keep records total idle without reducing tracked duration; Discard increments excluded idle; Split records a closed pause.
- The server enforces Activity off, rejects overlapping intervals even when tabs use different decision IDs, and reconciles an identical decision-ID retry without double counting.
- Timer start and manual entry creation store no location while Location is off. When Location is on, only an explicitly requested label already present in the user's saved labels is accepted; no implicit default label is written. Editing preserves an existing historical label unless the user clears it, while selecting a different label requires current consent and an allowed saved label.
- Bootstrap restores total idle, excluded idle, and pause state from PostgreSQL.
- `shared/utils/time.ts` includes `applyIdleDecision` and `countContextSwitches`.
- Exports include idle seconds, context switches, and location label.
- Component tests cover the account dialog, Settings draft/validation/dependencies, theme actions, atomic shell request, and uncertain-response reconciliation.
- Focused idle/activity unit tests cover restoration, one prompt per interval, all three idempotent decisions, activity-off suppression, serialized visibility requests, stale-entry protection, and exact listener cleanup.

## Gaps

- Browser focus loss can indicate that the user switched tabs, windows, or applications, but the web app cannot reliably distinguish which occurred.
- The app does not perform native desktop monitoring and never records the destination, app name, URL, title, screenshot, or keystroke.
- The current timer panel does not yet expose a location-label selector, so consent-aware labels can be accepted by the API but are not selectable during timer start in the current UI.

## Acceptance Criteria

- The app detects idle time after the configured threshold.
- On return, the user can keep idle time, discard it, or split it as a break.
- Context switches are counted without storing destinations.
- Settings persist across sessions.
- Exports include idle seconds, context switches, location label, and manual flag.

## Tests And Verification

- Unit tests for idle decisions and context-switch counting.
- Component or browser tests for idle-return decision UI.
- Focused component coverage for the inactivity dialog's labelled semantics, accessible action labels, autofocus, and emitted decision values.
- API tests for settings update and persistence.
- PostgreSQL tests cover Activity-off rejection, overlapping intervals from different IDs, idempotent lost-response retries, consent-aware timer/manual/edit location persistence and export, authoritative split-as-break preservation during edits, and serialized stop/idle behavior.
- Browser check: configure threshold, trigger idle, select decision, switch tabs or applications, stop session, and confirm one saved count per focus-loss action.
