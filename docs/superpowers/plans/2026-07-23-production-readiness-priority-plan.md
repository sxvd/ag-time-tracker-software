# Production Readiness Priority Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring the root Nuxt/PostgreSQL tracker to a production-ready state by closing authentication, server-authoritative activity, data-recovery, deployment-isolation, maintainability, and release-verification gaps in risk order.

**Architecture:** Preserve the root Nuxt 3 application as the only production application. Authentication issues the existing persisted application session; all later frontend behavior goes through base-aware authenticated Nitro APIs that enforce ownership and persist PostgreSQL state through Prisma. Stabilize authentication, security, and data correctness before incrementally splitting `frontend/app.vue`.

**Tech Stack:** Nuxt 3, Vue 3, TypeScript, Nitro/H3, Prisma 6, PostgreSQL 16, Vitest, Docker Compose.

## Global Constraints

- Production base URL remains `/tracker/`; the Docker network alias remains `tracker`.
- All core production state goes through backend API routes and PostgreSQL.
- Context-switch tracking stores counts only—never URLs, application names, page titles, screenshots, keystrokes, or browsing history.
- Company views remain aggregated and must not rank individuals.
- Every Prisma schema change gets a new migration; existing migrations are not edited.
- Do not add billing, rate, salary, earnings, or client-billing fields.
- The legacy `aq-time-tracker-software/` application remains available for reference but is excluded from production build and deployment workflows.
- Password registration must accept only `@airgradient.com` email addresses, create missing accounts automatically in production, require at least 8 characters, accept at least 64 characters, hash passwords server-side with a unique salt, and never store or log plaintext passwords.
- The user requested no commits during execution. Each task uses RED → GREEN → full verification and ends at an uncommitted review checkpoint.

---

## Priority Summary

| Priority | Work | Production reason |
|---|---|---|
| P0 | Remove Google OIDC and harden automatic company-email registration | The approved authentication path is password registration for `@airgradient.com` accounts |
| P0 | Persist context-switch counts atomically | Current stop request trusts a client-provided count |
| P0 | Isolate the legacy application | Prevent accidental legacy code inclusion or deployment |
| P0 | Clean-database deploy and rollback/backup runbook | A build is not releasable until migration and recovery paths are proven |
| P0 | Remove high/critical production dependency advisories | A build with known remotely reachable framework or runtime advisories is not deployable |
| P1 | Make Breezy/medal refresh retryable | Entry commits must not leave derived records permanently stale |
| P1 | Complete idle keep/discard/break flow | Current milestone says complete, but the user decision workflow is missing |
| P1 | Split API/types and timer behavior out of `app.vue` | Reduce change risk before further UI work |
| P2 | Split page-sized UI sections from `app.vue` | Maintainability and focused component verification |
| P2 | Full browser/accessibility evidence and truthful milestones | Release evidence must match the current PostgreSQL runtime |

## Recommended Execution Tracks

For the shortest safe production path, execute:

1. Tasks 1 → 2 → 3 (registration lock, authoritative data, legacy isolation).
2. Tasks 4 → 5 (data recovery and missing core idle workflow).
3. Task 9 (operations and recovery runbook).
4. Task 9A (production dependency security remediation).
5. Refresh and execute the dedicated frontend feature-refactor plan, then audit remaining feature-spec gaps.
6. Task 10 (final clean-database release candidate).

Tasks 6 → 8 are replaced by the dedicated frontend feature-refactor plan. That plan was refreshed on 2026-08-25 against Nuxt 3.21.10 and the current password-registration, Account/Settings, context-switch, and idle contracts. Structural frontend work may proceed while Task 9A waits for an upstream-compatible Prisma fix, but the unresolved High advisory continues to block production release approval and Task 10. Complete the refactor and feature-gap audit before running Task 10 as the final release candidate.

### Current Password Policy Decision

The approved authentication path is automatic password registration for `@airgradient.com` accounts in development and production. The password policy uses a minimum length of **8 characters**. The API—not only the frontend—must reject shorter passwords, accept passwords of at least 64 characters, and verify that only a salted server-side password hash is persisted. Focused tests must cover 7-character rejection, 8-character acceptance, long-password acceptance, and the absence of plaintext passwords from database rows and logs.

Task 1 below records the earlier production provisioning gate and is superseded by Task 2A. Do not restore Google OIDC or the provisioned-user-only production policy.

### Task 1: Production Account Provisioning Gate

**Files:**
- Modify: `nuxt.config.ts`
- Modify: `.env.example`
- Modify: `docker-compose.dev.yml`
- Modify: `docker-compose.prod.yml`
- Modify: `deploy.sh`
- Modify: `backend/api/session.post.ts`
- Modify: `backend/utils/auth.ts`
- Create: `tests/unit/account-provisioning.test.ts`
- Modify: `README.md`

**Interfaces:**
- Produces: `canCreateAccount(nodeEnv: string, allowSelfRegistration: boolean): boolean`.
- Produces runtime config: `allowSelfRegistration`.
- Production default: existing provisioned users only.

- [x] **Step 1: Write the failing policy test**

```ts
import { describe, expect, it } from 'vitest'
import { canCreateAccount } from '../../backend/utils/auth'

describe('account provisioning policy', () => {
  it('disables implicit account creation in production', () => {
    expect(canCreateAccount('production', false)).toBe(false)
    expect(canCreateAccount('production', true)).toBe(true)
    expect(canCreateAccount('development', false)).toBe(true)
  })
})
```

- [x] **Step 2: Run RED**

Run:

```bash
npm test -- tests/unit/account-provisioning.test.ts
```

Expected: FAIL because `canCreateAccount` does not exist.

- [x] **Step 3: Add the policy and route enforcement**

Add to `backend/utils/auth.ts`:

```ts
export function canCreateAccount(nodeEnv: string, allowSelfRegistration: boolean) {
  return nodeEnv !== 'production' || allowSelfRegistration
}
```

In `backend/api/session.post.ts`, before creating a missing user:

```ts
const config = useRuntimeConfig(event)
if (!user && !canCreateAccount(
  process.env.NODE_ENV || 'development',
  config.allowSelfRegistration === true
)) {
  throw createError({ statusCode: 401, statusMessage: 'Account is not provisioned.' })
}
```

Configure `allowSelfRegistration` from `NUXT_ALLOW_SELF_REGISTRATION`; set it to `true` in development and `false` in production. Document that production users must be seeded/provisioned while the hardened local account-creation flow is being designed and reviewed.

- [x] **Step 4: Run security gates**

Run:

```bash
npm test -- tests/unit/account-provisioning.test.ts tests/unit/auth-security.test.ts
npm run lint
npm run build
```

Expected: all commands exit 0; a missing production user cannot be auto-created.

- [x] **Step 5: Review checkpoint without committing**

```bash
git diff --check
git status --short
```

Expected: no whitespace errors; the provisioning files remain uncommitted for review.

### Task 2: Server-Authoritative Context-Switch Counts

**Files:**
- Create: `backend/api/timer-context-switch.post.ts`
- Create: `tests/unit/context-switch.test.ts`
- Create: `tests/integration/context-switch.test.ts`
- Modify: `backend/utils/timer-activity.ts`
- Modify: `backend/api/timer-stop.post.ts`
- Modify: `backend/utils/store.ts`
- Modify: `shared/utils/time.ts`
- Modify: `frontend/app.vue`
- Modify: `docs/specs/features/05-idle-context-settings.spec.md`

**Interfaces:**
- Produces: `shouldRecordContextSwitch(input): boolean`.
- Produces: `recordContextSwitch(userId: string, entryId: string): Promise<number>`.
- Produces: `POST /api/timer-context-switch` returning `{ entryId, contextSwitches }`.

- [x] **Step 1: Write failing transition tests**

```ts
expect(shouldRecordContextSwitch({
  previous: 'visible', current: 'hidden',
  active: true, paused: false, enabled: true
})).toBe(true)
expect(shouldRecordContextSwitch({
  previous: 'hidden', current: 'hidden',
  active: true, paused: false, enabled: true
})).toBe(false)
expect(shouldRecordContextSwitch({
  previous: 'visible', current: 'hidden',
  active: true, paused: true, enabled: true
})).toBe(false)
expect(shouldRecordContextSwitch({
  previous: 'visible', current: 'hidden',
  active: true, paused: false, enabled: false
})).toBe(false)
```

- [x] **Step 2: Write failing PostgreSQL tests**

Test ownership, completed-entry rejection, disabled settings, concurrent increments, bootstrap restoration, and a forged `contextSwitches: 0` stop payload.

```ts
expect(await recordContextSwitch(owner.id, active.id)).toBe(1)
await Promise.all([
  recordContextSwitch(owner.id, active.id),
  recordContextSwitch(owner.id, active.id)
])
expect((await integrationPrisma.timeEntry.findUniqueOrThrow({
  where: { id: active.id }
})).contextSwitches).toBe(3)
```

- [x] **Step 3: Run RED**

```bash
npm test -- tests/unit/context-switch.test.ts
npm run test:integration -- tests/integration/context-switch.test.ts
```

Expected: FAIL because the guard and persistence function do not exist.

- [x] **Step 4: Implement atomic persistence**

After checking active ownership, pause state, and `settings.activityEnabled`:

```ts
const updated = await prisma.timeEntry.update({
  where: { id: entryId },
  data: { contextSwitches: { increment: 1 } },
  select: { contextSwitches: true }
})
return updated.contextSwitches
```

Remove `contextSwitches` from the trusted stop input. `stopEntry` must preserve the database value.

- [x] **Step 5: Serialize frontend visibility requests**

Track the previous visibility state, queue one request at a time for the current entry, update the displayed count from the response, and restore it from bootstrap. Do not retry if the active entry ID changes.

- [x] **Step 6: Verify privacy and behavior**

```bash
rg -n "destinationUrl|websiteName|appName|windowTitle|screenshot|keystroke|browserHistory" backend frontend shared
npm test
npm run test:integration
npm run lint
npm run build
```

Expected: no introduced activity-detail storage; all tests and builds pass.

- [x] **Step 7: Review checkpoint without committing**

```bash
git diff --check
git status --short
```

Expected: no whitespace errors; context-switch changes remain uncommitted for review.

### Task 2A: Remove Google OIDC And Restore Password Registration

**Files:**
- Modify: `tests/unit/deployment-config.test.ts`
- Create: `tests/unit/password-policy.test.ts`
- Modify: `backend/api/session.post.ts`
- Modify: `backend/utils/auth.ts`
- Modify: `frontend/app.vue`
- Modify: `nuxt.config.ts`
- Modify: `.env.example`
- Modify: `docker-compose.dev.yml`
- Modify: `docker-compose.prod.yml`
- Modify: `deploy.sh`
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `backend/prisma/schema.prisma`
- Delete: `backend/api/auth/google.get.ts`
- Delete: `backend/api/auth/google/callback.get.ts`
- Delete: `backend/utils/google-oidc.ts`
- Delete: `backend/prisma/migrations/0005_google_oidc_identity/migration.sql`
- Delete: `tests/unit/google-oidc.test.ts`
- Delete: `tests/integration/google-identity.test.ts`
- Modify: `tests/integration/helpers/database.ts`
- Modify: `docs/specs/features/01-authentication-profile.spec.md`
- Modify: `README.md`

**Interfaces:**
- Produces: `passwordPolicyError(password: string): string | null`.
- Production authentication: automatic `@airgradient.com` account creation followed by the existing persisted application session.
- Removes: Google OIDC routes, runtime configuration, dependency, identity model, migration, tests, and documentation.

- [x] **Step 1: Write and run the removal-contract RED tests**

Update the deployment contract to require password registration in production and reject Google OIDC configuration. Add `tests/unit/password-policy.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { passwordPolicyError } from '../../backend/utils/auth'

describe('password policy', () => {
  it('rejects seven characters and accepts eight', () => {
    expect(passwordPolicyError('1234567')).toMatch(/8 characters/i)
    expect(passwordPolicyError('12345678')).toBeNull()
  })

  it('accepts a 64-character password', () => {
    expect(passwordPolicyError('a'.repeat(64))).toBeNull()
  })
})
```

Run:

```bash
npm test -- tests/unit/password-policy.test.ts tests/unit/deployment-config.test.ts
```

Expected: FAIL because `passwordPolicyError` does not exist and production Compose still disables password registration and requires Google OIDC.

- [x] **Step 2: Restore the hardened password-registration runtime**

Implement `passwordPolicyError`, enforce it before any account lookup, remove the Google-only guard from `session.post.ts`, enable self-registration and password auth in production configuration, and run:

```bash
npm test -- tests/unit/password-policy.test.ts tests/unit/account-provisioning.test.ts tests/unit/auth-security.test.ts tests/unit/deployment-config.test.ts
npm run lint
```

Expected: focused tests and typecheck pass; every seven-character password submission is rejected before account lookup and production permits automatic company-email account creation.

- [x] **Step 3: Remove Google OIDC runtime, UI, dependency, and obsolete tests**

Delete the OIDC routes, utility, and Google-specific tests. Remove the frontend Google branch, Nuxt/runtime environment keys, Compose/deploy keys, and `openid-client` through:

```bash
npm uninstall openid-client
rg -n -i "google.*(oidc|workspace|sign-in)|oidc.*google|openid-client|authError=google" backend/api backend/utils frontend nuxt.config.ts package.json package-lock.json docker-compose.dev.yml docker-compose.prod.yml deploy.sh .env.example tests
npm test
npm run lint
npm run build
```

Expected: the scan finds no Google authentication implementation or configuration; tests, typecheck, and build pass; Google auth routes are absent from `.output/server/chunks/routes`.

- [x] **Step 3A: Preserve safe authentication errors in the frontend**

Create `frontend/utils/auth-error.ts` with an allowlisted `signInErrorMessage(error: unknown): string`. It must accept known validation/authentication `statusMessage` values from `$fetch` errors while replacing unknown server details with `Could not sign in. Please try again.`. Update `submitSignIn()` to pass its caught error through the helper.

```bash
npm test -- tests/unit/auth-error.test.ts
npm run lint
```

Browser-check an existing account with a wrong password. Expected: the request returns `401`, the UI displays `Invalid email or password.`, and unknown server details are never rendered.

- [x] **Step 4: Remove the unshared identity schema and reconcile local PostgreSQL**

Preflight the development database:

```sql
SELECT COUNT(*) AS null_password_users FROM users WHERE password_hash IS NULL;
SELECT COUNT(*) AS google_identities FROM auth_identities;
```

Proceed only when both counts are zero. Because migration `0005_google_oidc_identity` is untracked and has not been shared, reverse it only in the local development database, remove its local `_prisma_migrations` record, delete the migration directory, remove `AuthIdentity` from the Prisma schema, regenerate Prisma Client, then rebuild the disposable integration database from migrations.

Expected: existing users, tasks, entries, and sessions remain; `users.password_hash` is `NOT NULL`; `auth_identities` and migration `0005_google_oidc_identity` are absent; clean migration deploy and integration tests pass.

- [x] **Step 4A: Align Prisma nullability and seeded credentials with the password policy**

Change `User.passwordHash` from `String?` to `String` in the Prisma schema because migration `0001_init` and both reconciled databases require `password_hash NOT NULL`. Replace the obsolete four-character seeded password with an explicit demo password of at least 8 characters, regenerate Prisma Client, reseed the development database, and verify the seeded account can sign in while only a salted scrypt hash is stored.

Expected: Prisma schema and PostgreSQL nullability agree; seeded credentials satisfy the same minimum-length policy as registration and sign-in; existing non-seeded accounts remain unchanged.

- [x] **Step 5: Align authentication documentation**

Rewrite the authentication feature spec, README, and environment examples around automatic `@airgradient.com` password registration, the 8-character minimum, salted scrypt hashes, persisted sessions, and the absence of Google SSO.

Run:

```bash
rg -n -i "google.*(oidc|workspace|sign-in)|oidc.*google|openid-client" README.md docs/specs/features/01-authentication-profile.spec.md .env.example
```

Expected: no stale Google authentication instructions.

- [x] **Step 6: Full authentication and production verification**

```bash
npm test
npm run test:integration
npm run lint
npm run build
```

Browser-check registration with a new `@airgradient.com` address using a 7-character rejection and an 8-character successful password, refresh persistence, sign out, sign back in, and verify the stored database value is a salted scrypt hash rather than plaintext.

- [x] **Step 7: Review checkpoint without committing**

```bash
git diff --check
git status --short
```

Expected: no whitespace errors; Google SSO is absent; password registration changes remain uncommitted for review.

- [x] **Step 7A: Make the self-registration switch effective and preserve the approved default**

Keep automatic `@airgradient.com` account creation enabled by default in development and production, but make an explicit `NUXT_ALLOW_SELF_REGISTRATION=false` effective in every runtime. Require `canCreateAccount` to honor the resolved flag, let both Compose files default the environment value to `true` without hardcoding it, and let `deploy.sh` create the key only when absent instead of overwriting an operator-selected `false`. Update the provisioning/deployment tests and documentation to match.

Expected: existing default workflows still auto-create company-email accounts; an explicit `false` blocks only missing-account creation while existing password accounts can still sign in.

### Task 3: Legacy Production Isolation

**Files:**
- Modify: `.dockerignore`
- Modify: `aq-time-tracker-software/README.md`
- Modify: `tests/unit/deployment-config.test.ts`

**Interfaces:**
- Produces: explicit legacy label and Docker build exclusion.
- Production continues to use only the root Nuxt/PostgreSQL application.

- [x] **Step 1: Add failing deployment assertions**

```ts
expect(dockerignore).toContain('aq-time-tracker-software')
expect(legacyReadme).toMatch(/legacy/i)
expect(legacyReadme).toMatch(/not.*production/i)
expect(prodCompose).not.toContain('aq-time-tracker-software')
```

- [x] **Step 2: Run RED**

```bash
npm test -- tests/unit/deployment-config.test.ts
```

Expected: FAIL because the directory is not excluded or clearly labelled.

- [x] **Step 3: Add the exclusion and notice**

Add `/aq-time-tracker-software` to `.dockerignore`. Add a prominent README notice that the React/Vite/SQLite/local-storage application is legacy reference code and must not be used by production build, migration, seed, test, or deploy commands.

- [x] **Step 4: Verify production build**

```bash
npm test -- tests/unit/deployment-config.test.ts
docker build --target build -t ag-time-tracker-legacy-isolation-check .
```

Expected: test and Docker build exit 0; legacy files are absent from the build context.

- [x] **Step 5: Review checkpoint without committing**

```bash
git diff --check
git status --short
```

Expected: no whitespace errors; legacy-isolation changes remain uncommitted for review.

### Task 4: Retryable Breezy And Medal Refresh

**Files:**
- Create: `backend/prisma/migrations/0006_derived_refresh_jobs/migration.sql`
- Create: `backend/utils/derived-refresh.ts`
- Create: `tests/integration/derived-refresh.test.ts`
- Modify: `backend/prisma/schema.prisma`
- Modify: `backend/utils/store.ts`
- Modify: `backend/api/bootstrap.get.ts`

**Interfaces:**
- Produces: `enqueueDerivedRefresh(tx, userId)`.
- Produces: `processDerivedRefresh(userId)`.
- Produces: `retryPendingDerivedRefresh(userId)`.

- [x] **Step 1: Write failing queue and idempotency tests**

Assert:

- entry mutation and pending refresh marker commit together;
- failure records `lastError` and increments `attemptCount`;
- bootstrap retries unfinished work;
- processing twice produces identical `breezy_days` and `user_medals`.

- [x] **Step 2: Run RED**

```bash
npm run test:integration -- tests/integration/derived-refresh.test.ts
```

Expected: FAIL because `DerivedRefreshJob` does not exist.

- [x] **Step 3: Add migration and processor**

Create a user-keyed `derived_refresh_jobs` table with `requested_at`, `attempt_count`, `last_error`, and `completed_at`. Upsert the marker inside entry mutations, process synchronously after commit, and retry incomplete work during bootstrap.

- [x] **Step 4: Verify**

```bash
npx prisma validate --schema backend/prisma/schema.prisma
npm run test:integration -- tests/integration/derived-refresh.test.ts
npm test
npm run lint
npm run build
```

Expected: all commands exit 0.

- [x] **Step 5: Review checkpoint without committing**

```bash
git diff --check
git status --short
```

Expected: no whitespace errors; derived-refresh changes remain uncommitted for review.

### Task 5: Complete Idle Keep, Discard, And Break Decisions

**Files:**
- Create: `frontend/components/IdleDecisionModal.vue`
- Create: `backend/api/timer-idle.post.ts`
- Create: `tests/unit/idle-decision.test.ts`
- Create: `tests/integration/timer-idle.test.ts`
- Modify: `backend/prisma/schema.prisma`
- Create: `backend/prisma/migrations/0007_idle_decisions/migration.sql`
- Modify: `backend/utils/timer-activity.ts`
- Modify: `backend/utils/store.ts`
- Modify: `frontend/app.vue`
- Modify: `docs/specs/features/05-idle-context-settings.spec.md`

**Interfaces:**
- Produces: `recordIdleDecision(userId, entryId, input)`.
- Input: `{ decision: 'keep' | 'discard' | 'break', startedAt: string, endedAt: string }`.
- Produces persisted total idle seconds and excluded idle seconds; `break` produces a closed pause window.

- [x] **Step 1: Write failing domain tests**

```ts
expect(applyIdleDecision(3600, 300, 'keep')).toEqual({
  durationSeconds: 3600, idleSeconds: 300, breakSeconds: 0
})
expect(applyIdleDecision(3600, 300, 'discard')).toEqual({
  durationSeconds: 3300, idleSeconds: 300, breakSeconds: 0
})
expect(applyIdleDecision(3600, 300, 'break')).toEqual({
  durationSeconds: 3300, idleSeconds: 300, breakSeconds: 300
})
```

- [x] **Step 2: Write failing persistence tests**

Test ownership, interval bounds, duplicate-decision rejection, keep/discard calculations, break pause creation, bootstrap restoration, and stop duration.

- [x] **Step 3: Add migration and server API**

Add `excluded_idle_seconds` to `time_entries` and an idempotency-backed `entry_idle_decisions` table keyed by entry and decision ID. Validate that the interval is inside the active entry and no longer than 24 hours.

- [x] **Step 4: Add the modal**

When activity returns after the threshold, open `IdleDecisionModal` with three keyboard-accessible actions: Keep, Discard, and Split as break. Submit one generated decision ID and update state from the API response.

- [x] **Step 5: Verify**

```bash
npm test -- tests/unit/idle-decision.test.ts
npm run test:integration -- tests/integration/timer-idle.test.ts
npm test
npm run lint
npm run build
```

Browser-check all three decisions, refresh, stop, export, and stored durations.

- [x] **Step 6: Review checkpoint without committing**

```bash
git diff --check
git status --short
```

Expected: no whitespace errors; idle-decision changes remain uncommitted for review.

### Task 9: Production Migration, Backup, And Recovery Runbook

**Files:**
- Create: `docs/operations/production-runbook.md`
- Create: `scripts/verify-production-config.mjs`
- Modify: `package.json`
- Modify: `deploy.sh`
- Modify: `tests/unit/deployment-config.test.ts`
- Modify: `README.md`

**Interfaces:**
- Produces: `npm run verify:production`.
- Documents backup, migration, deploy, healthcheck, rollback, and restore commands for the `/tracker/` deployment.

- [x] **Step 1: Add failing production-config assertions**

Assert required secrets, `/tracker/`, port `5500`, alias `tracker`, migration-before-web order, persistent PostgreSQL volume, and legacy exclusion.

- [x] **Step 2: Implement the read-only verification script**

The script must validate configuration files without printing secret values and exit non-zero for missing production invariants.

- [x] **Step 3: Write the runbook**

Include exact commands for:

- `pg_dump` before migration;
- `prisma migrate status`;
- deploy;
- `/tracker/api/health`;
- container logs;
- rollback to the previous image tag;
- restore into a new PostgreSQL database before replacing production.

- [x] **Step 4: Verify**

```bash
npm run verify:production
npm test -- tests/unit/deployment-config.test.ts
docker build --target runner -t ag-time-tracker-release-candidate .
```

Expected: all commands exit 0 without exposing secrets.

- [x] **Step 4A: Bind deployment to the reviewed immutable SHA**

Require `deploy.sh --expected-sha <full-sha>`, permit the reviewed runbook flow to use `--no-pull`, allow only `git pull --ff-only` when synchronization is requested, and verify `HEAD` immediately after synchronization and again before migration and startup. Derive the image tag from the reviewed SHA. A behavioral unit test must prove a mismatch exits before environment or build files are created.

Observed 2026-09-01: the mismatch behavior test passed, the runbook uses the full candidate SHA with `--no-pull`, and `npm run verify:production` passed 16 checks including repeated candidate verification.

- [x] **Step 4B: Keep production artifacts outside the checkout**

Require the pre-migration backup directory to be an existing mode-`700`
directory outside the canonical Git checkout. Use the shared backup helper for
dry-run validation, dump creation, `pg_restore` validation, SHA-256 generation,
and mode-`600` output. Keep `/backups/` ignored only as defense in depth and do
not generate an unused checkout-local `version.json`. Behavioral tests must
prove a simulated backup/deploy procedure leaves Git status clean and an
external dump cannot be staged from the application repository.

Observed 2026-09-01: the helper rejected both in-checkout and mode-`755`
destinations, created the fake verified dump/checksum only in an external
mode-`700` fixture, and Git rejected staging that absolute path. The fake
immutable deployment completed without creating `version.json` or changing
`git status --porcelain`.

- [x] **Step 5: Review checkpoint without committing**

```bash
git diff --check
git status --short
```

Expected: no whitespace errors; operations changes remain uncommitted for review.

### Task 9A: Production Dependency Security Remediation

**Reason added:** Task 9 Step 4 built the runner image successfully but `npm audit --omit=dev` reported 9 production dependency vulnerabilities: 2 critical, 5 high, 1 moderate, and 1 low. The observed dependency tree is rooted at `nuxt@3.21.8`, including `@nuxt/devtools@3.2.4` and `tar@7.5.16`. The audit reports a Nuxt fix at `3.21.10` or newer.

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify if evidence changes: `docs/milestones.md`
- Modify if install/run instructions change: `README.md`

**Interfaces:**
- Produces: `npm run audit:production` running `npm audit --omit=dev --audit-level=high`.
- Production security gate: zero high or critical advisories in installed production dependencies.
- Minimum direct framework version: `nuxt@3.21.10`; use the smallest compatible patched version rather than an unrelated major upgrade.

**Constraints:**

- Do not use `npm audit fix --force`.
- Do not suppress audit findings, add audit exceptions, or move runtime dependencies to `devDependencies` to make the report pass.
- Do not add a Prisma migration or change API/UI behavior.
- Update one dependency group at a time and preserve `/tracker/`, Nitro routes, authentication, Settings, timer behavior, and Docker runner behavior.
- Moderate/low residual advisories require written risk review; any high/critical production advisory blocks Task 10.
- Execute one numbered step, verify it, summarize it, and stop until the user types `next`. Do not commit.

- [x] **Step 1: Capture The Failing Production Audit Baseline**

Run without changing dependencies:

```bash
npm audit --omit=dev --audit-level=high
npm ls nuxt @nuxt/devtools tar brace-expansion postcss shell-quote svgo esbuild --omit=dev
```

Expected baseline: the audit exits non-zero and reports the known Nuxt 3.21.8 production tree. Record advisory counts and dependency paths; do not run an automatic fix.

Observed 2026-08-07: `npm audit --omit=dev --audit-level=high` exited 1 with 9 production findings: 2 critical, 5 high, 1 moderate, and 1 low. The direct dependency is `nuxt@3.21.8`; relevant paths include Nuxt → `@nuxt/devtools@3.2.4` → `shell-quote@1.8.4`, Nuxt/Vite → `esbuild@0.27.7` and `postcss@8.5.15`, Nuxt/Nitro → `esbuild@0.28.0`, Nuxt/Nitro → `@vercel/nft@1.10.2` → `@mapbox/node-pre-gyp@2.0.3` → `tar@7.5.16`, multiple Nitro/glob paths to vulnerable `brace-expansion`, and Nuxt/Vite/cssnano → `svgo@4.0.1`. `npm ls` exited 0, and no automatic fix or dependency-file change was made.

- [x] **Step 2: Upgrade The Direct Nuxt Patch Group**

Apply the smallest direct framework update reported as patched and add the reusable gate:

```bash
npm install --save-exact nuxt@3.21.10
npm pkg set scripts.audit:production="npm audit --omit=dev --audit-level=high"
npm run audit:production
npm ls nuxt @nuxt/devtools tar --omit=dev
```

Expected: `package.json` and `package-lock.json` change together; Nuxt resolves to 3.21.10. If the audit still contains high/critical advisories, continue to Step 3 without using `--force` or overrides.

Observed 2026-08-07: Nuxt is pinned to `3.21.10`, `@nuxt/devtools` resolves to `3.4.1`, and `tar` resolves to `7.5.22`. The reusable `audit:production` script was added. The production audit now reports one remaining high-severity `brace-expansion` finding and no critical findings, so Task 9A must continue with Step 3 before the production gate can pass. No automatic fix, `--force`, suppression, or override was used.

- [x] **Step 3: Resolve Remaining High/Critical Transitive Advisories**

Inspect the owner path before changing the lockfile:

```bash
npm explain @nuxt/devtools
npm explain tar
npm explain brace-expansion
npm explain postcss
npm explain shell-quote
npm explain svgo
npm explain esbuild
```

Then update only the observed vulnerable transitive packages within their owning packages' compatible ranges:

```bash
npm update @nuxt/devtools tar brace-expansion postcss shell-quote svgo esbuild
npm run audit:production
npm ls nuxt @nuxt/devtools tar brace-expansion postcss shell-quote svgo esbuild --omit=dev
```

Expected: the production audit exits 0 with zero high/critical findings. If npm cannot resolve patched compatible versions, stop and report the exact remaining dependency path; do not introduce `overrides` or a major framework upgrade without a separate approved plan.

Observed 2026-08-07: the remaining production path was Nuxt → Nitro → archiver/glob/minimatch → `brace-expansion@2.1.1`. A compatible transitive update changed only that package to `brace-expansion@2.1.4`; `npm run audit:production` now exits 0 with zero production findings, and the requested production dependency tree resolves cleanly. No `--force`, override, suppression, or major framework upgrade was used. A separate full audit that includes development dependencies still reports `happy-dom<=20.8.8` as one critical development-only finding requiring a breaking update; it is not present in the production audit and remains outside this production-runtime step for explicit follow-up.

- [x] **Step 4: Run Full Regression Gates**

```bash
npm run test
npm run test:component
npm run lint
npm run build
npm run verify:production
npm run audit:production
docker compose -p ag-time-tracker-software -f docker-compose.dev.yml run --rm test
git diff --check
```

Expected: 75 unit tests, 34 component tests, 32 PostgreSQL integration tests, typecheck, production build, production-config verification, and the high/critical audit gate all pass. Rebuild the Docker test image first if Compose would otherwise use a stale dependency lockfile.

Observed 2026-08-07: the final dependency state passed 76 unit tests, 34 component tests, 32 PostgreSQL integration tests, Nuxt typecheck, the Nuxt 3.21.10 production build, all 13 production-config checks, the zero-finding production audit, the rebuilt Docker test image, and `git diff --check`. The first clean Docker build exposed an npm lockfile compatibility mismatch because the host used npm 11.12.1 while `node:22-bookworm-slim` used npm 10.9.8. Regenerating only `package-lock.json` with the Docker npm version made `npm ci` reproducible; `package.json` and application behavior were unchanged. Generated `.nuxtrc` test residue was removed.

- [x] **Step 5: Verify The Patched Runner And Browser Runtime**

```bash
docker build --target runner -t ag-time-tracker-security-candidate .
docker image inspect ag-time-tracker-security-candidate:latest \
  --format '{{.Id}} {{json .Config.ExposedPorts}}'
```

Expected: the runner builds and exposes only the expected application port contract, including `5500/tcp`.

Using the local development Compose stack—not the production host—browser-check `/tracker/` for sign-in, refresh persistence, Account dialog, System/Light/Dark, Settings save/refresh, timer start/stop, context-switch/idle behavior, logout, mobile width, console errors, and failed network requests. Restore test-account settings and stop any temporary service afterward.

Observed 2026-08-25: the patched runner image built successfully as `sha256:3b6125829bdd510c90a5eebfd2455ccf73166c00a07091ed6c03a98210f190e8` and exposes the expected `5500/tcp` contract. The local `/tracker/` browser smoke passed sign-in, session refresh persistence, Account dialog, System/Light/Dark theme behavior with System restored, Settings save/refresh with the test threshold restored, timer start/refresh/stop, idle return handling, logout, 390 px mobile width, health, console, and network checks. The final context-switch check was manually confirmed using an actual browser-tab switch; switching desktop applications remains outside the browser-tab visibility contract. Focused context-switch unit tests passed 4/4 and PostgreSQL integration tests passed 6/6.

- [x] **Step 5A: Apply The Compatible Nanoid Remediation**

Update only the vulnerable transitive package within PostCSS's compatible range. Regenerate the lockfile with the Docker npm version if the host npm version makes `npm ci` non-reproducible.

```bash
npm update nanoid --no-audit --no-fund
npm ls nanoid --omit=dev
npm run test
npm run test:component
npm run lint
npm run build
npm run verify:production
docker compose -p ag-time-tracker-software -f docker-compose.dev.yml build test
docker compose -p ag-time-tracker-software -f docker-compose.dev.yml run --rm test
npm run audit:production
```

Observed 2026-08-25: `nanoid` moved from `3.3.17` to `3.3.18` and the audit dropped from four to three high findings. All non-audit gates passed: 76 unit tests, 34 component tests, typecheck, production build, 13 production configuration checks, reproducible Docker npm 10 installation, six clean-database migrations, and 32 PostgreSQL integration tests. The remaining findings are all in the Prisma configuration chain.

- [x] **Step 5B: Gate Prisma Changes On A Patched Stable Release**

Check the stable package metadata before changing the lockfile:

```bash
npm view prisma version
npm view prisma@latest dependencies.@prisma/config
npm view @prisma/config@latest version
npm view @prisma/config@latest dependencies.deepmerge-ts
npm outdated prisma @prisma/client deepmerge-ts
```

Proceed only when a stable, mutually compatible `prisma` and `@prisma/client` release no longer resolves an affected `deepmerge-ts` version. Prefer a patched Prisma 6 release. If the first fixed release requires Prisma 7 or later, write and approve a separate migration plan covering Prisma config, client generation, PostgreSQL driver/adapter behavior, seed and migration commands, Nitro bundling, and runner/migrator images before installation.

Observed 2026-08-25: the project resolves `prisma@6.19.3`, `@prisma/client@6.19.3`, `@prisma/config@6.19.3`, and `deepmerge-ts@7.1.5`. Stable Prisma `7.9.1` also resolves `@prisma/config@7.9.1` and the same affected `deepmerge-ts@7.1.5`, so a major upgrade would not remediate the finding. The project already satisfies Prisma 7's ESM and Node prerequisites, but the official upgrade guide documents additional breaking client, configuration, datasource, and migration changes. No Prisma package was changed.

Rechecked 2026-09-10: stable Prisma `7.10.0` still resolves `@prisma/config@7.10.0` with `deepmerge-ts@7.1.5`. The availability gate therefore remains closed and no Prisma package was changed.

- [ ] **Step 5C: Apply An Upstream-Compatible Prisma Remediation**

When Step 5B's availability gate passes, update `prisma` and `@prisma/client` together, regenerate the client, and run the complete Task 9A regression, clean-database, runner, and production-audit gates. Do not use a prerelease, `--force`, override, suppression, or dependency reclassification to manufacture a passing audit.

- [ ] **Step 6: Record Security Evidence And Stop Without Committing**

Update `docs/milestones.md` with the installed Nuxt version, audit counts, automated gates, runner image evidence, browser result, and any accepted moderate/low advisory rationale. Do not describe high/critical findings as accepted risk.

```bash
npm run audit:production
git diff --check
git status --short
```

Expected: the audit exits 0 for high/critical severity, no whitespace errors exist, and dependency/security changes remain uncommitted for review.

Observed 2026-08-25: this final gate is blocked by advisories published after the earlier zero-finding run. `npm run audit:production` now reports four high findings and zero critical, moderate, or low findings: `nanoid@3.3.17`, plus `deepmerge-ts@7.1.5` through `prisma@6.19.3` and `@prisma/config@6.19.3`. `nanoid@3.3.18` is available within the compatible range, but the current stable Prisma packages still pin the affected `deepmerge-ts` version. The verified runner and browser evidence was recorded in `docs/milestones.md`, but Step 6 remains incomplete. No high finding was accepted, and no `--force`, override, suppression, dependency reclassification, commit, or application behavior change was made. A separately approved, small-scope remediation step is required before rerunning this gate.

Remediation observed 2026-08-25: the compatible transitive `nanoid` patch was applied from `3.3.17` to `3.3.18`, reducing the production audit from four to three high findings. The host npm 11 update initially produced a lockfile that Docker npm 10 rejected; regenerating only `package-lock.json` with the Docker npm version restored reproducible `npm ci`. The patch passed 76 unit tests, 34 component tests, typecheck, production build, all 13 production configuration checks, the rebuilt Docker test image, all six migrations on the isolated test database, and 32 PostgreSQL integration tests. The three remaining high findings all belong to the Prisma → `@prisma/config` → `deepmerge-ts@7.1.5` chain, so Step 6 remains incomplete pending an upstream-compatible Prisma remediation.

Re-audit observed 2026-09-10: newly published `svgo@4.0.2` findings temporarily increased the production audit from three to four high findings. A compatible transitive update to `svgo@4.1.0`, `css-select@6.0.0`, and `css-what@7.0.0` removed the actionable SVG-optimizer finding and restored the result to three Prisma-chain high findings. The lockfile was regenerated with Docker npm 10 after the host npm 11 output failed clean `npm ci`. The rebuilt clean image resolved `svgo@4.1.0`, applied all seven migrations with none pending, and passed 221 unit plus 55 PostgreSQL integration tests; 104 component tests, typecheck, production build, all 18 production-configuration checks, and `git diff --check` also passed. Step 6 remains incomplete because stable Prisma `7.10.0` still pins the affected `deepmerge-ts@7.1.5`.

### Task 10: Clean-Database Release Candidate Verification

**Files:**
- Modify: `docs/milestones.md`
- Modify: `docs/specs/features/03-timer-tracking-entries.spec.md`
- Modify: `docs/specs/features/05-idle-context-settings.spec.md`
- Modify: `docs/specs/features/13-data-persistence-audit.spec.md`
- Modify: `docs/specs/features/14-accessibility-verification.spec.md`

**Interfaces:**
- Consumes Tasks 2–5, Task 2A's approved authentication contract (which supersedes Task 1's provisioned-user-only policy), Task 9, Task 9A, the refreshed frontend refactor, and the feature-gap audit.
- Produces reproducible release evidence; no production code changes without a new failing test.

- [ ] **Step 1: Apply migrations to a new empty PostgreSQL database**

```bash
npx prisma migrate deploy --schema backend/prisma/schema.prisma
npx prisma migrate status --schema backend/prisma/schema.prisma
npm run db:seed
```

Expected: every checked-in migration applies once and status reports no pending migrations.

- [ ] **Step 2: Run automated gates**

```bash
npm test
npm run test:integration
npm run lint
npm run build
npm run verify:production
npm run audit:production
npx prisma validate --schema backend/prisma/schema.prisma
```

Expected: every command exits 0.

- [ ] **Step 3: Run the browser release checklist**

Verify at `/tracker/`:

1. current password-authentication contract:
   - with default self-registration enabled, a missing `@airgradient.com` user and a valid 8–1,024-character password creates an account and session automatically;
   - a non-company email plus 7-character and 1,025-character passwords are rejected without creating an account;
   - an existing account signs in with its correct password and rejects a wrong password with the safe generic credential error;
   - if the optional `NUXT_ALLOW_SELF_REGISTRATION=false` override is exercised in isolated release verification, only a missing account is rejected while an existing account can still sign in, then the approved default is restored;
2. task creation, invitation, acceptance, and membership;
3. start, pause, refresh, resume, idle decision, context switch, and stop;
4. feedback, blockers, manual entry, entry edit, and audit;
5. personal dashboard and aggregate company dashboard;
6. Breezy Journey and medals;
7. settings;
8. CSV and JSON export;
9. current-session logout and second-session continuity;
10. desktop, 390px mobile, keyboard flow, console, and network errors.

- [ ] **Step 4: Inspect PostgreSQL rows**

Inspect `auth_sessions`, `task_invites`, `task_members`, `time_entries`, `entry_pauses`, `entry_idle_decisions`, `entry_feedback`, `entry_blockers`, `entry_audit_events`, `tracking_presence`, `breezy_days`, `user_medals`, `derived_refresh_jobs`, and `exports`.

- [ ] **Step 5: Correct stale documentation**

Update the July 2 milestone status and remove statements that PostgreSQL integration, live DB browser verification, edit-entry behavior, or pause persistence are still blocked. Do not mark the idle workflow, context-switch durability, or release candidate complete unless their current gates passed.

- [ ] **Step 6: Review evidence without committing**

```bash
git diff --check
git status --short
```

Expected: no whitespace errors; evidence documentation remains uncommitted for review.

## Self-Review

- Authentication ownership proof is addressed before deployment.
- Client-trusted context-switch data is removed before adding more UI.
- Legacy exclusion occurs before the release image is treated as authoritative.
- Derived-data recovery and the missing idle decision workflow are included.
- Frontend decomposition starts only after state contracts stabilize.
- The plan preserves `/tracker/`, aggregated company visibility, privacy constraints, and migration discipline.
- Production backup/restore and clean-database evidence are explicit release gates.
- High/critical production dependency advisories are removed before the final clean-database release candidate.
