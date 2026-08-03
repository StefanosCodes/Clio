# Clio Code Organization and Contract Registry

**Status:** Accepted planning contract. The exact imported Rivet paths remain
subject to the M1 pinned-snapshot inventory; M1 may adapt names but must preserve
the boundaries and dependency direction defined here.

**Implementation status:** specification only. The repository tree, generated
client, database objects, architecture tests, and Rivet import do not exist in
M0 and must not be credited as implemented behavior.

## Outcome

Make Clio easy for humans and coding agents to navigate, change, and verify by
giving every behavior one obvious home and every cross-layer change an explicit
contract path.

## Repository map

```text
apps/
  web/
    src/
      app/                    # bootstrap, providers, router, global composition
      pages/                  # route-level screens; composition only
      widgets/                # reusable page sections
      features/               # user actions and use-case UI
        auth/
        organization-switching/
        conversations/
        workspace-tools/
        packet-editing/
        source-ingestion/
        github-connection/
        engineering-analysis/
        packet-review/
        delivery-planning/
        linear-publication/
        usage-status/
      entities/               # domain-shaped state and presentation
        organization/
        conversation/
        planning-tool/
        build-packet/
        evidence/
        engineering-analysis/
        delivery-plan/
        subscription/
      shared/
        api/                   # imports generated client from packages/api-client
        config/
        lib/
        ui/
        types/                 # client-only primitives, never duplicate API DTOs
  api/
    src/clio/
      main.py
      api/
        dependencies/         # verified actor/org, transaction, provider handles
        errors/               # stable domain error to HTTP/SSE mapping
        routers/              # thin controllers grouped by capability
      application/
        ports/                 # repository/provider protocols used by use cases
        use_cases/             # one cohesive command/query orchestration per module
        policies/              # authorization, readiness, usage, invalidation
      domain/
        identity/
        billing/
        conversation/
        planning_tools/
        packet/
        sources/
        repository_context/
        analysis/
        review/
        delivery/
        integrations/
        evaluation/
        audit/
        errors.py
      infrastructure/
        db/
          repositories/       # raw parameterized SQL behind application ports
          queries/            # reusable bounded SQL fragments only
          transaction.py
        clerk/
        openai/
        codex/
        github/
        linear/
        storage/
      agents/
        planning/
        codex_specialist/
        context/
        tools/
      workers/
        engineering_analysis/
      observability/
        tracing/
        metrics/
        redaction/
packages/
  api-client/                 # generated from FastAPI OpenAPI; never hand edited
supabase/
  config.toml
  migrations/                 # DDL, constraints, indexes, functions, RLS policies
tests/
  contract/                   # Pydantic/OpenAPI/TypeScript/SQL compatibility
  integration/                # Postgres and provider adapter boundaries
  e2e/                        # actor journeys and failure/recovery paths
  evals/                      # labeled agent and Codex fixtures/graders
docs/
  architecture/
  adr/
```

## Dependency and ownership rules

### React feature slices

The frontend follows `app/pages -> widgets -> features -> entities -> shared`.
A layer may import only from layers to its right. A slice exposes a deliberate
public API; code must not deep-import another slice's internal components,
hooks, state, or schemas.

* `app` owns startup, providers, global routing, and organization-change reset.
* `pages` compose complete routes and own no reusable business behavior.
* `widgets` compose multiple features/entities into substantial page regions.
* `features` own user actions such as sending a planning turn or approving a
  packet version.
* `entities` render and locally model Clio domain nouns without performing
  cross-entity workflows.
* `shared` contains provider-neutral UI/utilities/config and the generated API
  client boundary. It must not contain Clio business rules merely to avoid an
  import.

The `workspace-tools` feature owns composer selection plus create, version,
archive, and duplicate actions. The `planning-tool` entity renders declared
questions, guidance, output format, creator, lifecycle, and version metadata.
Neither layer executes tenant-supplied code or converts stored text into new
agent/tool authority.

Server state is accessed through generated API operations wrapped by the
owning feature. Provider DTOs are not copied into UI state. Organization switch
clears or rekeys organization-scoped caches, streams, selections, and optimistic
mutations before the new organization becomes visible.

### Frontend state ownership

| State class | Authoritative owner | Client representation | Persistence/recovery |
| --- | --- | --- | --- |
| Durable domain state | PostgreSQL through FastAPI | TanStack Query organization-scoped cache | Refetch/reconcile from accepted server version |
| Identity presentation | Clerk React SDK | current user/organization display state | Backend re-verifies membership for every sensitive action |
| Navigation | URL/router | conversation, packet, review tab, destination identity | Restored by URL only after authority check |
| Live planning stream | persisted run events | feature-local discriminated reducer and monotonic cursor | reconnect from last acknowledged cursor or show terminal/retry state |
| Unsaved form/draft | owning feature | local reducer/form state | explicit discard, conflict, or save; not domain truth |
| Ephemeral UI | component/feature | `useState`/`useReducer` | intentionally discarded |
| Codex job projection | PostgreSQL job/result | query plus event/poll projection | refetch terminal state after disconnect |

V1 uses TanStack Query for server state, the router for navigable state,
feature-local reducers for ordered stream/draft state, and local React state for
ephemeral UI. Do not add Redux or Zustand as a general application store. A
client-only global store may be introduced later only when measured cross-tree
state has no clearer owner and its reset/tenant behavior is specified.

Organization-scoped query keys begin with the active organization identity,
for example `['organization', organizationId, 'packet', packetId]`. An active
organization change is an explicit client transaction:

1. abort in-flight streams and mutations;
2. hide prior-organization content immediately;
3. clear or rekey organization-scoped queries, selections, drafts, and
   optimistic mutations;
4. resolve the new Clerk organization and reload through FastAPI;
5. render data only after the backend verifies membership.

Clerk client state is presentation input, not backend authority. Query-cache
presence never grants access.

Streaming uses a generated discriminated `StreamEvent` union. A feature reducer
derives `StreamViewState` from ordered events and a monotonic `StreamCursor`.
Reconnect asks for events after the last acknowledged cursor. On a terminal
event, the client reconciles the authoritative persisted run/message and does
not retain partial stream text as a separate durable message.

Optimistic behavior is narrowly allowed. Local drafts and reversible UI may be
optimistic. A packet mutation must carry `base_packet_version` and an
idempotency key, then replace its cache entry with the accepted server version.
A stable `VersionConflict` returns the current version for reload/compare/reapply.
Approvals, subscription/usage decisions, integration authorization, Codex job
completion, and Linear publication are never optimistically marked successful.

### FastAPI MVC-shaped boundary

For this SPA, the backend uses MVC terminology at the delivery boundary:

* **Controller:** FastAPI router/dependency code parses requests, verifies the
  actor and active organization, invokes one application use case, and maps a
  stable result/error.
* **Model:** Pydantic domain/application contracts plus PostgreSQL stored state
  and invariants.
* **View model:** versioned Pydantic HTTP/SSE responses consumed by React. React
  owns the rendered view.

The internal execution path is:

```text
FastAPI controller
-> verified RequestContext
-> application command/query
-> domain policy/state transition
-> declared repository/provider port
-> infrastructure adapter
-> PostgreSQL or external provider
```

Controllers contain no SQL, agent prompts, provider decisions, or business
state transitions. Application use cases own orchestration and transaction
boundaries. Domain code is provider independent. Infrastructure depends inward
by implementing declared ports; domain/application code never imports Clerk,
OpenAI, Codex, GitHub, Supabase, or Linear SDK DTOs.

### SQL and migration ownership

Clio uses raw parameterized PostgreSQL, not SQLAlchemy or Alembic.

* SQL queries live only in bounded repository/query modules.
* DDL, constraints, indexes, functions, triggers, and RLS policies live only in
  versioned `supabase/migrations` files.
* Migrations never run automatically at FastAPI startup.
* Every tenant repository method requires verified organization context and an
  explicit organization predicate; RLS is defense in depth.
* The application role is non-owner, non-superuser, least privilege, and has no
  `BYPASSRLS`.
* A transaction sets actor/organization context transaction-locally and proves
  pooled connections cannot retain it.

## Canonical type registry

Pydantic is canonical for application and wire contracts. PostgreSQL DDL is
canonical for stored invariants. OpenAPI/JSON Schema generates the TypeScript
API client and DTOs. Provider-specific DTOs stop at infrastructure adapters.

| Family | Canonical Pydantic/application contracts | Generated TypeScript consumers | PostgreSQL/storage authority and invariants |
| --- | --- | --- | --- |
| Identity and authority | `ActorRef`, `OrganizationRef`, `MembershipSnapshot`, `OrganizationRole`, `RequestContext`, `AuthorityDecision` | auth and organization-switching features, route guards, audit views | organization/membership snapshots and webhook receipts; Clerk identity remains authoritative; actor/org/version keys and idempotent reconciliation |
| Subscription and usage | `PlanPolicy`, `SubscriptionSnapshot`, `UsagePeriod`, `UsageReservation`, `UsageEvent`, `TokenUsage`, `ModelPriceVersion`, `CostSnapshot`, `UsageDecision`, `BillingClass`, `MeteredOperation` | usage-status and billing surfaces; model/Codex operation status | policy/subscription/period/reservation/event/price records; integer micro-USD, atomic settlement, unique provider response, immutable historical price basis |
| Conversation and runtime | `Conversation`, `Message`, `SessionItem`, `WorkflowRun`, `RunEvent`, discriminated `StreamEvent`, `StreamCursor`, `RunSnapshot`, `PlanningTurnResult`, discriminated `NextAction`, `PacketPatch`, `MutationReceipt`, `VersionConflict`, stable run/error states | conversation feature, SSE reducer, reconnect and conflict UI | conversations, messages/session items, runs/events; one mutating turn, monotonic cursor, idempotent terminal state, optimistic packet base version |
| Frontend control state | TypeScript-only derived `OrganizationCacheScope`, `StreamViewState`, `ReconnectState`, `ClientDraftState`; no Pydantic twin | feature reducers, organization-scoped query keys, router, local UI | none; derived client state never becomes durable domain truth or duplicates API DTOs |
| Planning tools | `PlanningTool`, immutable `PlanningToolVersion`, `PlanningToolKind`, `PlanningQuestion`, `AnswerGuidance`, `ContextInstruction`, `OutputFormat`, `PlanningToolRef`, `ToolAuthorityDecision`, `ToolLifecycleState` | native chat-composer selector, workspace-tool management, creator/version metadata | tenant-owned tool identity plus immutable versions/questions/instructions; creator and Admin mutation authority, archived-tool rules, unique org/name/version, no executable payload or model/tool grant |
| Build Packet | `BuildPacket`, `BuildPacketVersion`, `Requirement`, `AcceptanceCriterion`, `Claim`, `Assumption`, `Unknown`, `Decision`, `Risk`, `Dependency`, `Revision`, `PlanningToolRef`, `PacketProfile`, `WorkflowSkillRef` | packet artifact/editor, readiness, review, delivery planning | packet identity plus immutable versions/revisions/responsibilities and selected tool/version; exact version binding, provenance, optimistic concurrency, no silent overwrite |
| Source and evidence | `SourceConnection`, `SourceObject`, `Upload`, `SourceSnapshot`, `EvidenceExcerpt`, `Citation`, `Provenance`, `RetentionState`, `ProcessingState` | source-ingestion, citation, conflict, and deletion UI | source/upload/snapshot/excerpt/citation metadata plus storage object refs; tenant scope, digest/provenance, processing and retention/deletion state |
| Repository context | `GitHubInstallationRef`, `RepositorySelection`, `RepositorySnapshot`, `RepositoryLocation`, `RepositoryEvidence`, `ContextBundle` | GitHub connection and evidence surfaces | installation/selection/exact-commit snapshot metadata; unique repository/commit identity, explicit selection, revoked access denied, derived-data retention |
| Engineering analysis | `EngineeringAnalysisTask`, `EngineeringAnalysisResult`, `EngineeringFinding`, `FindingKind`, `Limitation`, `AnalysisStaleness` | engineering-analysis and packet-review features | version-bound tasks/results/findings; organization, packet/version, repository/commit and input/config hashes; stale bindings cannot be accepted |
| Durable jobs | `EngineeringAnalysisJob`, `JobLease`, `JobAttempt`, `JobState`, `FailureClass`, `Cancellation`, `TerminalJobResult` | job projection and operator recovery views | jobs/leases/attempts/terminal results; legal state transitions, bounded attempts, lease ownership/expiry, one accepted terminal result |
| Review and approval | `PacketResponsibility`, `ReviewRequest`, `RequesterApproval`, `EngineeringFeedback`, `ReviewDecision`, `ApprovalInvalidation`, `Waiver` | requester approval and optional engineer-feedback features | one requester approval plus separate optional feedback/waivers; exact packet/tool version, deterministic staleness/invalidation |
| Delivery and publication | `DeliveryPlan`, discriminated plan variants, `MilestoneProposal`, `WorkItemProposal`, `DependencyEdge`, `PublicationPreview`, `PublicationApproval`, `PublicationResult`, `ExternalRecordRef`, `IdempotencyRecord` | delivery-planning and Linear-publication features | plan versions/nodes/edges/publications/external IDs; acyclic plan, exact preview approval, idempotent mapping, partial-success reconciliation |
| Integration lifecycle | `IntegrationConnection`, `CredentialRef`, `ResourceSelection`, `ConnectionHealth`, `OAuthState`, `Revocation`, `ReconciliationResult` | GitHub/Linear setup, selection, health, reconnect, revoke | connection metadata and credential references only; server-held secret material, state/PKCE digest, selected resources, health/revocation/reconciliation state |
| Evaluation and audit | `EvalCase`, `EvalRun`, `GraderResult`, `TraceRef`, `AuditEvent`, `RedactionDecision`, `VersionRef` | evaluation/operator views; no private raw corpus in browser by default | fixture/run/result metadata, trace references, audit events; version provenance, privacy class, redaction decision, retention and immutable audit ordering |
| Public errors | discriminated stable error codes plus safe metadata; no raw provider/database exceptions | generated HTTP/SSE unions and feature recovery UI | optional safe error/audit record only; provider/database details remain internal and secrets are never persisted in public payloads |

All tenant-owned types carry `organization_id`. Version-bound types carry the
exact object and version identifiers. Provider requests distinguish requested
from actual model/service tier. Money is integer micro-USD; token counts are
nonnegative integers. Every union used across a boundary is discriminated.

## Stored data registry

Exact table and index names are finalized in migrations, but ownership and the
minimum proof surface are fixed here. Every tenant row uses `organization_id`
except immutable global configuration explicitly justified in an ADR.

| Stored family / owner | Required records | Tenant/version and uniqueness keys | Constraints, indexes, and RLS | Retention/recovery | Required cross-tenant proof |
| --- | --- | --- | --- | --- | --- |
| Identity / `domain.identity` | organizations, membership snapshots, Clerk webhook receipts | organization, user, source version/event ID | unique webhook ID; membership lookup indexes; deny-by-default tenant policy under non-owner role | reconcile out-of-order events; remove access immediately; retain minimal audit per policy | actor from org A cannot select/mutate org B; removed member fails on pooled connection reuse |
| Billing/usage / `domain.billing` | subscription snapshots, policy versions, periods, reservations, append-only usage/cost events, price versions | organization + period/policy; provider response ID; reservation idempotency key | nonnegative integer/check constraints; unique provider/idempotency keys; org/active-period indexes; tenant RLS | immutable historical price/evidence; settle/release once; period reset and reconciliation | org A cannot read/reserve/settle org B; concurrent reservations cannot exceed one org allowance |
| Conversation / `domain.conversation` | conversations, messages/session items, workflow runs, run events | organization + conversation/run; monotonic event cursor; mutation idempotency | one active mutating turn; unique run/cursor/idempotency; org/recent-run indexes; tenant RLS | replay cursor, terminal reconciliation, policy-governed chat deletion | org A cannot resume/stream/mutate org B; transaction-local context clears before pool reuse |
| Planning tools / `domain.planning_tools` | tool identities, immutable versions, ordered questions, guidance/context/output declarations, creator/change audit | organization + tool + version; normalized organization/name; creator actor | unique org/name/version; immutable published version; kind/lifecycle checks; org/status/creator indexes; tenant RLS; no executable payload column | creator/Admin edit creates a new version; archive blocks new selection while existing packet refs remain readable | org A cannot discover/use/duplicate/archive org B tool; non-creator Member cannot mutate another member's tool; Admin can manage within own org only |
| Packet / `domain.packet` | packets, immutable versions, revisions, responsibilities | organization + packet + version; base version | unique packet/version; accepted-version and responsibility indexes; tenant RLS | preserve revision lineage; stale writes fail with current version; controlled deletion | org A cannot read/patch/review org B; stale base version cannot overwrite current version |
| Evidence / `domain.sources` | sources, uploads, snapshots, excerpts, citations, storage refs | organization + source/snapshot; digest/object version | digest/provenance constraints; org/source/status indexes; tenant RLS plus storage policy | processing recovery, retention expiry, object and derived-data deletion | org A cannot resolve metadata/object URL/content for org B; deletion removes derived access |
| GitHub / `domain.repository_context` | installations, selections, exact-commit snapshots/evidence | organization + installation/repository/commit | unique selection and snapshot identity; org/repo/commit indexes; tenant RLS | rate-limit/reconnect; revoke denies new reads; derived snapshot retention/deletion | org A cannot use org B installation/selection/snapshot even with a guessed repository ID |
| Analysis/jobs / `domain.analysis` | tasks, jobs, leases, attempts, results/findings | organization + job; packet/version + repository/commit + input/config hash | legal-state checks; unique accepted result; lease owner/expiry and ready-queue indexes; tenant RLS | lease reclaim, bounded retry/cancel, stale result retained but not accepted, checkout destroyed | worker/publication paths cannot cross org; expired lease holder cannot commit after reassignment |
| Review / `domain.review` | requests, responsibilities, requester approvals, optional engineering feedback, waivers | organization + packet/tool versions + responsibility/actor | decision/state checks; one exact-version requester approval; pending-feedback indexes; tenant RLS | consequential change invalidates approval and stales feedback; actor removal requires requester reassignment | org A actor cannot review org B; optional feedback cannot substitute for requester approval |
| Delivery / `domain.delivery` | plan versions, nodes/edges, publication previews/approvals/results, external IDs | organization + plan/version; destination + idempotency key; external ID | acyclic-edge validation; unique logical publication/external mapping; pending-reconcile indexes; tenant RLS | record partial success, reconcile known IDs, retry missing writes, retain receipt | org A cannot preview/approve/reconcile org B; duplicate command cannot create another logical record |
| Integrations / `domain.integrations` | connections, credential refs, selections, health/revocation state | organization + provider/connection/resource; OAuth state digest | unique active connection/selection; health/revoke indexes; tenant RLS; no raw secret column | reconnect/revoke and token-reference rotation; provider-specific retention | org A cannot resolve org B credential ref/resource; revoked connection cannot authorize work |
| Evaluation/audit / `domain.evaluation` and `domain.audit` | fixture/run/grader metadata, trace refs, audit events, redaction decisions | organization/privacy class + case/run/version; audit sequence | provenance/version constraints; case/run and actor/time indexes; tenant RLS; append-only audit permissions | retain only authorized/redacted artifacts for declared period; trace by reference | private org A case/trace/audit cannot be read by org B or leak into a global benchmark |

## Change packet required in every implementation issue

Before coding, the implementing agent records:

1. user-visible outcome and actor journey advanced;
2. frontend layer/slice and public API changed;
3. backend controller, application use case, domain policy, and ports changed;
4. Pydantic contracts and generated TypeScript impact;
5. repositories, migrations, RLS, indexes, and retention impact;
6. external provider/trust-boundary impact;
7. state, failure, retry, reconnect, revoke, and offboarding behavior;
8. exact deterministic tests, integration tests, evals, and manual evidence.

An issue that changes a public contract but names no compatibility test is not
ready. An issue that writes tenant data but names no RLS/cross-tenant test is
not ready. An issue that adds an integration but names no setup, selection,
health, reconnect, revoke, and retention path is not ready.

## File and module guardrails

Prefer one cohesive component, state machine, use case, adapter, or repository
per module. A source file approaching 300 lines triggers a cohesion review and
a file above 500 lines requires an explicit reason in review. Generated code,
migrations, and declarative fixtures are excluded. These are review signals,
not hard correctness claims.

Split when a module has more than one reason to change, crosses more than one
trust boundary, mixes orchestration with I/O, or cannot be tested without
unrelated setup. Do not create tiny pass-through files that obscure the
execution path. Public slice APIs, stable type names, and direct tests matter
more than maximizing folder count.

## Verification

All entries below specify future tests. Their presence in this contract is not a
claim that the test files or runtime behavior already exist.

### Architecture import tests

| Rule | Passing assertion | Representative forbidden edge |
| --- | --- | --- |
| React layers | each source import targets the same slice or a layer to its right in `app -> pages -> widgets -> features -> entities -> shared` | `entities` importing `features`; `shared` importing any Clio feature/entity |
| React slice API | cross-slice imports resolve through that slice's declared public entrypoint | deep import into another slice's components, hooks, state, or schemas |
| Generated client | `shared/api` imports the generated `packages/api-client`; generated files match codegen output | handwritten duplicate API DTO or edit inside generated output |
| FastAPI delivery | `api` may depend on application/domain contracts; routers only verify/parse/invoke/map | router importing SQL, prompt definitions, or provider decisions |
| Application/domain | application orchestrates domain and declared ports; domain stays provider independent | domain/application importing infrastructure or Clerk/OpenAI/Codex/GitHub/Linear DTOs |
| Infrastructure | adapters implement inward-facing application ports and translate provider DTOs | provider DTO crossing into domain, public API, or React state |
| SQL/DDL | runtime SQL is confined to repository/query modules; DDL/RLS is confined to ordered migrations | SQL in routes/use cases or migration execution during app startup |

The test reports the exact importing file, imported target, source/target layer,
and violated rule. Approved exceptions require a dated ADR and an expiry or
revisit trigger; path-name convenience alone is not an exception.

### Frontend state fixtures

| Fixture | Required assertion |
| --- | --- |
| Tenant query key | every organization-owned query/mutation key begins with the verified active organization scope |
| Organization switch | abort in-flight stream/mutation, hide prior tenant immediately, clear/rekey caches/selections/drafts/optimistic state, then render only after FastAPI re-verifies the new org |
| Stale response | response/event from the prior organization or an obsolete request token cannot repopulate visible state |
| Ordered stream | monotonically ordered events reduce to one deterministic `StreamViewState` |
| Duplicate/out-of-order stream | duplicate cursor is ignored and a gap/out-of-order event triggers replay/reconciliation instead of duplicated text |
| Cursor reconnect | reconnect requests strictly after the last acknowledged cursor and converges on persisted events |
| Terminal reconciliation | terminal event refetches the authoritative run/message; partial stream text is not retained as a second durable message |
| Version conflict | mutation carries `base_packet_version` and idempotency key; conflict exposes current version for reload/compare/reapply without overwrite |
| Workspace-tool selection | composer query/selection is organization scoped; archived or stale versions fail closed; a packet binds the exact accepted tool version and does not change when the tool is edited later |
| Sensitive optimistic state | approval, usage, integration authorization, Codex completion, and publication remain pending until accepted server state arrives |

### Contract generation fixture

For one representative discriminated contract from each canonical family:

1. instantiate valid and intentionally invalid Pydantic fixtures;
2. emit FastAPI OpenAPI and the referenced JSON Schema with stable schema IDs;
3. regenerate `packages/api-client` in a clean workspace using the pinned
   generator and configuration;
4. compile TypeScript fixtures that exhaustively narrow discriminated unions;
5. assert required/optional/nullability, enums, formats, stable public errors,
   organization/version fields, and serialization round trips; and
6. fail if regeneration leaves an unexplained diff or a handwritten duplicate
   DTO exists.

A provider DTO fixture must prove translation at the adapter boundary and fail
if a provider type appears in domain/public schema or generated client output.

### Database and tenancy verification

| Proof | Required assertion |
| --- | --- |
| Migration build | ordered migrations apply from an empty database and from the last accepted schema; expected tables, columns, checks, foreign keys, functions, triggers, indexes, and RLS policies exist |
| Runtime role | application role is non-owner, non-superuser, least privilege, has no `BYPASSRLS`, and cannot disable or alter tenant policies |
| Transaction-local context | verified actor/organization is set transaction-locally, clears on commit/rollback, and cannot survive pooled-connection reuse |
| Tenant repository coverage | every tenant repository read/write contains an explicit organization predicate and passes both same-tenant success and cross-tenant denial under RLS |
| Background/publication coverage | worker lease/result and publication preview/approval/reconcile paths enforce the same tenant context rather than a broader service identity |
| Workspace-tool authority | Members can discover/use tenant tools; only the creator or an Admin can create a successor version, archive, or duplicate under the same organization; no stored field can grant executable/model/provider authority |
| Constraint/index coverage | uniqueness, idempotency, state, nonnegative money/token, exact-version, and organization-leading access paths have an accepted constraint/index or written rationale |
| Recovery/retention | replay/reconciliation and deletion/expiry fixtures preserve required audit while denying access to revoked or expired derived data |

End-to-end actor fixtures cover new, returning, invited, removed, exhausted,
revoked, disconnected, retried, and resumed actors where relevant. No database
feature is complete from a privileged/owner-only test.

## M1 Rivet import and deviation gate

Before imported code is credited as Clio behavior, M1 must:

1. verify the accepted Rivet commit and record repository URL, commit SHA,
   retrieval date, provenance, and copied/licensed boundary;
2. inventory each imported path and map it to the target tree, owning slice or
   backend layer, canonical contracts, state owner, trust boundary, and tests;
3. run and retain inherited checks against the pinned source, then rerun the
   applicable checks after import inside Clio;
4. adapt path names only when dependency direction, tenant reset, type
   ownership, SQL ownership, and provider isolation remain unchanged;
5. record every necessary deviation as an ADR with context, decision,
   compatibility/security evidence, affected paths, and revisit trigger; and
6. reject or quarantine imported behavior that needs an unaccepted boundary,
   silently upgrades a dependency, exposes a secret, bypasses RLS, duplicates a
   canonical DTO, or fails the architecture/state/contract checks above.

The import does not prove product behavior merely because the source snapshot
contained a similarly named feature. M1 verification inside Clio is required.

## Revisit conditions

Revisit this layout after the Rivet import inventory or when a measured change
shows the boundaries create duplicated logic, dependency cycles, or excessive
coordination. Do not weaken tenancy, type ownership, or adapter isolation merely
to preserve imported paths.
