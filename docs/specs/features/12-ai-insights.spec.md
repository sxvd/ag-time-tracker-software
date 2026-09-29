# 12 AI Insights

Source: extracted from the preserved full brief in `docs/spec.md`.

## Summary

AI Insights is deferred. It is not part of the current Personal Dashboard, Company Dashboard, backend API, runtime configuration, or production workflow.

## Users

- None in the current product scope.

## Scope

- Record the deferral explicitly so AI suggestions are not accidentally restored during dashboard work.

## Out Of Scope

- AI as a required dependency for core workflows.
- Personal and company AI suggestion panels.
- AI insight API routes and provider integration.
- AI-specific runtime environment variables.
- AI-generated performance ranking.
- Sending sensitive raw personal data unnecessarily.

## UI Reference

The Personal Dashboard ASCII mockup in `docs/spec.md` intentionally excludes AI suggestions.

## Functional Requirements

- Personal and company dashboards do not render an AI suggestion panel or button.
- The current product does not expose an AI insights API route.
- The runtime does not require or advertise an AI provider key.
- Removing AI suggestions must not change dashboard privacy, tracking, export, Breezy, or medal behavior.

## Data And API

- There is no current AI-specific database model or API route.
- Dashboard rollups remain available through the authenticated bootstrap API for non-AI dashboard features.
- No AI provider key is exposed through Nuxt runtime configuration or deployment environments.

## Current Implementation

- Personal and company dashboards contain no AI suggestion panel or request controls.
- The former insights API route and frontend panel have been removed.
- App orchestration, Nuxt runtime configuration, Docker Compose, deployment setup, and environment documentation do not contain an AI insight dependency.

## Gaps

- AI remains intentionally deferred. Restoring it requires a separately approved product and privacy design.

## Acceptance Criteria

- No AI suggestion panel or button appears on either dashboard.
- No current production request can call an AI insights endpoint.
- No AI provider key is required in current environment configuration.
- Dashboard, export, and privacy tests continue to pass after removal.

## Tests And Verification

- Component contracts assert that both dashboards omit AI suggestion controls.
- Production configuration tests assert that no AI provider key is required.
- Browser check confirms both dashboards work without AI panels or failed AI requests.
