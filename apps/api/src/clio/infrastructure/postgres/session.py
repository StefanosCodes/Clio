from __future__ import annotations

import json
from typing import Any

from clio.infrastructure.postgres.database import Database


class PostgresAgentSession:
    """Agents SDK Session using Clio Postgres as the sole conversation memory."""

    session_settings = None

    def __init__(self, database: Database, organization_id: str, session_id: str) -> None:
        self.database = database
        self.organization_id = organization_id
        self.session_id = session_id

    async def get_items(self, limit: int | None = None) -> list[dict[str, Any]]:
        async with self.database.transaction(self.organization_id) as connection:
            if limit is None:
                rows = await connection.fetch(
                    """select item from agent_session_items
                       where organization_id = $1 and session_id = $2 order by id""",
                    self.organization_id,
                    self.session_id,
                )
            else:
                rows = await connection.fetch(
                    """select item from (
                         select id, item from agent_session_items
                         where organization_id = $1 and session_id = $2
                         order by id desc limit $3
                       ) recent order by id""",
                    self.organization_id,
                    self.session_id,
                    limit,
                )
        return [
            json.loads(row["item"])
            if isinstance(row["item"], str)
            else dict(row["item"])
            for row in rows
        ]

    async def add_items(self, items: list[dict[str, Any]]) -> None:
        if not items:
            return
        async with self.database.transaction(self.organization_id) as connection:
            await connection.executemany(
                """insert into agent_session_items (organization_id, session_id, item)
                   values ($1, $2, $3::jsonb)""",
                [
                    (self.organization_id, self.session_id, json.dumps(item))
                    for item in items
                ],
            )

    async def pop_item(self) -> dict[str, Any] | None:
        async with self.database.transaction(self.organization_id) as connection:
            row = await connection.fetchrow(
                """delete from agent_session_items where id = (
                     select id from agent_session_items
                     where organization_id = $1 and session_id = $2
                     order by id desc limit 1 for update skip locked
                   ) returning item""",
                self.organization_id,
                self.session_id,
            )
        if row is None:
            return None
        return (
            json.loads(row["item"])
            if isinstance(row["item"], str)
            else dict(row["item"])
        )

    async def clear_session(self) -> None:
        async with self.database.transaction(self.organization_id) as connection:
            await connection.execute(
                "delete from agent_session_items where organization_id = $1 and session_id = $2",
                self.organization_id,
                self.session_id,
            )
