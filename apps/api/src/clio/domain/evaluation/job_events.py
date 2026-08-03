from __future__ import annotations

from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, TypeAdapter


class SyntheticEvent(BaseModel):
    model_config = ConfigDict(extra="forbid")
    schema_version: Literal["1.0.0"] = "1.0.0"
    evidence_class: Literal["synthetic"] = "synthetic"
    runtime_evidence: Literal[False] = False
    cursor: int = Field(ge=0)
    planning_run_id: str
    packet_version: int = Field(gt=0)
    job_id: str


class EngineeringAnalysisJobCreated(SyntheticEvent):
    event: Literal["engineering_analysis_job_created"]
    repository_commit: str


class JobAttemptStarted(SyntheticEvent):
    event: Literal["job_attempt_started"]
    attempt_id: str
    lease_generation: int = Field(gt=0)


class LeaseExpired(SyntheticEvent):
    event: Literal["lease_expired"]
    attempt_id: str
    lease_generation: int = Field(gt=0)


class LeaseRecovered(SyntheticEvent):
    event: Literal["lease_recovered"]
    expired_attempt_id: str
    attempt_id: str
    lease_generation: int = Field(gt=1)


class CodexMcpCallStarted(SyntheticEvent):
    event: Literal["codex_mcp_call_started"]
    attempt_id: str
    call_id: str
    authority: Literal["read_only_synthetic"] = "read_only_synthetic"


class TypedResultRecorded(SyntheticEvent):
    event: Literal["typed_result_recorded"]
    attempt_id: str
    call_id: str
    result_schema_version: Literal["1.0.0"] = "1.0.0"
    result_sha256: str


class EngineeringAnalysisJobCompleted(SyntheticEvent):
    event: Literal["engineering_analysis_job_completed"]
    attempt_id: str
    terminal_status: Literal["completed"] = "completed"


EngineeringAnalysisEvent = Annotated[
    EngineeringAnalysisJobCreated
    | JobAttemptStarted
    | LeaseExpired
    | LeaseRecovered
    | CodexMcpCallStarted
    | TypedResultRecorded
    | EngineeringAnalysisJobCompleted,
    Field(discriminator="event"),
]
event_adapter = TypeAdapter(EngineeringAnalysisEvent)


def validate_job_fixture(payloads: list[dict[str, object]]) -> list[EngineeringAnalysisEvent]:
    events = [event_adapter.validate_python(payload) for payload in payloads]
    if [event.cursor for event in events] != list(range(len(events))):
        raise ValueError("synthetic job cursors must be contiguous")
    if len({event.planning_run_id for event in events}) != 1:
        raise ValueError("synthetic job events must bind one planning run")
    if len({event.job_id for event in events}) != 1:
        raise ValueError("synthetic job events must bind one job")
    if not any(event.event == "lease_expired" for event in events):
        raise ValueError("synthetic recovery fixture requires lease expiry")
    if not any(event.event == "lease_recovered" for event in events):
        raise ValueError("synthetic recovery fixture requires lease recovery representation")
    if any(event.runtime_evidence for event in events):
        raise ValueError("M1 job fixture cannot claim runtime evidence")
    return events
