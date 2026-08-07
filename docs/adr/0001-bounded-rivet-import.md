# ADR-0001 — Bounded Rivet foundation import

## Status

Accepted for M1/STE-7 on 2026-08-03.

## Context

Clio accepted `StefanosCodes/Rivet` commit
`cf116a9968d59f2c72b900cbc42a5f3ab5a9acf4` as a source snapshot, not as a
whole-repository dependency or a claim that inherited behavior already works in
Clio. The snapshot is unsigned and its reference frontend package is incomplete.
Its sample persistence also grants ordinary backend access through Supabase's
`service_role`, which conflicts with Clio's direct least-privilege database
contract.

## Decision

Import only the chat foundation's stable SSE vocabulary, cursor replay,
idempotent message/run shape, FastAPI boot pattern, deterministic fake-runtime
test seam, and React stream parser. Place the adapted behavior in Clio's
accepted application/domain/infrastructure and feature-slice boundaries.

Preserve Rivet's direct dependency pins `openai-agents==0.19.0`,
`fastapi==0.140.13`, `httpx==0.28.1`, `python-multipart==0.0.32`, and
`uvicorn==0.51.0` for the import baseline. Do not import the Rivet CLI, brain,
Obsidian material, general capability system, historical eval results, generic
artifact builder, knowledge/vector stack, Supabase REST gateway, or
`service_role` migration.

Vite is intentionally pinned to `8.2.0` instead of the source snapshot's
`8.0.12`: the current npm audit reports GHSA-v6wh-96g9-6wx3 and
GHSA-fx2h-pf6j-xcff through `8.0.15`. This build-tool-only security update does
not change the imported agent, FastAPI, or stream protocol contracts.

## Compatibility and security evidence

- Source commit/tree, downloaded archive digest, license digest, copied and
  excluded boundaries, and verification results are recorded in
  `docs/provenance/rivet-foundation-import.md`.
- Domain/application imports remain independent of FastAPI and provider SDKs.
- Routers contain no SQL or provider calls.
- Stream replay is strictly after a monotonic cursor.
- The imported baseline uses a deterministic fixture provider and makes no
  provider call.

## Consequences

STE-8 must add the Clio product shell, direct Postgres session/run persistence,
generated client, tenant-shaped fixture state, and bounded OpenAI smoke through
the declared ports. STE-37 must add privacy-aware traces and executable evals.
The missing upstream React modules are not reconstructed as Rivet code; Clio's
own feature slices implement the accepted UI contract.

## Revisit trigger

Revisit only when a later accepted Rivet snapshot or measured Clio behavior
shows that an excluded source boundary improves compatibility without weakening
Clio's type ownership, direct database role, tenant reset, or provider isolation.
