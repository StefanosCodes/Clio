from __future__ import annotations

import hashlib
from collections.abc import AsyncIterator

from clio.domain.conversation.contracts import (
    DoneEvent,
    FoundationChatRequest,
    SessionEvent,
    StatusEvent,
    StreamEvent,
    TextDeltaEvent,
    UsageEvent,
    UsageSnapshot,
)


class FoundationChatService:
    """Deterministic imported walking skeleton; product behavior starts in STE-8."""

    def __init__(self) -> None:
        self._events_by_message: dict[str, list[StreamEvent]] = {}

    async def stream(self, request: FoundationChatRequest) -> AsyncIterator[StreamEvent]:
        events = self._events_by_message.get(request.client_message_id)
        if events is None:
            run_id = f"run_{hashlib.sha256(request.client_message_id.encode()).hexdigest()[:16]}"
            reply = f"Foundation received: {request.message.strip()}"
            events = [
                SessionEvent(run_id=run_id, cursor=0),
                StatusEvent(run_id=run_id, cursor=1, status="running"),
                TextDeltaEvent(run_id=run_id, cursor=2, delta=reply),
                UsageEvent(
                    run_id=run_id,
                    cursor=3,
                    usage=UsageSnapshot(
                        provider="fixture",
                        model="deterministic",
                        input_tokens=0,
                        cached_input_tokens=0,
                        cache_write_tokens=0,
                        output_tokens=0,
                        reasoning_tokens=0,
                        total_tokens=0,
                        evidence_class="synthetic",
                    ),
                ),
                StatusEvent(run_id=run_id, cursor=4, status="completed"),
                DoneEvent(run_id=run_id, cursor=5, status="completed"),
            ]
            self._events_by_message[request.client_message_id] = events

        for event in events:
            if event.cursor > request.after_cursor:
                yield event
