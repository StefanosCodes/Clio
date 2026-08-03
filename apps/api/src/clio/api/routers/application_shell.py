from __future__ import annotations

import json
from collections.abc import AsyncIterator

from fastapi import APIRouter, Header, HTTPException, Request
from fastapi.responses import JSONResponse, StreamingResponse

from clio.application.use_cases import ApplicationShellService
from clio.domain.conversation.contracts import (
    ConversationDetail,
    ConversationView,
    CreateConversationRequest,
    ErrorEvent,
    PacketUpdateRequest,
    PacketView,
    StreamEvent,
    TurnStreamRequest,
)
from clio.infrastructure.postgres import (
    ActiveRunError,
    ConversationNotFoundError,
    VersionConflictError,
)

router = APIRouter(prefix="/api/v1", tags=["application-shell"])


def _service(request: Request) -> ApplicationShellService:
    service = getattr(request.app.state, "application_shell", None)
    if service is None:
        raise HTTPException(status_code=503, detail="local database is not configured")
    return service


def _organization(value: str | None) -> str:
    if value not in {"fixture-acme", "fixture-orbit"}:
        raise HTTPException(status_code=400, detail="fixture organization header is required")
    return value


def _encode_event(event: StreamEvent) -> str:
    payload = event.model_dump(mode="json")
    return (
        f"id: {payload['cursor']}\nevent: {payload['event']}\n"
        f"data: {json.dumps(payload, separators=(',', ':'))}\n\n"
    )


@router.get("/conversations", response_model=list[ConversationView])
async def list_conversations(
    request: Request,
    x_clio_organization: str | None = Header(default=None),
) -> list[ConversationView]:
    organization_id = _organization(x_clio_organization)
    return await _service(request).list_conversations(organization_id)


@router.post("/conversations", response_model=ConversationView, status_code=201)
async def create_conversation(
    payload: CreateConversationRequest,
    request: Request,
    x_clio_organization: str | None = Header(default=None),
) -> ConversationView:
    organization_id = _organization(x_clio_organization)
    return await _service(request).create_conversation(organization_id, payload.title)


@router.get("/conversations/{conversation_id}", response_model=ConversationDetail)
async def get_conversation(
    conversation_id: str,
    request: Request,
    x_clio_organization: str | None = Header(default=None),
) -> ConversationDetail:
    try:
        return await _service(request).get_detail(
            _organization(x_clio_organization), conversation_id
        )
    except ConversationNotFoundError as error:
        raise HTTPException(status_code=404, detail="conversation not found") from error


@router.post(
    "/conversations/{conversation_id}/turns/stream",
    responses={200: {"model": StreamEvent}},
)
async def stream_turn(
    conversation_id: str,
    payload: TurnStreamRequest,
    request: Request,
    x_clio_organization: str | None = Header(default=None),
) -> StreamingResponse:
    organization_id = _organization(x_clio_organization)

    async def events() -> AsyncIterator[str]:
        try:
            async for event in _service(request).stream_turn(
                organization_id, conversation_id, payload
            ):
                if await request.is_disconnected():
                    return
                yield _encode_event(event)
        except ActiveRunError as error:
            yield _encode_event(
                ErrorEvent(
                    run_id=error.run_id,
                    cursor=0,
                    code="ActiveRun",
                    message="A planning turn is already active.",
                    retryable=True,
                )
            )

    return StreamingResponse(
        events(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.post("/runs/{run_id}/cancel")
async def cancel_run(
    run_id: str,
    request: Request,
    x_clio_organization: str | None = Header(default=None),
) -> dict[str, object]:
    cancelled = await _service(request).cancel_run(
        _organization(x_clio_organization), run_id
    )
    return {"run_id": run_id, "status": "cancelled" if cancelled else "terminal"}


@router.put("/conversations/{conversation_id}/packet", response_model=PacketView)
async def update_packet(
    conversation_id: str,
    payload: PacketUpdateRequest,
    request: Request,
    x_clio_organization: str | None = Header(default=None),
) -> PacketView | JSONResponse:
    try:
        return await _service(request).update_packet(
            _organization(x_clio_organization), conversation_id, payload
        )
    except VersionConflictError as error:
        return JSONResponse(
            status_code=409,
            content={
                "code": "VersionConflict",
                "accepted": error.accepted.model_dump(mode="json") if error.accepted else None,
            },
        )
