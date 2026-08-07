from __future__ import annotations

from collections.abc import Iterable
from datetime import UTC, datetime
from typing import Any

from clio.application.use_cases import ApplicationShellService
from clio.domain.conversation.contracts import (
    ConversationDetail,
    ConversationView,
    PacketView,
    StreamEvent,
    TurnStreamRequest,
)


class MemoryStore:
    def __init__(self) -> None:
        self.events: dict[str, list[StreamEvent]] = {}
        self.completed: list[str] = []
        self.usage: list[dict[str, Any]] = []

    async def list_conversations(self, organization_id: str) -> list[ConversationView]:
        return []

    async def create_conversation(self, organization_id: str, title: str) -> ConversationView:
        return ConversationView(
            id="conversation-1",
            organization_id=organization_id,
            title=title,
            created_at=datetime.now(UTC),
            updated_at=datetime.now(UTC),
        )

    async def get_detail(self, organization_id: str, conversation_id: str) -> ConversationDetail:
        raise NotImplementedError

    async def begin_run(self, *args: Any, **kwargs: Any) -> str:
        return "run-1"

    async def append_events(
        self, organization_id: str, run_id: str, events: Iterable[StreamEvent]
    ) -> None:
        self.events.setdefault(run_id, []).extend(events)

    async def replay_events(
        self, organization_id: str, run_id: str, after_cursor: int
    ) -> list[dict[str, Any]]:
        return [
            event.model_dump(mode="json")
            for event in self.events[run_id]
            if event.cursor > after_cursor
        ]

    async def complete_run(self, organization_id: str, run_id: str, **kwargs: Any) -> str:
        self.completed.append(run_id)
        return "message-1"

    async def cancel_run(self, organization_id: str, run_id: str) -> bool:
        return True

    async def update_packet(self, *args: Any, **kwargs: Any) -> PacketView:
        raise NotImplementedError

    async def record_usage(
        self,
        organization_id: str,
        conversation_id: str,
        run_id: str,
        usage: dict[str, Any],
    ) -> None:
        self.usage.append(usage)


async def _collect(service: ApplicationShellService, payload: TurnStreamRequest) -> list[StreamEvent]:
    return [
        event
        async for event in service.stream_turn(
            "fixture-acme", "conversation-1", payload
        )
    ]


def test_fixture_turn_persists_terminal_sequence_and_reconnects_after_cursor() -> None:
    import asyncio

    async def scenario() -> None:
        store = MemoryStore()
        service = ApplicationShellService(store)
        first = await _collect(
            service,
            TurnStreamRequest(message="Plan a launch", client_message_id="message-0001"),
        )
        assert [event.cursor for event in first] == list(range(6))
        assert first[-1].event == "done"
        assert store.completed == ["run-1"]
        assert store.usage[0]["evidence_class"] == "synthetic"

        resumed = await _collect(
            service,
            TurnStreamRequest(
                message="ignored during reconnect",
                client_message_id="message-0002",
                reconnect_run_id="run-1",
                after_cursor=2,
            ),
        )
        assert [event.cursor for event in resumed] == [3, 4, 5]

    asyncio.run(scenario())
