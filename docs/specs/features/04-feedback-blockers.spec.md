# 04 End-Of-Session Feedback And Blockers

Source: extracted from the preserved full brief in `docs/spec.md`.

## Summary

End-of-session feedback captures how a work session felt. It turns subjective experience into structured personal reflection and aggregated process insight.

## Users

- Individuals reflecting on flow, efficiency, energy, and blockers.
- Company dashboard viewers looking at aggregated blocker and quality patterns.

## Scope

- Show a short feedback form after stopping a timer.
- Allow the form to be skipped.
- Store flow quality, efficiency feel, energy, optional note, and blockers as discrete fields.
- Support multi-select blocker tagging.
- Use the same feedback data in dashboards, Breezy day rollups, medals, and exports.

## Out Of Scope

- Long-form journaling.
- Manager review workflows.
- Sentiment scoring of free-text notes.

## UI Reference

The feedback modal uses international-friendly product wording while preserving the stored enum values used by dashboards and exports:

```text
End-of-session feedback:
+---------------------------------------------------------------+
| Work session saved                                            |
| Quick check-in                                                |
| Focus:      ( ) Smooth focus  ( ) Normal  ( ) Distracted      |
| Efficiency: ( ) Felt efficient ( ) Felt manual ( ) Felt wasteful|
| Energy:     ( ) Energized     ( ) Fine    ( ) Drained         |
| Any blockers? [ ] Waiting for someone [ ] Tool problem        |
|              [ ] Unclear task [ ] Interrupted                 |
|              [ ] Too much switching [ ] Meeting ran long      |
|              [ ] None                                         |
| Add a note: [ optional .................................... ] |
|                                  [Skip]  [Save feedback]      |
+---------------------------------------------------------------+
```

## Functional Requirements

- Stored flow quality values remain Great flow, Neutral, Friction; the feedback modal labels them as Smooth focus, Normal, Distracted.
- Stored efficiency feel values and visible labels remain Felt efficient, Felt manual, Felt wasteful.
- Stored energy values remain High, OK, Drained; the feedback modal labels them as Energized, Fine, Drained.
- Stored default blockers remain Waiting on someone, Tool was slow or broke, Unclear requirements, Interruptions, Context switching, Meetings overran, None; the feedback modal labels them as Waiting for someone, Tool problem, Unclear task, Interrupted, Too much switching, Meeting ran long, None.
- `None` should not combine with real blockers in saved feedback.
- Feedback is optional/skippable.
- Feedback must be stored as structured fields, not just text.
- Feedback and blockers participate in personal dashboard, company dashboard, Breezy Journey, medals, and export data.

## Data And API

Relevant target data:

- `entry_feedback`
- `blockers`
- `entry_blockers`
- `time_entries`

Relevant current files:

- `frontend/features/feedback/FeedbackModal.vue`
- `frontend/features/feedback/useEntries.ts`
- `backend/api/timer-stop.post.ts`
- `backend/utils/store.ts`
- `shared/utils/time.ts`

## Current Implementation

- `FeedbackModal.vue` provides radio groups for flow, efficiency, and energy plus blocker checkboxes and note.
- The modal can emit `skip`.
- `selectedBlockers` prevents `None` from staying selected with other blockers.
- `useEntries.ts` preserves feedback save/skip ordering, safe failure copy, and the timer-stop request boundary.
- `stopEntry` stores optional feedback and blockers as persisted `entry_feedback` and `entry_blockers` rows.
- `buildDashboards`, `deriveBreezyDay`, `awardMedals`, and `exportRows` consume feedback/blocker data.

## Gaps

- Feedback is persisted to PostgreSQL at runtime.
- API-level validation rejects invalid feedback and unknown blocker values.
- Skipped feedback behavior is represented by missing feedback, but acceptance expectations should be made explicit.
- Focused component tests cover feedback defaults, save/skip behavior, blocker exclusivity, stop ordering, and safe errors.
- There are no API/integration tests that verify discrete feedback persistence.

## Acceptance Criteria

- Stopping a timer opens a skippable feedback form.
- Saving feedback stores flow, efficiency, energy, note, and blockers as discrete fields.
- Skipping feedback still saves the time entry.
- Dashboards and exports reflect saved feedback and blockers.
- Company blocker views aggregate process friction without ranking individuals.

## Tests And Verification

- Component tests for selected radio/checkbox values and skip behavior.
- API tests for valid feedback save, skipped feedback, invalid values, and blocker shape.
- Browser check: stop timer, save Great flow plus a blocker, confirm dashboards and export include the data.
