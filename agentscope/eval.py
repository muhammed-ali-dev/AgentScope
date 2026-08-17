from __future__ import annotations

from typing import Any

from .benchmark import Case, CASES


def evaluate(run: dict[str, Any], case: Case) -> dict[str, Any]:
    output = run.get("output", {})
    failures: list[str] = []
    for key, expected in case.expected.items():
        if key == "max_calls":
            llm_calls = sum(span["kind"] == "llm" for span in run.get("spans", []))
            if llm_calls > expected:
                failures.append(f"llm_calls={llm_calls} exceeds {expected}")
        elif key == "max_input_tokens":
            tokens = sum(span.get("metadata", {}).get("input_tokens", 0) for span in run.get("spans", []))
            if tokens > expected:
                failures.append(f"input_tokens={tokens} exceeds {expected}")
        elif output.get(key) != expected:
            failures.append(f"{key}: expected {expected!r}, got {output.get(key)!r}")
    return {"case_id": case.case_id, "passed": not failures, "failures": failures, "expected": case.expected, "actual": output}


def run_benchmark(condition: str = "candidate") -> list[dict[str, Any]]:
    from .agent import run_demo

    results = []
    for case in CASES:
        results.append(evaluate(run_demo(case.case_id, condition), case))
    return results


def run_regression_suite() -> list[dict[str, Any]]:
    from .agent import run_demo

    results = []
    for case in CASES:
        if case.tag == "regression":
            result = evaluate(run_demo(case.case_id, "mutated"), case)
            result["mutation_detected"] = not result["passed"]
            results.append(result)
    return results


def diff_runs(before: dict[str, Any], after: dict[str, Any]) -> dict[str, Any]:
    before_spans = before.get("spans", [])
    after_spans = after.get("spans", [])
    before_cost = sum(span.get("metadata", {}).get("cost_usd", 0) for span in before_spans)
    after_cost = sum(span.get("metadata", {}).get("cost_usd", 0) for span in after_spans)
    return {
        "scenario_id": before.get("scenario_id"),
        "output_changed": before.get("output") != after.get("output"),
        "span_count_delta": len(after_spans) - len(before_spans),
        "llm_call_delta": sum(s["kind"] == "llm" for s in after_spans) - sum(s["kind"] == "llm" for s in before_spans),
        "cost_delta_usd": round(after_cost - before_cost, 6),
        "before_run_id": before.get("run_id"),
        "after_run_id": after.get("run_id"),
    }
