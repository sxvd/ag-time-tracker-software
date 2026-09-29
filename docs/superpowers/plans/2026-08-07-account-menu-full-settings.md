# Account Menu And Full Settings Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the standalone sidebar theme/logout controls with an accessible account popover and add a complete Settings page with atomic profile/preference saving and System-aware appearance.

**Architecture:** Keep `app.vue` as the shell coordinator while extracting account presentation, Settings form state, and theme state into focused Vue units. Persist profile and settings through one authenticated Nitro route backed by a Prisma transaction; keep appearance browser-local and resolve System through `prefers-color-scheme` before app mount.

**Tech Stack:** Nuxt 3, Vue 3, TypeScript, Nitro/H3, Prisma 6, PostgreSQL 16, Vitest, Nuxt Test Utils, Vue Test Utils, happy-dom, Docker Compose, and the in-app Browser.

## Global Constraints

- Work in `/Users/Ananya/Developer/ag-time-tracker-software/.worktrees/backend-database-hardening` on branch `backend-database-hardening`.
- Do not commit. The user's explicit instruction overrides the skill's default commit steps.
- Execute one numbered task, verify it, summarize it, and stop. Continue only after the user types `next`.
- Preserve `/tracker/`, Docker alias `tracker`, current permissions, privacy boundaries, and all unrelated UI behavior.
- Add no dependency and no Prisma migration; this design requires no schema change.
- API identity comes only from the authenticated session, never a browser-supplied user ID.
- Theme is browser-local. Profile and application settings are PostgreSQL data.
- System is the default theme preference; stored `light` and `dark` values remain overrides.
- Context tracking stores counts only, never destinations, URLs, app names, titles, screenshots, or keystrokes.
- Keep `docs/spec.md` unchanged.
- Use TDD: write the focused failing test, confirm RED, implement minimally, confirm GREEN, then run regression checks.

## File Map

| File | Responsibility |
|---|---|
| `shared/types/account-settings.ts` | Combined profile/settings contract |
| `backend/utils/account-settings.ts` | Full-payload validation before mutation |
| `backend/api/account-settings.patch.ts` | Authenticated combined endpoint |
| `backend/utils/store.ts` | Atomic user update and settings upsert |
| `shared/utils/theme.ts` | Pure theme normalization, resolution, head bootstrap |
| `frontend/composables/useTheme.ts` | Reactive preference and OS listener lifecycle |
| `frontend/plugins/theme.client.ts` | Initialize theme before app mount |
| `frontend/components/AccountMenu.vue` | Accessible account popover |
| `frontend/features/settings/SettingsPage.vue` | Full validated Settings form |
| `frontend/app.vue` | Navigation and API coordination |
| `frontend/assets/main.css` | Account/Settings responsive styling |
| `vitest.component.config.ts` | Vue SFC test runner |
| `tests/unit/account-settings-validation.test.ts` | Request boundary tests |
| `tests/unit/account-settings-route.test.ts` | Session-derived route ownership tests |
| `tests/integration/account-settings.test.ts` | Transaction and ownership tests |
| `tests/unit/theme.test.ts` | Theme migration/OS tests |
| `tests/component/account-menu.test.ts` | Popover accessibility/actions |
| `tests/component/settings-page.test.ts` | Form behavior and validation |
| Feature 01 and Feature 05 specs | ASCII and verified behavior alignment |

---

### Task 1: Atomic Account Settings Backend

**Risk:** High — the single Save must not partially update profile or settings.

**Files:**
- Create: `shared/types/account-settings.ts`
- Create: `backend/utils/account-settings.ts`
- Create: `backend/api/account-settings.patch.ts`
- Modify: `backend/utils/store.ts`
- Create: `tests/unit/account-settings-validation.test.ts`
- Create: `tests/unit/account-settings-route.test.ts`
- Create: `tests/integration/account-settings.test.ts`

**Produces:**

```ts
export type BreezyVerbosity = 'quiet' | 'gentle' | 'chatty'
export interface AccountSettingsInput {
  profile: { displayName: string; team: string }
  settings: {
    idleThresholdMinutes: number
    nudgeCadenceMinutes: number
    breezyVerbosity: BreezyVerbosity
    muted: boolean
    locationEnabled: boolean
    activityEnabled: boolean
    locationLabels: string[]
  }
}
export function parseAccountSettingsInput(value: unknown): AccountSettingsInput
export function updateAccountSettings(userId: string, input: AccountSettingsInput): Promise<void>
```

- [ ] **Step 1: Write validation tests**

Test a valid normalized payload and exact failures for: missing/array body, empty or overlong display name/team, idle outside `1..240`, nudge outside `5..1440`, invalid verbosity, non-boolean flags, more than 20 labels, labels over 100 characters, and duplicate labels. The valid assertion must remove duplicate labels and trim profile/labels.

```ts
expect(parseAccountSettingsInput(valid)).toEqual({
  profile: { displayName: 'Mog', team: 'Software' },
  settings: {
    idleThresholdMinutes: 5,
    nudgeCadenceMinutes: 90,
    breezyVerbosity: 'gentle',
    muted: false,
    locationEnabled: false,
    activityEnabled: true,
    locationLabels: ['Home office', 'AirGradient office']
  }
})
```

- [ ] **Step 2: Confirm RED**

```bash
npm run test -- tests/unit/account-settings-validation.test.ts
```

Expected: FAIL because the parser does not exist.

- [ ] **Step 3: Implement the shared type and parser**

Reuse `requiredString`, `boundedInteger`, `enumValue`, `booleanValue`, and `stringArray` from `backend/utils/validation.ts`. Validate `profile` and `settings` object shapes before reading fields. Do not mutate the database from the parser.

- [ ] **Step 4: Confirm parser GREEN**

Run the Step 2 command; all cases must pass.

- [ ] **Step 5: Write PostgreSQL transaction tests**

Before the PostgreSQL cases, create `tests/unit/account-settings-route.test.ts` with mocked `requireSessionUser`, parser, store update, and `publicState`. Prove an authentication rejection prevents parsing/mutation, and prove a successful handler passes the session user's ID rather than any body ID:

```ts
requireSessionUser.mockResolvedValue({ id: 'session-user' })
readBody.mockResolvedValue({ userId: 'attacker-selected-user' })
parseAccountSettingsInput.mockReturnValue(input)
await handler(event)
expect(updateAccountSettings).toHaveBeenCalledWith('session-user', input)
```

Run `npm run test -- tests/unit/account-settings-route.test.ts`; first confirm RED before creating the route in Step 7, then confirm GREEN after Step 7.

Write the PostgreSQL transaction tests next.

Use the guarded helpers in `tests/integration/helpers/database.ts` and cover:

```ts
await updateAccountSettings(user.id, input)
expect(await integrationPrisma.user.findUniqueOrThrow({ where: { id: user.id } }))
  .toMatchObject({ displayName: 'After', team: 'Hardware' })
expect(await integrationPrisma.settings.findUniqueOrThrow({ where: { userId: user.id } }))
  .toMatchObject({ idleThresholdMinutes: 12, activityEnabled: false })
```

Also prove another user is unchanged, a missing Settings row is created, and a failing settings write rolls back the preceding profile update. Trigger the last case by calling the store function with PostgreSQL-overflow integer `3_000_000_000`; assert the original display name remains and no Settings row exists.

- [ ] **Step 6: Confirm integration RED**

```bash
docker compose -p ag-time-tracker-software -f docker-compose.dev.yml run --rm test sh -c "npx prisma migrate deploy --schema=backend/prisma/schema.prisma && npm run test:integration -- tests/integration/account-settings.test.ts"
```

Expected: FAIL because the store function does not exist.

- [ ] **Step 7: Implement the transaction and route**

Store implementation:

```ts
export async function updateAccountSettings(userId: string, input: AccountSettingsInput) {
  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: userId }, data: input.profile })
    await tx.settings.upsert({
      where: { userId },
      update: input.settings,
      create: { userId, ...input.settings }
    })
  })
}
```

Route implementation:

```ts
export default defineEventHandler(async (event) => {
  const user = await requireSessionUser(event)
  const input = parseAccountSettingsInput(await readBody(event))
  await updateAccountSettings(user.id, input)
  return publicState(user.id)
})
```

Keep the existing `/api/profile` and `/api/settings` routes compatible.

- [ ] **Step 8: Verify and stop**

```bash
npm run test -- tests/unit/account-settings-validation.test.ts
docker compose -p ag-time-tracker-software -f docker-compose.dev.yml run --rm test sh -c "npx prisma migrate deploy --schema=backend/prisma/schema.prisma && npm run test:integration -- tests/integration/account-settings.test.ts"
npm run lint
git diff --check
```

Confirm no schema/migration change. Summarize and stop until `next`; do not commit.

---

### Task 2: System-Aware Theme Engine

**Risk:** Medium-high — migrate browser values, follow OS changes, and avoid opposite-theme initial rendering.

**Files:**
- Create: `shared/utils/theme.ts`
- Create: `frontend/composables/useTheme.ts`
- Create: `frontend/plugins/theme.client.ts`
- Modify: `nuxt.config.ts`
- Modify: `frontend/app.vue`
- Create: `tests/unit/theme.test.ts`

**Produces:**

```ts
export type ThemePreference = 'system' | 'light' | 'dark'
export type ResolvedTheme = 'light' | 'dark'
export const themeStorageKey = 'breezy-theme-mode'
export function normalizeThemePreference(value: unknown): ThemePreference
export function resolveTheme(value: ThemePreference, prefersDark: boolean): ResolvedTheme
export function themeBootstrapScript(): string
export function useTheme(): {
  preference: Readonly<Ref<ThemePreference>>
  resolvedTheme: Readonly<Ref<ResolvedTheme>>
  setPreference(value: ThemePreference): void
  initialize(): void
  dispose(): void
}
```

- [ ] **Step 1: Write pure failing tests**

Assert missing/null/unknown stored values normalize to `system`; valid System/Light/Dark remain unchanged; System resolves from OS; overrides ignore OS; and the bootstrap contains the exact storage key, media query, and `dataset.theme` assignment.

```ts
expect(resolveTheme('system', true)).toBe('dark')
expect(resolveTheme('system', false)).toBe('light')
expect(resolveTheme('light', true)).toBe('light')
expect(resolveTheme('dark', false)).toBe('dark')
```

- [ ] **Step 2: Confirm RED, implement pure functions, confirm GREEN**

```bash
npm run test -- tests/unit/theme.test.ts
```

The bootstrap must catch localStorage errors, normalize invalid data to System, query `(prefers-color-scheme: dark)`, and set only `light` or `dark` on the document root.

- [ ] **Step 3: Add failing lifecycle tests**

Stub `matchMedia` with observable `addEventListener`/`removeEventListener`. Prove OS changes update the DOM only in System; Light/Dark overrides persist to localStorage and ignore later OS changes; selecting System immediately follows current OS; `dispose()` removes the listener.

- [ ] **Step 4: Implement composable, plugin, and early bootstrap**

Use one module-scoped preference ref and resolved ref. Make `initialize()` idempotent. `theme.client.ts` calls `useTheme().initialize()`. In `nuxt.config.ts`, add `themeBootstrapScript()` to `app.head.script` without changing `/tracker/` or runtime configuration.

- [ ] **Step 5: Replace only theme state in `app.vue`**

Remove the old `ThemeMode`, `themeMode`, storage, restore/apply/toggle functions. Use `const theme = useTheme()`. Keep the existing visible sidebar theme button temporarily; clicking it sets an explicit opposite Light/Dark override based on `resolvedTheme`. Do not move logout in this task.

- [ ] **Step 6: Verify and stop**

```bash
npm run test -- tests/unit/theme.test.ts
npm run test
npm run lint
npm run build
git diff --check
```

Browser-check absent preference, existing Light/Dark overrides, System under emulated Light/Dark OS, real-time OS change, refresh, and console health. Summarize and stop until `next`; do not commit.

---

### Task 3: Accessible Account Menu Component

**Risk:** Medium — mixed navigation, radio controls, and logout require dialog semantics and correct focus handling.

**Files:**
- Create: `vitest.component.config.ts`
- Modify: `package.json`
- Create: `frontend/components/AccountMenu.vue`
- Create: `tests/component/account-menu.test.ts`

**Consumes/Produces:**

```ts
defineProps<{
  user: { displayName: string; email: string; team: string }
  initials: string
  themePreference: ThemePreference
}>()
defineEmits<{
  openSettings: []
  logout: []
  themeChange: [preference: ThemePreference]
}>()
```

- [ ] **Step 1: Configure SFC component tests**

Create `vitest.component.config.ts` with `defineVitestConfig` from `@nuxt/test-utils/config`, Nuxt environment, and include `tests/component/**/*.test.ts`. Add:

```json
"test:component": "vitest run --config vitest.component.config.ts"
```

Do not add packages.

- [ ] **Step 2: Write failing AccountMenu tests**

Use `mountSuspended`, attach to `document.body`, and prove: the trigger exposes `aria-haspopup="dialog"`; click/Enter opens labelled `role="dialog"`; identity is visible; System/Light/Dark emit exact `themeChange` values; Settings and Logout close then emit; Escape and outside pointer close; Escape restores focus to the trigger; unmount removes listeners.

```ts
await wrapper.get('[aria-haspopup="dialog"]').trigger('click')
expect(wrapper.get('[role="dialog"]').attributes('aria-label')).toBe('Account')
await wrapper.get('[data-testid="theme-dark"]').trigger('click')
expect(wrapper.emitted('themeChange')).toEqual([['dark']])
```

- [ ] **Step 3: Confirm RED**

```bash
npm run test:component -- tests/component/account-menu.test.ts
```

Expected: FAIL because the component does not exist.

- [ ] **Step 4: Implement minimally**

The whole profile card is a button. The conditional panel is a labelled non-modal dialog, not an ARIA menu. Register document pointer and key listeners only while open. Settings/Logout close before emitting; theme selection remains open. Remove listeners on close and unmount.

- [ ] **Step 5: Verify and stop**

```bash
npm run test:component
npm run test
npm run lint
git diff --check
```

Do not integrate into `app.vue` yet. Summarize the isolated component contract and accessibility evidence, then stop until `next`; do not commit.

---

### Task 4: Full Settings Page And Shell Integration

**Risk:** High — replaces live sidebar controls/dashboard card and connects the atomic API.

**Files:**
- Create: `frontend/features/settings/SettingsPage.vue`
- Create: `tests/component/settings-page.test.ts`
- Modify: `frontend/app.vue`
- Modify: `frontend/assets/main.css`

**Consumes/Produces:**

```ts
defineProps<{
  user: { displayName: string; email: string; team: string }
  settings: AccountSettingsInput['settings']
  themePreference: ThemePreference
  saving: boolean
  error: string
  status: string
}>()
defineEmits<{
  save: [input: AccountSettingsInput]
  themeChange: [preference: ThemePreference]
}>()
```

- [ ] **Step 1: Write failing SettingsPage tests**

Prove all four sections render; Save is disabled while unchanged/invalid/saving; a valid edit emits one complete payload; display name/team, idle `1..240`, nudge `5..1440`, verbosity, booleans, and labels validate; Activity off disables but preserves idle threshold; Location off disables but preserves labels; labels are addable/removable and limited to 20 unique trimmed values of 100 characters; theme emits immediately without making persisted Save dirty; `error` uses an alert and `status="Settings saved."` uses a polite live region. Unmounting with a dirty draft and remounting from unchanged props must restore the server values, proving navigation discards unsaved changes.

```ts
expect(wrapper.emitted('save')?.[0]?.[0]).toEqual({
  profile: { displayName: 'Mog Updated', team: 'Software' },
  settings: {
    idleThresholdMinutes: 10,
    nudgeCadenceMinutes: 90,
    breezyVerbosity: 'gentle',
    muted: false,
    locationEnabled: false,
    activityEnabled: true,
    locationLabels: ['Home office', 'AirGradient office']
  }
})
```

- [ ] **Step 2: Confirm RED, implement, confirm GREEN**

```bash
npm run test:component -- tests/component/settings-page.test.ts
```

Use native labelled controls and number constraints. Maintain a local draft/baseline, compare only persisted fields for dirty state, focus the first invalid field, and reset the baseline only when successful incoming props match server state.

- [ ] **Step 3: Add shell orchestration**

Extend `AppSection` with `'Settings'`; add `openSettings`, `isSavingAccountSettings`, `accountSettingsError`, and `accountSettingsStatus`; handle Settings in title/subtitle/eyebrow/page-key computations. Clear status at the start of a new Save and set it to `Settings saved.` only after the returned/refreshed state matches the submitted payload. Replace the two old save functions with one PATCH:

```ts
const next = await authFetch<ApiState>('/api/account-settings', {
  method: 'PATCH',
  body: input
})
await loadState(next)
```

For validation/server failure, preserve the draft and show the safe returned message. For network/unknown failure, reload bootstrap because the transaction may have committed; reconcile success if server values match, otherwise keep the draft and show `Could not confirm whether settings were saved. Refresh and check before trying again.`

- [ ] **Step 4: Integrate AccountMenu and SettingsPage**

Replace the standalone theme button, user card, and logout button:

```vue
<AccountMenu
  :user="state.user"
  :initials="initials"
  :theme-preference="theme.preference.value"
  @open-settings="openSettings"
  @theme-change="theme.setPreference"
  @logout="logout"
/>
```

Render `SettingsPage` for `activeSection === 'Settings'`, passing `state.user`, `state.settings`, theme, saving, error, and status. Remove the Personal-dashboard Profile & settings card and duplicate profile form. Keep the runtime settings object used by timer/context/Breezy logic; do not move timer logic.

- [ ] **Step 5: Add responsive CSS**

Match existing sidebar/card styles. Anchor the popover above the profile trigger on desktop and contain it within the viewport on mobile. Use a two-column Settings grid on wide screens and one column at the existing mobile breakpoint. Add visible focus, disabled, field-error, live-status, and Save states without altering unrelated selectors or colors.

- [ ] **Step 6: Automated verification**

```bash
npm run test:component
npm run test
npm run lint
npm run build
docker compose -p ag-time-tracker-software -f docker-compose.dev.yml run --rm test
git diff --check
```

- [ ] **Step 7: Browser verification**

Discover the web port with `docker compose -p ag-time-tracker-software -f docker-compose.dev.yml port web 3000` and use its `/tracker/` URL. Verify desktop/mobile account menu; pointer/keyboard/Escape/outside/focus; System and overrides with refresh; all Settings validation; one-button save and refresh persistence; idle threshold `1` producing Idle Decision after more than 60 seconds without SQL; Activity off suppressing new idle/context records; logout returning to sign-in; and no relevant console error/overlay. Restore threshold `5` and Activity on through UI.

- [ ] **Step 8: Stop for review**

Summarize rendered behavior, accessibility, transaction persistence, idle configuration, viewport checks, and risks. Stop until `next`; do not commit.

---

### Task 5: Spec Alignment And Release Gate

**Risk:** Low runtime risk; high documentation and release-evidence value.

**Files:**
- Modify: `docs/specs/features/01-authentication-profile.spec.md`
- Modify: `docs/specs/features/05-idle-context-settings.spec.md`
- Modify: `docs/milestones.md` only if verified behavior contradicts it

- [ ] **Step 1: Restore Authentication UI Reference**

Copy the original Sign Up / Sign In ASCII from `docs/spec.md` into Feature 01 verbatim. Follow it with an implementation note that the approved current flow is one email/password form with automatic first-time registration. Document the account trigger and relocated Logout.

- [ ] **Step 2: Add the Settings Design Extension**

Feature 05 must say the preserved brief has no dedicated Settings ASCII, then include the approved account-popover and full Settings ASCII under `2026-08-07 Design Extension`. Document System default/overrides, atomic Save, all field limits, dependent controls, privacy, accessibility, and actual files/API.

- [ ] **Step 3: Correct status honestly**

Only move behavior from Gaps to Current Implementation after Task 4 evidence passes. Keep browser-tab-only context-switch limitations explicit. Update `docs/milestones.md` only for a direct contradiction; do not mark a broader milestone complete from this feature alone.

- [ ] **Step 4: Run the fresh release gate**

```bash
npm run test
npm run test:component
npm run lint
npm run build
docker compose -p ag-time-tracker-software -f docker-compose.dev.yml run --rm test
git diff --check
git status --short
```

Confirm all tests/build/typecheck pass, no schema/migration changed, and no commit exists.

- [ ] **Step 5: Final browser smoke and stop**

Run sign in → Account → System/Light/Dark → Settings → change idle threshold → Save → refresh → Settings → logout. Capture Account, Settings desktop/mobile, and saved-state evidence; inspect console/overlay. Report exact pass counts, files, DB/theme/privacy/accessibility evidence, limitations, and no-commit confirmation. Do not begin another plan item until the user types `next`.
