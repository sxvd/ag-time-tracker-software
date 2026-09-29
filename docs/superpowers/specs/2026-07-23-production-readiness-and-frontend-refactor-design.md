# Production Readiness And Frontend Feature Refactor Design

## Purpose

Define two coordinated but independently reviewable work tracks:

1. close the remaining security, persistence, operations, and release gaps in production-risk order; and
2. refactor the frontend into spec-aligned feature boundaries without changing its appearance, copy, API contracts, or behavior.

The production application remains the root Nuxt 3 application at `/tracker/`, using Nitro APIs, Prisma, and PostgreSQL. The Docker network alias remains `tracker`. The application under `aq-time-tracker-software/` remains reference-only legacy code and must not enter production workflows.

## Current Baseline

- The root Nuxt application is the production path.
- Auth sessions, task permissions, one-active-timer enforcement, persisted pauses, and audited entry editing use PostgreSQL.
- `frontend/app.vue` contains 1,345 lines and still coordinates authentication, navigation, API calls, timer state, tasks, entries, dashboards, Settings orchestration, Breezy Journey, medals, export, and insights.
- Existing focused frontend units include `AccountMenu.vue`, `SettingsPage.vue`, `IdleDecisionModal.vue`, `BreezyCompanion.vue`, `EntryEditModal.vue`, `FeedbackModal.vue`, `MetricChart.vue`, `useTheme.ts`, the theme bootstrap plugin, and safe authentication-error mapping.
- Password authentication automatically creates a missing exact-domain `@airgradient.com` account when explicitly enabled, hashes passwords with salted scrypt, and persists server-managed sessions. External identity-provider authentication is out of scope for the accepted current plan.
- Context switches are incremented atomically by an authenticated backend route, and idle Keep, Discard, and Split-as-break decisions persist idempotently to PostgreSQL.
- Retryable Breezy day and medal refresh uses persisted derived-refresh jobs.
- The latest verified baseline passes 76 unit tests, 34 component tests, 32 PostgreSQL integration tests, Nuxt typecheck, production build, and 13 production configuration checks.
- Task 9A's production audit remains blocked by a newly disclosed Prisma configuration dependency advisory. This blocks release approval but does not change the accepted frontend runtime contract used for structural refactoring.

## Global Product And Technical Constraints

- Company dashboards remain visible to every authenticated AirGradient user and remain aggregate and process-focused.
- Individuals see and export their own detailed records.
- Context-switch tracking stores counts only. It never stores URLs, application names, website names, page titles, screenshots, keystrokes, screen contents, or destinations.
- No billing, hourly rate, salary, earnings, payroll, or client-billing behavior is introduced.
- Server routes enforce authentication and ownership or accepted task membership.
- Every Prisma schema change receives a new append-only migration.
- The frontend refactor does not modify backend behavior, database schema, API route shape, visible copy, CSS appearance, or workflow semantics.
- Each implementation batch ends at a verification gate before the next batch begins.

## Track A: Production Readiness

### Priority Order

| Priority | Change | Reason |
|---|---|---|
| P0 | Harden password registration and sessions | Enforces exact company-domain input, password policy, salted hashes, safe errors, and persisted session revocation |
| P0 | Persist context switches atomically | Removes the client-provided total as the source of truth |
| P0 | Isolate the legacy application | Prevents accidental inclusion or deployment of the old runtime |
| P0 | Prove clean migration, backup, restore, rollback, and health checks | Establishes a reproducible release and recovery path |
| P1 | Add retryable Breezy and medal refresh | Prevents permanently stale derived records after a committed entry |
| P1 | Complete idle Keep, Discard, and Split-as-break | Closes a core workflow that is currently marked complete inaccurately |
| P2 | Run full accessibility and browser release verification | Produces evidence against the current PostgreSQL runtime |
| P2 | Correct milestones and feature specs | Keeps documented status aligned with verified behavior |

### Password Authentication Decision

The accepted current authentication flow uses one email-and-password form. The server normalizes and validates the exact `@airgradient.com` suffix, applies the 8–1,024 character password policy before lookup, verifies existing salted scrypt hashes, and automatically creates a missing company-email account only when `NUXT_ALLOW_SELF_REGISTRATION` explicitly enables provisioning.

Successful authentication creates the existing persisted application session. Logout revokes that server-side session. Safe policy errors may identify invalid input, while an existing account with incorrect credentials receives the generic `Invalid email or password.` response. This internal-only model does not prove mailbox ownership, so deployment remains inside the trusted organizational access boundary. External identity providers, mailbox verification, MFA, password reset, and administrative session management are outside the accepted current scope.

## Track B: Frontend Feature Refactor

### Refactor Boundary

The refactor baseline is captured after the accepted password registration, Account/Settings, server-authoritative context-switch, and idle-decision contracts are stable. Task 9A's unresolved upstream Prisma advisory continues to block production release approval, but it does not authorize or require a frontend behavior change.

The refactor itself is structural only:

- identical rendered copy and interaction order;
- identical API paths, methods, payloads, and response handling;
- identical timer, pause, feedback, task, dashboard, export, and session behavior;
- identical CSS selectors and responsive appearance;
- no new state-management or UI dependency;
- no backend, Prisma, deployment, or feature-spec behavior changes in refactor commits.

### Chosen Architecture

Use incremental feature slices with Vue composables and typed props/events. Do not add Pinia. `app.vue` remains the top-level shell and owns only authentication gating, navigation selection, and coordination between feature surfaces.

```text
frontend/
├── app.vue
├── assets/
│   └── main.css
├── components/
│   └── MetricChart.vue
├── composables/
│   ├── useTrackerApi.ts
│   ├── useAppNavigation.ts
│   └── useTheme.ts
├── types/
│   └── api.ts
└── features/
    ├── auth/
    ├── settings/
    ├── tasks/
    ├── tracking/
    ├── feedback/
    ├── dashboard/
    ├── breezy/
    ├── medals/
    ├── export/
    └── insights/
```

Files that are already focused may move into their owning feature without changing their public props, emitted events, markup, or styles. `main.css` remains a single file during this refactor to reduce visual-regression risk.

### Feature-To-Spec Ownership

| Frontend feature | Owning feature specs |
|---|---|
| `auth` | `01-authentication-profile` |
| `settings` | `01-authentication-profile`, `05-idle-context-settings` |
| `tasks` | `02-tasks-categories-collaboration` |
| `tracking` | `03-timer-tracking-entries`, `05-idle-context-settings` |
| `feedback` | `04-feedback-blockers` |
| `dashboard` | `06-personal-dashboard`, `07-company-dashboard` |
| `breezy` | `08-breezy-companion`, `09-breezy-journey` |
| `medals` | `10-medals` |
| `export` | `11-raw-data-export` |
| `insights` | `12-ai-insights` |
| Cross-cutting tests and contracts | `13-data-persistence-audit`, `14-accessibility-verification` |

Sign-in and session lifecycle belong to `auth`. The approved full Settings surface spans profile plus activity/privacy preferences and therefore remains one `settings` code slice owned jointly by Features 01 and 05. Timer-time idle and visibility listeners remain in `tracking`. A feature directory may contain components, a composable, and feature-local types when they change together; empty scaffolding directories are not created.

### Frontend Data Flow

```text
app.vue shell
  -> shared session/navigation state
  -> typed feature props
  <- typed domain events
  -> feature or shared composable
  -> useTrackerApi
  -> existing Nitro API
```

Feature presentation components do not call Prisma, access backend utilities, or mutate another feature's state. Cross-feature operations remain coordinated at the narrowest common owner. Timer lifecycle state stays in one timer coordinator so visibility, idle, pause, elapsed-time, and cleanup behavior cannot drift across components.

### Refactor Sequence

1. Capture a behavior baseline with characterization tests and browser evidence.
2. Extract frontend API types without changing runtime behavior.
3. Extract the base-aware authenticated API client.
4. Extract theme and navigation coordination.
5. Extract `auth`.
6. Extract `tasks`.
7. Extract `feedback` and entry forms.
8. Extract `dashboard`.
9. Extract `medals`, `export`, and `insights`.
10. Extract `breezy`.
11. Extract `tracking` and its timer coordinator last because it has the highest state-transition risk.
12. Reduce `app.vue` to the shell and run the complete parity gate.

Each numbered extraction is independently reviewable and revertible. A failed parity gate stops the refactor before the next feature moves.

### Refactor Verification Strategy

Before extraction, record:

- sign-in and session restoration;
- task creation, sharing, invitation acceptance, and inline task selection;
- start, pause, refresh, resume, context switch, idle decision, stop, and feedback;
- manual entry and entry editing;
- personal and aggregate company dashboards;
- Breezy Journey, medals, settings, insights, and CSV/JSON export;
- desktop and 390-pixel mobile layouts;
- keyboard navigation, active states, polite Breezy announcements, and reduced motion;
- browser console and failed network requests.

After every batch:

1. run the focused component or composable tests;
2. run the complete unit suite;
3. run Nuxt typecheck with development dependencies installed;
4. run the production build when types, auto-imports, or component boundaries change;
5. browser-check the affected workflow;
6. compare visible copy, accessible names, event order, API calls, and key CSS classes to the baseline.

The final refactor gate repeats the production browser checklist against a migrated PostgreSQL test database. Refactor completion is not claimed from typecheck or unit tests alone.

## Combined Execution Order

The two tracks are sequenced as follows:

1. harden and verify password registration and persisted sessions;
2. implement server-authoritative context switches;
3. isolate legacy production inputs;
4. implement retryable derived refresh and the complete idle decision workflow;
5. verify production operations and remediate production dependency findings where compatible fixes exist;
6. capture the post-behavior-change frontend baseline;
7. execute the frontend feature refactor in small batches;
8. complete the feature-gap audit;
9. prove the final clean-database release candidate after the dependency gate is clear;
10. update milestones and feature specs with exact evidence.

Production operations work that does not touch frontend contracts may proceed independently, but the refactor baseline must not be captured before the accepted authentication and timer workflow changes are complete.

## Success Criteria

- An internal user authenticates through the accepted password-registration flow with exact-domain validation, salted password hashing, and a revocable persisted application session.
- Every authenticated AirGradient user can access aggregate company insight without access to another person's private raw records.
- Context-switch and idle data are server-authoritative and privacy-preserving.
- Core entry mutations cannot permanently strand Breezy or medal state.
- Legacy code is absent from production build and deployment inputs.
- A clean database can be migrated, seeded, tested, backed up, restored, and rolled back through documented commands.
- Frontend behavior and appearance remain unchanged across the structural refactor.
- `app.vue` becomes a small top-level shell and feature code is discoverable from the corresponding feature spec.
- Tests, build, browser evidence, and documentation agree on the final production state.
