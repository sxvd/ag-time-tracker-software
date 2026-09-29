# Breezy Companion Runtime Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn Breezy from a mostly decorative rotating mascot into a clear, accessible companion that reacts to real work events, respects user preferences, and persists cadence-driven well-being nudges without duplicating them across tabs or reloads.

**Architecture:** Introduce a pure frontend presentation model and a single `useBreezyRuntime` coordinator so timer, feedback, idle, and task flows publish typed events instead of directly rewriting display copy. Keep Breezy's compact block separate from the timer, select mascot artwork from state-appropriate pools, and add a non-blocking toast for proactive nudges. Claim and acknowledge cadence nudges through authenticated Nitro routes backed by the existing `breezy_nudges` table; the server owns eligibility and serializes claims on the active entry.

**Tech Stack:** Nuxt 3, Vue 3, TypeScript, Nitro/H3, Prisma 6, PostgreSQL 16, Vitest, Nuxt Test Utils, Vue Test Utils, happy-dom, Docker Compose, and the in-app Browser.

**Spec:** `docs/specs/features/08-breezy-companion.spec.md`

## Global Constraints

- Work in `/Users/Ananya/Developer/ag-time-tracker-software/.worktrees/backend-database-hardening` on branch `backend-database-hardening`.
- Do not commit. The user's explicit instruction overrides commit steps from the planning skill.
- Execute exactly one numbered task, verify it, summarize it, and stop. Continue only when the user types `next`.
- Use TDD for every behavior change: write a focused test, confirm RED for the intended reason, implement minimally, then confirm GREEN.
- Preserve the `/tracker/` base URL, Docker alias `tracker`, authentication model, timer behavior, entry calculations, privacy boundaries, and current light/dark/System theme behavior.
- Keep `docs/spec.md` unchanged. Align Feature 08 and `docs/milestones.md` only when the corresponding runtime behavior is verified.
- Do not add dependencies. Use the existing Vue/Nuxt/Prisma/Vitest stack.
- Do not add a Prisma migration: the existing `BreezyNudge` model already contains `userId`, `relatedEntryId`, `type`, `message`, `shownAt`, and `acknowledgedAt`.
- Breezy must never log URLs, app names, window titles, screenshots, keystrokes, or private activity details. It may consume timer state, elapsed work duration, pause state, aggregate context-switch counts, feedback choice, and persisted settings.
- Breezy copy must be supportive and non-punitive. Never convert context switching, idle time, blockers, or low-energy feedback into individual performance scoring.
- Muted means no Breezy live announcements, proactive claims, animation, or toast. Quiet means status-only presentation with no proactive nudges. Gentle and chatty may show proactive nudges as defined below.
- All proactive nudges are dismissible, non-blocking, keyboard accessible, and suppressed while a feedback, idle-decision, manual-entry, entry-edit, task, or share modal is open.
- Honor `prefers-reduced-motion`; state changes and content must remain understandable without animation.

## Locked Product Behavior

| Situation | Visible status | Gentle | Chatty | Quiet / Muted |
|---|---|---|---|---|
| No active timer | `Ready when you are` | One short ready message | Ready message plus direct action confirmations | Status only / `Breezy is muted` |
| Timer running | `Focus in progress` | Start/resume acknowledgement | Start/resume acknowledgement and other successful action confirmations | Status only / muted |
| Timer paused | `Taking a break` | Supportive break message | Supportive break message | Status only / muted |
| 45 minutes focused | `Focused and steady` | One persisted long-focus encouragement per entry | Same | No proactive nudge |
| Configured cadence reached | `Time for a reset` | Persisted hydration/ventilation nudge | Same | No proactive nudge |
| Great-flow feedback saved | `Great flow` | Celebration message and motion | Celebration message and motion | Status only / no motion when muted |

- The first cadence nudge for an entry is hydration; later cadence nudges alternate ventilation and hydration.
- A cadence nudge is due at `nudgeCadenceMinutes`, `2 * nudgeCadenceMinutes`, and so on, using working duration that excludes pauses and excluded idle.
- Long-focus is due once when working duration reaches 45 minutes.
- Mascot artwork continues rotating every two minutes, but only within the pool for the current semantic state. A state change immediately selects from the new pool without repeating the current source when another candidate exists.
- Human-readable labels are visible. Raw implementation moods such as `waving` are only internal values and never shown as unexplained copy.
- The Breezy block owns Breezy's message. The duplicate Breezy line under the timer is removed.

## File Map

| File | Responsibility |
|---|---|
| `frontend/features/breezy/breezyRuntime.ts` | Pure event-to-presentation rules and user-facing labels/copy |
| `frontend/features/breezy/mascotCatalog.ts` | State-specific pools for all approved mascot assets |
| `frontend/features/breezy/useBreezyRuntime.ts` | Reactive event coordination, priority, motion key, and restored state |
| `frontend/features/breezy/useBreezyNudges.ts` | Poll/claim lifecycle, suppression, acknowledgement, and cleanup |
| `frontend/features/breezy/BreezyCompanion.vue` | Compact companion block and state-aware mascot rotation |
| `frontend/features/breezy/BreezyNudgeToast.vue` | Accessible, dismissible, non-blocking proactive notification |
| `frontend/features/tracking/TimerPanel.vue` | Timer UI after duplicate Breezy copy is removed |
| `frontend/features/tracking/useTimerSession.ts` | Publish typed start/pause/resume/task-required events |
| `frontend/features/tracking/useIdleActivity.ts` | Publish typed idle-decision events without private activity details |
| `frontend/features/feedback/useEntries.ts` | Publish stop/feedback/manual/edit events and Great-flow celebration |
| `frontend/features/tasks/useTasks.ts` | Publish typed task/invitation confirmations |
| `frontend/app.vue` | Compose Breezy runtime, nudge lifecycle, modal suppression, and presentation |
| `frontend/types/api.ts` | Browser contract for the current user's Breezy nudges |
| `backend/utils/breezy-nudges.ts` | Locked eligibility, claim, acknowledgement, and mapping logic |
| `backend/api/breezy-nudges/claim.post.ts` | Authenticated claim endpoint |
| `backend/api/breezy-nudges/[id].patch.ts` | Authenticated acknowledgement endpoint |
| `backend/utils/store.ts` | Include only the authenticated user's recent Breezy nudges in bootstrap state |
| `frontend/assets/main.css` | Compact block, toast, responsive, focus, dark-mode, and reduced-motion styles |
| `tests/unit/breezy-runtime.test.ts` | Pure presentation and verbosity contracts |
| `tests/unit/breezy-nudges-route.test.ts` | Session-derived route ownership and input validation |
| `tests/integration/breezy-nudges.test.ts` | PostgreSQL claim concurrency, cadence, ownership, and acknowledgement |
| `tests/component/breezy.test.ts` | Companion, image pools, toast, accessibility, rotation, and cleanup |
| `tests/unit/breezy-runtime-composable.test.ts` | Event priority, celebration, fallback, and lifecycle |
| `tests/unit/breezy-nudge-scheduler.test.ts` | Claim timing, suppression, reload, acknowledgement, and cleanup |

---

### Task 1: Pure Breezy Presentation Contract And Mascot Pools

**Risk:** Medium — every later task depends on stable event names, labels, and verbosity behavior.

**Files:**
- Create: `frontend/features/breezy/breezyRuntime.ts`
- Create: `frontend/features/breezy/mascotCatalog.ts`
- Create: `tests/unit/breezy-runtime.test.ts`
- Modify: `docs/specs/features/08-breezy-companion.spec.md`

**Interfaces:**

```ts
export type BreezyVerbosity = 'quiet' | 'gentle' | 'chatty'
export type BreezyMood = 'idle' | 'happy' | 'cheering' | 'waving' | 'sipping-water' | 'sleepy'
export type BreezyEvent =
  | { type: 'ready'; recentMood?: string }
  | { type: 'task-required' }
  | { type: 'session-started' }
  | { type: 'session-paused' }
  | { type: 'session-resumed' }
  | { type: 'idle-returned' }
  | { type: 'idle-saved'; decision: 'keep' | 'discard' | 'break' }
  | { type: 'session-saved'; greatFlow: boolean }
  | { type: 'manual-entry-saved' }
  | { type: 'entry-updated' }
  | { type: 'invitation-sent' | 'invitation-accepted' }
  | { type: 'long-focus'; nudgeId: string; message: string }
  | { type: 'hydration'; nudgeId: string; message: string }
  | { type: 'ventilation'; nudgeId: string; message: string }

export interface BreezyPresentation {
  mood: BreezyMood
  label: string
  message: string
  imagePool: BreezyImagePool
  announce: boolean
  celebrate: boolean
  dismissibleNudgeId: string | null
}

export function resolveBreezyPresentation(input: {
  event: BreezyEvent
  verbosity: BreezyVerbosity
  muted: boolean
}): BreezyPresentation

export function normalizeBreezyMood(value: unknown): BreezyMood
```

- [ ] **Step 1: Write the presentation tests**

Use literal expectations rather than deriving expected copy from the implementation:

```ts
expect(resolveBreezyPresentation({
  event: { type: 'session-paused' },
  verbosity: 'gentle',
  muted: false
})).toMatchObject({
  mood: 'sipping-water',
  label: 'Taking a break',
  message: 'Your timer is paused. Take a breath or grab some water.',
  announce: true,
  celebrate: false,
  dismissibleNudgeId: null
})

expect(resolveBreezyPresentation({
  event: { type: 'hydration', nudgeId: 'nudge-1', message: 'A sip of water could be a good reset.' },
  verbosity: 'quiet',
  muted: false
})).toMatchObject({ label: 'Focus in progress', message: '', announce: false })

expect(resolveBreezyPresentation({
  event: { type: 'session-saved', greatFlow: true },
  verbosity: 'gentle',
  muted: true
})).toMatchObject({ label: 'Breezy is muted', message: '', announce: false, celebrate: false })
```

Cover every event, muted precedence, all three verbosity values, raw-mood labels never appearing in visible copy, normalization of unknown/legacy Journey moods, recent Journey mood affecting the ready presentation, and Great-flow celebration only when not muted. Nudge presentation must use the server-provided `event.message`; do not maintain a second frontend copy of persisted nudge text.

- [ ] **Step 2: Confirm RED**

```bash
npm run test -- tests/unit/breezy-runtime.test.ts
```

Expected: FAIL because `breezyRuntime.ts` does not exist.

- [ ] **Step 3: Implement the minimal pure resolver**

Use an exhaustive `switch (event.type)` and an `assertNever` helper. Keep copy and semantic mapping in this file; do not read Vue refs, timers, browser APIs, or the database.

- [ ] **Step 4: Add the mascot catalog**

Export these stable pools and ensure every approved asset appears in at least one pool:

```ts
export type BreezyImagePool = 'ready' | 'focus' | 'break' | 'air' | 'celebrate' | 'quiet'
export const mascotPools: Record<BreezyImagePool, readonly string[]> = {
  ready: ['/mascots/mascot-standard.png', '/mascots/mascot-hello.png', '/mascots/mascot-notification.png'],
  focus: ['/mascots/mascot-book.png', '/mascots/mascot-engineer.png', '/mascots/mascot-idea.png', '/mascots/mascot-mission.png', '/mascots/mascot-reading.png', '/mascots/mascot-reading-indoors.png', '/mascots/mascot-thinking.png'],
  break: ['/mascots/mascot-coffee.png', '/mascots/mascot-enjoy-weather.png', '/mascots/mascot-enjoy-weather-alt.png', '/mascots/mascot-sleep.png', '/mascots/mascot-tv.png'],
  air: ['/mascots/mascot-location-services.png', '/mascots/mascot-mask.png', '/mascots/mascot-wear-mask.png', '/mascots/mascot-cigarette-low.png', '/mascots/mascot-cigarette-high.png'],
  celebrate: ['/mascots/mascot-baby.png', '/mascots/mascot-hello.png', '/mascots/mascot-idea.png'],
  quiet: ['/mascots/mascot-standard.png', '/mascots/mascot-doctor.png']
}
```

If an approved file exists outside these literals, add it to the closest semantic pool rather than restoring a global random list.

- [ ] **Step 5: Confirm GREEN and stop**

```bash
npm run test -- tests/unit/breezy-runtime.test.ts
npm run test
npm run lint
git diff --check -- frontend/features/breezy/breezyRuntime.ts frontend/features/breezy/mascotCatalog.ts tests/unit/breezy-runtime.test.ts docs/specs/features/08-breezy-companion.spec.md
```

Update Feature 08 with the locked labels, verbosity table, state-aware image rotation, and explicit note that Breezy Journey remains unchanged. Summarize Task 1 and stop until `next`.

---

### Task 2: Compact And Understandable Breezy Block

**Risk:** Low-medium — presentation changes must preserve timer controls and both themes.

**Files:**
- Modify: `frontend/features/breezy/BreezyCompanion.vue`
- Modify: `frontend/features/tracking/TimerPanel.vue`
- Modify: `frontend/app.vue`
- Modify: `frontend/assets/main.css`
- Modify: `tests/component/breezy.test.ts`
- Modify: `tests/component/timer-panel.test.ts`
- Modify: `tests/component/app-contract.test.ts`

**Consumes:** `BreezyPresentation`, `mascotPools` from Task 1.

**Produces:**

```ts
defineProps<{ presentation: BreezyPresentation; muted: boolean }>()
```

- [ ] **Step 1: Write failing component contracts**

Assert that the companion renders `presentation.label` and `presentation.message`, contains no visible `Breezy: waving`-style raw mood, uses an image from `presentation.imagePool`, changes to a different source after two minutes when the pool has alternatives, switches pools immediately when props change, and disposes its interval.

Add a TimerPanel assertion that `.breezy-line` no longer exists and that the timer's task, elapsed time, primary action, Stop action, and stats remain unchanged.

- [ ] **Step 2: Confirm RED**

```bash
npm run test:component -- tests/component/breezy.test.ts tests/component/timer-panel.test.ts tests/component/app-contract.test.ts
```

Expected: FAIL because the companion still accepts raw `mood/message` props and TimerPanel still renders duplicate Breezy copy.

- [ ] **Step 3: Implement the compact component**

Replace the global mascot list with `mascotPools[presentation.imagePool]`. Watch the pool key, select immediately from the new pool, retain the two-minute interval, and avoid immediate repeats when the pool contains more than one image.

Render this hierarchy:

```vue
<section class="breezy-panel" :aria-live="presentation.announce ? 'polite' : 'off'">
  <div class="breezy-photo" role="img" :aria-label="presentation.label">
    <img :src="currentMascot" alt="">
  </div>
  <div class="breezy-copy">
    <p class="eyebrow">Breezy</p>
    <h2>{{ presentation.label }}</h2>
    <p v-if="presentation.message" class="breezy-message">{{ presentation.message }}</p>
  </div>
</section>
```

Remove `breezyMessage` from TimerPanel's props and remove `.breezy-line` markup/styles. In `app.vue`, temporarily resolve the current raw event through Task 1 until Task 3 introduces the coordinator.

- [ ] **Step 4: Refine hierarchy without changing layout flow**

Keep the two-column desktop `track-grid`, but reduce `.featured .breezy-photo` from 260px to 168px, remove forced `min-height: 100%`, use a quieter surface/shadow than the timer card, and keep the card self-contained. At `max-width: 820px`, stack it below TimerPanel. Verify 390px has no horizontal overflow.

- [ ] **Step 5: Verify and stop**

```bash
npm run test:component -- tests/component/breezy.test.ts tests/component/timer-panel.test.ts tests/component/app-contract.test.ts
npm run test:component
npm run lint
NUXT_APP_BASE_URL=/tracker/ npm run build
git diff --check -- frontend/features/breezy/BreezyCompanion.vue frontend/features/tracking/TimerPanel.vue frontend/app.vue frontend/assets/main.css tests/component/breezy.test.ts tests/component/timer-panel.test.ts tests/component/app-contract.test.ts
```

Run browser smoke in System/Light/Dark: confirm TimerPanel remains primary, Breezy label/message are understandable, raw `waving` is absent, image pool matches state, and no console warning/error appears. Summarize Task 2 and stop until `next`.

---

### Task 3: Single Frontend Breezy Event Runtime

**Risk:** Medium-high — this replaces scattered direct message mutation across several workflows.

**Files:**
- Create: `frontend/features/breezy/useBreezyRuntime.ts`
- Create: `tests/unit/breezy-runtime-composable.test.ts`
- Modify: `frontend/features/tracking/useTimerSession.ts`
- Modify: `frontend/features/tracking/useIdleActivity.ts`
- Modify: `frontend/features/feedback/useEntries.ts`
- Modify: `frontend/features/tasks/useTasks.ts`
- Modify: `frontend/app.vue`
- Modify: corresponding unit/component tests for each changed composable

**Interfaces:**

```ts
export interface BreezyRuntimeDependencies {
  verbosity: () => BreezyVerbosity
  muted: () => boolean
}

export function useBreezyRuntime(dependencies: BreezyRuntimeDependencies): {
  presentation: Readonly<Ref<BreezyPresentation>>
  motionKey: Readonly<Ref<number>>
  publish: (event: BreezyEvent) => void
  restore: (input: { active: boolean; paused: boolean; latestJourneyMood?: string }) => void
}
```

Changed feature dependency contract:

```ts
onBreezyEvent: (event: BreezyEvent) => void
```

- [ ] **Step 1: Write runtime tests**

Prove initial ready state, restore to focus/break without announcing, restored ready state reflecting a normalized latest Journey mood, event replacement, muted precedence, settings changes recomputing the current event, Great-flow incrementing `motionKey` exactly once, and non-celebration events not incrementing it.

- [ ] **Step 2: Confirm RED**

```bash
npm run test -- tests/unit/breezy-runtime-composable.test.ts
```

Expected: FAIL because `useBreezyRuntime.ts` does not exist.

- [ ] **Step 3: Implement the coordinator**

Store only the current typed event in a ref. Compute presentation from Task 1 using current `verbosity()` and `muted()`. `restore` publishes a non-announcing ready/focus/break state and passes the latest Journey mood through `normalizeBreezyMood`. Increment motion only for an unmuted `{ type: 'session-saved', greatFlow: true }` event.

- [ ] **Step 4: Replace direct string mutations**

Replace `breezyMessage: Ref<string>` with `onBreezyEvent` in timer, idle, entries, and task composables. Preserve each existing request/error flow; only successful companion output changes. Map actions exactly:

```ts
start -> { type: 'session-started' }
missing task -> { type: 'task-required' }
pause -> { type: 'session-paused' }
resume -> { type: 'session-resumed' }
idle return -> { type: 'idle-returned' }
idle decision -> { type: 'idle-saved', decision }
stop feedback -> { type: 'session-saved', greatFlow: payload?.flowQuality === 'Great flow' }
manual save -> { type: 'manual-entry-saved' }
entry edit -> { type: 'entry-updated' }
task invitation -> { type: 'invitation-sent' }
invitation acceptance -> { type: 'invitation-accepted' }
```

API error copy must remain next to the failed control/modal; do not route technical errors through Breezy. Successful event copy follows verbosity: quiet has no message; gentle includes timer, break, idle, Great-flow, and proactive nudge messages; chatty additionally includes task, invitation, manual-entry, and edit confirmations.

- [ ] **Step 5: Compose in `app.vue`**

Remove `breezyMessage`, `activeMood`, and the unused `breakPulse`. Create one runtime after account settings state is available, pass `publish` to feature composables, call `restore` after bootstrap/timer synchronization, and pass `presentation` plus `motionKey` to `BreezyCompanion`.

- [ ] **Step 6: Verify and stop**

```bash
npm run test -- tests/unit/breezy-runtime-composable.test.ts tests/unit/timer-session.test.ts tests/unit/idle-activity.test.ts
npm run test
npm run test:component
npm run lint
NUXT_APP_BASE_URL=/tracker/ npm run build
git diff --check
```

Browser smoke: Start, Pause, Resume, Stop with Neutral, then Stop with Great flow. Confirm label/message transitions, one celebration motion, no duplicate TimerPanel copy, and no regression in persisted timer behavior. Summarize Task 3 and stop until `next`.

---

### Task 4: Authenticated Persisted Nudge Claim And Acknowledgement

**Risk:** High — server eligibility must be authoritative, private, idempotent under concurrent tabs, and safe across reloads.

**Files:**
- Create: `backend/utils/breezy-nudges.ts`
- Create: `backend/api/breezy-nudges/claim.post.ts`
- Create: `backend/api/breezy-nudges/[id].patch.ts`
- Modify: `backend/utils/store.ts`
- Modify: `frontend/types/api.ts`
- Create: `tests/unit/breezy-nudges-route.test.ts`
- Create: `tests/integration/breezy-nudges.test.ts`

**Interfaces:**

```ts
export type BreezyNudgeType = 'long-focus' | 'hydration' | 'ventilation'

export interface ApiBreezyNudge {
  id: string
  relatedEntryId: string
  type: BreezyNudgeType
  message: string
  shownAt: string
  acknowledgedAt: string | null
}

export async function claimDueBreezyNudge(
  userId: string,
  entryId: string,
  now?: Date
): Promise<ApiBreezyNudge | null>

export async function acknowledgeBreezyNudge(
  userId: string,
  nudgeId: string,
  now?: Date
): Promise<ApiBreezyNudge>
```

- [ ] **Step 1: Write route ownership tests**

Mock `requireSessionUser` and prove the claim route passes the session user ID, validates `entryId` with `requiredString(..., { max: 128 })`, and never accepts a body `userId`. Prove acknowledgement uses the session user and route `id` only.

- [ ] **Step 2: Confirm route RED**

```bash
npm run test -- tests/unit/breezy-nudges-route.test.ts
```

Expected: FAIL because both routes are missing.

- [ ] **Step 3: Write PostgreSQL behavior tests**

Using the guarded `_test` database, cover:

- another user's entry returns 404 and creates nothing;
- completed or paused entries return no due nudge;
- muted and quiet settings create nothing;
- before 45 working minutes creates nothing;
- at 45 working minutes creates one `long-focus` row;
- two simultaneous claims at the same threshold return the same effective result with only one row persisted;
- at cadence one, hydration is created; at cadence two, ventilation is created; pauses and excluded idle do not advance eligibility;
- an unacknowledged nudge is returned after bootstrap for its owner only;
- acknowledgement succeeds only for its owner and is idempotent.

Use literal messages:

```ts
const nudgeMessages = {
  'long-focus': 'You have been focused for a while. A short reset can help.',
  hydration: 'A sip of water could be a good reset.',
  ventilation: 'If it works for your space, this is a good moment for fresh air.'
} as const
```

- [ ] **Step 4: Confirm integration RED**

```bash
docker compose -p ag-time-tracker-software -f docker-compose.dev.yml run --rm test sh -c "npx prisma migrate deploy --schema=backend/prisma/schema.prisma && npm run test:integration -- tests/integration/breezy-nudges.test.ts"
```

Expected: FAIL because claim/acknowledgement functions are missing.

- [ ] **Step 5: Implement locked eligibility**

Inside one Prisma transaction, lock the owned active `time_entries` row with `SELECT ... FOR UPDATE`, reload pauses/settings/nudges, reject non-ownership, and calculate current working duration with the existing shared duration utility. Select the next due event in priority order: uncreated long-focus at 45 minutes, then the next cadence slot. Count only `hydration` and `ventilation` rows for cadence slots and alternate by count. Create at most one row per claim.

Do not trust client elapsed seconds, mood, type, cadence, message, user ID, or shown time.

- [ ] **Step 6: Implement routes and bootstrap mapping**

Claim route:

```ts
export default defineEventHandler(async (event) => {
  const user = await requireSessionUser(event)
  const body = await readBody<Record<string, unknown>>(event)
  return { nudge: await claimDueBreezyNudge(user.id, requiredString('entryId', body.entryId, { max: 128 })) }
})
```

Acknowledgement route calls `acknowledgeBreezyNudge(user.id, getRouterParam(event, 'id') || '')` and returns `{ nudge }`. Add `breezyNudges: ApiBreezyNudge[]` to `ApiState`; `publicState` includes only that user's latest 20 rows, ordered newest first, with unacknowledged rows first. Never expose another user's nudges in personal or company state.

- [ ] **Step 7: Verify and stop**

```bash
npm run test -- tests/unit/breezy-nudges-route.test.ts
docker compose -p ag-time-tracker-software -f docker-compose.dev.yml run --rm test sh -c "npx prisma migrate deploy --schema=backend/prisma/schema.prisma && npm run test:integration -- tests/integration/breezy-nudges.test.ts"
npm run lint
git diff --check
git diff -- backend/prisma/schema.prisma backend/prisma/migrations
```

The final schema/migration diff must be empty. Summarize ownership, concurrency, cadence, and privacy evidence, then stop until `next`.

---

### Task 5: Cadence Scheduler, Toast, Verbosity, And Mute Runtime

**Risk:** Medium-high — timers must not leak, duplicate requests, interrupt modals, or announce muted content.

**Files:**
- Create: `frontend/features/breezy/useBreezyNudges.ts`
- Create: `frontend/features/breezy/BreezyNudgeToast.vue`
- Create: `tests/unit/breezy-nudge-scheduler.test.ts`
- Modify: `tests/component/breezy.test.ts`
- Modify: `frontend/app.vue`
- Modify: `frontend/assets/main.css`

**Interfaces:**

```ts
export interface BreezyNudgeDependencies {
  activeEntry: ComputedRef<ApiEntry | null>
  pausedAt: Ref<string | null>
  settings: Pick<ApiSettings, 'muted' | 'breezyVerbosity'>
  suppressed: ComputedRef<boolean>
  restoredNudges: ComputedRef<ApiBreezyNudge[]>
  authFetch: <T>(url: string, options?: TrackerFetchOptions) => Promise<T>
  publish: (event: BreezyEvent) => void
}

export function useBreezyNudges(dependencies: BreezyNudgeDependencies): {
  activeNudge: Readonly<Ref<ApiBreezyNudge | null>>
  dismissActiveNudge: () => Promise<void>
  syncNudgeScheduler: () => void
  disposeNudgeScheduler: () => void
}
```

- [ ] **Step 1: Write scheduler tests with fake timers**

Prove:

- no interval/request while inactive, paused, muted, quiet, or suppressed;
- one immediate claim on eligible running-session synchronization and then one claim every 30 seconds;
- multiple sync calls still leave exactly one interval;
- an unacknowledged restored nudge appears without a new claim;
- claim result maps `long-focus`, `hydration`, and `ventilation` plus the server message to typed events;
- stale responses from a previous entry are ignored;
- dismissal calls `PATCH /api/breezy-nudges/:id`, clears only the matching nudge, and does not close any modal;
- unmount/disposal clears interval and ignores delayed responses.

- [ ] **Step 2: Confirm scheduler RED**

```bash
npm run test -- tests/unit/breezy-nudge-scheduler.test.ts
```

Expected: FAIL because the scheduler does not exist.

- [ ] **Step 3: Implement the lifecycle**

Keep a single 30-second interval and a single in-flight claim. The server remains the source of truth for due time, so the client sends only `{ entryId }`. Suppression pauses claims but must not acknowledge or discard restored nudges.

- [ ] **Step 4: Write and implement toast contracts**

Test and implement:

```vue
<aside v-if="nudge" class="breezy-toast" role="status" aria-live="polite">
  <div>
    <strong>{{ label }}</strong>
    <p>{{ nudge.message }}</p>
  </div>
  <button type="button" aria-label="Dismiss Breezy reminder" @click="$emit('dismiss')">×</button>
</aside>
```

The toast is not a dialog, never captures focus automatically, is reachable by keyboard, and remains understandable with animation disabled. Use `role="status"` only for a newly claimed nudge; restored content renders with `aria-live="off"` to avoid re-announcing on every reload.

- [ ] **Step 5: Compose suppression and settings behavior**

In `app.vue`, compute `suppressed` from every blocking modal/form state: feedback, idle decision, manual entry, entry editor, new task, share task, or settings save. Sync the scheduler after bootstrap, timer start, pause, resume, stop, account-settings changes, and restored state. Render `BreezyNudgeToast` adjacent to `BreezyCompanion` and acknowledge only on explicit Dismiss.

Verify settings semantics:

- `muted`: status `Breezy is muted`, no live region, motion, claim, or toast;
- `quiet`: semantic status remains visible, no proactive claim/toast and no direct-event message;
- `gentle`: key timer/break/Great-flow messages plus persisted proactive nudges;
- `chatty`: gentle behavior plus successful task/manual/edit/invitation confirmations.

- [ ] **Step 6: Verify and stop**

```bash
npm run test -- tests/unit/breezy-nudge-scheduler.test.ts tests/unit/breezy-runtime-composable.test.ts
npm run test:component -- tests/component/breezy.test.ts tests/component/app-account-settings.test.ts
npm run test
npm run test:component
npm run lint
NUXT_APP_BASE_URL=/tracker/ npm run build
git diff --check
```

Browser smoke with a test user's cadence temporarily set to 5 minutes: confirm no nudge when paused/muted/quiet or while a modal is open; confirm one toast when eligible; dismiss it; reload and confirm it stays acknowledged. Restore the user's original cadence/verbosity/mute values after testing. Summarize Task 5 and stop until `next`.

---

### Task 6: Full Acceptance, Accessibility, Documentation, And Milestone Evidence

**Risk:** Medium — this is the release gate for claiming Breezy Companion complete.

**Files:**
- Modify: `docs/specs/features/08-breezy-companion.spec.md`
- Modify: `docs/milestones.md`
- Create: `docs/verification/breezy-runtime-2026-09-02.md`
- Modify only if verification exposes a defect: Breezy files and their focused tests from Tasks 1–5

- [ ] **Step 1: Run automated verification from a clean generated state**

```bash
rm -rf .nuxt .output
npm run test
npm run test:component
docker compose -p ag-time-tracker-software -f docker-compose.dev.yml run --rm test
npm run lint
NUXT_APP_BASE_URL=/tracker/ npm run build
npm run verify:production
git diff --check
```

Do not mark M7 complete if any Breezy test, integration test, type check, production build, or browser acceptance item is missing.

- [ ] **Step 2: Desktop browser acceptance**

At `/tracker/`, verify and capture evidence for:

1. Ready state uses a human-readable label and no duplicated timer copy.
2. Start, Pause, Resume, Stop, Great flow, Manual entry, and Edit entry produce the expected verbosity-specific transitions.
3. Great flow animates once; reduced-motion mode communicates the same state without visible motion.
4. Mascots rotate after two minutes only within the active semantic pool.
5. Long-focus/cadence claims persist once, survive reload, do not duplicate across two signed-in tabs, and acknowledge on Dismiss.
6. Muted and Quiet prevent proactive nudges; Gentle and Chatty match the locked behavior table.
7. Feedback, idle, manual, edit, task, and share modals suppress toast presentation.
8. System, Light, and Dark modes keep readable contrast, visible focus, no overflow, and no console warning/error.

- [ ] **Step 3: Responsive and accessibility acceptance**

At 390px, confirm TimerPanel precedes Breezy, the block and toast fit without horizontal scrolling, Dismiss is keyboard reachable, live announcements are polite and non-repeating, and no information depends on animation or image alone.

- [ ] **Step 4: Record exact evidence**

Write `docs/verification/breezy-runtime-2026-09-02.md` with commands, pass counts, tested URL/base path, database used, screenshots, console/network observations, preference restoration, and any limitation. Do not write `passed` for a check that was inferred rather than executed.

- [ ] **Step 5: Align spec and milestone, then stop**

Update Feature 08 Current Implementation, Gaps, Acceptance Criteria, and Tests with verified behavior only. Mark the Breezy portion of M7 complete only if persisted nudges, cadence, verbosity, mute, Great-flow celebration, accessibility, and browser acceptance all passed; keep unrelated Medal/Profile/Journey gaps accurate.

```bash
git diff --check -- docs/specs/features/08-breezy-companion.spec.md docs/milestones.md docs/verification/breezy-runtime-2026-09-02.md
git status --short
```

Summarize the complete Breezy evidence and remaining unrelated M7 gaps. Stop; do not commit.

---

## Execution Order And Review Gates

1. Task 1 establishes vocabulary and deterministic presentation.
2. Task 2 fixes the misleading visual hierarchy without touching persistence.
3. Task 3 centralizes existing event reactions and makes Great flow observable.
4. Task 4 adds the high-risk server-owned persistence and concurrency boundary.
5. Task 5 activates cadence, settings behavior, and accessible toast delivery.
6. Task 6 is the release gate and documentation pass.

Every task is a separate approval gate. Never begin the next task until the user types `next`.
