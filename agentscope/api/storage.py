from __future__ import annotations

import json
import os
from typing import Any

import psycopg


SCHEMA = """
CREATE TABLE IF NOT EXISTS runs (
  run_id uuid PRIMARY KEY,
  scenario_id text NOT NULL,
  dataset_version text NOT NULL,
  condition text NOT NULL,
  agent_version text NOT NULL,
  commit_sha text NOT NULL,
  status text NOT NULL,
  started_at timestamptz NOT NULL,
  ended_at timestamptz,
  payload jsonb NOT NULL
);
CREATE INDEX IF NOT EXISTS runs_scenario_idx ON runs (scenario_id);
CREATE INDEX IF NOT EXISTS runs_started_idx ON runs (started_at DESC);
CREATE TABLE IF NOT EXISTS evaluations (
  id bigserial PRIMARY KEY,
  run_id uuid NOT NULL REFERENCES runs(run_id) ON DELETE CASCADE,
  case_id text NOT NULL,
  evaluator text NOT NULL,
  passed boolean NOT NULL,
  payload jsonb NOT NULL
);
"""


class PostgresStore:
    def __init__(self, url: str) -> None:
        self.url = url

    def setup(self) -> None:
        with psycopg.connect(self.url) as conn:
            conn.execute(SCHEMA)

    def write(self, runs: list[dict[str, Any]], evaluations: list[dict[str, Any]]) -> None:
        with psycopg.connect(self.url) as conn:
            for run in runs:
                conn.execute(
                    """INSERT INTO runs (run_id, scenario_id, dataset_version, condition, agent_version, commit_sha, status, started_at, ended_at, payload)
                    VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
                    ON CONFLICT (run_id) DO UPDATE SET payload=EXCLUDED.payload, status=EXCLUDED.status, ended_at=EXCLUDED.ended_at""",
                    (run["run_id"], run["scenario_id"], run["dataset_version"], run["condition"], run["agent_version"], run["commit_sha"], run["status"], run["started_at"], run.get("ended_at"), json.dumps(run)),
                )
            for evaluation in evaluations:
                conn.execute(
                    "INSERT INTO evaluations (run_id, case_id, evaluator, passed, payload) VALUES (%s,%s,%s,%s,%s)",
                    (evaluation["run_id"], evaluation["case_id"], evaluation["evaluator"], evaluation["passed"], json.dumps(evaluation)),
                )

    def read_runs(self) -> list[dict[str, Any]]:
        with psycopg.connect(self.url) as conn:
            rows = conn.execute("SELECT payload FROM runs ORDER BY started_at DESC").fetchall()
        return [row[0] for row in rows]


def configured_store() -> PostgresStore | None:
    url = os.getenv("DATABASE_URL")
    if not url:
        return None
    store = PostgresStore(url)
    store.setup()
    return store
