from __future__ import annotations

from typing import Any

from .benchmark import Case, get_case
from .sdk import Trace


def run_demo(case_id: str = "D2", condition: str = "agentscope") -> dict[str, Any]:
    case: Case = get_case(case_id)
    trace = Trace(case.case_id, condition)

    with trace.span("agent", "triage.run", {"ticket_id": f"ticket-{case_id.lower()}"}) as root:
        with trace.span("llm", "classify.intent", {"purpose": "classification", "prompt_hash": "p_84f1"}, {"model": "fixture-gpt", "input_tokens": 188, "output_tokens": 42, "cost_usd": 0.0031}):
            pass
        with trace.span("retrieval", "policy.search", {"query": case.title}, {"corpus_version": "2026-04", "documents": ["policy-2026-04", "policy-refund", "policy-legacy"]}):
            pass
        with trace.span("tool", "account.lookup", {"customer_id": "cus_7J3M"}, {"latency_ms": 91, "result": "available"}):
            pass
        if case.tag == "cost" and condition == "baseline":
            with trace.span("llm", "duplicate.plan", {"purpose": "duplicate planning", "prompt_hash": "p_84f1"}, {"model": "fixture-gpt", "input_tokens": 188, "output_tokens": 42, "cost_usd": 0.0031}):
                pass
        if case.case_id == "D5":
            with trace.span("tool", "account.lookup.retry", {"customer_id": "cus_7J3M"}, {"latency_ms": 2000, "timeout": True}) as retry:
                retry.status = "error"
                retry.error = {"type": "ToolTimeout", "message": "account.lookup exceeded 2000ms"}
        if case.tag == "cost" and condition == "baseline":
            with trace.span("llm", "post_terminal.summary", {"purpose": "unnecessary summary", "prompt_hash": "p_92a0"}, {"model": "fixture-gpt", "input_tokens": 512, "output_tokens": 96, "cost_usd": 0.0072}):
                pass
        output = dict(case.expected)
        if condition == "mutated":
            mutations = {
                "R1": {"priority": "normal"},
                "R2": {"status": "blocked"},
                "R3": {"cited_doc": "policy-legacy"},
                "R4": {"status": "resolved"},
            }
            output.update(mutations.get(case.case_id, {}))
        root.output = output
    return trace.finish(output).model_dump(mode="json")
