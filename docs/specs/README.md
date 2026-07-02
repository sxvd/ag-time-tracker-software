# Split Feature Specs

This directory reorganizes the existing full product brief from `docs/spec.md` into feature-level specs. The original `docs/spec.md` is intentionally kept unchanged as the preserved source brief.

Use these files when planning or implementing feature work:

- `features/01-authentication-profile.spec.md`
- `features/02-tasks-categories-collaboration.spec.md`
- `features/03-timer-tracking-entries.spec.md`
- `features/04-feedback-blockers.spec.md`
- `features/05-idle-context-settings.spec.md`
- `features/06-personal-dashboard.spec.md`
- `features/07-company-dashboard.spec.md`
- `features/08-breezy-companion.spec.md`
- `features/09-breezy-journey.spec.md`
- `features/10-medals.spec.md`
- `features/11-raw-data-export.spec.md`
- `features/12-ai-insights.spec.md`
- `features/13-data-persistence-audit.spec.md`
- `features/14-accessibility-verification.spec.md`

Each feature spec keeps the same structure:

- Summary
- Users
- Scope
- Out of scope
- UI reference, using the original ASCII mockup when one exists
- Functional requirements
- Data/API notes
- Current implementation
- Gaps
- Acceptance criteria
- Tests and verification

When behavior changes, update the relevant feature spec and keep `docs/milestones.md` honest about completed work and blockers.
