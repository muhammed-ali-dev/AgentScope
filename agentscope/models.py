from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Literal
from uuid import UUID, uuid4

from pydantic import BaseModel, Field


SpanKind = Literal["agent", "llm", "retrieval", "tool", "evaluator"]


class Span(BaseModel):
    span_id: UUID = Field(default_factory=uuid4)
    parent_span_id: UUID | None = None
    kind: SpanKind
    name: str
    status: Literal["ok", "error", "blocked"] = "ok"
    started_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    ended_at: datetime | None = None
    input: dict[str, Any] = Field(default_factory=dict)
    output: dict[str, Any] = Field(default_factory=dict)
    error: dict[str, Any] | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)


class Run(BaseModel):
    run_id: UUID = Field(default_factory=uuid4)
    scenario_id: str
    dataset_version: str = "triage-v1"
    condition: Literal["baseline", "agentscope", "candidate", "mutated"] = "agentscope"
    agent_version: str = "triage-agent@0.1.0"
    commit_sha: str = "local"
    status: Literal["ok", "error", "blocked"] = "ok"
    started_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    ended_at: datetime | None = None
    output: dict[str, Any] = Field(default_factory=dict)
    spans: list[Span] = Field(default_factory=list)


class EvalResult(BaseModel):
    run_id: UUID
    case_id: str
    evaluator: str
    passed: bool
    severity: Literal["info", "warning", "error"] = "error"
    failures: list[str] = Field(default_factory=list)
    actual: dict[str, Any] = Field(default_factory=dict)
    expected: dict[str, Any] = Field(default_factory=dict)


class IngestRequest(BaseModel):
    runs: list[Run]
    evaluations: list[EvalResult] = Field(default_factory=list)


class ReplayRequest(BaseModel):
    scenario_id: str
    condition: Literal["baseline", "agentscope", "candidate", "mutated"] = "candidate"
