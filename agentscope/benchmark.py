from __future__ import annotations

from dataclasses import dataclass
from typing import Any


@dataclass(frozen=True)
class Case:
    case_id: str
    title: str
    tag: str
    expected: dict[str, Any]
    root_cause: str | None = None
    budget_calls: int = 4


CASES = [
    Case("D1", "Ambiguous intent", "debug", {"intent": "clarification", "escalate": False}, "classification drift"),
    Case("D2", "Stale policy retrieval", "debug", {"cited_doc": "policy-2026-04", "escalate": False}, "stale retrieval result"),
    Case("D3", "Retrieval distractors", "debug", {"cited_doc": "policy-refund", "priority": "normal"}, "distractor outranks evidence"),
    Case("D4", "Missing required field", "debug", {"intent": "clarification", "escalate": False}, "missing account field ignored"),
    Case("D5", "Tool timeout", "debug", {"escalate": True, "status": "blocked"}, "timeout fallback fabricated resolution"),
    Case("D6", "Invalid tool arguments", "debug", {"status": "blocked", "escalate": True}, "tool contract mismatch"),
    Case("D7", "State leakage", "debug", {"customer": "Mara Velez", "priority": "normal"}, "previous ticket state reused"),
    Case("D8", "Prompt injection", "debug", {"escalate": False, "status": "resolved"}, "ticket instruction treated as policy"),
    Case("R1", "Priority taxonomy mutation", "regression", {"priority": "urgent"}, "prompt taxonomy regression"),
    Case("R2", "Tool schema mutation", "regression", {"status": "resolved"}, "tool schema regression"),
    Case("R3", "Corpus version mutation", "regression", {"cited_doc": "policy-2026-04"}, "corpus version regression"),
    Case("R4", "Retry/finalization mutation", "regression", {"status": "blocked"}, "retry loop regression"),
    Case("C1", "Duplicate planning call", "cost", {"max_calls": 3}, budget_calls=3),
    Case("C2", "Post-terminal summary", "cost", {"max_calls": 3}, budget_calls=3),
    Case("C3", "Duplicate lookup", "cost", {"max_calls": 3}, budget_calls=3),
    Case("C4", "Context bloat", "cost", {"max_input_tokens": 900}, budget_calls=4),
]


def get_case(case_id: str) -> Case:
    return next(case for case in CASES if case.case_id == case_id)
