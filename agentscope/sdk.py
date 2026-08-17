from __future__ import annotations

from contextlib import contextmanager
from datetime import datetime, timezone
from typing import Any, Iterator

from .models import Run, Span


class Trace:
    """Small synchronous tracer that is also useful in fixture-only runs."""

    def __init__(self, scenario_id: str, condition: str = "agentscope") -> None:
        self.run = Run(scenario_id=scenario_id, condition=condition)  # type: ignore[arg-type]
        self._active: list[Span] = []

    @contextmanager
    def span(self, kind: str, name: str, input: dict[str, Any] | None = None, metadata: dict[str, Any] | None = None) -> Iterator[Span]:
        current = self._active[-1] if self._active else None
        span = Span(kind=kind, name=name, parent_span_id=current.span_id if current else None, input=input or {}, metadata=metadata or {})  # type: ignore[arg-type]
        self._active.append(span)
        self.run.spans.append(span)
        try:
            yield span
        except Exception as exc:
            span.status = "error"
            span.error = {"type": type(exc).__name__, "message": str(exc)}
            raise
        finally:
            span.ended_at = datetime.now(timezone.utc)
            self._active.pop()

    def finish(self, output: dict[str, Any], status: str = "ok") -> Run:
        self.run.output = output
        self.run.status = status  # type: ignore[assignment]
        self.run.ended_at = datetime.now(timezone.utc)
        return self.run
