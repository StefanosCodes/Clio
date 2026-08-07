from __future__ import annotations

import json
import uuid
from collections.abc import Iterable
from typing import Any

import asyncpg

from clio.domain.conversation.contracts import (
    ConversationDetail,
    ConversationView,
    MessageView,
    PacketView,
    RunView,
    StreamEvent,
)
from clio.infrastructure.postgres.database import Database


class ConversationNotFoundError(Exception):
    pass


class ActiveRunError(Exception):
    def __init__(self, run_id: str) -> None:
        self.run_id = run_id
        super().__init__(f"conversation already has active run {run_id}")


class VersionConflictError(Exception):
    def __init__(self, accepted: PacketView | None) -> None:
        self.accepted = accepted
        super().__init__("packet base version is stale")


def _conversation(row: asyncpg.Record) -> ConversationView:
    return ConversationView(**dict(row))


def _message(row: asyncpg.Record) -> MessageView:
    return MessageView(**dict(row))


def _run(row: asyncpg.Record) -> RunView:
    return RunView(**dict(row))


def _packet(row: asyncpg.Record | None) -> PacketView | None:
    if row is None:
        return None
    payload = dict(row)
    if isinstance(payload["content"], str):
        payload["content"] = json.loads(payload["content"])
    return PacketView(**payload)


class ConversationRepository:
    def __init__(self, database: Database) -> None:
        self.database = database

    async def list_conversations(self, organization_id: str) -> list[ConversationView]:
        async with self.database.transaction(organization_id) as connection:
            rows = await connection.fetch(
                """select id::text, organization_id, title, created_at, updated_at
                   from conversations where organization_id = $1
                   order by updated_at desc, id""",
                organization_id,
            )
        return [_conversation(row) for row in rows]

    async def create_conversation(self, organization_id: str, title: str) -> ConversationView:
        conversation_id = uuid.uuid4()
        async with self.database.transaction(organization_id) as connection:
            row = await connection.fetchrow(
                """insert into conversations (id, organization_id, title)
                   values ($1, $2, $3)
                   returning id::text, organization_id, title, created_at, updated_at""",
                conversation_id,
                organization_id,
                title,
            )
        assert row is not None
        return _conversation(row)

    async def get_detail(self, organization_id: str, conversation_id: str) -> ConversationDetail:
        async with self.database.transaction(organization_id) as connection:
            conversation_row = await connection.fetchrow(
                """select id::text, organization_id, title, created_at, updated_at
                   from conversations where organization_id = $1 and id = $2::uuid""",
                organization_id,
                conversation_id,
            )
            if conversation_row is None:
                raise ConversationNotFoundError(conversation_id)
            message_rows = await connection.fetch(
                """select id::text, conversation_id::text, role, content, run_id::text, created_at
                   from messages where organization_id = $1 and conversation_id = $2::uuid
                   order by created_at, id""",
                organization_id,
                conversation_id,
            )
            run_rows = await connection.fetch(
                """select id::text, conversation_id::text, status, runtime, retry_of::text,
                          created_at, completed_at
                   from planning_runs where organization_id = $1 and conversation_id = $2::uuid
                   order by created_at, id""",
                organization_id,
                conversation_id,
            )
            packet_row = await connection.fetchrow(
                """select conversation_id::text, version, content, created_at
                   from packet_snapshots where organization_id = $1 and conversation_id = $2::uuid
                   order by version desc limit 1""",
                organization_id,
                conversation_id,
            )
        return ConversationDetail(
            conversation=_conversation(conversation_row),
            messages=[_message(row) for row in message_rows],
            runs=[_run(row) for row in run_rows],
            packet=_packet(packet_row),
        )

    async def begin_run(
        self,
        organization_id: str,
        conversation_id: str,
        *,
        client_message_id: str,
        message: str,
        runtime: str,
        retry_of: str | None,
    ) -> str:
        run_id = uuid.uuid4()
        message_id = uuid.uuid4()
        try:
            async with self.database.transaction(organization_id) as connection:
                await connection.execute(
                    """insert into messages
                       (id, organization_id, conversation_id, role, content, client_message_id)
                       values ($1, $2, $3::uuid, 'user', $4, $5)
                       on conflict (organization_id, client_message_id) do nothing""",
                    message_id,
                    organization_id,
                    conversation_id,
                    message,
                    client_message_id,
                )
                await connection.execute(
                    """insert into planning_runs
                       (id, organization_id, conversation_id, client_message_id, runtime, status, retry_of)
                       values ($1, $2, $3::uuid, $4, $5, 'running', $6::uuid)""",
                    run_id,
                    organization_id,
                    conversation_id,
                    client_message_id,
                    runtime,
                    retry_of,
                )
        except asyncpg.UniqueViolationError as error:
            async with self.database.transaction(organization_id) as connection:
                active = await connection.fetchval(
                    """select id::text from planning_runs
                       where organization_id = $1 and conversation_id = $2::uuid and status = 'running'""",
                    organization_id,
                    conversation_id,
                )
            if active:
                raise ActiveRunError(active) from error
            raise
        return str(run_id)

    async def append_events(
        self,
        organization_id: str,
        run_id: str,
        events: Iterable[StreamEvent],
    ) -> None:
        async with self.database.transaction(organization_id) as connection:
            for event in events:
                await connection.execute(
                    """insert into run_events (organization_id, run_id, cursor, event_type, payload)
                       values ($1, $2::uuid, $3, $4, $5::jsonb)
                       on conflict (organization_id, run_id, cursor) do nothing""",
                    organization_id,
                    run_id,
                    event.cursor,
                    event.event,
                    event.model_dump_json(),
                )

    async def replay_events(
        self, organization_id: str, run_id: str, after_cursor: int
    ) -> list[dict[str, Any]]:
        async with self.database.transaction(organization_id) as connection:
            rows = await connection.fetch(
                """select payload from run_events
                   where organization_id = $1 and run_id = $2::uuid and cursor > $3
                   order by cursor""",
                organization_id,
                run_id,
                after_cursor,
            )
        return [
            json.loads(row["payload"])
            if isinstance(row["payload"], str)
            else dict(row["payload"])
            for row in rows
        ]

    async def complete_run(
        self,
        organization_id: str,
        run_id: str,
        *,
        assistant_content: str,
        status: str = "completed",
        provider_response_id: str | None = None,
        provider_request_id: str | None = None,
    ) -> str | None:
        message_id = uuid.uuid4() if status == "completed" else None
        async with self.database.transaction(organization_id) as connection:
            conversation_id = await connection.fetchval(
                """update planning_runs set status = $3, completed_at = now(),
                          provider_response_id = $4, provider_request_id = $5
                   where organization_id = $1 and id = $2::uuid and status = 'running'
                   returning conversation_id""",
                organization_id,
                run_id,
                status,
                provider_response_id,
                provider_request_id,
            )
            if conversation_id is None:
                return None
            if message_id is not None:
                await connection.execute(
                    """insert into messages
                       (id, organization_id, conversation_id, role, content, run_id)
                       values ($1, $2, $3, 'assistant', $4, $5::uuid)""",
                    message_id,
                    organization_id,
                    conversation_id,
                    assistant_content,
                    run_id,
                )
            await connection.execute(
                "update conversations set updated_at = now() where organization_id = $1 and id = $2",
                organization_id,
                conversation_id,
            )
        return str(message_id) if message_id else None

    async def cancel_run(self, organization_id: str, run_id: str) -> bool:
        async with self.database.transaction(organization_id) as connection:
            result = await connection.execute(
                """update planning_runs set status = 'cancelled', completed_at = now()
                   where organization_id = $1 and id = $2::uuid and status = 'running'""",
                organization_id,
                run_id,
            )
        return result == "UPDATE 1"

    async def update_packet(
        self,
        organization_id: str,
        conversation_id: str,
        *,
        base_version: int,
        idempotency_key: str,
        content: dict[str, Any],
    ) -> PacketView:
        async with self.database.transaction(organization_id) as connection:
            existing = await connection.fetchrow(
                """select conversation_id::text, version, content, created_at
                   from packet_snapshots where organization_id = $1
                   and conversation_id = $2::uuid and idempotency_key = $3""",
                organization_id,
                conversation_id,
                idempotency_key,
            )
            if existing:
                return _packet(existing)  # type: ignore[return-value]
            latest = await connection.fetchrow(
                """select conversation_id::text, version, content, created_at
                   from packet_snapshots where organization_id = $1 and conversation_id = $2::uuid
                   order by version desc limit 1 for update""",
                organization_id,
                conversation_id,
            )
            accepted = _packet(latest)
            accepted_version = accepted.version if accepted else 0
            if base_version != accepted_version:
                raise VersionConflictError(accepted)
            row = await connection.fetchrow(
                """insert into packet_snapshots
                   (id, organization_id, conversation_id, version, content, idempotency_key)
                   values ($1, $2, $3::uuid, $4, $5::jsonb, $6)
                   returning conversation_id::text, version, content, created_at""",
                uuid.uuid4(),
                organization_id,
                conversation_id,
                accepted_version + 1,
                json.dumps(content),
                idempotency_key,
            )
        assert row is not None
        return _packet(row)  # type: ignore[return-value]

    async def record_usage(
        self,
        organization_id: str,
        conversation_id: str,
        run_id: str,
        usage: dict[str, Any],
    ) -> None:
        async with self.database.transaction(organization_id) as connection:
            await connection.execute(
                """insert into usage_events
                   (id, organization_id, conversation_id, run_id, evidence_class, provider,
                    actual_model, actual_service_tier, input_tokens, cached_input_tokens,
                    cache_write_tokens, output_tokens, reasoning_tokens, total_tokens,
                    price_version, cost_microusd)
                   values ($1, $2, $3::uuid, $4::uuid, $5, $6, $7, $8, $9, $10, $11,
                           $12, $13, $14, $15, $16)
                   on conflict (organization_id, run_id) do nothing""",
                uuid.uuid4(), organization_id, conversation_id, run_id,
                usage["evidence_class"], usage["provider"], usage["model"],
                usage["actual_service_tier"], usage["input_tokens"],
                usage["cached_input_tokens"], usage["cache_write_tokens"],
                usage["output_tokens"], usage["reasoning_tokens"], usage["total_tokens"],
                usage["price_version"], usage["cost_microusd"],
            )
