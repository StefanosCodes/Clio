from __future__ import annotations

import json
from collections.abc import AsyncIterator

from fastapi import APIRouter, Request
from fastapi.responses import StreamingResponse

from clio.application.use_cases import FoundationChatService
from clio.domain.conversation.contracts import FoundationChatRequest, StreamEvent

router = APIRouter(prefix="/api/v1/foundation", tags=["foundation"])
_service = FoundationChatService()


def encode_event(event: StreamEvent) -> str:
    payload = event.model_dump(mode="json")
    return f"id: {event.cursor}\nevent: {event.event}\ndata: {json.dumps(payload, separators=(',', ':'))}\n\n"


async def event_stream(
    request: FoundationChatRequest,
    http_request: Request,
) -> AsyncIterator[str]:
    async for event in _service.stream(request):
        if await http_request.is_disconnected():
            return
        yield encode_event(event)


@router.post("/chat/stream", responses={200: {"model": StreamEvent}})
async def stream_foundation_chat(
    request: FoundationChatRequest,
    http_request: Request,
) -> StreamingResponse:
    return StreamingResponse(
        event_stream(request, http_request),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
