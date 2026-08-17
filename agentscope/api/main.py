from __future__ import annotations

from collections import Counter
from typing import Any

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from ..agent import run_demo
from ..benchmark import CASES
from ..models import IngestRequest
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
    return {"status": "ok", "storage": "demo-seed"}


@app.get("/v1/overview")
def overview() -> dict[str, Any]:
    runs = demo_runs()
    all_spans = [span for run in runs for span in run["spans"]]
    errors = sum(span["status"] == "error" for span in all_spans)
    cost = sum(span.get("metadata", {}).get("cost_usd", 0) for span in all_spans)
    calls = sum(span["kind"] == "llm" for span in all_spans)
    return {"runs": len(runs), "errors": errors, "llm_calls": calls, "cost_usd": round(cost, 4), "debugging_time_saved": "Not measured"}


@app.get("/v1/runs")
def runs() -> list[dict[str, Any]]:
    if store:
        stored = store.read_runs()
        if stored:
            return stored
    return demo_runs()


@app.get("/v1/runs/{run_id}")
def run_detail(run_id: str) -> dict[str, Any]:
    return next(run for run in runs() if str(run["run_id"]) == run_id)


@app.post("/v1/runs:ingest")
def ingest(request: IngestRequest) -> dict[str, int]:
    if store:
        store.write([run.model_dump(mode="json") for run in request.runs], [evaluation.model_dump(mode="json") for evaluation in request.evaluations])
    return {"runs_ingested": len(request.runs), "evaluations_ingested": len(request.evaluations)}


@app.get("/v1/benchmark")
def benchmark() -> dict[str, Any]:
    return {"version": "triage-v1", "cases": [case.__dict__ for case in CASES], "tags": dict(Counter(case.tag for case in CASES))}
