from __future__ import annotations

import asyncio
import json
import os

from clio.infrastructure.openai import run_provider_smoke
from clio.infrastructure.postgres import ConversationRepository, Database


async def main() -> None:
    database_url = os.environ.get("DATABASE_URL")
    api_key = os.environ.get("OPENAI_API_KEY")
    if not database_url or not api_key:
        raise SystemExit("DATABASE_URL and OPENAI_API_KEY must be set")
    database = Database(database_url, assume_role=os.getenv("CLIO_DATABASE_ROLE") or None)
    await database.connect()
    try:
        repository = ConversationRepository(database)
        organization_id = "fixture-acme"
        conversation = await repository.create_conversation(
            organization_id, "STE-8 development provider smoke"
        )
        result = await run_provider_smoke(
            database=database,
            repository=repository,
            organization_id=organization_id,
            conversation_id=conversation.id,
            api_key=api_key,
            prompt="Confirm this synthetic Clio application-shell smoke in one short sentence.",
        )
        print(
            json.dumps(
                {
                    "status": "completed",
                    "run_id": result.run_id,
                    "response_sha256": result.response_sha256,
                    "response_id_present": bool(result.response_id),
                    "request_id_present": bool(result.request_id),
                    "usage": result.usage,
                    "raw_content_retained": False,
                },
                sort_keys=True,
            )
        )
    finally:
        await database.close()


if __name__ == "__main__":
    asyncio.run(main())
