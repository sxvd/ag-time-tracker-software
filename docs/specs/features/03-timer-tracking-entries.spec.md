# 03 Timer And Tracking Entries

Source: extracted from the preserved full brief in `docs/spec.md`.

## Summary

The timer workflow records work sessions against tasks. Users can start, pause, resume, stop, and create or edit manual entries when they forgot to run the timer.

## Users

- Individuals tracking active work.
- Collaborators tracking time on shared tasks.

## Scope

- Start, stop, pause, and resume a timer attached to a task.
- Show live elapsed time.
- Require a selected or created task before tracking.
- Keep `New team task` as the primary Track-page collaboration action and present `Manual entry` as a lighter soft secondary button, because it is for retroactive recording rather than the main real-time tracking path. Individual work can still be created directly from the timer draft.
- Record pauses and calculate duration.
- Add manual/retroactive entries.
- Edit existing entries.
- Flag manual and edited entries.
- Maintain a history log.
- Paginate Today's entries in groups of five with previous/next navigation.
- Recalculate derived metrics after edits.
- Reject invalid or overlapping entries.

## Out Of Scope

- Billing timesheets.
- Payroll.
- Desktop background app tracking.

## UI Reference

The original `docs/spec.md` includes this main timer reference:

```text
Main Timer View:
+---------------------------------------------------------------+
| AirGradient Time Tracker         Breezy: happy  [mute] [user] |
| Today                                                         |
|                                                               |
| Task: [ Deep work: PCB layout review        v ]  Cat: [Deep v]|
| 00:42:18    [Start] [Pause] [Stop]   [Take a Break]           |
|                                                               |
| Breezy: "You're in the zone, keep going."                     |
|                                                               |
| Collaborators                                                |
| Alex Kim      ##########..........  42%  (tracking now)       |
| Mina Chen     ######..............  25%                       |
| [ Manage collaborators ]                                      |
|                                                               |
| Today's sessions                                              |
| 09:15  Deep work     1h 12m   Great flow                      |
| 11:00  Meeting       0h 30m   Friction   [Meetings overran]   |
| 13:20  Comms         0h 45m   Neutral                         |
|                                                               |
| [Personal] [Company] [Breezy Journey] [Medals] [Export]       |
+---------------------------------------------------------------+
```

The original `docs/spec.md` also includes this add/edit entry reference:

```text
Add / Edit Tracking Entry:
+---------------------------------------------------------------+
| History > Edit entry                                          |
+---------------------------------------------------------------+
| Task            [ PCB layout review                    v ]    |
| Category        [ (B) Deep work                       v ]      |
| Client/Project  [ AirGradient / Hardware review       v ]      |
| Start           [ 2026-06-10 09:15 ]                         |
| End             [ 2026-06-10 10:27 ]                         |
| Pause total     [ 00:05 ]   Manual: [x]   Edited: [x]        |
| Flow            (x) Great flow  ( ) Neutral  ( ) Friction     |
| Blockers        [x] Unclear requirements  [ ] Interruptions   |
| Note            [ clarified connector pinout.............. ]  |
|                                                               |
| [ Cancel ]                                      [ Save entry ]|
| Validation: end > start, no active overlap, user owns entry.  |
+---------------------------------------------------------------+
```

## Functional Requirements

- A timer cannot start without a task.
- A user cannot have overlapping active timers.
- Pause/resume creates pause windows that are excluded from duration.
- Stop opens the feedback flow.
- Manual entries require valid start and end times where end is after start.
- Users can edit their own entries for task, category, client/project, start/end, pauses, feedback, blockers, note, and location label.
- Editing an entry recalculates duration, Breezy days, medals, and dashboards while preserving server-authoritative idle totals, exclusions, decisions, and context-switch counts.
- Manual and edited entries are visibly flagged in history and exports.

## Data And API

Relevant target data:

- `time_entries`
- `entry_pauses`
- `entry_feedback`
- `entry_blockers`
- `entry_audit_events`
- `breezy_days`
- `user_medals`

Relevant current API files:

- `backend/api/timer-start.post.ts`
- `backend/api/timer-stop.post.ts`
- `backend/api/timer-pause.post.ts`
- `backend/api/timer-resume.post.ts`
- `backend/api/manual-entry.post.ts`
- `backend/api/entries/[id].patch.ts`
- `backend/utils/store.ts`
- `shared/utils/time.ts`

## Current Implementation

- `startEntry` creates an active persisted entry after checking task membership.
- Pause, resume, idle, and stop transitions serialize on the same locked active-entry row. `pauseActiveEntry` creates one server-timestamped open pause; `resumeActiveEntry` closes it and calculates pause duration on the server.
- `stopEntry` reloads state after acquiring the lock, closes any open pause at the stop timestamp, and calculates duration from the freshly persisted pauses and excluded idle before storing feedback and blockers.
- `createManualEntry` creates retroactive manual entries, records an audit event, and validates `endedAt > startedAt`.
- `updateEntry` edits completed entries owned by the authenticated user, validates task access/overlap and idle-decision bounds, replaces editable pauses/feedback/blockers in one transaction, preserves server-authoritative idle/context fields and split-as-break pause windows, and records before/after audit data.
- `shared/utils/time.ts` calculates duration, pauses, idle decisions, context switches, Breezy day derivation, and medals.
- `frontend/features/tracking/useTimerSession.ts` coordinates live elapsed time plus start/pause/resume mutations and restores persisted pause state from bootstrap data.
- `frontend/features/tracking/TimerPanel.vue` owns the existing timer/task markup, live readout, action labels and states, task-input focus forwarding, stats, and accessibility attributes.
- `frontend/features/feedback/useEntries.ts` coordinates stop feedback, manual entries, and owned-entry edits; focused feature components own their existing modal markup.
- `frontend/features/dashboard/EntryHistory.vue` renders Today's entries as semantic tables, five rows per page with previous/next navigation. Individual scope visibly labels Task, Time spent, Start → Finish, and Feeling, with an accessible visually hidden controls header and an icon-only Edit action; Team scope uses Task, Time spent, and Contributor. Entry rows contain values without repeating field labels, while Manual/Edited status and owned-entry editing remain available. Entry deletion is not exposed because no audited deletion workflow exists.

## Gaps

- Runtime entries are persisted to PostgreSQL.
- Derived refresh markers commit with entry mutations; synchronous processing records failure details and bootstrap retries unfinished Breezy/medal work.

## Acceptance Criteria

- A user can start, pause, resume, and stop a task timer.
- Live elapsed time updates accurately and excludes pauses/idle decisions.
- A stopped session saves feedback and blockers.
- A manual entry is flagged manual.
- An edited entry is flagged edited and recalculates all derived metrics.
- Invalid dates and overlapping active timers are rejected.

## Tests And Verification

- Unit tests for duration, pause handling, and overlap validation.
- API tests for start, stop, manual entry, edit entry, and ownership enforcement.
- PostgreSQL integration coverage for successful edits, audit data, export flags, task access, ownership, overlap rejection, and preservation of keep/discard/split decisions plus their authoritative break pause.
- PostgreSQL integration coverage includes pause/resume ownership, duplicate/racing pauses, stop/pause and stop/idle serialization, no terminal open pause, and duration consistency from locked state.
- Focused timer-session unit tests cover restoration, elapsed calculations, request ordering, missing-task focus, refresh replacement, and interval cleanup; TimerPanel component tests cover labels, states, live values, classes, action order, and focus forwarding.
- EntryHistory component coverage verifies scope-specific semantic headers, value-only rows, current Feeling/status output, the accessible icon-only Edit action, and the absence of an unsupported Delete action.
- Browser check: create/select task, start, pause, resume, stop, save feedback, add manual entry, edit entry.
