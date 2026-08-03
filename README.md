# Clio

Clio is a planned multi-tenant AI planning platform that turns an unclear
business request into a versioned, evidence-backed Build Packet and, after
explicit requester approval, a reviewed delivery structure in Linear.

This repository currently contains Clio's product, architecture, and evaluation
contracts. It does not yet contain a verified Clio application. Planned
capabilities are not implemented behavior.

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

M0 is assembled in a grouped draft pull request. Before it may merge or M1 may
start, three target requesters and two engineers must review the same exact
final PR head, and the findings must be recorded in Linear. Any later commit
invalidates review tied to an older head. The first real baseline-versus-
candidate model run belongs to STE-37 in M1, after this gate passes.

## V1 boundary

GitHub and Linear are the core integrations. GitHub/Codex access is bounded and
read-only; deterministic publication to Linear requires approval of the exact
Build Packet and preview. Direct Slack/Teams connectors, external Clio MCP,
executable tenant tools, and multi-person product approval are deferred.
