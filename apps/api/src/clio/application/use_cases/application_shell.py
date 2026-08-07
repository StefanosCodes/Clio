from __future__ import annotations

from collections.abc import AsyncIterator

from pydantic import TypeAdapter

from clio.domain.conversation.contracts import (
    ConversationDetail,
    ConversationView,
    DoneEvent,
    PacketUpdateRequest,
    PacketView,
    SessionEvent,
    StatusEvent,
    StreamEvent,
    TextDeltaEvent,
    TurnStreamRequest,
    UsageEvent,
    UsageSnapshot,
)
from clio.domain.conversation.ports import ConversationStore

_stream_event_adapter = TypeAdapter(StreamEvent)


class ApplicationShellService:
    def __init__(self, store: ConversationStore) -> None:
        self.store = store

    async def list_conversations(self, organization_id: str) -> list[ConversationView]:
        return await self.store.list_conversations(organization_id)

    async def create_conversation(self, organization_id: str, title: str) -> ConversationView:
        return await self.store.create_conversation(organization_id, title)

    async def get_detail(self, organization_id: str, conversation_id: str) -> ConversationDetail:
        return await self.store.get_detail(organization_id, conversation_id)

    async def stream_turn(
        self,
        organization_id: str,
        conversation_id: str,
        request: TurnStreamRequest,
    ) -> AsyncIterator[StreamEvent]:
        if request.reconnect_run_id:
            payloads = await self.store.replay_events(
                organization_id, request.reconnect_run_id, request.after_cursor
            )
            for payload in payloads:
                yield _stream_event_adapter.validate_python(payload)
            return

        if request.runtime != "fixture":
            raise ValueError("provider turns use the bounded smoke adapter in M1")

        run_id = await self.store.begin_run(
            organization_id,
            conversation_id,
            client_message_id=request.client_message_id,
            message=request.message,
            runtime=request.runtime,
            retry_of=request.retry_of,
        )
        reply = (
            "I captured that direction. In the next milestone, planning intelligence "
            f"will turn it into accepted work. For now, your request is saved: {request.message.strip()}"
        )
        usage = UsageSnapshot(
            provider="fixture",
            model="deterministic-shell-v1",
            input_tokens=0,
            cached_input_tokens=0,
            cache_write_tokens=0,
            output_tokens=0,
            reasoning_tokens=0,
            total_tokens=0,
            evidence_class="synthetic",
        )
        prefix: list[StreamEvent] = [
            SessionEvent(
                run_id=run_id,
                cursor=0,
                runtime="fixture",
                conversation_id=conversation_id,
            ),
            StatusEvent(run_id=run_id, cursor=1, status="running"),
            TextDeltaEvent(run_id=run_id, cursor=2, delta=reply),
            UsageEvent(run_id=run_id, cursor=3, usage=usage),
        ]
        await self.store.append_events(organization_id, run_id, prefix)
        message_id = await self.store.complete_run(
            organization_id, run_id, assistant_content=reply
        )
        suffix: list[StreamEvent] = [
            StatusEvent(
                run_id=run_id,
                cursor=4,
                status="completed",
                message_id=message_id,
            ),
            DoneEvent(run_id=run_id, cursor=5, status="completed"),
        ]
        await self.store.append_events(organization_id, run_id, suffix)
        await self.store.record_usage(
            organization_id,
            conversation_id,
            run_id,
            usage.model_dump(),
        )
        for event in [*prefix, *suffix]:
            if event.cursor > request.after_cursor:
                yield event

    async def cancel_run(self, organization_id: str, run_id: str) -> bool:
        return await self.store.cancel_run(organization_id, run_id)

    async def update_packet(
        self,
        organization_id: str,
        conversation_id: str,
        request: PacketUpdateRequest,
    ) -> PacketView:
        return await self.store.update_packet(
            organization_id,
            conversation_id,
            base_version=request.base_version,
            idempotency_key=request.idempotency_key,
            content=request.content,
        )
