# Account Menu And Full Settings Page Design

## Purpose

Create one predictable account entry point in the application shell and a complete Settings page that lets an authenticated user manage profile, appearance, activity/privacy, and Breezy preferences without editing PostgreSQL manually.

This is one implementation task named **Account Menu And Full Settings Page**. It is not a new numbered product feature: profile and logout remain owned by Feature 01, while activity and preference settings remain owned by Feature 05.

The design also restores the original authentication ASCII reference to Feature 01 and adds a new Settings ASCII reference to Feature 05, labelled as a design extension rather than an original mockup.

## Approved Product Decisions

- Replace the separate sidebar Dark mode and Log out controls with a clickable account profile control.
- Clicking the account control opens a compact account popover containing account identity, Settings, appearance selection, and Log out.
- Settings opens a full page inside the existing application shell.
- Display name and team are managed on the same Settings page.
- The Settings page uses one `Save changes` button.
- Theme preference supports `System`, `Light`, and `Dark`.
- `System` is the default and follows OS changes in real time; users may override it.
- The visual companion is not used for this design. The approved ASCII references are the layout source.

## Scope

### In Scope

- Account profile trigger in the sidebar.
- Accessible account popover.
- Full Settings page within the current Nuxt application shell.
- Profile, appearance, activity/privacy, and Breezy settings sections.
- Atomic persistence for the single Save action.
- System theme detection and manual Light/Dark overrides.
- Focused unit, integration, component, and browser verification.
- Feature-spec alignment and ASCII references.

### Out Of Scope

- Password change, password recovery, multi-factor authentication, or SSO.
- Administrator user management.
- New roles or company permissions.
- New database columns or a Prisma migration.
- Cross-device persistence for appearance. Theme remains a browser-local preference.
- Collecting URLs, application names, website names, page titles, screenshots, keystrokes, or other private activity detail.
- A general frontend refactor outside the account and settings boundaries.

## Current Baseline

- The sidebar renders the user card, a separate Dark/Light mode button, and a separate Log out button directly in `frontend/app.vue`.
- Profile and a subset of settings are embedded in the Personal dashboard.
- The current visible fields are display name, team, Breezy verbosity, and global mute.
- PostgreSQL already stores idle threshold, nudge cadence, Breezy verbosity, mute, location opt-in, activity opt-in, and location labels per user.
- `PATCH /api/profile` and `PATCH /api/settings` persist profile and settings independently.
- The existing profile/settings dashboard button invokes both requests without atomicity or unified error handling.
- Theme currently stores only `light` or `dark` under `breezy-theme-mode`; absence resolves to Light rather than the OS preference.
- Feature 05 requires user-configurable idle behavior, but the user cannot currently edit the idle threshold or activity tracking through the UI.

## Information Architecture

The sidebar account area becomes the single entry point for account-level actions.

```text
Sidebar
+------------------------+
| Main navigation        |
|                        |
|                        |
| [M] Mog             >  |  <- account trigger
|     Software           |
+------------------------+
             |
             v
Account popover
+----------------------------+
| Mog                        |
| mog@airgradient.com        |
| Software                   |
+----------------------------+
| Settings                >  |
| Theme                      |
| [System] [Light] [Dark]    |
+----------------------------+
| Log out                    |
+----------------------------+
```

The full Settings page uses the existing app shell and main content area:

```text
Settings
Manage your profile, preferences, and privacy.

+ Profile --------------------------------+
| Display name  [ Mog                  ]   |
| Team          [ Software            v]  |
+------------------------------------------+

+ Appearance -----------------------------+
| Theme       [ System ] [ Light ] [ Dark ]|
| System follows the appearance of this   |
| device and updates when the OS changes.  |
+------------------------------------------+

+ Activity & Privacy ---------------------+
| Activity tracking                  [On]  |
| Idle threshold            [ 5 ] minutes  |
| Context switches store counts only.      |
| Location tracking                  [Off] |
| Location labels                         |
+------------------------------------------+

+ Breezy --------------------------------+
| Voice             [ gentle          v]  |
| Global mute                        [Off] |
| Nudge cadence           [ 90 ] minutes  |
+------------------------------------------+

                              [Save changes]
```

Settings is not duplicated as a permanent sidebar navigation item. The account popover is its navigation entry. The Personal dashboard no longer renders the embedded Profile & settings card after the full page is available.

## Interaction Design

### Account Trigger And Popover

- The entire profile card is a button with the current display name and team.
- The trigger exposes expanded state and the relationship to the popover with accessible attributes.
- Because the panel contains navigation, a theme radio group, and logout rather than a simple list of menu commands, it uses labelled non-modal dialog semantics instead of an ARIA `menu` role.
- Click, `Enter`, or `Space` opens the popover.
- `Escape`, clicking outside, selecting Settings, or selecting Log out closes it.
- Closing returns focus to the account trigger unless focus intentionally moved to the Settings page.
- Popover actions remain reachable in a logical keyboard order.
- Settings opens the Settings page in the existing main content surface and keeps the user signed in.
- Log out uses the existing server-side session revocation flow. It is visually separated from preference actions.

### Settings Navigation

- Add `Settings` to the application section model coordinated by `app.vue`.
- Opening Settings keeps the current audience lens unchanged but renders account-owned content, not company data.
- Existing Track, dashboards, and Breezy Journey navigation continue to work unchanged.
- On mobile, the Settings content uses the same responsive content column and cards as other application sections.

### Form State

- The page initializes a draft from the latest authenticated bootstrap state.
- Theme preference is displayed in the page but changes immediately and is not included in the server transaction.
- Other fields remain draft values until `Save changes` is selected.
- `Save changes` is disabled when there are no persisted-field changes, when the form is invalid, or while saving.
- A successful response replaces the draft and shared application state with the returned server state.
- The page displays `Settings saved.` in a polite live region after success.
- This task does not add an unsaved-navigation confirmation. Navigating away discards the unsaved draft, and returning initializes it from the last server state.

## Settings Fields And Validation

| Section | Field | Behavior and validation |
|---|---|---|
| Profile | Display name | Required after trimming; maximum 100 characters |
| Profile | Team | Required after trimming; maximum 80 characters; use the existing allowed team choices in the UI |
| Appearance | Theme | `system`, `light`, or `dark`; applied immediately and stored locally |
| Activity & Privacy | Activity tracking | Boolean; controls idle and context-switch detection |
| Activity & Privacy | Idle threshold | Integer from 1 through 240 minutes |
| Activity & Privacy | Location tracking | Boolean and off by default for users without stored settings |
| Activity & Privacy | Location labels | At most 20 unique non-empty labels, each at most 100 characters |
| Breezy | Voice | `quiet`, `gentle`, or `chatty` |
| Breezy | Global mute | Boolean |
| Breezy | Nudge cadence | Integer from 5 through 1,440 minutes |

The frontend provides immediate field-level validation for usability. The server independently validates the complete payload and is authoritative.

When Activity tracking is off, the Idle threshold field remains visible but disabled, preserving its saved value. Context-switch and idle listeners must stop recording new events while disabled. Existing historical counts remain unchanged.

When Location tracking is off, location-label editing remains visible but disabled. Existing saved labels remain stored so re-enabling the preference does not destroy the user's configuration.

## Theme Model

Define two separate concepts:

```text
ThemePreference = system | light | dark
ResolvedTheme    = light | dark
```

The browser-local key remains `breezy-theme-mode` to preserve existing preferences.

Migration rules:

1. If the key is absent, use `system`.
2. If the existing key contains `light` or `dark`, preserve it as an explicit override.
3. If the key contains `system`, resolve through `window.matchMedia('(prefers-color-scheme: dark)')`.
4. If the key contains an unknown value, replace it with `system`.

The theme composable owns preference, resolved theme, persistence, and the media-query listener. It applies only `light` or `dark` to `document.documentElement.dataset.theme`, keeping the current CSS contract intact.

A minimal theme bootstrap runs in the document head before the application mounts. It reads the same localStorage key, resolves System with `matchMedia`, and sets `data-theme` before the main UI renders. The bootstrap performs no network request and contains no user or work data. `useTheme.ts` takes over after hydration using the same resolution rules, preventing a Light-to-Dark or Dark-to-Light flash during initial render.

The media-query listener updates the rendered theme only when preference is `system`. It is removed during teardown. Selecting Light or Dark stops following OS changes; selecting System immediately resolves the current OS preference and resumes listening.

Theme preference stays browser-local because it must apply before authentication and should not depend on an API response. Both the account popover and Settings page consume the same composable state, so the controls cannot disagree.

## Component Boundaries

```text
nuxt.config.ts
frontend/
├── app.vue
├── components/
│   └── AccountMenu.vue
├── composables/
│   └── useTheme.ts
├── plugins/
│   └── theme.client.ts
└── features/
    └── settings/
        └── SettingsPage.vue
```

### `AccountMenu.vue`

- Receives current user identity and shared theme state.
- Emits `open-settings` and `logout`.
- Updates theme only through the shared theme interface.
- Owns popover visibility, outside-click behavior, Escape handling, and focus restoration.
- Does not call backend APIs.

### `SettingsPage.vue`

- Receives the current user, settings, theme preference, saving state, and server error.
- Owns the editable draft and field-level validation.
- Emits one validated persisted-settings payload through `save`.
- Updates theme through a dedicated emitted event or shared theme interface because appearance is immediate.
- Does not know session cookies or call Prisma.

### `useTheme.ts`

- Provides `preference`, `resolvedTheme`, and `setPreference`.
- Reads and writes the existing localStorage key.
- Owns `matchMedia` subscription and DOM theme application.
- Is safe when rendered without `window` or `document` during server-side rendering.

### `theme.client.ts`

- Initializes the shared theme state before application mount.
- Reuses the same resolver exported by `useTheme.ts`; it does not maintain a second preference state.
- Ensures account and sign-in surfaces render with the resolved theme before authentication completes.

### `nuxt.config.ts`

- Registers the minimal head bootstrap that sets the initial `data-theme` before the application UI renders.
- Keeps the bootstrap limited to the fixed storage key and three allowed preference values; parity with the composable resolver is covered by tests.

### `app.vue`

- Remains the shell coordinator.
- Opens Settings, invokes the authenticated API helper, refreshes shared state, and performs logout.
- Removes the standalone theme/logout controls and the dashboard-embedded settings card.
- Does not duplicate the internal form or popover implementation.

## Backend Contract And Atomic Save

Add one authenticated route:

```text
PATCH /api/account-settings
```

Request shape:

```json
{
  "profile": {
    "displayName": "Mog",
    "team": "Software"
  },
  "settings": {
    "idleThresholdMinutes": 5,
    "nudgeCadenceMinutes": 90,
    "breezyVerbosity": "gentle",
    "muted": false,
    "locationEnabled": false,
    "activityEnabled": true,
    "locationLabels": ["Home office", "AirGradient office"]
  }
}
```

The route:

1. requires the current authenticated application session;
2. validates the entire request before any database mutation;
3. updates the authenticated user's profile and upserts that user's settings in one Prisma transaction;
4. never accepts a user ID from the browser;
5. returns the same public bootstrap state shape used by the existing profile and settings routes.

The combined route does not remove `PATCH /api/profile` or `PATCH /api/settings` in this task. They remain compatible for existing callers until a later cleanup explicitly deprecates them.

No Prisma schema change or migration is required.

## Error Handling

- Client validation identifies the first invalid field, displays a specific inline message, and moves focus to it after Save is attempted.
- Authentication failure follows the existing session-expired behavior and does not display server internals.
- A server validation response preserves the user's draft and displays the safe server message in an alert region.
- A database failure rolls back both the profile update and settings upsert.
- While the request is running, the Save button displays `Saving...` and cannot be triggered again.
- A network or unknown response failure is treated as indeterminate because the transaction may have committed before the response was interrupted. The frontend immediately reloads bootstrap state: if reload succeeds, it reconciles the form and reports whether the requested values were saved; if reload also fails, it preserves the draft and displays `Could not confirm whether settings were saved. Refresh and check before trying again.`
- Theme changes are independent browser-local actions. A settings API failure does not revert a theme change already selected by the user.
- Logout failure follows the existing safe logout behavior; the account menu must not expose token or cookie details.

## Privacy And Access Boundaries

- Users can read and edit only their own profile and preferences.
- The endpoint derives identity exclusively from the authenticated session.
- Settings do not expand company-dashboard access or expose another person's raw data.
- Activity tracking stores idle totals and context-switch counts only.
- Location remains opt-in.
- Theme preference contains no work or identity data and remains local to the browser.

## Documentation Alignment

Implementation updates the following feature specs:

- `docs/specs/features/01-authentication-profile.spec.md`
  - restore the original Sign Up / Sign In ASCII mock under UI Reference;
  - retain the approved current single-form automatic-registration behavior as an explicit implementation difference;
  - document the account trigger, Settings navigation, and logout placement.
- `docs/specs/features/05-idle-context-settings.spec.md`
  - add the approved Settings ASCII mock under a `Design Extension` label;
  - document all fields, System theme default, atomic Save behavior, accessibility, and browser verification;
  - replace the inaccurate Settings gap with the actual pre-implementation gap until verification passes.

The preserved `docs/spec.md` is not overwritten. It remains the source brief.

## Verification Strategy

### Unit Tests

- Resolve an absent theme preference to System plus the current OS theme.
- Preserve existing Light and Dark localStorage values as overrides.
- Fall back from an unknown stored value to System.
- React to OS appearance changes only while preference is System.
- Stop following OS changes while manually overridden.
- Validate profile and settings boundaries, including integer limits and location-label normalization.

### Component Tests

- Open and close the account popover with pointer and keyboard input.
- Close on Escape and outside click, restoring focus correctly.
- Open Settings and invoke Logout through distinct events.
- Keep Account menu and Settings page theme controls synchronized.
- Disable dependent Activity and Location controls without erasing their draft values.
- Disable Save when unchanged, invalid, or saving.
- Focus the first invalid field and announce save success or failure.

### Integration Tests

- Reject unauthenticated combined updates.
- Update only the authenticated user.
- Validate the full request before mutation.
- Prove profile and settings commit together on success.
- Prove both mutations roll back when either database operation fails.
- Upsert a settings row for a newly registered user who currently relies on defaults.
- Return the updated public state.

### Browser Verification

- Desktop and mobile account-menu layout.
- Pointer and keyboard navigation, Escape, outside click, and focus return.
- Settings navigation inside `/tracker/` without losing the authenticated session.
- System theme under simulated Light and Dark OS preferences.
- Real-time OS theme change while System is selected.
- Light and Dark overrides surviving refresh.
- Existing stored `light` or `dark` preference surviving the migration.
- Initial sign-in and authenticated surfaces render with the resolved preference without a visible opposite-theme flash.
- Single-button save, validation errors, success feedback, and refresh persistence.
- Idle prompt at a user-configured threshold without direct database editing.
- Activity tracking disabled behavior.
- Logout revokes the session and returns to sign-in.
- No relevant console errors, framework overlay, clipping, or inaccessible focus behavior.

## Implementation Sequencing And Review Gates

The later implementation plan should divide this feature into small risk-based steps and stop after each step for user review:

1. Characterize current theme, profile, settings, and logout behavior.
2. Add and verify the atomic backend contract.
3. Add and verify the System-aware theme composable without changing layout.
4. Add and verify the account popover, replacing standalone sidebar actions.
5. Add and verify the full Settings page and remove the dashboard-embedded card.
6. Align feature specs and run the complete browser/production verification gate.

No step starts until the user types `next`, matching the existing project workflow. No commit is created unless the user changes the current no-commit instruction.

## Acceptance Criteria

- Clicking the sidebar account profile opens the approved account popover.
- The popover contains identity, Settings, System/Light/Dark appearance selection, and Log out.
- Settings opens a complete, responsive Settings page in the existing app shell.
- Profile and persisted preferences are saved through one button and one atomic server transaction.
- A first-time user without a settings row can save preferences successfully.
- Idle threshold and activity tracking can be configured by the signed-in user without SQL or Prisma Studio.
- System is the default theme preference and follows OS changes in real time.
- Existing Light or Dark browser preferences remain explicit overrides after rollout.
- Manual Light/Dark overrides survive refresh.
- Account menu and Settings page controls remain synchronized.
- Keyboard, focus, live-region, validation, and mobile requirements pass.
- Existing timer, dashboards, export, Breezy Journey, and authentication behavior remain functional.
- Feature 01 and Feature 05 accurately reflect the implemented and verified behavior.
- The original `docs/spec.md` remains preserved.
