# Rivet foundation import record

## Accepted source

| Field | Recorded value |
| --- | --- |
| Repository | `https://github.com/StefanosCodes/Rivet` |
| Accepted commit | `cf116a9968d59f2c72b900cbc42a5f3ab5a9acf4` |
| Commit URL | `https://github.com/StefanosCodes/Rivet/commit/cf116a9968d59f2c72b900cbc42a5f3ab5a9acf4` |
| Git tree | `6773c9cc463c92ba709c4663fd0bcd4c268b162d` |
| Signature | unsigned (`verification.reason=unsigned`) |
| Retrieved | 2026-08-03 |
| Archive SHA-256 | `967ce1fa27bcc9f4db4e56c5f6cbbec0ec85209b48d2db60a5a6451c6a6ed99b` |
| License | Apache-2.0 |
| License SHA-256 | `9e148e4fb8957b9fb2e96a793b5320f639ab44c9bfbb3aee60e772db554f765a` |

The full Apache-2.0 text is retained at `third_party/rivet/LICENSE` and the
attribution/changes notice is retained at `third_party/rivet/NOTICE.md`.

## Copied and adapted boundary

| Rivet source | Clio target | Behavior retained | Local change |
| --- | --- | --- | --- |
| `src/agent-contracts.ts` | `apps/api/src/clio/domain/conversation/contracts.py` | stable terminal/status/event and usage shapes | Canonical Pydantic discriminated events; Clio field names and evidence class |
| `src/agent-client.ts` SSE parser | `apps/web/src/features/conversations/model/parseEventStream.ts` | chunk-safe SSE parsing | Clio event/cursor contract; no handwritten API DTO family |
| `examples/chat-agent/backend/app/main.py` | `apps/api/src/clio/main.py` | FastAPI factory, health, CORS, streaming composition | thin routers and Clio application/domain boundary |
| `rivet_agent/runtime.py` fake/runtime seam | `FoundationChatService` | deterministic provider-free run seam | bounded fixture only; provider adapter deferred to STE-8 |
| inherited chat/reconnect tests | API and web tests | stable ordered stream and reconnect | adapted to Clio paths and monotonic `cursor` |

No source file is copied verbatim except the upstream license. Adapted files are
derivative work under the retained Apache-2.0 terms.

## Intentionally excluded boundary

| Excluded Rivet path/capability | Reason |
| --- | --- |
| `.agents/`, `brain/`, `src/cli.ts`, generic shape/result/usage CLI | not part of Clio's selected chat foundation |
| `packages/react` UI package | accepted archive lacks referenced `lib/chat-state` and `lib/catalog`; Clio requires feature-sliced product UI |
| knowledge/vector ingestion and storage bucket | source ingestion is later Clio scope and the source uses different authority/storage assumptions |
| `rivet_agent/supabase_client.py` and `20260729190145_rivet_persistence.sql` | ordinary service-role/REST persistence violates direct least-privilege `DATABASE_URL` access |
| historical provider matrix and verification Markdown | provenance only; never a Clio result |
| artifact builder and background runs | Clio's only V1 durable worker is later Codex analysis; M1 synthetic job events do not create a worker |
| Rivet skills/spec/pack registries | Clio's workflow-skill and planning-tool contracts have different authority and version semantics |

## Dependency lock and compatibility

The Python import baseline preserves Rivet's exact direct versions. Clio's
`uv.lock` freezes the resolved transitive graph; the root npm lock freezes the
selected frontend and imported Supabase CLI versions. The source archive was
checked with Node 22.23.1, npm 10.9.8, and Python 3.13.1.

One explicit build-tool deviation is recorded: Vite `8.0.12` was replaced by
`8.2.0` after `npm audit` reported GHSA-v6wh-96g9-6wx3 and
GHSA-fx2h-pf6j-xcff. No OpenAI Agents SDK, FastAPI, or protocol dependency was
upgraded during import.

Current official OpenAI guidance was revalidated on 2026-08-03 before import:
one conversation strategy per conversation; Sessions are the default for
application-controlled durable state; server-side Agents SDK tracing is on by
default; traces demonstrate execution rather than correctness; and response
usage exposes input, cached input, cache-write, output, reasoning, total, actual
model, and service tier evidence. The current resolver identified
`gpt-5.6-sol`; no model/provider call occurs in STE-7.

## Verification ledger

### Pinned source before import

| Command | Result |
| --- | --- |
| `npm ci` | PASS; 231 packages audited, 0 vulnerabilities |
| `npm run check && npm run build && npm test` | PASS; 7 files / 23 tests |
| `npm run verify:frontend` | FAIL; accepted archive is missing `packages/react/src/lib/chat-state` and `catalog` |
| `.venv/bin/python -m pytest -q` | PASS; 36 tests |
| `.venv/bin/python -m rivet_agent.evaluations` | PASS; 4 deterministic cases |
| live-provider matrix | NOT RERUN in source; historical files are provenance only |

### Clio after import

| Command | Observed result |
| --- | --- |
| `npm run verify` | PASS; TypeScript check, 4 Vitest tests including frontend dependency direction, and Vite 8.2.0 production build |
| `apps/api/.venv/bin/python -m pytest -q apps/api/tests` | PASS; 4 tests including backend dependency direction and cursor replay |
| `npm audit --audit-level=high` | PASS; 0 vulnerabilities after the recorded Vite security update |
| `git diff --check` | PASS |
| local Uvicorn + `GET /health/live` | PASS; HTTP 200 with `{"status":"live"}` |
| local Uvicorn + `POST /api/v1/foundation/chat/stream` | PASS; ordered cursors 0–5 and terminal `done` |

Provider-backed gates are intentionally deferred to the bounded development
smoke owned by STE-8 and paired comparison owned by STE-37. The fixture usage
event is explicitly `synthetic` with zero tokens and zero provider requests.

## Rollback and update procedure

Rollback reverts the ticket-labeled STE-7 commit; no migration or durable data
is introduced by this slice. To update the foundation, open a separate measured
ticket, accept one full source commit, record its tree/archive/license digests,
diff only the copied/adapted boundary above, rerun source and Clio verification,
and update this ADR rather than importing a moving branch.

## M0 entry-state reconciliation

The canonical M0 contracts and PR #1 description still described an unmerged
Draft and five pending review slots after GitHub recorded PR #1 as merged at
`2021f29c6a6f046e19ad44ec8aeac2ebb31fdc0d`. STE-7 updates the delivery-state
wording without inventing reviewer evidence: the slots remain historically
Pending, while the repository owner's merge and explicitly launched M1 goal are
the current execution authority.
