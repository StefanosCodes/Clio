from __future__ import annotations

from collections.abc import Iterable
from typing import Any, Protocol

from clio.domain.conversation.contracts import (
    ConversationDetail,
    ConversationView,
    PacketView,
    StreamEvent,
)


class ConversationStore(Protocol):
    async def list_conversations(self, organization_id: str) -> list[ConversationView]: ...

    async def create_conversation(self, organization_id: str, title: str) -> ConversationView: ...

    async def get_detail(self, organization_id: str, conversation_id: str) -> ConversationDetail: ...

    async def begin_run(
        self,
        organization_id: str,
        conversation_id: str,
        *,
        client_message_id: str,
        message: str,
        runtime: str,
        retry_of: str | None,
    ) -> str: ...

    async def append_events(
        self, organization_id: str, run_id: str, events: Iterable[StreamEvent]
    ) -> None: ...

    async def replay_events(
        self, organization_id: str, run_id: str, after_cursor: int
    ) -> list[dict[str, Any]]: ...

    async def complete_run(
        self,
        organization_id: str,
        run_id: str,
        *,
        assistant_content: str,
        status: str = "completed",
        provider_response_id: str | None = None,
        provider_request_id: str | None = None,
    ) -> str | None: ...

    async def cancel_run(self, organization_id: str, run_id: str) -> bool: ...

    async def update_packet(
        self,
        organization_id: str,
        conversation_id: str,
        *,
        base_version: int,
        idempotency_key: str,
        content: dict[str, Any],
    ) -> PacketView: ...

    async def record_usage(
        self,
        organization_id: str,
        conversation_id: str,
        run_id: str,
        usage: dict[str, Any],
    ) -> None: ...
