from __future__ import annotations

from collections import Counter
from typing import Any

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

from ..agent import run_demo
from ..benchmark import CASES, get_case
from ..eval import diff_runs, run_benchmark, run_regression_suite
from ..models import IngestRequest, ReplayRequest
from .storage import configured_store


app = FastAPI(title="AgentScope Telemetry API", version="0.1.0")
app.add_middleware(CORSMiddleware, allow_origins=["http://localhost:3000"], allow_methods=["*"], allow_headers=["*"])
store = configured_store()


def demo_runs() -> list[dict[str, Any]]:
    runs = []
    for case in CASES:
        condition = "baseline" if case.tag == "cost" else "agentscope"
        runs.append(run_demo(case.case_id, condition))
    return runs


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "storage": "postgresql" if store else "demo-seed"}


@app.get("/v1/overview")
def overview() -> dict[str, Any]:
    available_runs = runs()
    all_spans = [span for run in available_runs for span in run["spans"]]
    errors = sum(span["status"] == "error" for span in all_spans)
    cost = sum(span.get("metadata", {}).get("cost_usd", 0) for span in all_spans)
    calls = sum(span["kind"] == "llm" for span in all_spans)
    ended = [run.get("ended_at") for run in available_runs if run.get("ended_at")]
    regressions = run_regression_suite()
    return {
        "runs": len(available_runs),
        "errors": errors,
        "llm_calls": calls,
        "cost_usd": round(cost, 6),
        "last_run_at": max(ended) if ended else None,
        "regressions_detected": sum(result["mutation_detected"] for result in regressions),
        "regression_cases": len(regressions),
        "debugging_time_saved": None,
    }


@app.get("/v1/runs")
def runs() -> list[dict[str, Any]]:
    if store:
        stored = store.read_runs()
        if stored:
            return stored
    return demo_runs()


@app.get("/v1/runs/{run_id}")
def run_detail(run_id: str) -> dict[str, Any]:
    try:
        return next(run for run in runs() if str(run["run_id"]) == run_id)
    except StopIteration as exc:
        raise HTTPException(status_code=404, detail="Run not found") from exc


@app.post("/v1/runs:ingest")
def ingest(request: IngestRequest) -> dict[str, int]:
    if store:
        store.write([run.model_dump(mode="json") for run in request.runs], [evaluation.model_dump(mode="json") for evaluation in request.evaluations])
    return {"runs_ingested": len(request.runs), "evaluations_ingested": len(request.evaluations)}


@app.get("/v1/benchmark")
def benchmark() -> dict[str, Any]:
    return {"version": "triage-v1", "cases": [case.__dict__ for case in CASES], "tags": dict(Counter(case.tag for case in CASES))}


@app.post("/v1/replay")
def replay(request: ReplayRequest) -> dict[str, Any]:
    try:
        get_case(request.scenario_id)
    except StopIteration as exc:
        raise HTTPException(status_code=404, detail="Scenario not found") from exc
    return run_demo(request.scenario_id, request.condition)


@app.get("/v1/diff")
def diff(
    scenario_id: str,
    before: str = Query(default="baseline", pattern="^(baseline|agentscope|candidate|mutated)$"),
    after: str = Query(default="candidate", pattern="^(baseline|agentscope|candidate|mutated)$"),
) -> dict[str, Any]:
    try:
        get_case(scenario_id)
    except StopIteration as exc:
        raise HTTPException(status_code=404, detail="Scenario not found") from exc
    before_run = run_demo(scenario_id, before)
    after_run = run_demo(scenario_id, after)
    return {"before": before_run, "after": after_run, "diff": diff_runs(before_run, after_run)}


@app.get("/v1/evaluations")
def evaluations() -> dict[str, Any]:
    clean = run_benchmark()
    regressions = run_regression_suite()
    return {
        "candidate": {"passed": sum(result["passed"] for result in clean), "cases": len(clean), "results": clean},
        "seeded_regressions": {
            "detected": sum(result["mutation_detected"] for result in regressions),
            "cases": len(regressions),
            "results": regressions,
        },
    }
