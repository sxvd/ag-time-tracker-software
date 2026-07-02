# 08 Breezy Companion

Source: extracted from the preserved full brief in `docs/spec.md`.

## Summary

Breezy is the companion layer of the product. Breezy encourages focus, reacts to session quality, nudges healthy habits, and keeps the product calm rather than guilt-tripping.

## Users

- Individuals tracking work sessions.
- Users revisiting their work habits through Breezy mood and Journey history.

## Scope

- Reusable Vue component for Breezy.
- States: idle, happy, cheering, waving, sipping water, sleepy.
- Non-blocking toast/notification system.
- Mute and verbosity controls: quiet, gentle, chatty, plus global mute.
- Mood reflects recent habits: breaks, feedback, great-flow sessions, steady tracking.
- Supportive session-start line.
- Encouragement during long focus stretches.
- Take a Break button with supportive hydration reminder.
- Ventilation/air nudges on a configurable cadence, default around 90 minutes.
- Great-flow celebration.

## Out Of Scope

- Shame-based productivity scoring.
- Blocking modals for habit nudges.
- LLM-generated emotional coaching as a core dependency.

## UI Reference

The original main timer mockup references Breezy:

```text
| AirGradient Time Tracker         Breezy: happy  [mute] [user] |
...
| 00:42:18    [Start] [Pause] [Stop]   [Take a Break]           |
|                                                               |
| Breezy: "You're in the zone, keep going."                     |
```

## Functional Requirements

- Breezy mood should update based on recent habits and session state.
- Breezy messages must stay supportive and non-punitive.
- Users can mute Breezy globally.
- Users can set Breezy verbosity.
- Breezy nudges should be dismissable and screen-reader friendly.
- Long sessions can trigger focus encouragement and ventilation/hydration nudges.
- A Great flow session triggers a small celebration.

## Data And API

Relevant target data:

- `settings.breezy_verbosity`
- `settings.nudge_cadence_minutes`
- `breezy_nudges`
- `breezy_days`
- `time_entries`
- `entry_feedback`

Relevant current files:

- `frontend/components/BreezyCompanion.vue`
- `frontend/app.vue`
- `backend/utils/store.ts`
- `shared/utils/time.ts`

## Current Implementation

- `BreezyCompanion.vue` renders Breezy with mood, muted state, message, and polite live region.
- `frontend/app.vue` computes mood from active timer state and latest journey data.
- `frontend/app.vue` updates Breezy messages on start, pause, resume, stop, and manual entry flows.
- Settings include muted and Breezy verbosity in persisted user settings.
- Great flow can trigger a celebratory message and motion key.

## Gaps

- Breezy is currently image-based, not an expressive SVG character with all named states.
- There is no persisted `breezy_nudges` runtime flow.
- Ventilation/hydration nudge cadence is not fully implemented.
- Verbosity levels do not substantially alter message behavior.
- There is no dedicated toast/notification system.
- Dedicated `breezy_nudges` persistence is present in the schema but is not yet wired as a full runtime notification flow.

## Acceptance Criteria

- Breezy appears in the main app shell/timer area.
- Breezy changes mood based on session state and recent work habits.
- Start, long focus, break, hydration/ventilation, and Great flow moments produce supportive messages.
- Users can mute Breezy and adjust verbosity.
- Breezy nudges are accessible and non-blocking.

## Tests And Verification

- Unit tests for mood derivation where possible.
- Component tests for muted state and message rendering.
- Browser check: start timer, pause/take break, stop with Great flow, confirm Breezy reactions and mute behavior.
