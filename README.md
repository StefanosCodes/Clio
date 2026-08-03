# Clio

Clio is a planned multi-tenant AI planning platform that turns an unclear
business request into a versioned, evidence-backed Build Packet and, after
explicit requester approval, a reviewed delivery structure in Linear.

This repository contains Clio's product, architecture, and evaluation
contracts plus the bounded M1 Rivet-derived application foundation. The
foundation boots and its deterministic stream/reconnect checks pass; the
product shell, durable database path, provider smoke, and evaluation evidence
remain ticket-gated M1 work. Planned capabilities are not implemented behavior.

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
STE-7 → STE-8 → STE-37 on one grouped draft pull request. The first real
bounded model smoke belongs to STE-8 and the first reproducible paired planning
comparison belongs to STE-37. The completed M1 draft requires user inspection
and explicit merge authorization; this repository never treats a draft,
historical Rivet evidence, or synthetic event as permission to merge.

## V1 boundary

GitHub and Linear are the core integrations. GitHub/Codex access is bounded and
read-only; deterministic publication to Linear requires approval of the exact
Build Packet and preview. Direct Slack/Teams connectors, external Clio MCP,
executable tenant tools, and multi-person product approval are deferred.
