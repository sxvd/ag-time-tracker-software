# 10 Medals And Collection

Source: extracted from the preserved full brief in `docs/spec.md`.

## Summary

Medals are lightweight recognition for healthy, honest, and useful tracking patterns. They should feel rewarding without making the product competitive or punitive.

## Users

- Individuals browsing their own medal collection.

## Scope

- Extendable medal set where adding a medal is a config/data change, not a code rewrite.
- Categories: time-based, team-based, consistency-based, topic-based, air-and-clarity, rhythm-and-rest, focus, honesty-and-self-knowledge, Breezy milestones.
- Example medals include In the Zone, Fresh Air, Honest Reviewer, Steady Breeze, Hydrated, Clear Skies, Blue Sky Day, Cleared the Haze, Deep Breath, Well Watered, Sustainable Pace, Single-Tasker, Flow State, Straight Shooter, Pattern Spotter, Took Stock, Breezy's Best Day.
- Users can browse their collection.
- At least two medals should be awardable in the main demo flow.

## Out Of Scope

- Public leaderboards.
- Competitive medal rankings.
- Monetary rewards.

## UI Reference

The Personal Dashboard ASCII mock in `docs/spec.md` shows Medals as one compact two-column table with the shared headers `Medal` and `Status`. A medal's meaning appears directly beneath its name/status row.

## Functional Requirements

- Medal eligibility is derived from user-owned sessions and Breezy days.
- Medals are user-specific.
- Awarded medals show award state and date when persisted.
- Unawarded medals can be visible as collection goals.
- Medal logic should be easy to extend.
- The Personal Dashboard medal summary uses one shared `Medal`/`Status` header row, a primary row for each medal, a secondary meaning row directly beneath it, and the status labels `Awarded` and `Waiting`.

## Data And API

Relevant target data:

- `medals`
- `user_medals`
- `time_entries`
- `entry_feedback`
- `entry_blockers`
- `breezy_days`

Relevant current files:

- `backend/utils/store.ts`
- `shared/utils/time.ts`
- `frontend/features/medals/MedalCollection.vue`
- `frontend/features/dashboard/PersonalDashboard.vue`

## Current Implementation

- `awardMedals` returns medal codes from persisted session summaries; Sustainable Pace requires at least five minutes of persisted pause/rest time and is not awarded for kept or discarded idle.
- `buildMedals` maps persisted medal definitions to awarded/unawarded state.
- `MedalCollection.vue` renders the Personal Dashboard summary as a semantic two-column table with shared Medal and Status headers. Each description is linked to its medal and rendered in a secondary row; unawarded medals are labelled Waiting.

## Gaps

- Medal definitions are seeded into `medals`.
- Awards are persisted to `user_medals` when tracked or manual entries update derived records.
- Persisted `user_medals` records include `awardedAt`; the current `ApiMedal` shape and `MedalCollection` summary do not expose or render that date.
- The medal collection UI is a dashboard summary, not a full browsable collection.
- Component contracts cover the shared two-column table header, associated meaning rows, and Awarded/Waiting presentation states for the current summary.
- Team-based and Breezy milestone categories are not fully represented.

## Acceptance Criteria

- Users can browse awarded and unawarded medals.
- Medal eligibility is derived from persisted user data.
- Adding a new medal does not require rewriting core medal logic.
- Demo data awards at least two medals.
- Medals do not create public or company-facing performance rankings.
- The Personal Dashboard shows one shared two-column medal table header rather than repeating labels or splitting medals into independent columns; each meaning is directly below the medal it explains.

## Tests And Verification

- Unit tests for medal award conditions.
- Integration tests cover persisted medal award creation, retry/idempotency, and actual-break-only Sustainable Pace semantics.
- Browser check: complete Great flow session with blocker, confirm relevant medals appear.
