# STE-37 trace and evaluation harness

Date: 2026-08-03
Status: harness and provider schedule frozen before paired execution
Interpretation: M1 walking-skeleton evidence only; no production-model decision

## Frozen inputs

- Dataset: `clio-m0-seed@1.0.0`
- Manifest SHA-256: `d5cc1f711735fa65148134487e7bb3bfcc80bcba572a0e75271f62bbb85f2cab`
- M1 cases: `CLIO-M0-001`, `CLIO-M0-002`, `CLIO-M0-003`, `CLIO-M0-010`
- Preregistration internal SHA-256: `70ddcbe72e4882d4e18e20f50623cdc59a8bae0d55af0544050a10f972f2a134`
- Randomized schedule SHA-256: `7a4675b32bc3d7a5a3a3cfc56fd51385fd26d36aa7c7f1baab21dbbea4aea052`
- Harness source SHA-256: `273e7caf01bdd4da0a361f4aa72a8957fde00fe43d05b828d5e25550151f77cf`
- Random seed: `3701`
- Repeats: three per configuration/case; 24 calls total

The exact committed harness SHA is recorded in the pre-dispatch Linear receipt and in the paired report at execution. Dispatch refuses a dirty worktree, so source or schedule changes require a new committed harness and new preregistration.

## Configurations and budget

| Role | Model | Reasoning | Tier | Output cap | Timeout | Attempts | Per-call max |
| --- | --- | --- | --- | ---: | ---: | ---: | ---: |
| baseline | `gpt-5.6-terra` | low | default/standard | 512 | 45 s | 1 | 10,000 micro-USD |
| candidate | `gpt-5.6-sol` | low | default/standard | 512 | 45 s | 1 | 20,000 micro-USD |

The total ceiling is 360,000 micro-USD ($0.36). The runner disables transport retries and fallback models. Its conservative 900-input-token preflight must pass before dispatch.

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

## Commands

```text
PYTHONPATH=apps/api/src apps/api/.venv/bin/python apps/api/scripts/run_deterministic_eval.py
PYTHONPATH=apps/api/src apps/api/.venv/bin/python apps/api/scripts/generate_ste37_preregistration.py
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
