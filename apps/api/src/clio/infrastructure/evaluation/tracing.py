from __future__ import annotations

import threading
from datetime import UTC, datetime
from typing import Any

from agents.tracing import Span, Trace, TracingProcessor

from clio.infrastructure.evaluation.privacy import sanitize


class LocalRedactingTraceProcessor(TracingProcessor):
    """Capture Agents SDK traces locally after aggressive field redaction."""

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._records: dict[str, dict[str, Any]] = {}

    def on_trace_start(self, trace: Trace) -> None:
        with self._lock:
            self._records[trace.trace_id] = {
                "trace_id": trace.trace_id,
                "workflow_name": trace.name,
                "metadata": sanitize(trace.metadata or {}),
                "started_at": datetime.now(UTC).isoformat(),
                "ended_at": None,
                "spans": [],
                "truthfulness": "trace_proves_execution_not_correctness",
            }

    def on_trace_end(self, trace: Trace) -> None:
        with self._lock:
            record = self._records.get(trace.trace_id)
            if record is not None:
                record["ended_at"] = datetime.now(UTC).isoformat()

    def on_span_start(self, span: Span[Any]) -> None:
        return None

    def on_span_end(self, span: Span[Any]) -> None:
        exported = sanitize(span.span_data.export())
        with self._lock:
            record = self._records.get(span.trace_id)
            if record is None:
                return
            record["spans"].append(
                {
                    "span_id": span.span_id,
                    "parent_id": span.parent_id,
                    "started_at": span.started_at,
                    "ended_at": span.ended_at,
                    "error": sanitize(span.error) if span.error else None,
                    "data": exported,
                }
            )

    def shutdown(self) -> None:
        return None

    def force_flush(self) -> None:
        return None

    def export(self) -> list[dict[str, Any]]:
        with self._lock:
            return sanitize(list(self._records.values()))

    def latest(self) -> dict[str, Any]:
        records = self.export()
        if not records:
            raise RuntimeError("no local trace was captured")
        return records[-1]
