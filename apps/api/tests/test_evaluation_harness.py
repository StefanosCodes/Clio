from __future__ import annotations

import json
import hashlib
from pathlib import Path

import pytest

from clio.domain.evaluation import validate_job_fixture
from clio.infrastructure.evaluation.deterministic import (
    run_deterministic_suite,
    synthetic_job_fixture,
)
from clio.infrastructure.evaluation.privacy import PromotionDenied, promote_trace, sanitize

REPOSITORY = Path(__file__).parents[3]


def test_deterministic_runner_repeats_scores_and_captures_required_spans() -> None:
    manifest = json.loads((REPOSITORY / "tests/evals/m0_seed_cases.json").read_text())
    first = run_deterministic_suite(manifest)
    second = run_deterministic_suite(manifest)

    comparable_first = [
        (record["case_id"], record["output_sha256"], record["hard_gates"], record["rubric"])
        for record in first["records"]
    ]
    comparable_second = [
        (record["case_id"], record["output_sha256"], record["hard_gates"], record["rubric"])
        for record in second["records"]
    ]
    assert comparable_first == comparable_second
    assert len(first["records"]) == 4
    assert all(
        gate["status"] != "fail"
        for record in first["records"]
        for gate in record["hard_gates"]
    )
    span_types = {
        span["data"]["type"]
        for record in first["records"]
        for span in record["trace"]["spans"]
    }
    assert {"custom", "function", "guardrail"}.issubset(span_types)
    function_spans = [
        span
        for record in first["records"]
        for span in record["trace"]["spans"]
        if span["data"]["type"] == "function"
    ]
    assert all(span["data"]["input"] == "[REDACTED]" for span in function_spans)
    assert all(span["data"]["output"] == "[REDACTED]" for span in function_spans)


def test_redaction_and_promotion_fail_closed() -> None:
    unsafe = {
        "prompt": "private customer conversation sk-example123456",
        "metadata": {"OPENAI_API_KEY": "sk-example123456"},
    }
    cleaned = sanitize(unsafe)
    assert cleaned["prompt"] == "[REDACTED]"
    assert cleaned["metadata"]["OPENAI_API_KEY"] == "[REDACTED]"
    with pytest.raises(PromotionDenied):
        promote_trace(unsafe, privacy_class="authorized_private", authorized=True)
    with pytest.raises(PromotionDenied):
        promote_trace(unsafe, privacy_class="redacted_internal", authorized=True)


def test_synthetic_job_fixture_represents_but_does_not_claim_recovery() -> None:
    events = validate_job_fixture(synthetic_job_fixture())
    assert [event.cursor for event in events] == list(range(7))
    assert any(event.event == "lease_expired" for event in events)
    assert any(event.event == "lease_recovered" for event in events)
    assert all(event.evidence_class == "synthetic" for event in events)
    assert all(event.runtime_evidence is False for event in events)


def test_preregistration_freezes_same_case_randomized_schedule_and_budgets() -> None:
    preregistration = json.loads(
        (REPOSITORY / "tests/evals/ste37_preregistration.json").read_text()
    )
    schedule = preregistration["schedule"]
    assert len(schedule) == 24
    assert len({item["schedule_id"] for item in schedule}) == 24
    counts: dict[tuple[str, str], int] = {}
    for item in schedule:
        key = (item["configuration_id"], item["case_id"])
        counts[key] = counts.get(key, 0) + 1
    assert set(counts.values()) == {3}
    schedule_hash = hashlib.sha256(
        json.dumps(schedule, sort_keys=True, separators=(",", ":")).encode()
    ).hexdigest()
    assert schedule_hash == preregistration["schedule_sha256"]
    unhashed = dict(preregistration)
    expected = unhashed.pop("preregistration_sha256")
    actual = hashlib.sha256(
        json.dumps(unhashed, sort_keys=True, separators=(",", ":")).encode()
    ).hexdigest()
    assert actual == expected
    assert preregistration["budget"]["total_max_cost_microusd"] == 360_000
    assert preregistration["report_contract"]["production_selection_allowed"] is False
