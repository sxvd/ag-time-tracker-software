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
- System-managed supportive message behavior; mute and verbosity remain persisted for compatibility but are not exposed in the current Settings UI.
- Mood reflects recent habits: breaks, feedback, great-flow sessions, steady tracking.
- Supportive session-start line.
- Encouragement during long focus stretches.
- Take a Break button with supportive hydration reminder.
- Ventilation/air nudges on a system-managed cadence, default around 50 minutes.
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
- Breezy mute and verbosity remain supported internally but are not user-facing controls in the current Settings UI.
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

- `frontend/features/breezy/BreezyCompanion.vue`
- `frontend/features/breezy/BreezyNudgeToast.vue`
- `frontend/features/breezy/useBreezyRuntime.ts`
- `frontend/features/breezy/useBreezyNudges.ts`
- `frontend/app.vue`
- `tests/component/breezy.test.ts`
- `backend/api/breezy-nudges/claim.post.ts`
- `backend/api/breezy-nudges/[id].patch.ts`
- `backend/utils/breezy-nudges.ts`
- `backend/utils/store.ts`
- `shared/utils/time.ts`

## Current Implementation

- `frontend/features/breezy/BreezyCompanion.vue` renders Breezy with mood, muted state, message, animation key, and polite live region.
- `frontend/features/breezy/breezyRuntime.ts` is the pure presentation contract for Breezy runtime events. It resolves semantic mood, visible label, copy, announcement, celebration, dismissible nudge identity, and image-pool selection without Vue, browser, or persistence dependencies.
- `frontend/features/breezy/mascotCatalog.ts` groups all 22 approved mascot images by state. The companion must rotate within the resolved semantic pool, avoid immediate repeats, and dispose its interval when unmounted.
- `frontend/features/breezy/useBreezyRuntime.ts` owns the current typed event, restores timer and Journey state without announcing it, recomputes presentation from account settings, and increments celebration motion only for unmuted Great-flow saves.
- `frontend/features/breezy/useBreezyNudges.ts` owns the single polling lifecycle. It claims once immediately and then every 30 seconds while eligible, prevents overlapping requests, rejects stale responses, restores a pending nudge without repeating its announcement, and acknowledges only an explicit dismissal.
- `frontend/features/breezy/BreezyNudgeToast.vue` renders the persisted server message as a non-blocking `role="status"` notification with a keyboard-accessible Dismiss action. Restored notifications use `aria-live="off"`; newly claimed notifications use polite announcements.
- The authenticated claim and acknowledgement routes derive ownership from the session. PostgreSQL serializes claims for an active entry, so concurrent signed-in tabs share one persisted nudge rather than creating duplicates.
- Cadence uses working time after pauses and excluded idle. The first cadence nudge is hydration, later cadence nudges alternate ventilation and hydration, and long focus is emitted once after 45 working minutes.
- `frontend/app.vue` composes the runtime and scheduler. Timer, idle, feedback, entry, and task workflows publish typed events rather than mutating display strings. Toasts and claims are suppressed when the timer is inactive or paused, Breezy is muted or quiet, or a feedback, idle-decision, manual-entry, entry-edit, new-task, share-task, or settings-save surface is active.
- Persisted settings still include muted and Breezy verbosity for compatibility, but the current Settings UI does not expose them. Current account-settings saves and the legacy settings route ignore client-supplied Breezy overrides and enforce `nudgeCadenceMinutes = 50`, `breezyVerbosity = gentle`, and `muted = false`.
- Great flow can trigger a celebratory message and motion key.

## Locked Presentation Contract

Visible labels are stable UI copy and must not expose raw Journey mood values. The runtime maps ready, task-required, session-started, session-paused, session-resumed, idle-returned, idle-saved, session-saved, manual-entry-saved, entry-updated, invitation-sent, invitation-accepted, long-focus, hydration, and ventilation events to semantic presentations.

- `Ready when you are`
- `Choose a task`
- `Focus in progress`
- `Taking a break`
- `Welcome back`
- `Time saved`, `Time updated`, and `Break recorded`
- `Session saved` and `Great flow`
- `Manual entry saved` and `Entry updated`
- `Invitation sent` and `Shared task joined`
- `Breezy is muted`

`session-paused` uses: “Your timer is paused. Take a breath or grab some water.” A Great-flow session uses: “Great flow. You found a strong rhythm today.” Nudge copy is always the exact server-provided message; the frontend does not duplicate or rewrite persisted nudge text.

| Verbosity | Nonessential presentation behavior |
| --- | --- |
| quiet | No message or live announcement; no celebration motion. |
| gentle | Show and politely announce concise ready, timer (including a normal session save), break, idle, Great-flow, and proactive nudge messages. Task-required, invitation, manual-entry, and edit confirmations remain status-only. |
| chatty | Additionally show task-required, invitation, manual-entry, and edit confirmation copy. Add a small supportive extension to non-nudge messages and politely announce them; persisted nudge text remains unchanged. |

Global mute takes precedence over every event: it presents the `Breezy is muted` label with no message, announcement, celebration, or dismissible nudge. Great-flow celebration is available only when Breezy is not muted.

Ready presentation can normalize a recent Journey mood into a supported companion mood, but raw mood labels are never shown. Breezy Journey itself remains unchanged by this runtime contract.

## Gaps

- No known Breezy Companion runtime functional gap remains in the automated and executed browser acceptance scope.
- Forced `prefers-reduced-motion` visual acceptance was not executed because the controlled browser reported `reduce=false` and exposes no media-emulation control. The CSS media rule remains present; component tests verify celebration motion-key behavior, but they do not replace a forced visual browser check.
- Every suppression flag is covered by scheduler/component tests. The current browser release check re-verified paused, modal, Quiet, and Muted suppression, but did not freshly exercise every individual modal with a live pending toast.
- Breezy Journey aggregation, medals, and removal of legacy profile-team behavior belong to other M7 feature surfaces and are not changed by this companion runtime.

## Acceptance Criteria

- [x] Breezy appears in the main app shell/timer area with a human-readable semantic label and no duplicate timer message.
- [x] Breezy changes mood and presentation based on timer, break, saved-entry, Great-flow, and recent Journey state.
- [x] Start, pause, resume, long focus, hydration/ventilation cadence, Great flow, manual-entry, and entry-edit moments resolve to the locked supportive presentation contract.
- [x] Breezy uses a system-managed default presentation in the current UI, while persisted mute/verbosity compatibility remains covered by runtime tests.
- [x] Proactive nudges persist once per eligibility boundary, survive reload, do not duplicate across concurrent tabs, and are acknowledged only by Dismiss.
- [x] Breezy nudges are non-modal, use a polite live region for new notifications, avoid repeated announcements after restore, and expose a keyboard-operable Dismiss button.
- [x] The 390px layout keeps Timer before Breezy and contains the card and toast without page-level horizontal scrolling.
- [ ] Forced reduced-motion visual browser acceptance remains unexecuted in the controlled browser; automated contracts and the CSS media rule cover the behavior.

## Tests And Verification

- Clean host unit suite: 29 files and 195 tests passed.
- Component suite: 11 files and 93 tests passed.
- A freshly rebuilt Docker aggregate suite passed 195 unit tests and 54 PostgreSQL integration tests against `ag_time_tracker_test`; all six migrations applied with none pending.
- Lint, the `/tracker/` production build, all 16 `verify:production` checks, and `git diff --check` passed.
- Browser acceptance covered Ready, Start, Pause, Resume, Great flow, Manual entry, Edit entry, Gentle and Chatty verbosity, System/Light/Dark themes, real two-minute Ready-pool mascot rotation, 390px layout, keyboard dismissal, and concurrent-tab persistence/deduplication. No browser console warning or error was observed.
- Detailed commands, browser evidence, restored preferences, and limitations are recorded in `docs/verification/breezy-runtime-2026-09-02.md`.
