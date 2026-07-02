# 09 Breezy Journey

Source: extracted from the preserved full brief in `docs/spec.md`.

## Summary

Breezy Journey is a calm personal timeline of working days. It turns tracked sessions into Breezy moods and air clarity over weeks and months.

## Users

- Individuals reviewing their own work patterns over time.

## Scope

- Calendar or timeline of Breezy days across weeks and months.
- Each meaningful tracked day records a Breezy mood and air clarity score.
- Mood and clarity derive from hours, breaks, feedback, blockers, great-flow sessions, and context switches.
- Time axis uses month names such as March, April, May.
- Weekly points aggregate daily scores into one stable point per week.
- Use a single visualization style.
- Recompute affected Breezy days and weekly aggregates when entries are edited.
- Derive Journey from persisted `breezy_days`, not hard-coded chart data.

## Out Of Scope

- Multiple competing Journey visualizations.
- Shame-based streaks.
- Public sharing or team comparison of personal Journey data.

## UI Reference

The original `docs/spec.md` includes this Breezy Journey reference:

```text
Breezy Journey:
+------------------------------------------------------------------------------------------------+
| Breezy Journey                                                   [ Timeline ] [ Calendar ] [ Moods ] |
| A calm look back at weekly Breezy days, moods, and clear-air moments.                              |
|                                                                                                |
| [ March ] [ April ] [ May ] [ June ]                                      [ 6 Breezy days saved ] |
+------------------------------------------------------------------------------------------------+
|             March                         April                              May                  |
|                                                                                                |
|   +-------------------+  +-------------------+  +-------------------+  +-------------------+     |
|   | Calm          o   |  | Clear         o   |  | Cloudy       --   |  | Light         o   |     |
|   | steady focus      |  | deep work         |  | small blockers    |  | easy handoff     |     |
|   +-------------------+  +-------------------+  +-------------------+  +-------------------+     |
|                                                                                                |
|       (^_^)                                                                         (^_^)        |
|        |                                                                              |          |
|        |            (^o^)                         (^_^)                               |          |
|        |             |                              |                                  |          |
|   =====*======.......*....                         .*.....................             |          |
|          \                  \                     /                    \              |          |
|           \                  \        (^_^)      /                      \             |          |
|            \                  \        |        /                        \            |          |
|             \                  \_______*_______/                          \____       |
|              \                                                                    \   |
|               \                                                                    \  |
|                *          *          *          *          *          *          *     |
|               W1         W2         W3         W4         W5         W6         W7     |
|                                                                                                |
|                                  +-------------------+  +-------------------+                 |
|                                  | Bright        o   |  | Settled       o   |                 |
|                                  | best day          |  | good rhythm       |                 |
|                                  +-------------------+  +-------------------+                 |
|                                                                                                |
|                                      *          *          *          *          *              |
|                                      W8         W9         W10        W11        W12            |
+------------------------------------------------------------------------------------------------+
| o Deep work    o Clear air    o Admin    o Friction            Each Breezy holds a saved task memory |
| Source: persisted breezy_days rolled up to one point/week.                                      |
+------------------------------------------------------------------------------------------------+
```

## Functional Requirements

- A Breezy day is created for each meaningful tracked work day.
- Breezy mood and air clarity are derived from session quality and healthy habits.
- Weekly points aggregate daily clarity scores, mood counts, break habits, and great-flow sessions.
- Labels use month names, not relative labels like `-1w`.
- The Journey should feel personal, calm, and rewarding.
- Editing an entry updates the affected Breezy day and weekly aggregate.

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

## Current Implementation

- `deriveBreezyDay` computes mood and air clarity from session summaries.
- `buildJourney` reads persisted Breezy days, combines them with persisted entry hours, and adds month-based week labels.
- `frontend/app.vue` renders a Journey section with month pills, saved-day count, visual road/timeline, mood cards, and clarity text.

## Gaps

- Journey is derived from persisted `breezy_days`, with an on-demand fallback for existing entries without rollups.
- Weekly aggregation is simplified and index-based rather than a stable calendar-week aggregate.
- Edited-entry recomputation is not implemented because entry editing is not implemented.
- There is no dedicated API for Breezy Journey data.
- There are no integration tests for Breezy day persistence or weekly aggregation.

## Acceptance Criteria

- Tracked work creates or updates a Breezy day.
- Breezy Journey shows month-labelled weekly points.
- Journey data is derived from persisted `breezy_days`.
- Editing an entry recalculates affected daily and weekly Journey data.
- The Journey uses a single calm visualization style.

## Tests And Verification

- Unit tests for Breezy day derivation.
- Integration tests for create/update of persisted Breezy days.
- Browser check: track a session with Great flow, confirm a Journey point appears with month label.
