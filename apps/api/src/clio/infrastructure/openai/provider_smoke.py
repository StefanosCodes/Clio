from __future__ import annotations

import hashlib
from dataclasses import dataclass
from typing import Any

from agents import Agent, ModelSettings, RunConfig, Runner
from agents.models.openai_responses import OpenAIResponsesModel
from openai import AsyncOpenAI

from clio.infrastructure.postgres import ConversationRepository, PostgresAgentSession
from clio.infrastructure.postgres.database import Database

MODEL = "gpt-5.6-sol"
PRICE_VERSION = "openai-standard-gpt-5.6-sol-short-2026-08-03"
MAX_OUTPUT_TOKENS = 128
MAX_CALL_MICROUSD = 10_000


class CapturingResponsesModel(OpenAIResponsesModel):
    """Retain response envelope metadata that Agents SDK normalizes away."""

    actual_model: str | None = None
    actual_service_tier: str | None = None

    async def _fetch_response(self, *args: Any, **kwargs: Any) -> Any:
        response = await super()._fetch_response(*args, **kwargs)
        self.actual_model = response.model
        self.actual_service_tier = response.service_tier
        return response


@dataclass(frozen=True)
class ProviderSmokeResult:
    run_id: str
    response_sha256: str
    response_id: str | None
    request_id: str | None
    usage: dict[str, Any]


def calculate_cost_microusd(
    *,
    input_tokens: int,
    cached_input_tokens: int,
    cache_write_tokens: int,
    output_tokens: int,
) -> int:
    uncached_input = max(0, input_tokens - cached_input_tokens - cache_write_tokens)
    # USD/M-token converts directly to micro-USD/token.
    return (
        uncached_input * 5
        + cached_input_tokens * 0.5
        + cache_write_tokens * 6.25
        + output_tokens * 30
    ).__ceil__()


def enforce_preregistered_budget(prompt: str) -> None:
    if len(prompt) > 1_000:
        raise ValueError("provider smoke prompt exceeds preregistered size")
    conservative_input_tokens = 400
    worst_case = calculate_cost_microusd(
        input_tokens=conservative_input_tokens,
        cached_input_tokens=0,
        cache_write_tokens=0,
        output_tokens=MAX_OUTPUT_TOKENS,
    )
    if worst_case > MAX_CALL_MICROUSD:
        raise ValueError("provider smoke exceeds preregistered cost budget")


async def run_provider_smoke(
    *,
    database: Database,
    repository: ConversationRepository,
    organization_id: str,
    conversation_id: str,
    api_key: str,
    prompt: str,
) -> ProviderSmokeResult:
    enforce_preregistered_budget(prompt)
    run_id = await repository.begin_run(
        organization_id,
        conversation_id,
        client_message_id="provider-smoke-ste8-0001",
        message="[synthetic development smoke input redacted]",
        runtime="provider",
        retry_of=None,
    )
    session = PostgresAgentSession(database, organization_id, f"smoke:{conversation_id}")
    client = AsyncOpenAI(api_key=api_key, timeout=45.0, max_retries=0)
    model = CapturingResponsesModel(MODEL, client)
    agent = Agent(
        name="Clio M1 synthetic smoke",
        instructions=(
            "This is a bounded synthetic development smoke. Reply with one short sentence "
            "confirming the application shell can reach the model. Do not call tools."
        ),
        model=model,
        model_settings=ModelSettings(
            max_tokens=MAX_OUTPUT_TOKENS,
            reasoning={"effort": "low"},
            store=False,
            extra_body={"service_tier": "default"},
        ),
    )
    try:
        result = await Runner.run(
            agent,
            prompt,
            max_turns=1,
            session=session,
            run_config=RunConfig(
                tracing_disabled=True,
                trace_include_sensitive_data=False,
                workflow_name="Clio STE-8 provider smoke",
            ),
        )
        usage = result.context_wrapper.usage
        normalized = {
            "provider": "openai",
            "model": model.actual_model or MODEL,
            "actual_service_tier": model.actual_service_tier or "default",
            "input_tokens": usage.input_tokens,
            "cached_input_tokens": usage.input_tokens_details.cached_tokens,
            "cache_write_tokens": usage.input_tokens_details.cache_write_tokens,
            "output_tokens": usage.output_tokens,
            "reasoning_tokens": usage.output_tokens_details.reasoning_tokens,
            "total_tokens": usage.total_tokens,
            "evidence_class": "development",
            "price_version": PRICE_VERSION,
        }
        normalized["cost_microusd"] = calculate_cost_microusd(
            input_tokens=normalized["input_tokens"],
            cached_input_tokens=normalized["cached_input_tokens"],
            cache_write_tokens=normalized["cache_write_tokens"],
            output_tokens=normalized["output_tokens"],
        )
        if normalized["cost_microusd"] > MAX_CALL_MICROUSD:
            raise RuntimeError("provider returned usage above preregistered cost budget")
        raw_response = str(result.final_output)
        response = result.raw_responses[-1]
        await repository.record_usage(
            organization_id, conversation_id, run_id, normalized
        )
        await repository.complete_run(
            organization_id,
            run_id,
            assistant_content="[development smoke response redacted]",
            provider_response_id=response.response_id,
            provider_request_id=response.request_id,
        )
        return ProviderSmokeResult(
            run_id=run_id,
            response_sha256=hashlib.sha256(raw_response.encode()).hexdigest(),
            response_id=response.response_id,
            request_id=response.request_id,
            usage=normalized,
        )
    except Exception:
        await repository.complete_run(
            organization_id,
            run_id,
            assistant_content="[development smoke failed]",
            status="failed",
        )
        raise
    finally:
        await session.clear_session()
        await client.close()
