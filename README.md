# AgentScope

AgentScope is a focused observability and evaluation platform for multi-step AI agents. It makes a support-triage agent inspectable at the exact point where intent, evidence, tools, retries, and cost diverge.

![AgentScope API-backed overview](docs/dashboard-overview.png)

_API-backed overview generated from the deterministic `triage-v1` benchmark. Debugging-time improvement remains explicitly unmeasured._

## Product workflows

### Trace replay and version diff

![AgentScope baseline-to-candidate trace diff](docs/dashboard-diff.png)

The dashboard executes the same replay/diff contract exposed by the CLI. This C1 comparison preserves the evaluated output while showing the exact LLM-call, span, and recorded fixture-cost deltas.

### Seeded regression gate

![AgentScope seeded regression gate](docs/regression-gate.png)

Each row is produced by running a seeded mutation through the deterministic evaluator; the dashboard can open the corresponding mutated-to-candidate diff.

## What is implemented

- A Python SDK that records hierarchical agent, LLM, retrieval, tool, and evaluator spans.
- A deterministic `triage-v1` benchmark with 16 debugging, regression, and cost scenarios.
- Fixture replay and contract evaluation through the Python CLI.
- Runnable replay and version diff commands for comparing call counts, outputs, spans, and cost.
- Seeded regression mutations that are executed through the evaluation suite.
- A FastAPI telemetry API with PostgreSQL persistence and a seeded local fallback.
- A Next.js dashboard with API-backed replay, baseline/candidate version diffs, run filtering, trace timelines, seeded-regression inspection, and cost comparisons.
- PostgreSQL schema for idempotent run storage and evaluation records.

The current implementation is a working local vertical slice. It does not claim measured reductions in debugging time or LLM spend yet; those require the operator and live-provider experiments described by the benchmark contract.

## Architecture

![AgentScope architecture](docs/architecture.svg)

## Run locally

### Dashboard

```bash
cd dashboard
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The dashboard has seeded data so it is inspectable without a running database.

### API and CLI

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -e .
uvicorn agentscope.api.main:app --reload --port 8000
```

In another terminal:

```bash
.venv/bin/python -m agentscope.cli demo --scenario D5
.venv/bin/python -m agentscope.cli replay --scenario D5
.venv/bin/python -m agentscope.cli diff --scenario C1 --before baseline --after candidate
.venv/bin/python -m agentscope.cli eval
```

The dashboard automatically reads from `NEXT_PUBLIC_API_URL` when the API is running. If it cannot connect within five seconds, it switches to four explicitly labeled fixture previews; replay and diff actions remain API-only and show an error instead of simulating a result.

Dashboard workflows call these API endpoints:

```text
GET  /v1/runs
POST /v1/replay
GET  /v1/diff?scenario_id=C1&before=baseline&after=candidate
GET  /v1/evaluations
GET  /v1/benchmark
```

### PostgreSQL

```bash
docker compose up -d db
export DATABASE_URL=postgresql://agentscope:agentscope@localhost:5432/agentscope
uvicorn agentscope.api.main:app --reload --port 8000
```

## Benchmark scenarios

`triage-v1` includes deterministic cases for ambiguous intent, stale retrieval, retrieval distractors, missing fields, tool timeouts, invalid tool arguments, state leakage, prompt injection, prompt mutations, tool-schema mutations, corpus changes, retry regressions, duplicate planning calls, post-terminal calls, duplicate lookups, and context bloat.

The evaluation command reports raw case outcomes. No resume-style percentages are generated until an actual baseline-versus-treatment experiment has been run.

## Verification

```bash
.venv/bin/python -m unittest discover -s tests -v
cd dashboard && npm run build
```
