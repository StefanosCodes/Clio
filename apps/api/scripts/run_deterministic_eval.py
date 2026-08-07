from __future__ import annotations

import hashlib
import json
from pathlib import Path

from clio.domain.evaluation import validate_job_fixture
from clio.infrastructure.evaluation.deterministic import (
    run_deterministic_suite,
    synthetic_job_fixture,
)

REPOSITORY = Path(__file__).parents[3]
MANIFEST_PATH = REPOSITORY / "tests" / "evals" / "m0_seed_cases.json"
ARTIFACT_DIRECTORY = REPOSITORY / "artifacts" / "evals"


def main() -> None:
    manifest = json.loads(MANIFEST_PATH.read_text())
    suite = run_deterministic_suite(manifest)
    job_payloads = synthetic_job_fixture()
    events = validate_job_fixture(job_payloads)
    ARTIFACT_DIRECTORY.mkdir(parents=True, exist_ok=True)
    deterministic_path = ARTIFACT_DIRECTORY / "ste37_deterministic_trace.json"
    job_path = ARTIFACT_DIRECTORY / "ste37_synthetic_job_events.json"
    deterministic_path.write_text(json.dumps(suite, indent=2, sort_keys=True) + "\n")
    job_path.write_text(
        json.dumps(
            {
                "schema_version": "1.0.0",
                "evidence_class": "synthetic",
                "runtime_evidence": False,
                "truthfulness": "expired lease is representable; no worker recovery ran",
                "events": [event.model_dump(mode="json") for event in events],
            },
            indent=2,
            sort_keys=True,
        )
        + "\n"
    )
    print(
        json.dumps(
            {
                "deterministic_cases": len(suite["records"]),
                "failed_applicable_gates": sum(
                    gate["status"] == "fail"
                    for record in suite["records"]
                    for gate in record["hard_gates"]
                ),
                "trace_sha256": hashlib.sha256(deterministic_path.read_bytes()).hexdigest(),
                "synthetic_job_event_count": len(events),
                "job_fixture_sha256": hashlib.sha256(job_path.read_bytes()).hexdigest(),
                "runtime_recovery_claimed": False,
            },
            sort_keys=True,
        )
    )


if __name__ == "__main__":
    main()
