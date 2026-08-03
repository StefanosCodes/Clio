# STE-8 application-shell evidence

Date: 2026-08-03  
Environment: local development only  
Authority: `FixtureOrganizationContext`; this is not Clerk membership or production tenant-isolation evidence.

## Outcome

Clio now has a runnable conversation-first shell with durable Postgres conversations/messages/runs/events/packet snapshots, generated frontend DTOs, fixture-organization reset behavior, and a collapsible Build Packet surface. Saved idle conversations clearly state that no worker is running.

## Direct Postgres evidence

- The Supabase CLI `2.110.0` initialized `supabase/` and created the versioned migration filename before its SQL was edited.
- The migration defines the NOLOGIN least-privilege `clio_app` role; the runtime uses direct `asyncpg==0.31.0`, not Supabase REST and not a service-role key.
- Local verification connected as the Postgres administrator only to `SET LOCAL ROLE clio_app`; a deployed application must connect directly with an out-of-band `clio_app` login credential.
- The Supabase Postgres image pull stalled without progress. The migration and integration proof therefore ran against the already-local `pgvector/pgvector:pg17` image on loopback. This is a recorded local-infrastructure deviation, not a claim that the full Supabase local stack ran.
- PostgreSQL integration observed: two conversations persisted/reopened; cross-organization reads returned no rows; replay after cursor 2 returned 3, 4, 5; a concurrent active turn was rejected; cancel released the boundary; packet idempotency returned the accepted version; a stale base version produced `VersionConflict`; the custom Agents SDK Session supported ordered read, pop, and clear.
- Production RLS/Clerk isolation proof remains owned by STE-10/STE-11 in M2.

## Generated contract evidence

`npm run generate:api` exports FastAPI OpenAPI and runs pinned `openapi-typescript==7.13.0`. The web application imports its conversation, packet, run, message, and discriminated stream-event types from `@clio/api-client`; it does not maintain a parallel handwritten DTO union.

## Provider smoke preregistration

- Model: `gpt-5.6-sol`
- API/runtime: Responses through Agents SDK `0.19.0` with `PostgresAgentSession`
- Reasoning: low
- Service tier request: default/standard
- Output cap: 128 tokens
- Timeout/retries: 45 seconds, one attempt, client retries disabled
- Pre-dispatch maximum: 10,000 micro-USD ($0.01)
- Price version: `openai-standard-gpt-5.6-sol-short-2026-08-03`
- Retention: Agents tracing disabled; raw prompt/response absent from retained evidence and session cleared; only redacted conversation placeholders, IDs, hash, normalized usage, pricing version, and outcome retained.

## Provider smoke observation

The one authorized attempt completed successfully:

- actual model: `gpt-5.6-sol`
- actual service tier: `default`
- input / cached input / cache write: 50 / 0 / 0 tokens
- output / reasoning: 15 / 0 tokens
- total: 65 tokens
- calculated cost: 700 micro-USD ($0.0007)
- evidence class: `development`
- response SHA-256: `0271d4dace92cd1c36e175f21089480333e0eb9e864eb65eb5d9fd105f6ef943`
- provider request and response IDs: present, values intentionally omitted from this document
- raw content retained: no

The versioned cost uses the official 2026-08-03 short-context standard rates: $5/M uncached input, $0.50/M cached input, $6.25/M cache write, and $30/M output. The SDK reported zero reasoning tokens; reasoning tokens are normalized separately but billed as output when present.

## UI acceptance observation

The running application was exercised in the in-app browser against the real local API and Postgres process:

1. Existing persisted conversations loaded and reopened with the “Saved conversation — no worker running” terminal label.
2. A new conversation was created and navigable by URL.
3. A fixture turn streamed, reconciled to exactly one durable user message and one durable assistant message, and reopened without duplication.
4. A Build Packet fixture snapshot was created at version 1.
5. Switching from Acme Studio to Orbit Works hid Acme messages, conversations, selection, packet, and drafts; Orbit loaded empty.
6. Switching back reloaded the Acme conversation and its version-1 packet.

Visual proof: `docs/evidence/ste-8-shell.png`.

## Verification commands

```text
npm run generate:api
npm run check
npm run test
npm run build
npm audit --audit-level=high
cd apps/api && .venv/bin/pytest -q
TEST_DATABASE_URL=<local-loopback-url> apps/api/.venv/bin/pytest -q apps/api/tests/test_postgres_application_shell.py
psql <local-loopback-url> -v ON_ERROR_STOP=1 -f supabase/migrations/20260803194914_m1_application_shell.sql
```

Observed before ticket commit: 9 frontend tests passed across 5 files; TypeScript and Vite production build passed; 6 default backend tests passed with the explicitly local-Postgres test skipped; the Postgres integration test passed against a freshly migrated PostgreSQL 17 database when its loopback URL was supplied; npm reported 0 vulnerabilities.

## Official references

- OpenAI Agents SDK session behavior: https://openai.github.io/openai-agents-python/sessions/
- OpenAI Agents SDK tracing: https://openai.github.io/openai-agents-python/tracing/
- OpenAI API pricing: https://developers.openai.com/api/docs/pricing
- OpenAI `gpt-5.6-sol` migration guide: https://developers.openai.com/api/docs/guides/upgrading-to-gpt-5p6-sol
- Supabase CLI local development: https://supabase.com/docs/guides/local-development/cli/getting-started
- Supabase row-level security: https://supabase.com/docs/guides/database/postgres/row-level-security
