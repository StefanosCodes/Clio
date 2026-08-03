from __future__ import annotations

import asyncio
import os
import uuid

import pytest

from clio.application.use_cases import ApplicationShellService
from clio.domain.conversation.contracts import PacketUpdateRequest, TurnStreamRequest
from clio.infrastructure.postgres import (
    ActiveRunError,
    ConversationRepository,
    Database,
    PostgresAgentSession,
    VersionConflictError,
)


@pytest.mark.postgres
def test_durable_shell_continuity_scope_and_concurrency() -> None:
    database_url = os.getenv("TEST_DATABASE_URL")
    if not database_url:
        pytest.skip("TEST_DATABASE_URL is not configured")

    async def scenario() -> None:
        database = Database(database_url, assume_role="clio_app")
        await database.connect()
        try:
            repository = ConversationRepository(database)
            service = ApplicationShellService(repository)
            unique = uuid.uuid4().hex
            first = await repository.create_conversation("fixture-acme", "First outcome")
            second = await repository.create_conversation("fixture-acme", "Second outcome")
            assert {
                first.id,
                second.id,
            }.issubset(
                {item.id for item in await repository.list_conversations("fixture-acme")}
            )
            orbit_conversation_ids = {
                item.id
                for item in await repository.list_conversations("fixture-orbit")
            }
            assert first.id not in orbit_conversation_ids
            assert second.id not in orbit_conversation_ids

            events = [
                event
                async for event in service.stream_turn(
                    "fixture-acme",
                    first.id,
                    TurnStreamRequest(
                        message="Make this durable",
                        client_message_id=f"postgres-message-{unique}-1",
                    ),
                )
            ]
            reopened = await repository.get_detail("fixture-acme", first.id)
            assert [message.role for message in reopened.messages] == ["user", "assistant"]
            assert reopened.messages[-1].content == events[2].delta  # type: ignore[union-attr]
            replay = await repository.replay_events(
                "fixture-acme", events[0].run_id, after_cursor=2
            )
            assert [event["cursor"] for event in replay] == [3, 4, 5]

            active_run = await repository.begin_run(
                "fixture-acme",
                second.id,
                client_message_id=f"postgres-message-{unique}-2",
                message="first active turn",
                runtime="fixture",
                retry_of=None,
            )
            with pytest.raises(ActiveRunError):
                await repository.begin_run(
                    "fixture-acme",
                    second.id,
                    client_message_id=f"postgres-message-{unique}-3",
                    message="concurrent active turn",
                    runtime="fixture",
                    retry_of=None,
                )
            assert await repository.cancel_run("fixture-acme", active_run)

            packet = await service.update_packet(
                "fixture-acme",
                first.id,
                PacketUpdateRequest(
                    base_version=0,
                    idempotency_key=f"packet-key-{unique}-1",
                    content={"outcome": "Version one"},
                ),
            )
            repeated = await service.update_packet(
                "fixture-acme",
                first.id,
                PacketUpdateRequest(
                    base_version=0,
                    idempotency_key=f"packet-key-{unique}-1",
                    content={"outcome": "ignored duplicate"},
                ),
            )
            assert packet == repeated
            with pytest.raises(VersionConflictError) as conflict:
                await service.update_packet(
                    "fixture-acme",
                    first.id,
                    PacketUpdateRequest(
                        base_version=0,
                        idempotency_key=f"packet-key-{unique}-2",
                        content={"outcome": "stale update"},
                    ),
                )
            assert conflict.value.accepted == packet

            session = PostgresAgentSession(database, "fixture-acme", f"test:{first.id}")
            await session.add_items([{"role": "user", "content": "one"}, {"role": "assistant", "content": "two"}])
            assert [item["content"] for item in await session.get_items(limit=1)] == ["two"]
            assert (await session.pop_item())["content"] == "two"  # type: ignore[index]
            await session.clear_session()
            assert await session.get_items() == []
        finally:
            await database.close()

    asyncio.run(scenario())
