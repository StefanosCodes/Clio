# STE-37 trace and evaluation harness

Date: 2026-08-03
Status: paired v2 execution complete; human adjudication absent
Interpretation: M1 walking-skeleton evidence only; no production-model decision

## Frozen inputs — v1

- Dataset: `clio-m0-seed@1.0.0`
- Manifest SHA-256: `d5cc1f711735fa65148134487e7bb3bfcc80bcba572a0e75271f62bbb85f2cab`
- M1 cases: `CLIO-M0-001`, `CLIO-M0-002`, `CLIO-M0-003`, `CLIO-M0-010`
- Preregistration internal SHA-256: `70ddcbe72e4882d4e18e20f50623cdc59a8bae0d55af0544050a10f972f2a134`
- Randomized schedule SHA-256: `7a4675b32bc3d7a5a3a3cfc56fd51385fd26d36aa7c7f1baab21dbbea4aea052`
- Harness source SHA-256: `273e7caf01bdd4da0a361f4aa72a8957fde00fe43d05b828d5e25550151f77cf`
- Random seed: `3701`
- Repeats: three per configuration/case; 24 calls total

The exact committed harness SHA is recorded in the pre-dispatch Linear receipt and in the paired report at execution. Dispatch refuses a dirty worktree, so source or schedule changes require a new committed harness and new preregistration.

The v1 harness was committed at `21e05824f634e9c2e8a1538f66be303ba63e3972`. The corrective v2 harness was committed before dispatch at `adf62c8fbd3807e888467c63458c6a45e996738a`.

### v1 provider-run invalidation

The first provider dispatch exposed that the 512-output-token cap was too small for the pinned structured response. One schedule item completed, four returned provider `response.incomplete` / `max_output_tokens`, and a sixth in-flight call was interrupted when the run was stopped. Agents SDK streaming generator cleanup also emitted secondary context-cleanup warnings after incomplete responses. These are harness-invalid observations, not model failures and not passing comparison evidence.

The five checkpointed items remain in `artifacts/evals/ste37_invalid_attempts_v1.json` (SHA-256 `0af048dcdf5beb35fd22ff6bcb04cc6dbf227cd3330f9ddcb00771fd15acf976`). No invalid result is converted to pass or included in the v2 aggregate.

The corrective v2 preregistration keeps the same cases, models, reasoning, service tier, repeats, and randomized-order rule while setting low verbosity and a 1,024-token output cap. Its separately committed source/schedule digests and budgets are recorded before the v2 dispatch.

- v2 preregistration internal SHA-256: `6a4ba29486166277f10abbbc6249ab43db516016189a4938a2469844c506f050`
- v2 randomized schedule SHA-256: `7c4f615221aee7be2102cbd662c58ca56a429d2d02c15a1a0a0a7aae0ac304e6`
- v2 harness source SHA-256: `33316016d7f40cfaa8c05ad7768f2046ed2962e91876be4e9232f7389be3802a`
- v2 prompt: `clio-planning-eval-prompt@1.0.1`

## Configurations and budget

| Role | Model | Reasoning | Tier | Output cap | Timeout | Attempts | Per-call max |
| --- | --- | --- | --- | ---: | ---: | ---: | ---: |
| baseline v1 | `gpt-5.6-terra` | low | default/standard | 512 | 45 s | 1 | 10,000 micro-USD |
| candidate v1 | `gpt-5.6-sol` | low | default/standard | 512 | 45 s | 1 | 20,000 micro-USD |
| baseline v2 | `gpt-5.6-terra` | low / low verbosity | default/standard | 1,024 | 45 s | 1 | 15,000 micro-USD |
| candidate v2 | `gpt-5.6-sol` | low / low verbosity | default/standard | 1,024 | 45 s | 1 | 40,000 micro-USD |

The v1 total ceiling was 360,000 micro-USD ($0.36). Stopping after at most four baseline and two candidate dispatches limited its maximum exposure to 80,000 micro-USD ($0.08), including the uncheckpointed interrupted call. The v2 ceiling is 600,000 micro-USD ($0.60), making the cumulative milestone ceiling 680,000 micro-USD ($0.68). The runner disables transport retries and fallback models. Its conservative 900-input-token preflight must pass before dispatch.

The price policy is `openai-standard-2026-08-03`: terra uses $2/M input, $0.20/M cached input, $2.50/M cache write, and $12/M output; sol uses $5/M input, $0.50/M cached input, $6.25/M cache write, and $30/M output.

## Executable deterministic proof

`artifacts/evals/ste37_deterministic_trace.json` contains four repeatable planning fixtures. Each emits locally captured Agents SDK spans for:

- the planning-model fixture;
- `bounded-planning-tool@1.0.0`;
- `secret-and-private-content@1.0.0` guardrail; and
- `clio-hard-gates@1.0.0` grading.

Observed before the provider run: 4 cases, 0 failed applicable hard gates. Artifact SHA-256: `20f54824c48e5d8bff9e953db3dcbb40d94c0e52fa9e05da11d3c781bae2a492`.

`artifacts/evals/ste37_synthetic_job_events.json` freezes seven typed future events linking planning run → engineering-analysis job → attempt → expired lease → represented recovery → synthetic read-only Codex MCP call → typed result → terminal job. Every event has `evidence_class=synthetic` and `runtime_evidence=false`. Artifact SHA-256: `0941dad5567a5ed21b8fbc8cd63ee2cca4ed9cc1f4f9ac2335680e2e62aedffd`.

This proves the event/metric schema can represent lease recovery. It does not prove a worker, Codex call, sandbox, killed-worker recovery, or repository analysis ran.

## Trace privacy and promotion

The evaluation process replaces the default trace exporter with a local redacting processor. Trace generation/request/response fields are stripped, obvious key/bearer/connection patterns are redacted, and retained data is limited to safe identifiers/digests, versions, timings, normalized usage/cost, gate results, and sanitized structured output.

Trace promotion fails closed for:

- `authorized_private` and `prohibited` content;
- an unapproved project reference;
- `redacted_internal` content without authorization and an exact expiry; or
- any retained secret/prohibited private-content pattern.

Case 001 retains the accepted project reference pointer and existing minimal synthetic paraphrase only. No transcript or customer content is fetched. Cases 002/003/010 are repository-owned synthetic data.

## Scoring truthfulness

Deterministic hard gates run first. Rubric scores are explicitly provisional heuristics with `human_score`, `human_rationale`, and `adjudication` null. A trace proves what executed, not that the output is correct.

The paired report must show per-run/aggregate hard gates, provisional quality, latency, normalized tokens/cost, failures, and a provisional Pareto view. It must set production selection to false because the four-case M1 slice, calibrated human reviewers, and named product/engineering release decision are absent.

## Paired v2 result

The frozen v2 schedule completed all 24 calls: 12 baseline `gpt-5.6-terra` and 12 candidate `gpt-5.6-sol` observations, three repeats per configuration/case. Every observation used the requested default service tier, completed in one attempt with no transport retry, retained first-token latency and hashed request/response identifiers, remained inside its per-call budget, and passed every applicable deterministic hard gate. All 24 retained output hashes are distinct.

| Metric | Baseline terra | Candidate sol |
| --- | ---: | ---: |
| Completed / scheduled | 12 / 12 | 12 / 12 |
| Applicable hard-gate pass rate | 100% | 100% |
| Median first-token latency | 934 ms | 1,712 ms |
| Median total latency | 3,588 ms | 5,764 ms |
| Maximum total latency | 4,307 ms | 12,133 ms |
| Input / output / reasoning tokens | 7,035 / 3,608 / 0 | 7,035 / 4,055 / 877 |
| Observed cost | 57,366 micro-USD | 156,825 micro-USD |

Total observed v2 cost was 214,191 micro-USD ($0.214191), below the 600,000-micro-USD v2 ceiling. The maximum single-call cost was 21,540 micro-USD, below its frozen configuration limit.

The baseline provisional rubric means were assumption visibility 3, delivery traceability 2, groundedness/citation 3, question usefulness 3, readiness quality 3, and response efficiency 2. The candidate means were identical except question usefulness at 2.667. This is not a production-quality conclusion: two candidate case-010 repeats received a score of 1 because the frozen heuristic expects a question while that case contract does not require one. The mismatch is preserved, disclosed, and left for human adjudication rather than silently regraded.

The report decision is `no_production_selection_human_adjudication_required`. Product and engineering reviewers are null, human adjudication is null, release authority is absent, and both configurations have `production_selection_eligible=false`. The Pareto view is provisional only.

### Retained evidence

- Final paired report: `artifacts/evals/ste37_paired_comparison.json`, SHA-256 `02a5b67677562d38f760d8c2ff8f5d741bf34f972c6307e7e480687405a9cd33`
- Provider trace set: `artifacts/evals/ste37_provider_traces.json`, SHA-256 `91ce366edbe8df99fb3785ea71ff889977bd2853b5b6aff0791e369ef6d2b18e`
- Immutable v2 checkpoint: `artifacts/evals/ste37_paired_checkpoint_v2.json`, SHA-256 `1897bf1c69c9d236f3db47623814d58bcbbaf77af10d7fe35f4d8a03cbfe82f7`
- Excluded v1 invalid attempts: `artifacts/evals/ste37_invalid_attempts_v1.json`, SHA-256 `0af048dcdf5beb35fd22ff6bcb04cc6dbf227cd3330f9ddcb00771fd15acf976`

The provider trace set contains 24 local traces with `agent`, `custom`, and normalized-usage `response` spans. Raw provider request/response bodies, prompts, outputs, credentials, and secret-like patterns are not retained. The excluded v1 evidence is referenced by the final report with `included_in_aggregate=false`.

## Commands

```text
PYTHONPATH=apps/api/src apps/api/.venv/bin/python apps/api/scripts/run_deterministic_eval.py
PYTHONPATH=apps/api/src apps/api/.venv/bin/python apps/api/scripts/generate_ste37_preregistration.py
PYTHONPATH=apps/api/src apps/api/.venv/bin/python apps/api/scripts/finalize_ste37_report.py
cd apps/api && .venv/bin/pytest -q -m 'not postgres and not provider'
```

Provider dispatch, after committing this exact harness:

```text
PYTHONPATH=apps/api/src apps/api/.venv/bin/python apps/api/scripts/run_paired_eval.py
```

## Official references

- OpenAI agent evaluations: https://developers.openai.com/api/docs/guides/agent-evals
- OpenAI evaluation best practices: https://developers.openai.com/api/docs/guides/evaluation-best-practices
- OpenAI trace grading: https://developers.openai.com/api/docs/guides/trace-grading
- OpenAI Agents SDK tracing: https://openai.github.io/openai-agents-python/tracing/
- OpenAI pricing: https://developers.openai.com/api/docs/pricing
