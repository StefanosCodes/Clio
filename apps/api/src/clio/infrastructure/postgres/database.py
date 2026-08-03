from __future__ import annotations

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

import asyncpg


class Database:
    """Direct asyncpg connection pool with transaction-local fixture scope.

    `assume_role` exists only for local verification where the Supabase postgres
    admin connection SET ROLEs into the NOLOGIN application role. A deployed
    process connects directly as its least-privilege login and leaves it unset.
    """

    def __init__(self, database_url: str, *, assume_role: str | None = None) -> None:
        self.database_url = database_url
        self.assume_role = assume_role
        self.pool: asyncpg.Pool | None = None

    async def connect(self) -> None:
        if self.pool is None:
            self.pool = await asyncpg.create_pool(self.database_url, min_size=1, max_size=5)

    async def close(self) -> None:
        if self.pool is not None:
            await self.pool.close()
            self.pool = None

    @asynccontextmanager
    async def transaction(self, organization_id: str) -> AsyncIterator[asyncpg.Connection]:
        if self.pool is None:
            raise RuntimeError("database pool is not connected")
        async with self.pool.acquire() as connection:
            async with connection.transaction():
                if self.assume_role:
                    if self.assume_role != "clio_app":
                        raise ValueError("only the local clio_app role may be assumed")
                    await connection.execute("set local role clio_app")
                await connection.fetchval(
                    "select set_config('app.organization_id', $1, true)",
                    organization_id,
                )
                yield connection
