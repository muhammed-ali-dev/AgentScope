# AgentScope

Observability and deterministic evaluation for multi-step AI agents. AgentScope traces model, retrieval, and tool execution so failures, regressions, and unnecessary LLM calls can be inspected and compared.

![AgentScope dashboard](docs/dashboard-overview.png)

## Capabilities

- **Trace:** hierarchical agent, LLM, retrieval, tool, latency, token, cost, and error spans.
- **Replay and diff:** rerun fixture-backed scenarios and compare outputs, spans, calls, and recorded cost across versions.
- **Evaluate:** execute 16 deterministic support-triage scenarios, including four seeded regressions and four cost cases.
- **Inspect:** query FastAPI/PostgreSQL telemetry from a Next.js dashboard with run, regression, and cost views.

## Architecture

![AgentScope architecture](docs/architecture.svg)

The runtime path is `demo agent → Python SDK/CLI → FastAPI → PostgreSQL → Next.js → replay/diff → eval gate`. Without PostgreSQL, the API and dashboard use clearly labeled deterministic fixtures.

## Quick start

Start the API:

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -e .
uvicorn agentscope.api.main:app --reload --port 8000
```

Start the dashboard in another terminal:

```bash
cd dashboard
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

To persist telemetry, run `docker compose up -d db` and export:

```bash
export DATABASE_URL=postgresql://agentscope:agentscope@localhost:5432/agentscope
```

## Exercise the workflows

```bash
.venv/bin/python -m agentscope.cli replay --scenario D5
.venv/bin/python -m agentscope.cli diff --scenario C1 --before baseline --after candidate
.venv/bin/python -m agentscope.cli eval
```

<details>
<summary>Version-diff and regression screenshots</summary>

![Baseline-to-candidate trace diff](docs/dashboard-diff.png)

![Seeded regression gate](docs/regression-gate.png)

</details>

## Verify

```bash
.venv/bin/python -m unittest discover -s tests -v
cd dashboard && npm run build
```

> **Status:** working local vertical slice. Fixture costs are recorded test metadata; debugging-time and live-provider cost reductions have not been measured.
