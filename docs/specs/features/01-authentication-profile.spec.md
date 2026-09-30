# 01 Authentication And Profile

Source: extracted from the preserved full brief in `docs/spec.md` and updated to reflect the approved password-only production flow.

## Summary

Authentication lets AirGradient company users explicitly register a new account, sign in to an existing account, return through a persisted secure session, and maintain their identity and application preferences. A user's Team preference uses the same canonical values as task categories, while dashboard reporting still aggregates by the category attached to each task.

## Users

- AirGradient team members with an `@airgradient.com` work email.
- Authenticated company users viewing aggregate, process-focused company insight.

## Scope

- Present the authentication form immediately on first load with a visible `Sign in` / `Register` toggle on the authentication card.
- Use the same work-email and password fields in both modes while sending an explicit authentication intent to the server.
- In `Register` mode, also collect `Name` and `Team`; Team is a dropdown backed by the canonical work-category list.
- Accept only email addresses ending in the exact `@airgradient.com` domain.
- Require passwords from 8 through 1,024 characters for both registration and sign-in.
- Create a missing company-email account only from `Register` mode and only when `NUXT_ALLOW_SELF_REGISTRATION=true`.
- Never create an account from `Sign in` mode.
- Hash every password server-side with scrypt and a unique random salt.
- Persist signed-in state through a server-managed application session.
- Sign out by revoking the persisted session.
- Update display name and Team from the full Settings page.
- Protect pages and API routes with server-side `401` or `403` responses.
- Document seeded credentials and required authentication environment variables.

## Out Of Scope

- Password reset or account recovery.
- Email mailbox ownership verification.
- Multi-factor authentication.
- External identity-provider authentication.
- Multi-tenant company domain management.
- Administrator user management and session revocation UI.

## UI Behavior

### Historical Original UI Reference

The following reference is retained as historical context. The current target keeps account-level Team selection for the user's real organizational team, but the available Team values use the same canonical list as task categories:

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

Current target: the signed-out `/tracker/` view opens directly to the account card with a two-option segmented toggle above one form. `Sign in` authenticates existing users with work email and password only. `Register` adds `Name` and `Team`, then creates a missing `@airgradient.com` account when self-registration is enabled. Display name and Team remain editable from Settings. Team uses the canonical work-category list: Software, Hardware, Firmware, Communication, Research, Commerce, Production, Other.

The authentication UI has two explicit paths:

1. Choose `Sign in` for an existing account or `Register` for a new account.
2. Enter an AirGradient work email and password. In `Register` mode, also enter Name and choose Team.
3. In `Sign in` mode, verify the existing account's salted password hash and return a generic credential error when the account is missing or the password is wrong.
4. In `Register` mode, create a missing account with the submitted Name, selected Team, and salted password hash when registration is enabled. If the account already exists, direct the user back to `Sign in`.
5. Establish the same persisted application session after either successful path.

Safe validation messages may identify input-policy failures, including the company-email rule and the 8-character minimum. Credential failures for an existing account use the generic `Invalid email or password.` message. Unknown server details must not be rendered in the UI.

After authentication, the entire sidebar profile card is the account trigger. It opens a labelled account dialog containing identity, Settings, appearance controls, and Log out. Log out is no longer a permanent standalone sidebar button; it remains available from this account dialog and still revokes the persisted server session.

## Functional Requirements

- Normalize email addresses to lowercase before lookup.
- Reject non-company email addresses on the server.
- Reject empty passwords, passwords shorter than 8 characters, and passwords longer than 1,024 characters before database lookup.
- Accept passwords of at least 64 characters.
- Never store or log plaintext passwords.
- Store password hashes in `scrypt$<salt>$<derived-key>` form with a new salt for every hash.
- Allow production account creation only for an explicit `Register` request and when `NUXT_ALLOW_SELF_REGISTRATION` evaluates to `true` or `1`.
- Require a non-empty Name of at most 100 characters and a valid canonical Team for registration.
- Keep signed-in state across refreshes.
- Store only a SHA-256 hash of the signed session token in PostgreSQL.
- Set the browser session cookie as HTTP-only, `SameSite=Lax`, path `/`, and secure when served through HTTPS.
- Revoke the persisted session during sign-out.
- Require an authenticated session on protected API routes.
- Allow every authenticated AirGradient user to view aggregate company data while keeping personal raw detail private.
- Account-level Team identifies where the user belongs, using the same value set as task categories. Company Dashboard analytical filtering still comes from the Category attached to each task.

## Data And API

Relevant data:

- `users`: id, email, display_name, non-null password_hash, legacy team compatibility field, created_at.
- `auth_sessions`: id, user, token_hash, expiry, revocation, last-seen, and creation timestamps.
- `settings`: user-level preferences loaded after sign-in.

Relevant implementation files:

- `backend/api/session.post.ts`
- `backend/api/session.delete.ts`
- `backend/api/bootstrap.get.ts`
- `backend/api/account-settings.patch.ts`
- `backend/api/profile.patch.ts`
- `backend/utils/auth.ts`
- `backend/utils/store.ts`
- `backend/prisma/schema.prisma`
- `backend/prisma/seed.mjs`
- `frontend/features/settings/AccountMenu.vue`
- `frontend/features/settings/SettingsPage.vue`
- `frontend/features/settings/useAccountSettings.ts`
- `frontend/utils/auth-error.ts`

## Current Implementation

- Development and production Compose permit explicit company-email registration.
- `backend/api/session.post.ts` applies the domain, password, and authentication-mode policy before account lookup.
- Missing users are created through Prisma with the submitted Name, selected canonical Team, and a salted scrypt hash only for `Register` requests.
- Existing users are authenticated with a timing-safe password comparison.
- Session tokens are HMAC-signed, stored in the HTTP-only `breezy_session` cookie, and represented in PostgreSQL by a token hash.
- `requireSessionUser` and `requireSessionIdentity` enforce protected API access.
- `account-settings.patch.ts` updates display name, Team, and application preferences atomically through a Prisma transaction; `profile.patch.ts` remains compatible for legacy callers but is not used by the current Settings UI.
- `AccountMenu.vue` owns the accessible account trigger/dialog and relocates Settings, appearance, and Log out into one account entry point.
- `SettingsPage.vue` owns the profile draft and emits the complete validated payload to the settings orchestration without calling backend APIs directly.
- `useAccountSettings.ts` owns runtime settings synchronization, the atomic save request, validation-message mapping, and uncertain-response reconciliation.
- `session.delete.ts` clears the cookie and revokes the persisted session row.
- Seeded demo users use the policy-compliant password documented in `README.md`.

Current target: keep Team in account settings, but keep its allowed values aligned with the canonical task-category list so users do not see two competing taxonomies.

## Security Limitations

- Domain-string validation does not prove that the person controls the submitted mailbox. Deployment must remain restricted to the trusted internal access boundary until mailbox verification or another stronger authentication factor is implemented.
- There is no login rate limiting or temporary account lockout.
- There is no password reset, forced rotation, or administrator session-management interface.
- The minimum password length is intentionally 8 characters; stronger organization-wide password requirements are deferred.

## Acceptance Criteria

- A missing `@airgradient.com` user can select `Register`, submit Name, Team, and a password of at least 8 characters, and receive a persisted account and session when self-registration is enabled.
- Submitting the same missing account through `Sign in` does not create it and returns a generic credential error.
- Registering an existing account does not sign it in and directs the user to the `Sign in` mode.
- A seven-character password is rejected before account lookup.
- An existing user can sign in with the correct password and refresh without losing the session.
- Wrong credentials return a safe generic error.
- A non-company email is rejected.
- Signing out revokes the server-side session and removes authenticated access.
- A user can update display name and Team; Team uses the same canonical values as task categories.
- Only salted scrypt hashes—not plaintext passwords—appear in database rows.
- Protected routes return `401` without a valid session.

## Tests And Verification

- Unit tests cover company-domain validation, password boundaries, production provisioning policy, session-secret requirements, safe frontend error mapping, and Prisma nullability.
- Integration tests cover seeded credentials, session token storage, task permissions, and database persistence.
- Browser verification covers seven-character rejection, sign-in, refresh persistence, sign-out, and first-time account creation.
- Database verification checks non-null salted hashes and confirms plaintext passwords are absent.
