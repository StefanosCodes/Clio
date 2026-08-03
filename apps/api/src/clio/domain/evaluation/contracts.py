from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class EvaluationContract(BaseModel):
    model_config = ConfigDict(extra="forbid")


class EvidenceClaim(EvaluationContract):
    claim: str = Field(min_length=1, max_length=1_000)
    source_ref: str | None = Field(default=None, max_length=500)
    status: Literal["evidence", "inference", "decision", "unknown"]


class PlanningEvaluationOutput(EvaluationContract):
    schema_version: Literal["1.0.0"] = "1.0.0"
    case_id: str
    summary: str = Field(min_length=1, max_length=2_000)
    readiness: Literal["ready", "blocked"]
    consequential_question: str | None = Field(default=None, max_length=1_000)
    decisions: list[str] = Field(default_factory=list, max_length=10)
    unknowns: list[str] = Field(default_factory=list, max_length=10)
    evidence_claims: list[EvidenceClaim] = Field(default_factory=list, max_length=10)
    safety_actions: list[str] = Field(default_factory=list, max_length=10)
    non_goals: list[str] = Field(default_factory=list, max_length=10)


class GateResult(EvaluationContract):
    gate_id: str
    status: Literal["pass", "fail", "not_applicable"]
    rationale: str


class RubricResult(EvaluationContract):
    dimension: str
    provisional_score: int | None = Field(default=None, ge=0, le=3)
    provisional_rationale: str | None = None
    human_score: int | None = Field(default=None, ge=0, le=3)
    human_rationale: str | None = None
    adjudication: str | None = None
    authority: Literal["provisional_only", "human_adjudicated"] = "provisional_only"
