from __future__ import annotations

import hashlib
import json
import random
import subprocess
from pathlib import Path
from typing import Any

REPOSITORY = Path(__file__).parents[3]
MANIFEST_PATH = REPOSITORY / "tests" / "evals" / "m0_seed_cases.json"
OUTPUT_PATH = REPOSITORY / "tests" / "evals" / "ste37_preregistration.json"
SELECTED_CASES = {"CLIO-M0-001", "CLIO-M0-002", "CLIO-M0-003", "CLIO-M0-010"}


def canonical(value: Any) -> bytes:
    return json.dumps(value, sort_keys=True, separators=(",", ":")).encode()


def sha256(value: Any) -> str:
    return hashlib.sha256(canonical(value)).hexdigest()


def source_digest() -> str:
    roots = [
        REPOSITORY / "apps" / "api" / "src" / "clio" / "domain" / "evaluation",
        REPOSITORY / "apps" / "api" / "src" / "clio" / "infrastructure" / "evaluation",
        REPOSITORY / "apps" / "api" / "scripts" / "generate_ste37_preregistration.py",
        REPOSITORY / "apps" / "api" / "scripts" / "run_deterministic_eval.py",
        REPOSITORY / "apps" / "api" / "scripts" / "run_paired_eval.py",
    ]
    files: list[Path] = []
    for root in roots:
        files.extend(sorted(root.rglob("*.py")) if root.is_dir() else [root])
    digest = hashlib.sha256()
    for path in sorted(files):
        digest.update(str(path.relative_to(REPOSITORY)).encode())
        digest.update(b"\0")
        digest.update(path.read_bytes())
        digest.update(b"\0")
    return digest.hexdigest()


def main() -> None:
    manifest = json.loads(MANIFEST_PATH.read_text())
    cases = [case for case in manifest["cases"] if case["case_id"] in SELECTED_CASES]
    configurations = [
        {
            "configuration_id": "baseline-terra-low-default",
            "role": "baseline",
            "provider": "openai",
            "requested_model": "gpt-5.6-terra",
            "reasoning": "low",
            "service_tier": "default",
            "max_output_tokens": 512,
            "timeout_seconds": 45,
            "attempts": 1,
            "transport_retries": 0,
            "max_cost_microusd": 10_000,
        },
        {
            "configuration_id": "candidate-sol-low-default",
            "role": "candidate",
            "provider": "openai",
            "requested_model": "gpt-5.6-sol",
            "reasoning": "low",
            "service_tier": "default",
            "max_output_tokens": 512,
            "timeout_seconds": 45,
            "attempts": 1,
            "transport_retries": 0,
            "max_cost_microusd": 20_000,
        },
    ]
    schedule = [
        {
            "schedule_id": f"{configuration['configuration_id']}:{case['case_id']}:r{repeat}",
            "configuration_id": configuration["configuration_id"],
            "case_id": case["case_id"],
            "repeat_index": repeat,
        }
        for configuration in configurations
        for case in cases
        for repeat in range(1, 4)
    ]
    random.Random(3701).shuffle(schedule)
    parent_commit = subprocess.run(
        ["git", "rev-parse", "HEAD"],
        cwd=REPOSITORY,
        check=True,
        text=True,
        capture_output=True,
    ).stdout.strip()
    payload: dict[str, Any] = {
        "schema_version": "1.0.0",
        "ticket": "STE-37",
        "created_at": "2026-08-03",
        "dataset": {
            "id": manifest["dataset_id"],
            "version": manifest["dataset_version"],
            "manifest_sha256": hashlib.sha256(MANIFEST_PATH.read_bytes()).hexdigest(),
            "selected_case_ids": [case["case_id"] for case in cases],
            "case_sha256": {case["case_id"]: sha256(case) for case in cases},
        },
        "harness": {
            "parent_commit": parent_commit,
            "source_sha256": source_digest(),
            "dispatch_requires_clean_committed_head": True,
            "agents_sdk": "0.19.0",
            "prompt_version": "clio-planning-eval-prompt@1.0.0",
            "schema_version": "clio-planning-eval-output@1.0.0",
            "planning_tool_version": "bounded-planning-tool@1.0.0",
            "guardrail_version": "secret-and-private-content@1.0.0",
            "hard_grader_version": "clio-hard-gates@1.0.0",
            "rubric_version": "clio-rubric-provisional@1.0.0",
            "job_event_schema": "clio-engineering-analysis-events@1.0.0",
        },
        "privacy": {
            "retention_class": "synthetic_repository",
            "trace_export": "local_redacting_processor_only",
            "remote_trace_export": False,
            "raw_prompt_retained": False,
            "raw_response_body_retained": False,
            "case_001_reference_policy": "authorized_pointer_and_existing_minimal_paraphrase_only",
            "human_scores": None,
            "adjudication": None,
        },
        "budget": {
            "schedule_seed": 3701,
            "repeat_count_per_configuration_case": 3,
            "call_count": 24,
            "total_max_cost_microusd": 360_000,
            "price_version": "openai-standard-2026-08-03",
            "conservative_input_tokens_per_call": 900,
        },
        "pricing_usd_per_million_tokens": {
            "gpt-5.6-terra": {"input": 2, "cached_input": 0.2, "cache_write": 2.5, "output": 12},
            "gpt-5.6-sol": {"input": 5, "cached_input": 0.5, "cache_write": 6.25, "output": 30},
        },
        "configurations": configurations,
        "schedule": schedule,
        "report_contract": {
            "first_token_latency": "observed_from_first_output_text_delta",
            "human_release_authority": "required_but_absent_in_m1",
            "production_selection_allowed": False,
            "real_codex_or_job_execution_allowed": False,
        },
    }
    payload["schedule_sha256"] = sha256(schedule)
    payload["preregistration_sha256"] = sha256(payload)
    OUTPUT_PATH.write_text(json.dumps(payload, indent=2, sort_keys=True) + "\n")
    print(
        json.dumps(
            {
                "path": str(OUTPUT_PATH.relative_to(REPOSITORY)),
                "preregistration_sha256": payload["preregistration_sha256"],
                "schedule_sha256": payload["schedule_sha256"],
                "harness_source_sha256": payload["harness"]["source_sha256"],
                "call_count": len(schedule),
            },
            sort_keys=True,
        )
    )


if __name__ == "__main__":
    main()
