from __future__ import annotations

from datetime import UTC, datetime
from typing import Annotated, Any, Literal

from pydantic import BaseModel, ConfigDict, Field


class Contract(BaseModel):
    model_config = ConfigDict(extra="forbid")


class FoundationChatRequest(Contract):
    message: str = Field(min_length=1, max_length=20_000)
    client_message_id: str = Field(min_length=8, max_length=120)
    after_cursor: int = Field(default=-1, ge=-1)


class CreateConversationRequest(Contract):
    title: str = Field(default="New planning conversation", min_length=1, max_length=120)


class TurnStreamRequest(Contract):
    message: str = Field(min_length=1, max_length=20_000)
    client_message_id: str = Field(min_length=8, max_length=120)
    after_cursor: int = Field(default=-1, ge=-1)
    reconnect_run_id: str | None = None
    retry_of: str | None = None
    runtime: Literal["fixture", "provider"] = "fixture"


class PacketUpdateRequest(Contract):
    base_version: int = Field(ge=0)
    idempotency_key: str = Field(min_length=8, max_length=120)
    content: dict[str, Any]


class OrganizationView(Contract):
    id: str
    name: str
    authority: Literal["fixture"] = "fixture"


class ConversationView(Contract):
    id: str
    organization_id: str
    title: str
    created_at: datetime
    updated_at: datetime


class MessageView(Contract):
    id: str
    conversation_id: str
    role: Literal["user", "assistant"]
    content: str
    run_id: str | None
    created_at: datetime


class RunView(Contract):
    id: str
    conversation_id: str
    status: Literal["running", "completed", "failed", "cancelled"]
    runtime: Literal["fixture", "provider"]
    retry_of: str | None
    created_at: datetime
    completed_at: datetime | None


class PacketView(Contract):
    conversation_id: str
    version: int
    content: dict[str, Any]
    created_at: datetime


class ConversationDetail(Contract):
    conversation: ConversationView
    messages: list[MessageView]
    runs: list[RunView]
    packet: PacketView | None


class EventBase(Contract):
    schema_version: Literal["1.0.0"] = "1.0.0"
    run_id: str
    cursor: int = Field(ge=0)
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))


class SessionEvent(EventBase):
    event: Literal["session"] = "session"
    runtime: Literal["fixture", "provider"] = "fixture"
    conversation_id: str | None = None


class StatusEvent(EventBase):
    event: Literal["status"] = "status"
    status: Literal["running", "completed", "failed", "cancelled"]
    message_id: str | None = None


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
    actual_service_tier: str = "fixture"
    price_version: str = "synthetic-zero-v1"
    cost_microusd: int = Field(default=0, ge=0)


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
