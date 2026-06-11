# Milestones — AirGradient Time Tracker (Breezy)

> Status legend: ✅ done · 🟡 partial · ⬜ not started · ⛔ blocked (environment)

## Context / environment note
This work was carried out in a **design environment that produces a self-contained HTML/React prototype**, not a Node/Nuxt repository. The spec targets a full-stack Nuxt 3 + PostgreSQL + Prisma app with a `gh` PR workflow, Vitest/Playwright, and Chrome DevTools MCP. Those server/DB/CI deliverables **cannot be executed here** and are marked ⛔. The complete **product surface and UX** from the spec is implemented as a high-fidelity, interactive prototype (`index.html`) with in-memory state, real client-side CSV/JSON export, the real Breezy mascot artwork, AirGradient branding, and light/dark themes.

## Milestone status
- ✅ **M0** — Spec saved to `docs/spec.md`; this milestones file created; AGENTS.md provided by user.
- 🟡 **M1** — AirGradient-style shell, responsive layout, working start/stop/break timer. *(Prototype state, not Postgres-backed.)* ⛔ Nuxt + PostgreSQL + auth backend.
- ✅ **M2** — Tasks, editable categories (6 defaults + add), clients/projects, manual/retroactive entries (flagged), history log.
- ✅ **M3** — End-of-session feedback (flow / efficiency / energy / note) + multi-select blockers as discrete fields.
- 🟡 **M4** — Idle detection + context-switch counting (simulated/live via visibility API); settings page. ⛔ true OS idle.
- ✅ **M5** — Personal dashboard (hours, by category/day, flow/efficiency/energy, blockers, estimate-vs-actual, week trend) with seeded data.
- ✅ **M6** — Company dashboard (aggregated category, blocker ranking by count & time, context-switch trend, team filter); shared tasks with per-contributor time.
- ✅ **M7** — Breezy companion (mood, encouragement, break/hydration/ventilation nudges, praise, mute), medals, profile w/ team, Breezy Journey (month labels, one point per week, single visualisation).
- 🟡 **M8** — AI Insights panel with graceful no-key fallback (static heuristic suggestions in prototype).
- 🟡 **M9** — CSV/JSON export ✅; accessibility pass 🟡; automated test layers ⛔ (no test runner in this environment).
- ⛔ **M10** — GitHub issue/PR comment review (no repo access here).
- 🟡 **M11** — Browser verification via internal preview + screenshots ✅; Chrome DevTools MCP / PR body ⛔.

## Deferred / blocked (needs the coding-agent repo environment)
- Nuxt 3 + Nitro server API, PostgreSQL + Prisma migrations, session/JWT auth.
- `gh` branch `agentic-timetracker-app`, single PR, PR body updates.
- Vitest unit/component, @nuxt/test-utils, Playwright E2E, migration check.
- Chrome DevTools MCP end-to-end verification.
