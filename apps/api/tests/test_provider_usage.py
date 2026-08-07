from clio.infrastructure.openai.provider_smoke import (
    MAX_CALL_MICROUSD,
    calculate_cost_microusd,
    enforce_preregistered_budget,
)


def test_preregistered_provider_budget_and_normalized_cost() -> None:
    enforce_preregistered_budget("short synthetic prompt")
    assert (
        calculate_cost_microusd(
            input_tokens=100,
            cached_input_tokens=20,
            cache_write_tokens=10,
            output_tokens=30,
        )
        == 1_323
    )
    assert MAX_CALL_MICROUSD == 10_000
