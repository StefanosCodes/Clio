# Clio

Clio is a planned multi-tenant AI planning platform that turns an unclear
business request into a versioned, evidence-backed Build Packet and, after
explicit requester approval, a reviewed delivery structure in Linear.

This repository contains Clio's product, architecture, and evaluation
contracts plus the bounded M1 Rivet-derived foundation and working application
shell. The shell uses direct Postgres persistence, generated API contracts,
fixture-organization state, reconnectable streams, versioned packet fixtures,
and normalized development-usage evidence. Planning intelligence, verified
Clerk tenancy, production RLS evidence, a real Codex worker, and deployment are
still later ticket-gated work.

## Start here

- [Product contract](docs/product/product-contract.md) — product promise,
  users, Build Packet, interaction model, V1 scope, milestones, risks, and
  accepted decisions.
- [System architecture and decision records](docs/architecture/system-architecture-and-decision-records.md)
  — boundaries, authority, workflow, persistence, integrations, and ADRs.
- [Code organization and contract registry](docs/architecture/code-organization-and-contract-registry.md)
  — feature slices, backend layers, shared types, tables, events, jobs, and
  generated-client boundaries.
- [Pricing, usage, and environment contract](docs/architecture/pricing-usage-and-environment-contract.md)
  — plans, metering, reservations, credentials, and environment rules.
- [M0 evaluation contract](docs/evaluation/m0-evaluation-contract.md) — seeded
  cases, labels, rubrics, metadata, thresholds, privacy, and paired comparison.
- [M0 seed manifest](tests/evals/m0_seed_cases.json) — the declarative 10-case
  fixture set. M0 makes no real provider call.
- [STE-8 application-shell evidence](docs/evidence/ste-8-application-shell.md) —
  direct-Postgres, generated-contract, browser acceptance, and bounded provider
  smoke evidence with explicit M2 boundaries.
- [STE-37 evaluation evidence](docs/evidence/ste-37-evaluation-harness.md) —
  frozen schedules, privacy-aware traces, deterministic fixtures, paired
  provider observations, and the explicit no-selection result.

## Run the M1 shell locally

1. Run `npm ci` and `uv sync --project apps/api --all-extras --frozen`.
2. Start local Supabase Postgres and apply the CLI-created migration with
   `npx supabase db reset`. The repository configuration disables the HTTP,
   auth, storage, realtime, studio, edge, and analytics services for this slice.
3. Set `DATABASE_URL` to the direct local Postgres URL reported by the CLI and
   set `CLIO_DATABASE_ROLE=clio_app`. Never commit either setting.
4. Run the API with
   `PYTHONPATH=apps/api/src uv run --project apps/api uvicorn clio.main:app --host 127.0.0.1 --port 8020`.
5. In another terminal, run
   `VITE_API_URL=http://127.0.0.1:8020 npm --workspace @clio/web run dev`.

The two selectable organizations are fixtures for reset/reload testing only.
They do not establish real tenant membership or production isolation.

## Source-of-truth rule

Durable product, architecture, evaluation, and implementation contracts live
in this repository and change through reviewed commits and pull requests.
Linear tracks work, dependencies, decisions, human review, completion receipts,
and links to exact repository evidence. Linear documents may summarize these
contracts but must not become a second full copy.

If repository and Linear execution records disagree, stop dependent work and
reconcile the mismatch explicitly. Chat history, generated output, and ticket
status alone do not prove implementation.

## Current delivery gate

M0 merged through [PR #1](https://github.com/StefanosCodes/Clio/pull/1) at
`2021f29c6a6f046e19ad44ec8aeac2ebb31fdc0d`. M1 executes serially as
STE-7 → STE-8 → STE-37 on one grouped draft pull request. All three ticket
gates now have committed evidence. STE-8 contains the first bounded model smoke;
STE-37 contains the first reproducible paired planning comparison and records
`no_production_selection_human_adjudication_required`. The completed M1 draft
requires user inspection and explicit merge authorization; this repository
never treats a draft, historical Rivet evidence, synthetic event, or provisional
evaluation result as permission to merge.

## V1 boundary

GitHub and Linear are the core integrations. GitHub/Codex access is bounded and
read-only; deterministic publication to Linear requires approval of the exact
Build Packet and preview. Direct Slack/Teams connectors, external Clio MCP,
executable tenant tools, and multi-person product approval are deferred.
