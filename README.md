# AgentScope

AgentScope is a focused observability and evaluation platform for multi-step AI agents. It makes a support-triage agent inspectable at the exact point where intent, evidence, tools, retries, and cost diverge.

![AgentScope architecture](docs/architecture.svg)

![AgentScope dashboard preview](docs/dashboard-preview.svg)

## What is implemented

- A Python SDK that records hierarchical agent, LLM, retrieval, tool, and evaluator spans.
- A deterministic `triage-v1` benchmark with 16 debugging, regression, and cost scenarios.
- Fixture replay and contract evaluation through the Python CLI.
- A FastAPI telemetry API with PostgreSQL persistence and a seeded local fallback.
- A Next.js dashboard for run filtering, trace timelines, failure signals, token/cost metadata, and benchmark breakdowns.
- PostgreSQL schema for idempotent run storage and evaluation records.

The current implementation is a working local vertical slice. It does not claim measured reductions in debugging time or LLM spend yet; those require the operator and live-provider experiments described by the benchmark contract.

## Architecture

```mermaid
flowchart LR
  A[Demo support-triage agent] --> B[Python SDK / CLI]
  B --> C[FastAPI telemetry API]
  C --> D[(PostgreSQL)]
  D --> E[Next.js dashboard]
  E --> F[Replay + diff]
  F --> G[Eval harness / CI gate]
```

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
.venv/bin/python -m agentscope.cli eval
```

The dashboard automatically reads from `NEXT_PUBLIC_API_URL` when the API is running and falls back to its local fixtures otherwise.

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
