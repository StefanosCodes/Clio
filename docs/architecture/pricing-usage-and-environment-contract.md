# Pricing, Unified Usage, and Environment Contract

## Status and scope

This is the M0 contract for Clio pricing, quantitative AI usage, cost evidence,
and credential boundaries. It is a design contract, not proof that billing,
metering, environments, or provider calls are implemented.

M0 defines deterministic records and fixtures only. The first real model call
belongs to M1, Clerk Billing and tenant persistence begin in M2, GitHub
credentials begin in M4, Codex service execution begins in M5, and Linear OAuth
begins in M7.

## Public pricing contract

The public pricing surface is deliberately short:

| Plan | Price | Released capability contract |
| --- | --- | --- |
| Starter | **$20/month** | The released Clio experience and one organization-wide monthly AI allowance |
| Pro | **$60/month** | Exactly the same released capabilities as Starter with **3× monthly usage** |
| Enterprise | **Contact us** | Custom usage capacity plus agreed security, governance, onboarding, and support requirements |

Starter and Pro do not differ by features. V1 does not plan-gate Packet
Templates, approval workflows, Codex, repositories, or connectors. The MVP has
one default Packet Template and one fixed approval contract. Every released AI
capability consumes the same organization allowance.

Customer-facing copy may show only:

- percentage of the current allowance remaining;
- `healthy`, `low`, or `exhausted` warning state; and
- the current period reset timestamp.

It must not expose provider or model names, token counts, provider prices,
per-action quotas, or Clio's internal allowance in dollars. Usage varies with
work size and complexity. V1 has no overage invoice: when exhausted, new AI
work pauses while reads, edits, exports, and deterministic actions remain
available.

The internal Starter allowance remains `benchmark_pending` through M0. A
versioned `PlanPolicy` resolves its value after representative planning and
Codex workflows are measured. Pro always resolves to exactly three times the
Starter value for the same policy version. Changing the base allowance is a
configuration/policy change, not a product-code deployment.

## Authority and invariants

- Clerk is authoritative for organization subscription state and billing-period
  boundaries.
- Clio Postgres is authoritative for quantitative usage, reservations, provider
  evidence, calculated cost, and allowance enforcement.
- All durable records are organization-scoped and versioned.
- Token counts and money are nonnegative integers. Money is stored as
  `micro_usd` (`1 USD = 1,000,000 micro-USD`).
- Provider response identity is unique within a provider account/project.
- Raw provider usage is retained separately from normalized billing buckets.
- Requested and actual model/service tier remain distinct.
- Reasoning tokens are retained as output detail and are not charged twice when
  already included in provider-reported output tokens.
- Cost is reproducible from one immutable usage event and one effective price
  version.
- Customer-visible allowance changes only through committed
  `customer_billable` cost. Other billing classes remain measurable.
- A reservation or event cannot move between organizations or usage periods.

## Canonical boundary records

These are versioned Pydantic/application contracts in implementation and map to
PostgreSQL records where persistence is named. Provider DTOs are translated at
the adapter boundary and never become these public/domain shapes directly.

| Type | Required fields | Stored invariants |
| --- | --- | --- |
| `PlanPolicy` | `schema_version`, `policy_version`, `plan_code`, `currency`, `starter_base_allowance_micro_usd`, `allowance_multiplier`, `warning_threshold_basis_points`, `effective_at` | Starter multiplier is `1`; Pro multiplier is `3`; Enterprise has an explicit contract; the M0 Starter base is `benchmark_pending` rather than a number |
| `SubscriptionSnapshot` | `schema_version`, `organization_id`, `provider`, `provider_subscription_id`, `plan_code`, `status`, `period_start`, `period_end`, `observed_at`, `source_version` | Append-only observation; period end is after start; provider identity is unique per organization |
| `UsagePeriod` | `schema_version`, `id`, `organization_id`, `policy_version`, `period_start`, `period_end`, `allowance_micro_usd`, `committed_micro_usd`, `reserved_micro_usd`, `state`, `lock_version` | `committed + reserved <= allowance`; one active period per organization and boundary; optimistic/row locking guards writes |
| `UsageReservation` | `schema_version`, `id`, `organization_id`, `usage_period_id`, `metered_operation`, `billing_class`, `reserved_micro_usd`, `state`, `idempotency_key`, `expires_at`, `created_at`, `settled_at` | Idempotency key is unique per organization/operation; legal states are `active`, `committed`, `released`, `expired`; settlement occurs once |
| `UsageEvent` | `schema_version`, `id`, `organization_id`, `usage_period_id`, `reservation_id`, `billing_class`, `metered_operation`, `provider`, `provider_response_id`, `requested_model`, `actual_model`, `requested_service_tier`, `actual_service_tier`, `token_usage`, `model_price_version_id`, `cost_snapshot`, `occurred_at`, `recorded_at` | Append-only; provider response identity is unique; the exact price and normalized usage used for cost remain reconstructible |
| `TokenUsage` | `schema_version`, `provider_input_tokens`, `normalized_uncached_input_tokens`, `normalized_cached_input_tokens`, `normalized_cache_write_tokens`, `provider_output_tokens`, `reasoning_tokens`, `provider_total_tokens`, `normalization_notes` | Normalized charged buckets are disjoint; reasoning tokens are a subset/detail of output unless a provider explicitly prices them separately; all counts are nonnegative |
| `ModelPriceVersion` | `schema_version`, `id`, `provider`, `model`, `service_tier`, `context_band`, `currency`, `uncached_input_micro_usd_per_million`, `cached_input_micro_usd_per_million`, `cache_write_micro_usd_per_million`, `output_micro_usd_per_million`, `tool_prices`, `effective_at`, `retired_at`, `source_url`, `source_retrieved_at` | Immutable after use; effective intervals do not overlap for the same provider/model/tier/context band; source provenance is required |
| `CostSnapshot` | `schema_version`, `price_version_id`, `line_items`, `total_micro_usd`, `rounding_rule`, `calculated_at` | Line items sum to total; uses the event's effective price version; no floating-point money |
| `UsageDecision` | `schema_version`, `allowed`, `reason`, `usage_period_id`, `requested_reservation_micro_usd`, `available_micro_usd_before`, `public_percentage_remaining`, `public_warning_state`, `reset_at` | Public response omits internal prices, tokens, and absolute dollar allowance |
| `BillingClass` | `customer_billable`, `development`, `internal_evaluation`, `automatic_system_retry`, `infrastructure_failure` | Only `customer_billable` reduces customer-visible allowance; every class remains observable |
| `MeteredOperation` | `schema_version`, `operation_code`, `operation_version`, `provider_kind`, `max_reservation_micro_usd`, `max_attempts`, `timeout_seconds`, `enabled` | Per-run safety bounds are resolved before reservation; V1 codes include `planning_turn`, `codex_analysis`, and versioned future provider operations |

`PlanPolicy.starter_base_allowance_micro_usd` is a discriminated value:
`benchmark_pending` in M0, then a nonnegative integer in an accepted later
policy version. No M0 fixture may be mistaken for that production value.

## Cost normalization and calculation

Each provider adapter preserves the raw response usage and produces disjoint
normalized buckets. It does not assume cached input or cache-write counts are
always subsets unless the provider contract says so. A normalization mismatch
is an evidence error and cannot silently become customer-billable cost.

For a price row expressed per million tokens:

```text
token_numerator =
    uncached_input_tokens × uncached_input_micro_usd_per_million
  + cached_input_tokens   × cached_input_micro_usd_per_million
  + cache_write_tokens    × cache_write_micro_usd_per_million
  + output_tokens         × output_micro_usd_per_million

token_cost_micro_usd = ceil(token_numerator / 1,000,000)
total_micro_usd = token_cost_micro_usd + sum(provider_tool_charge_micro_usd)
```

Rounding occurs once after summing all token components. Tool prices declare
their own integer unit (for example per call or per session) in the price row.
Reasoning-token detail is not an extra line item when it is already included in
`provider_output_tokens`.

### Worked deterministic cost fixture

This fixture is synthetic and validates arithmetic only. It is not an OpenAI
price, a production model result, or the Starter allowance.

| Price/usage input | Fixture value |
| --- | ---: |
| Uncached input rate | 2,000,000 micro-USD / 1M tokens |
| Cached input rate | 200,000 micro-USD / 1M tokens |
| Cache-write rate | 2,500,000 micro-USD / 1M tokens |
| Output rate | 12,000,000 micro-USD / 1M tokens |
| Tool charge | 10,000 micro-USD per call |
| Uncached input | 8,000 tokens |
| Cached input | 1,000 tokens |
| Cache writes | 1,000 tokens |
| Output | 500 tokens, including 200 reasoning tokens |
| Tool calls | 2 |

Expected line items:

```text
uncached input = 8,000 × 2,000,000 / 1,000,000 = 16,000
cached input   = 1,000 ×   200,000 / 1,000,000 =    200
cache writes   = 1,000 × 2,500,000 / 1,000,000 =  2,500
output         =   500 ×12,000,000 / 1,000,000 =  6,000
tool calls     =     2 ×    10,000             = 20,000
total                                               44,700 micro-USD
```

The 200 reasoning tokens are metadata within the 500 output tokens, so the
expected total remains **44,700 micro-USD ($0.044700)**.

## Reservation and billing-class protocol

The only legal metered path is:

```text
verify organization membership and subscription snapshot
→ resolve active UsagePeriod and PlanPolicy
→ resolve MeteredOperation safety bound and BillingClass
→ atomically reserve bounded micro-USD
→ execute at most the allowed provider attempts
→ persist raw response plus normalized UsageEvent and CostSnapshot
→ commit customer-billable actual cost or record non-customer-billable cost
→ release the unused reservation exactly once
→ return only percentage, warning state, and reset time to the customer
```

The reservation transaction locks or conditionally updates the active period.
It succeeds only if `committed + reserved + requested <= allowance`. Execution
does not start on a denied reservation. Commit is idempotent and fails closed
if the calculated actual cost exceeds the reservation; an explicit bounded
extension transaction is required before more provider work.

### Deterministic outcome fixtures

| Case | Given | Expected outcome |
| --- | --- | --- |
| Reservation race | Period has 10,000 available; two requests concurrently reserve 7,000 | Exactly one reservation becomes `active`; the other receives `allowed=false`, `reason=insufficient_allowance`; no provider call starts for the loser |
| Cancel before provider execution | Active reservation exists; execution has not started | Release the full reservation once; record cancellation audit; create no provider-response `UsageEvent` |
| Cancel after provider response | Customer-requested operation produced a provider response before cancellation | Record the response and actual cost as `customer_billable`; release unused reservation; do not discard incurred evidence |
| Automatic retry | A retry is initiated automatically after a retryable provider/infrastructure failure | Record each measurable attempt with `automatic_system_retry` or `infrastructure_failure`; only the accepted customer result is customer-billable; attempts remain linked |
| Exhaustion | `committed + reserved == allowance` | Deny new AI work; allow already-reserved work to settle; keep reads, edits, exports, and deterministic actions available |
| Period reset | Clerk reports a new billing boundary | Create a new period from the effective policy; do not carry committed cost forward; settle pre-boundary reservations against their original period |
| Mid-cycle upgrade | Clerk reports Starter → Pro during an active period | Upgrade is effective immediately; set allowance to exactly 3× the same policy's Starter allowance; preserve committed/reserved amounts and period end; do not reset usage |
| Downgrade | Clerk schedules Pro → Starter | Keep Pro through the paid period; apply Starter at the next period; never reduce the current allowance below committed/reserved cost |
| Infrastructure failure | No valid provider result is accepted | Release unused reservation; retain non-customer-billable failure evidence; expose a retryable safe error without consuming customer allowance |
| Idempotent settlement | The same commit/release command is delivered twice | The first legal transition wins; the duplicate returns the existing settlement and changes no totals |

## Environment isolation contract

| Environment | Isolation and permitted behavior |
| --- | --- |
| Unit/contract tests | Fake providers, deterministic price fixtures, local database/Supabase CLI; no network credential required |
| Local M1 smoke | Dedicated development OpenAI project/key and local database; first real response is classified `development` and captured; never use production data |
| CI | Fake providers by default; separately authorized sandbox integration jobs only; secrets are masked and unavailable to forked/untrusted jobs |
| Staging | Dedicated non-production Clerk, Stripe test processing through Clerk Billing, Supabase, OpenAI, GitHub App, Codex worker, and Linear OAuth resources as their milestones arrive |
| Production | Distinct production resources, secret store, callbacks, encryption keys, backups, alerts, rotation/revoke procedures, and least-privilege service identities; no development credential reuse |

Only intentionally public configuration may enter the React bundle. Clio V1
does not place a Supabase service credential or database connection in the
browser; React calls FastAPI, and FastAPI resolves verified organization
authority.

## Credential and configuration matrix

Validation commands check presence or public metadata without printing secret
values. Live authentication checks occur only in the owning milestone.

| Capability / representative variable | Exposure | Owner | First required | M0-safe validation | Rotation or revoke path |
| --- | --- | --- | --- | --- | --- |
| API base URL (`VITE_API_BASE_URL`) | React-public | Application | M1 | Validate allowed origin/HTTPS policy | Change deployment configuration; invalidate stale client build |
| Clerk publishable key (`VITE_CLERK_PUBLISHABLE_KEY`) | React-public | Identity | M2 | Confirm present and development/staging/production instance matches environment | Rotate in Clerk; update client configuration and rebuild |
| Clerk secret key (`CLERK_SECRET_KEY`) | Server-only | Identity | M2 | `test -n "${CLERK_SECRET_KEY:-}"` without printing | Rotate/revoke in Clerk; update secret store; reconcile webhooks/subscriptions |
| Clerk webhook signing secret (`CLERK_WEBHOOK_SIGNING_SECRET`) | Server-only | Identity | M2 | Presence plus callback allowlist review | Rotate endpoint secret; overlap verification window; remove old secret |
| Runtime database URL (`DATABASE_URL`) | Server/worker-only | Data platform | M2 | Confirm role is non-owner and target is non-production for local/staging | Rotate database role/password; terminate old sessions; verify least privilege |
| Supabase project URL/runtime storage configuration | Server-only in V1 | Data platform | M2 | Confirm project/environment identity; no service key in React config | Rotate project keys/roles; update server secret store; audit access |
| Supabase migration credentials (`SUPABASE_ACCESS_TOKEN`, migration DB URL) | CI/admin-only | Data platform | M2 | Presence in protected job only; `supabase --version`; no value output | Revoke token/role; issue least-privilege replacement; audit migrations |
| Application encryption key (`APP_ENCRYPTION_KEY`) | Server/worker-only | Security | M2 | Validate algorithm/version and minimum decoded length without printing | Versioned envelope-key rotation; rewrap data; revoke old key after verification |
| OpenAI API key (`OPENAI_API_KEY`) | Server/worker-only | AI platform | M1 | M0: presence check only; M1: one explicit development smoke with usage capture | Rotate/revoke in dedicated OpenAI project; update secret store; invalidate old key |
| GitHub App ID/client ID | Server configuration; identifiers may be public | Repository integration | M4 | Validate expected app/environment metadata | Rotate app/client configuration and callback allowlist |
| GitHub App private key/client secret/webhook secret | Server/worker-only | Repository integration | M4 | Validate key parse/permissions without printing; no M0 credential requested | Rotate/revoke in GitHub App; replace installation tokens; audit installations |
| Codex worker authentication and sandbox configuration | Worker-only | AI/engineering platform | M5 | M0: record owner and boundary; M5 must verify the current supported service-auth mechanism and isolated read-only sandbox | Revoke dedicated service credential; rotate worker secret/config; invalidate active leases |
| Linear OAuth client ID | Server configuration; identifier may be public | Delivery integration | M7 | Validate redirect URI and environment metadata | Rotate client registration/callback configuration |
| Linear OAuth client secret and token-encryption material | Server-only | Delivery integration | M7 | Presence and encryption-boundary review only | Revoke OAuth client/tokens; rotate secret and encryption key; require reconnect |

No credential value, personal access token, personal ChatGPT/Codex login,
database owner credential, or Supabase service-role key belongs in model-visible
context, repository files, logs, traces, frontend bundles, fixtures, or Linear.

## M1 entry gate from this contract

M1 may make the first real model call only after:

1. an approved `ModelPriceVersion` is loaded from current official pricing;
2. the dedicated development `OPENAI_API_KEY` passes a presence check without
   disclosure;
3. a `development` `MeteredOperation` has a bounded reservation and timeout;
4. raw and normalized usage, requested/actual model and tier, price version,
   and calculated cost have a persistence target;
5. failure/retry evidence is non-customer-billable; and
6. the smoke-test command and redaction rule are reviewed.

M0 performs none of those live provider actions.

## Authoritative references

- [OpenAI API pricing](https://developers.openai.com/api/docs/pricing)
- [OpenAI production cost guidance](https://developers.openai.com/api/docs/guides/production-best-practices#text-generation)
- [Clerk Billing overview](https://clerk.com/docs/guides/billing/overview)
- [Clerk Billing product and metered-billing status](https://clerk.com/billing)
- [Clerk custom plans and prices](https://clerk.com/docs/guides/billing/custom-plans)
- [Supabase Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Supabase Postgres roles](https://supabase.com/docs/guides/database/postgres/roles)
