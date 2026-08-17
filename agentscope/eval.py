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
