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

The original `docs/spec.md` does not include a dedicated medals ASCII mockup. Medals appear in the main navigation and personal dashboard requirements.

## Functional Requirements

- Medal eligibility is derived from user-owned sessions and Breezy days.
- Medals are user-specific.
- Awarded medals show award state and date when persisted.
- Unawarded medals can be visible as collection goals.
- Medal logic should be easy to extend.

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
- `frontend/app.vue`

## Current Implementation

- `awardMedals` returns medal codes from persisted session summaries.
- `buildMedals` maps persisted medal definitions to awarded/unawarded state.
- `frontend/app.vue` shows medal summary cards in the personal dashboard.

## Gaps

- Medal definitions are seeded into `medals`.
- Awards are persisted to `user_medals` when tracked or manual entries update derived records.
- Award dates are not recorded by the current medal flow.
- The medal collection UI is a dashboard summary, not a full browsable collection.
- Team-based and Breezy milestone categories are not fully represented.

## Acceptance Criteria

- Users can browse awarded and unawarded medals.
- Medal eligibility is derived from persisted user data.
- Adding a new medal does not require rewriting core medal logic.
- Demo data awards at least two medals.
- Medals do not create public or company-facing performance rankings.

## Tests And Verification

- Unit tests for medal award conditions.
- Integration tests for persisted medal award creation.
- Browser check: complete Great flow session with blocker, confirm relevant medals appear.
