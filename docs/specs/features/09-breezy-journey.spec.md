# 09 Breezy Journey

Source: extracted from the preserved full brief in `docs/spec.md`.

## Summary

Breezy Journey is a calm personal timeline of completed work. In navigation it is labelled `Work Journey` so users immediately understand it is their work history. It turns tracked entries into a weekly task timeline, with Breezy mood details available when the user selects a completed task segment.

## Users

- Individuals reviewing their own work patterns over time.

## Scope

- Weekly journey view for the selected period. Do not show a nested `Day / Week / Month` selector or duplicate `Track / Dashboard / Work Journey` navigation inside the Journey card.
- The weekly view shows one row per day and one rounded segment per completed task.
- The left day rail shows weekday, date, and tracked time; empty days say `No tracked tasks`.
- The X axis represents tracked hours and is labelled `Tracked hours`. Show a default 0-8 hour scale.
- Each segment still represents one completed task, but segment length represents tracked time spent on that task.
- Breezy markers use one fixed Journey mascot asset (`/mascots/mascot-journey.png`) across the whole page and do not rotate or randomize.
- Each task segment can be clicked or keyboard-activated to inspect the task memory in a popover anchored to that segment: title, date, duration, mood, feedback, blocker, breaks, and context-switch count.
- `Write onboarding copy` in the mockup is sample popover content only; production should show the actual clicked or selected task.
- Mood and clarity derive from hours, breaks, feedback, blockers, great-flow sessions, and context switches.
- Use a single primary visualization style: the weekly completed-task timeline.
- Recompute affected Breezy days and weekly task timeline data when entries are edited.
- Derive Journey from persisted entries and `breezy_days`, not hard-coded chart data.

## Out Of Scope

- Multiple competing Journey visualizations.
- Shame-based streaks.
- Public sharing or team comparison of personal Journey data.

## UI Reference

The current `docs/spec.md` includes this Breezy Journey reference:

```text
Breezy Journey:
PERSONAL · PRIVATE
Work Journey                                                      [ < ] [ Aug 31 - Sep 6, 2026 v ]
Revisit completed tasks, time spent, and task memories for the selected week.          12 tasks · 8h 24m tracked
[cal] Your completed-task timeline.

                         │
Mon  Aug 31              │ [ Software task        ] [ Research task      ] (Breezy)
     2h 10m tracked      │ ···············································································
                         │
Tue  Sep 1               │ [ Software task        ] [ selected task                         ] [ Research task     ] [ Communication task ] (Breezy)
     2h 45m tracked      │                         ╰────────────── anchored task popup ───────────────╮
                         │                                +----------------------------------------+    │
                         │                                | Write onboarding copy              x   |    │
                         │                                | [cal] Sep 1, 2026    [time] 56 min     |    │
                         │                                | Mood       Clear                       |    │
                         │                                | Feedback   Good flow                   |    │
                         │                                | Blocker    Waiting for review          |    │
                         │                                | -------------------------------------- |    │
                         │                                | 1 break                                |    │
                         │                                | 3 context switches                     |    │
                         │                                +----------------------------------------+    │
                         │
Wed  Sep 2               │ [ Software task  ] [ Hardware task                     ] [ Research task ] (Breezy)
     1h 40m tracked      │ ···············································································
                         │
Thu  Sep 3               │ [ Software task      ] (Breezy)
     45m tracked         │ ···············································································
                         │
Fri  Sep 4               │ [ Production task ] [ Software task        ]
     1h 04m tracked      │ ···············································································
                         │
Sat  Sep 5               │ No tracked tasks
Sun  Sep 6               │ No tracked tasks
                         │____________________________________________________________________________________
                         0       1       2       3       4       5       6       7       8
                                                   Tracked hours

[blue] [cyan] [mint] [pale] Each segment = one completed task memory · Segment length = tracked time
Popover text is sample content only; show the actual clicked or selected task in production.
Source: persisted entries, feedback, blockers, pauses, context-switch counts, and breezy_days rollups.
```

## Functional Requirements

- A Breezy day is created for each meaningful tracked work day.
- Breezy mood and air clarity are derived from session quality and healthy habits.
- Week view shows Monday-Sunday rows with tracked-time summaries and completed-task segments.
- The X axis is labelled `Tracked hours` with a default 0-8 hour scale; each segment equals one completed task and segment length equals tracked time.
- Clicking or keyboard-activating a segment opens an anchored detail popover without navigating away. The popover stays open until the user closes it, changes week, or selects another segment.
- Historical weeks can be selected without leaving the page.
- The Journey should feel personal, calm, and rewarding.
- The timeline itself should not have a separate filled graph background; keep only the day divider, row guides, task segments, Breezy marker, popover, and X axis on the surrounding page/card surface.
- Editing an entry updates the affected Breezy day and Journey segment data.

## Data And API

Relevant target data:

- `breezy_days`
- `time_entries`
- `entry_feedback`
- `entry_blockers`
- `entry_pauses`

Relevant current files:

- `backend/utils/store.ts`
- `shared/utils/time.ts`
- `frontend/app.vue`
- `frontend/features/breezy/BreezyJourney.vue`
- `tests/component/breezy.test.ts`

## Current Implementation

- `deriveBreezyDay` computes mood and air clarity from session summaries and credits only persisted pause/rest seconds, not idle kept as work or discarded idle.
- `buildJourney` reads persisted Breezy days and combines them with persisted entry hours.
- `frontend/features/breezy/BreezyJourney.vue` renders the weekly completed-task timeline shown above; `frontend/app.vue` supplies persisted Journey, entries, tasks, and categories.
- The app navigation labels this destination `Work Journey`, while the feature remains Breezy Journey in the product model.

## Gaps

- Journey is derived from persisted `breezy_days`, with an on-demand fallback for existing entries without rollups.
- Weekly aggregation is simplified and index-based rather than a stable calendar-week aggregate.
- Completed-entry editing is implemented and enqueues a retryable recomputation of the affected user's Breezy days and medals.
- There is no dedicated API for Breezy Journey data.
- PostgreSQL integration tests cover Breezy-day persistence, retry/idempotency, edited-entry refresh, and break-credit semantics. Stable calendar-week aggregation remains unimplemented.

## Acceptance Criteria

- Tracked work creates or updates a Breezy day.
- Breezy Journey defaults to a Monday-Sunday weekly completed-task timeline.
- The selected period summary shows completed task count and tracked time.
- Each day row shows weekday, date, daily tracked time, and completed-task segments.
- Clicking or keyboard-activating a segment shows task-memory details: title, date, duration, mood, feedback, blocker, breaks, and context switches.
- Journey data is derived from persisted `breezy_days`.
- Editing an entry recalculates affected daily and weekly Journey data.
- The Journey uses a single calm visualization style.

## Tests And Verification

- Component tests cover the empty weekly Journey scaffold, completed-task segments, tracked-hours scale, anchored task-memory popover, and fixed Journey mascot asset in `tests/component/breezy.test.ts`.
- Unit tests for Breezy day derivation.
- Integration tests cover create/update/retry of persisted Breezy days and prove only actual persisted pause time receives healthy-break credit.
- Browser check: track completed sessions, open Work Journey, confirm Monday-Sunday rows, tracked-hours axis, task segments, fixed Breezy marker, and anchored task-memory popover.
