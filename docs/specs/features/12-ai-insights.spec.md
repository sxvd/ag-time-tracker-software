# 12 AI Insights

Source: extracted from the preserved full brief in `docs/spec.md`.

## Summary

AI Insights is an optional suggestion panel. It can provide personal and company-level suggestions when a key is configured, and must degrade cleanly when no key exists.

## Users

- Individuals looking for a personal improvement suggestion.
- Company viewers looking for an aggregated process suggestion.

## Scope

- Personal insight suggestion.
- Company insight suggestion.
- Optional free LLM API integration.
- Graceful no-key fallback.
- Preserve company privacy boundaries.

## Out Of Scope

- AI as a required dependency for core workflows.
- AI-generated performance ranking.
- Sending sensitive raw personal data unnecessarily.

## UI Reference

The original `docs/spec.md` does not include a dedicated AI Insights ASCII mockup. It is specified as an optional panel/route and appears in the demo script.

## Functional Requirements

- The route works when no API key is configured.
- No-key fallback returns useful deterministic suggestions from dashboard data.
- Personal suggestions use personal dashboard patterns.
- Company suggestions use aggregated process data.
- If an LLM provider is added later, the UI contract should remain stable.

## Data And API

Relevant target data:

- Dashboard rollups from personal and company dashboards.
- Runtime config key such as `NUXT_AI_INSIGHTS_API_KEY`.

Relevant current files:

- `backend/api/insights.post.ts`
- `backend/utils/store.ts`
- `nuxt.config.ts`
- `frontend/app.vue`

## Current Implementation

- `insights.post.ts` requires a session and reads dashboard rollups.
- If no API key is configured, it returns deterministic personal or company suggestions.
- If an API key is present, it returns a placeholder response indicating where provider integration can be swapped in.
- `frontend/app.vue` has buttons for personal and company insights.

## Gaps

- There is no real LLM provider call.
- There are no tests for no-key fallback.
- Prompt/data minimization rules are not yet specified for a future provider integration.
- Company suggestions depend on PostgreSQL-backed aggregate data.

## Acceptance Criteria

- Personal and company insight buttons return suggestions with no key configured.
- No-key response is clearly graceful, not an error.
- Company insight remains aggregate and process-focused.
- Adding a provider later does not require changing the UI contract.

## Tests And Verification

- API tests for no-key personal and company fallbacks.
- API tests for auth requirement.
- Browser check: run one personal and one company insight with no key configured.
