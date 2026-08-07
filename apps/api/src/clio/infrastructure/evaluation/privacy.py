from __future__ import annotations

import json
import re
from copy import deepcopy
from typing import Any

PROHIBITED_KEYS = {
    "api_key",
    "authorization",
    "credential",
    "input",
    "output",
    "prompt",
    "raw",
    "request",
    "request_body",
    "response",
    "response_body",
    "secret",
    "token_value",
}
SECRET_PATTERNS = [
    re.compile(r"\bsk-[A-Za-z0-9_-]{8,}\b"),
    re.compile(r"(?i)bearer\s+[A-Za-z0-9._~+/-]{8,}"),
    re.compile(r"(?i)(?:OPENAI_API_KEY|DATABASE_URL)\s*=\s*\S+"),
    re.compile(r"(?i)private customer conversation"),
    re.compile(r"(?i)unauthorized private repository"),
]


class PromotionDenied(ValueError):
    pass


def _redact_text(value: str) -> str:
    result = value
    for pattern in SECRET_PATTERNS:
        result = pattern.sub("[REDACTED]", result)
    return result


def sanitize(value: Any) -> Any:
    if isinstance(value, dict):
        sanitized: dict[str, Any] = {}
        for key, item in value.items():
            lowered = str(key).lower()
            if lowered in PROHIBITED_KEYS:
                sanitized[str(key)] = "[REDACTED]"
            else:
                sanitized[str(key)] = sanitize(item)
        return sanitized
    if isinstance(value, list):
        return [sanitize(item) for item in value]
    if isinstance(value, tuple):
        return [sanitize(item) for item in value]
    if isinstance(value, str):
        return _redact_text(value)
    if value is None or isinstance(value, bool | int | float):
        return value
    return _redact_text(str(value))


def assert_retained_safe(value: Any) -> None:
    serialized = json.dumps(value, sort_keys=True)
    for pattern in SECRET_PATTERNS:
        if pattern.search(serialized):
            raise PromotionDenied("retained trace contains prohibited content")


def promote_trace(
    trace_record: dict[str, Any],
    *,
    privacy_class: str,
    authorized: bool,
    expires_at: str | None = None,
) -> dict[str, Any]:
    if privacy_class in {"authorized_private", "prohibited"}:
        raise PromotionDenied(f"privacy class {privacy_class} cannot be promoted in M1")
    if privacy_class == "approved_project_reference" and not authorized:
        raise PromotionDenied("project-reference promotion requires recorded authorization")
    if privacy_class == "redacted_internal" and (not authorized or not expires_at):
        raise PromotionDenied("redacted-internal promotion requires authorization and expiry")
    promoted = sanitize(deepcopy(trace_record))
    promoted["privacy_class"] = privacy_class
    promoted["promotion_authorized"] = authorized
    promoted["expires_at"] = expires_at
    assert_retained_safe(promoted)
    return promoted
