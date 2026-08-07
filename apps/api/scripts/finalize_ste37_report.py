from __future__ import annotations

import hashlib
import importlib.util
import json
from pathlib import Path
from typing import Any

from clio.infrastructure.evaluation.privacy import assert_retained_safe, sanitize

REPOSITORY = Path(__file__).parents[3]
ARTIFACT_DIRECTORY = REPOSITORY / "artifacts" / "evals"
CHECKPOINT_PATH = ARTIFACT_DIRECTORY / "ste37_paired_checkpoint_v2.json"
TRACE_PATH = ARTIFACT_DIRECTORY / "ste37_provider_traces.json"
REPORT_PATH = ARTIFACT_DIRECTORY / "ste37_paired_comparison.json"
PREREGISTRATION_PATH = REPOSITORY / "tests" / "evals" / "ste37_preregistration_v2.json"
MANIFEST_PATH = REPOSITORY / "tests" / "evals" / "m0_seed_cases.json"
RUNNER_PATH = REPOSITORY / "apps" / "api" / "scripts" / "run_paired_eval.py"


def load_runner() -> Any:
    spec = importlib.util.spec_from_file_location("clio_ste37_runner", RUNNER_PATH)
    if spec is None or spec.loader is None:
        raise RuntimeError("unable to load paired-evaluation report functions")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def main() -> None:
    runner = load_runner()
    checkpoint = json.loads(CHECKPOINT_PATH.read_text())
    preregistration = json.loads(PREREGISTRATION_PATH.read_text())
    manifest = json.loads(MANIFEST_PATH.read_text())
    cases = {case["case_id"]: case for case in manifest["cases"]}
    runs: list[dict[str, Any]] = checkpoint["runs"]
    for run in runs:
        case = cases[run["case_id"]]
        run["organization_fixture_id"] = "fixture-evaluation"
        run["packet_version"] = 1
        run["repository_commit"] = checkpoint["harness_commit"]
        run["case_sha256"] = preregistration["dataset"]["case_sha256"][run["case_id"]]
        run["source_refs"] = case["source_refs"]
        run["privacy_class"] = case["privacy_class"]
        run["prompt_version"] = preregistration["harness"]["prompt_version"]
        run["planning_tool_version"] = preregistration["harness"]["planning_tool_version"]
        run["tool_policy_version"] = "no-tools-no-external-effects@1.0.0"
        run["schema_version"] = preregistration["harness"]["schema_version"]
        run["grader_version"] = preregistration["harness"]["hard_grader_version"]
        run["rubric_version"] = preregistration["harness"]["rubric_version"]
        run["tool_charges_microusd"] = 0
        run["evaluator_identity"] = "codex-m1-goal-runner"
        run["result_ref"] = f"{REPORT_PATH.name}#{run['schedule_id']}"
        run["trace_ref"] = f"{TRACE_PATH.name}#{run['trace_id']}"
    report = {
        "schema_version": "1.0.1",
        "report_id": "clio-ste37-paired-comparison-v2-2026-08-03",
        "report_finalizer_version": "1.0.0",
        "evidence_class": "development_evaluation",
        "preregistration_sha256": preregistration["preregistration_sha256"],
        "schedule_sha256": preregistration["schedule_sha256"],
        "dataset": preregistration["dataset"],
        "harness": {**preregistration["harness"], "commit": checkpoint["harness_commit"]},
        "privacy": preregistration["privacy"],
        "budget": preregistration["budget"],
        "runs": runs,
        "aggregate": runner.aggregate(runs, preregistration),
        "human_reviewers": {"product": None, "engineering": None},
        "human_adjudication": None,
        "release_authority": "absent",
        "waiver": None,
        "rollback": None,
        "invalid_predecessor_evidence": {
            "path": "ste37_invalid_attempts_v1.json",
            "included_in_aggregate": False,
            "classification": "harness_invalid_output_envelope",
        },
        "limitations": [
            "four M1 cases are not statistically sufficient for production selection",
            "provisional rubric scores are deterministic heuristics, not human-calibrated release labels",
            "two candidate case-010 repeats received a provisional question-usefulness score of 1 because the frozen heuristic expects a question; the case contract does not require one, so this is preserved for human adjudication rather than silently regraded",
            "no real Codex, job worker, sandbox, publication, or killed-worker recovery ran",
            "trace proves execution, not correctness",
        ],
    }
    assert_retained_safe(report)
    REPORT_PATH.write_text(json.dumps(sanitize(report), indent=2, sort_keys=True) + "\n")
    print(
        json.dumps(
            {
                "report_sha256": hashlib.sha256(REPORT_PATH.read_bytes()).hexdigest(),
                "trace_sha256": hashlib.sha256(TRACE_PATH.read_bytes()).hexdigest(),
                "completed_runs": sum(run["terminal_status"] == "completed" for run in runs),
                "failed_applicable_gates": sum(
                    gate["status"] == "fail"
                    for run in runs
                    for gate in run["hard_gates"]
                ),
                "observed_cost_microusd": sum(run["cost_microusd"] for run in runs),
                "decision": report["aggregate"]["decision"],
            },
            sort_keys=True,
        )
    )


if __name__ == "__main__":
    main()
