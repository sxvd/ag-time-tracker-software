# 01 Authentication And Profile

Source: extracted from the preserved full brief in `docs/spec.md`.

## Summary

Authentication lets company users sign in, keep a secure session across refreshes, and maintain a basic profile used for team-level dashboard rollups.

## Users

- Individual team members and freelancers tracking their own work.
- Company users who need team-level aggregated insight.

## Scope

- Sign up with display name, work email, password, and team.
- Sign in with email and password.
- Restrict authentication to `@airgradient.com` email accounts unless the product domain rule is changed.
- Persist signed-in state through a secure session or JWT.
- Sign out.
- Update display name and team from the profile page.
- Protect pages and API routes with clear `401` or `403` responses.
- Document seed/demo credentials and required auth/session environment variables.

## Out Of Scope

- SSO.
- Password reset.
- Multi-tenant company domain management.
- Admin user management.

## UI Reference

The original `docs/spec.md` includes this authentication reference:

```text
Sign Up / Sign In:
+---------------------------------------------------------------+
| AirGradient Time Tracker                         Breezy (^_^) |
+---------------------------------------------------------------+
| [ Sign in ] [ Create account ]                                |
|                                                               |
| Work email     [ name@airgradient.com..................... ]  |
| Password       [ ********................................. ]  |
| Display name   [ Alex Kim................................. ]  |
| Team           [ Software v ]                                |
|                                                               |
| [ Create account ]          Existing user? [ Sign in ]        |
|                                                               |
| Rules: @airgradient.com only, password hashed server-side,    |
| session stored securely, all data persisted to PostgreSQL.    |
+---------------------------------------------------------------+
```

## Functional Requirements

- Reject non-company email addresses before account creation and sign in.
- Reject empty passwords.
- Store password hashes server-side. Never store, log, export, or seed plaintext passwords.
- Signed-in state survives refresh.
- Protected API routes require an authenticated user.
- Profile team selection supports team filters in company dashboards.
- Demo credentials are documented in `README.md`.
- `.env.example` describes required session/auth secrets.

## Data And API

Relevant target data:

- `users`: id, email, display_name, password_hash, team, created_at.
- `auth_sessions` or equivalent session/JWT persistence.
- `settings`: user-level preferences used after sign in.

Relevant current API files:

- `backend/api/session.post.ts`
- `backend/api/session.delete.ts`
- `backend/api/bootstrap.get.ts`
- `backend/api/profile.patch.ts`
- `backend/utils/auth.ts`
- `backend/utils/store.ts`

## Current Implementation

- `backend/api/session.post.ts` accepts an `@airgradient.com` email and password.
- Unknown emails are auto-created with a display name derived from the email and team `Software`.
- Session tokens are HMAC-signed and stored in an HTTP-only `breezy_session` cookie by `backend/utils/auth.ts`.
- API protection is implemented with `requireSessionUser`.
- `profile.patch.ts` updates display name and team through Prisma.
- `session.delete.ts` clears the session cookie and revokes persisted `auth_sessions` rows.

## Gaps

- There is no separate sign-up endpoint with display name and team selection.
- Runtime auth data is stored in PostgreSQL through Prisma.
- Password handling uses scrypt hashes server-side.
- Existing users are authenticated by verifying the stored password hash.
- `auth_sessions` is present in the Prisma schema.
- The sign-in UI does not expose the full create-account form from the mockup.

## Acceptance Criteria

- A user can create an account with display name, company email, password, and team.
- A user can sign in and refresh without losing the session.
- Non-company emails are rejected.
- Protected routes return `401` when no valid session is present.
- A user can update display name and team.
- No plaintext passwords appear in code, logs, exports, seed data, or database rows.

## Tests And Verification

- Unit or integration tests for company email validation.
- API tests for sign up, sign in, sign out, current session, and profile update.
- Browser check: sign in, refresh, confirm protected app state remains available, sign out, confirm protected state is unavailable.
- Database verification once PostgreSQL persistence is implemented.
