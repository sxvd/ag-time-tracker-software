# AirGradient Time Tracker

React/Vite time-tracking demo with a small Node API and SQLite-backed sessions.

## Project layout

- `src/app/` - top-level React application shell.
- `src/domain/` - seeded demo data and derived selectors.
- `src/state/` - client-side store and API orchestration.
- `src/ui/` - shared UI primitives, modal, mascot, and optional tweak helpers.
- `src/views/` - screen-level personal, company, journey, history, and tracking views.
- `src/standalone/` - browser-local mock API used by the standalone demo.
- `public/assets/` - static mascot images served by Vite and copied into builds.
- `backend/` - Node HTTP API and SQLite persistence.
- `scripts/` - build helpers, including the single-file standalone exporter.
- `artifacts/` - screenshots, logs, generated standalone HTML, and archived source uploads.

## Commands

```bash
npm run dev
npm test
npm run build
npm run build:standalone
npm run preview
```

`npm run build:standalone` writes the self-contained HTML demo to `artifacts/standalone/AirGradient-Time-Tracker-Standalone.html`.
