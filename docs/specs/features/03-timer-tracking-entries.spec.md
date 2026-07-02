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
- Record pauses and calculate duration.
- Add manual/retroactive entries.
- Edit existing entries.
- Flag manual and edited entries.
- Maintain a history log.
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
- Editing an entry recalculates duration, idle seconds, estimate-vs-actual metrics, Breezy days, medals, and dashboards.
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
- `backend/api/manual-entry.post.ts`
- `backend/utils/store.ts`
- `shared/utils/time.ts`

## Current Implementation

- `startEntry` creates an active persisted entry after checking task membership.
- `stopEntry` stores stop time, idle seconds, context switches, pauses, feedback, blockers, and calculated duration through Prisma.
- `createManualEntry` creates retroactive manual entries, records an audit event, and validates `endedAt > startedAt`.
- `shared/utils/time.ts` calculates duration, pauses, idle decisions, context switches, estimate variance, Breezy day derivation, and medals.
- `frontend/app.vue` handles live elapsed time, local pause/resume, stop feedback, manual entry form, and entry history display.

## Gaps

- Runtime entries are persisted to PostgreSQL.
- There is no edit-entry endpoint or full edit-entry UI.
- `time_entries` includes `is_edited` and `updated_at` in the Prisma schema.
- `entry_audit_events` is present in the Prisma schema.
- Pause windows are only submitted on stop, not persisted during an active paused state.
- Overlap validation is limited to active timer checks.
- Editing does not yet trigger Breezy day and medal recomputation because editing is not implemented.

## Acceptance Criteria

- A user can start, pause, resume, and stop a task timer.
- Live elapsed time updates accurately and excludes pauses/idle decisions.
- A stopped session saves feedback and blockers.
- A manual entry is flagged manual.
- An edited entry is flagged edited and recalculates all derived metrics.
- Invalid dates and overlapping active timers are rejected.

## Tests And Verification

- Unit tests for duration, pause handling, overlap validation, and estimate variance.
- API tests for start, stop, manual entry, edit entry, and ownership enforcement.
- Browser check: create/select task, start, pause, resume, stop, save feedback, add manual entry, edit entry.
