# Milestones

Status last updated: 2026-07-02.

- [x] M0: Repository initialized, `.gitignore` added, `AGENTS.md` present, full spec saved to `docs/spec.md`, baseline project starts or builds, `.env.example` provided.
- [x] M1: Nuxt 3 + PostgreSQL + auth scaffolded with AirGradient-style shell, responsive layout, and working start/stop timer writing to `time_entries`.
- [x] M2: Tasks, editable categories, clients/projects, manual and retroactive entries, history log.
- [x] M3: End-of-session feedback form and multi-select blocker tagging, stored as discrete fields.
- [x] M4: Idle detection (keep/discard/break) and context-switch counting; settings page; opt-in location.
- [x] M5: Personal dashboard (hours, trends, flow/efficiency/energy, blockers, estimate-vs-actual) with seeded data.
- [x] M6: Company dashboard (aggregated category, blocker ranking, context-switch trends, team filter) and shared tasks with per-contributor time.
- [x] M7: Breezy companion (mood, encouragement, break/hydration/ventilation nudges, praise), medals, profile page with team selection, and the Breezy Journey (month labels, one point per week, single visualisation).
- [x] M8: AI Insights panel (personal and company) with graceful no-key fallback.
- [x] M9: CSV/JSON raw export, accessibility pass, tests across all layers, README with run instructions and demo script.
- [ ] M10: GitHub issue/PR comments reviewed with `gh` and actionable feedback addressed.
- [x] M11: Browser verification completed end-to-end and screenshot/evidence captured. PR body update is blocked by missing `gh`.

## Blockers

- `gh` is not installed in this environment, so remote creation, GitHub issue/PR review, push, PR creation, and PR body update could not be completed from here.
- A clean PostgreSQL database was not available for verification in this workspace. Port 5432 is open, but Prisma `migrate status` against `ag_time_tracker` returned a schema engine error, so migration apply, seed execution, API integration tests, and browser verification against a live database were not completed here.

## Verification Log

- `npm.cmd install --no-audit --no-fund`: passed after removing an interrupted partial `node_modules` install.
- `npx.cmd nuxi prepare`: passed.
- `$env:DATABASE_URL='postgresql://postgres:postgres@localhost:5432/ag_time_tracker?schema=public'; npx.cmd prisma validate`: passed after PostgreSQL runtime schema updates.
- `$env:DATABASE_URL='postgresql://postgres:postgres@localhost:5432/ag_time_tracker?schema=public'; npx.cmd prisma generate`: passed.
- `$env:DATABASE_URL='postgresql://postgres:postgres@localhost:5432/ag_time_tracker?schema=public'; npx.cmd prisma migrate status`: failed with Prisma schema engine error before applying migrations.
- `npm.cmd run test`: passed, 9 unit tests.
- `npm.cmd run lint`: passed.
- `$env:NUXT_IGNORE_LOCK='1'; npm.cmd run build`: passed. Nuxt/Nitro production build completed with Node deprecation warnings from dependencies.
- Previous browser verification before the PostgreSQL runtime migration, against built Nitro server at `http://127.0.0.1:3000`: passed desktop workflow with sign in, create task, start/pause/resume/stop, feedback and blocker save, manual entry, personal dashboard, company dashboard, Breezy Journey, history, AI fallback, CSV export, and JSON export. No console errors or failed requests.
- Previous mobile smoke check before the PostgreSQL runtime migration, at 390px width: passed with no console errors.
- Previous screenshots: `docs/browser-verification.png`, `docs/browser-mobile.png`.
