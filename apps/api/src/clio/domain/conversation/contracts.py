from __future__ import annotations

from datetime import UTC, datetime
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field


class Contract(BaseModel):
    model_config = ConfigDict(extra="forbid")


class FoundationChatRequest(Contract):
    message: str = Field(min_length=1, max_length=20_000)
    client_message_id: str = Field(min_length=8, max_length=120)
    after_cursor: int = Field(default=-1, ge=-1)


class EventBase(Contract):
    schema_version: Literal["1.0.0"] = "1.0.0"
    run_id: str
    cursor: int = Field(ge=0)
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))


class SessionEvent(EventBase):
    event: Literal["session"] = "session"
    runtime: Literal["fixture"] = "fixture"


class StatusEvent(EventBase):
    event: Literal["status"] = "status"
    status: Literal["running", "completed", "failed", "cancelled"]


class TextDeltaEvent(EventBase):
    event: Literal["text_delta"] = "text_delta"
    delta: str


class UsageSnapshot(Contract):
    provider: str
    model: str
    input_tokens: int = Field(ge=0)
    cached_input_tokens: int = Field(ge=0)
    cache_write_tokens: int = Field(ge=0)
    output_tokens: int = Field(ge=0)
    reasoning_tokens: int = Field(ge=0)
    total_tokens: int = Field(ge=0)
    evidence_class: Literal["synthetic", "development"]


class UsageEvent(EventBase):
    event: Literal["usage"] = "usage"
    usage: UsageSnapshot


class ErrorEvent(EventBase):
    event: Literal["error"] = "error"
    code: str
    message: str
    retryable: bool


class DoneEvent(EventBase):
    event: Literal["done"] = "done"
    status: Literal["completed", "failed", "cancelled"]


StreamEvent = Annotated[
    SessionEvent | StatusEvent | TextDeltaEvent | UsageEvent | ErrorEvent | DoneEvent,
    Field(discriminator="event"),
]
