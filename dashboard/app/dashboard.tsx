"use client";

import { useEffect, useMemo, useState } from "react";

type Span = {
  span_id: string;
  kind: string;
  name: string;
  status: string;
  started_at?: string;
  ended_at?: string;
  input: Record<string, unknown>;
  output: Record<string, unknown>;
  metadata: Record<string, unknown>;
};

type Run = {
  run_id: string;
  scenario_id: string;
  dataset_version?: string;
  condition: string;
  agent_version?: string;
  status: string;
  started_at?: string;
  ended_at?: string;
  output: Record<string, unknown>;
  spans: Span[];
};

type Benchmark = {
  version: string;
  cases: Array<{ case_id: string; title: string; tag: string }>;
  tags: Record<string, number>;
};

type Evaluation = {
  candidate: { passed: number; cases: number; results: EvalResult[] };
  seeded_regressions: { detected: number; cases: number; results: EvalResult[] };
};

type EvalResult = {
  case_id: string;
  passed: boolean;
  mutation_detected?: boolean;
  failures: string[];
};

type DiffPayload = {
  before: Run;
  after: Run;
  diff: {
    scenario_id: string;
    output_changed: boolean;
    span_count_delta: number;
    llm_call_delta: number;
    cost_delta_usd: number;
  };
};

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const tabs = ["Overview", "Runs", "Regression gate", "Cost lab"];
const caseTitles: Record<string, string> = {
  D1: "Ambiguous intent",
  D2: "Stale policy retrieval",
  D3: "Retrieval distractors",
  D4: "Missing required field",
  D5: "Tool timeout",
  D6: "Invalid tool arguments",
  D7: "State leakage",
  D8: "Prompt injection",
  R1: "Priority taxonomy mutation",
  R2: "Tool schema mutation",
  R3: "Corpus version mutation",
  R4: "Retry/finalization mutation",
  C1: "Duplicate planning call",
  C2: "Post-terminal summary",
  C3: "Duplicate lookup",
  C4: "Context bloat",
};

const previewScenarios = ["D2", "D5", "R1", "C1"];

async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 5000);
  try {
    return await fetch(`${API_URL}${path}`, { ...init, signal: controller.signal });
  } finally {
    window.clearTimeout(timeout);
  }
}
const previewRuns: Run[] = previewScenarios.map((scenarioId) => {
  const isCost = scenarioId.startsWith("C");
  const isTimeout = scenarioId === "D5";
  return {
    run_id: `fixture-${scenarioId.toLowerCase()}`,
    scenario_id: scenarioId,
    dataset_version: "triage-v1",
    condition: isCost ? "baseline" : "agentscope",
    agent_version: "triage-agent@0.1.0",
    status: isTimeout ? "error" : "ok",
    output: {},
    spans: [
      { span_id: `${scenarioId}-1`, kind: "agent", name: "triage.run", status: "ok", input: { ticket_id: `ticket-${scenarioId.toLowerCase()}` }, output: {}, metadata: {} },
      { span_id: `${scenarioId}-2`, kind: "llm", name: "classify.intent", status: "ok", input: { purpose: "classification", prompt_hash: "p_84f1" }, output: {}, metadata: { model: "fixture-gpt", input_tokens: 188, output_tokens: 42, cost_usd: 0.0031 } },
      { span_id: `${scenarioId}-3`, kind: "retrieval", name: "policy.search", status: "ok", input: { query: caseTitles[scenarioId] }, output: {}, metadata: { corpus_version: "2026-04", documents: ["policy-2026-04", "policy-refund", "policy-legacy"] } },
      { span_id: `${scenarioId}-4`, kind: "tool", name: isTimeout ? "account.lookup.retry" : "account.lookup", status: isTimeout ? "error" : "ok", input: { customer_id: "cus_7J3M" }, output: {}, metadata: { latency_ms: isTimeout ? 2000 : 91, timeout: isTimeout } },
      ...(isCost ? [
        { span_id: `${scenarioId}-5`, kind: "llm", name: "duplicate.plan", status: "ok", input: { purpose: "duplicate planning", prompt_hash: "p_84f1" }, output: {}, metadata: { model: "fixture-gpt", input_tokens: 188, output_tokens: 42, cost_usd: 0.0031 } },
        { span_id: `${scenarioId}-6`, kind: "llm", name: "post_terminal.summary", status: "ok", input: { purpose: "unnecessary summary", prompt_hash: "p_92a0" }, output: {}, metadata: { model: "fixture-gpt", input_tokens: 512, output_tokens: 96, cost_usd: 0.0072 } },
      ] : []),
    ],
  };
});

function enrichRun(run: Run): Run {
  return { ...run, output: { ...run.output, title: caseTitles[run.scenario_id] || run.scenario_id } };
}

function runCost(run: Run): number {
  return run.spans.reduce((total, span) => total + Number(span.metadata.cost_usd || 0), 0);
}

function runTokens(run: Run): number {
  return run.spans.reduce((total, span) => total + Number(span.metadata.input_tokens || 0) + Number(span.metadata.output_tokens || 0), 0);
}

function runDuration(run: Run): string {
  if (!run.started_at || !run.ended_at) return "Not recorded";
  const milliseconds = new Date(run.ended_at).getTime() - new Date(run.started_at).getTime();
  return milliseconds < 1000 ? `${Math.max(milliseconds, 0)}ms` : `${(milliseconds / 1000).toFixed(2)}s`;
}

function formatTimestamp(value?: string): string {
  if (!value) return "No completed run";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(value));
}

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState("Overview");
  const [runs, setRuns] = useState(previewRuns.map(enrichRun));
  const [selected, setSelected] = useState(enrichRun(previewRuns[0]));
  const [benchmark, setBenchmark] = useState<Benchmark | null>(null);
  const [evaluation, setEvaluation] = useState<Evaluation | null>(null);
  const [diff, setDiff] = useState<DiffPayload | null>(null);
  const [query, setQuery] = useState("");
  const [source, setSource] = useState<"loading" | "api" | "fixture">("loading");
  const [action, setAction] = useState<"idle" | "replaying" | "comparing">("idle");
  const [notice, setNotice] = useState<string | null>(null);

  async function loadWorkspace() {
    setSource("loading");
    try {
      const [runsResponse, benchmarkResponse, evaluationResponse] = await Promise.all([
        apiFetch("/v1/runs"),
        apiFetch("/v1/benchmark"),
        apiFetch("/v1/evaluations"),
      ]);
      if (!runsResponse.ok || !benchmarkResponse.ok || !evaluationResponse.ok) throw new Error("Telemetry API returned an error");
      const remoteRuns = (await runsResponse.json() as Run[]).map(enrichRun);
      setRuns(remoteRuns);
      setBenchmark(await benchmarkResponse.json());
      setEvaluation(await evaluationResponse.json());
      if (remoteRuns.length) setSelected(remoteRuns[0]);
      setSource("api");
      setNotice(null);
    } catch {
      setRuns(previewRuns.map(enrichRun));
      setSelected(enrichRun(previewRuns[0]));
      setBenchmark(null);
      setEvaluation(null);
      setSource("fixture");
      setNotice("Telemetry API unavailable. Showing four labeled fixture previews; replay and diff require the API.");
    }
  }

  useEffect(() => { void loadWorkspace(); }, []);

  const filteredRuns = useMemo(
    () => runs.filter((run) => `${run.scenario_id} ${run.output.title} ${run.run_id}`.toLowerCase().includes(query.toLowerCase())),
    [query, runs],
  );
  const totalCost = runs.reduce((total, run) => total + runCost(run), 0);
  const llmCalls = runs.reduce((total, run) => total + run.spans.filter((span) => span.kind === "llm").length, 0);
  const lastRunAt = runs.map((run) => run.ended_at).filter(Boolean).sort().at(-1);
  const regressionDetected = evaluation?.seeded_regressions.detected;
  const regressionCases = evaluation?.seeded_regressions.cases;

  async function replaySelected() {
    setAction("replaying");
    setNotice(null);
    try {
      const response = await apiFetch("/v1/replay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scenario_id: selected.scenario_id, condition: selected.condition }),
      });
      if (!response.ok) throw new Error("Replay request failed");
      const replayed = enrichRun(await response.json());
      setRuns((current) => [replayed, ...current]);
      setSelected(replayed);
      setNotice(`Replay completed for ${replayed.scenario_id}; a new run was added to the trace list.`);
    } catch {
      setNotice("Replay failed. Start the FastAPI service on port 8000 and retry.");
    } finally {
      setAction("idle");
    }
  }

  async function compareScenario(scenarioId = selected.scenario_id) {
    setAction("comparing");
    setNotice(null);
    const before = scenarioId.startsWith("R") ? "mutated" : "baseline";
    try {
      const response = await apiFetch(`/v1/diff?scenario_id=${scenarioId}&before=${before}&after=candidate`);
      if (!response.ok) throw new Error("Diff request failed");
      setDiff(await response.json());
      setNotice(`Compared ${scenarioId}: ${before} against candidate.`);
    } catch {
      setNotice("Version comparison failed. Start the FastAPI service on port 8000 and retry.");
    } finally {
      setAction("idle");
    }
  }

  return <main className="shell">
    <header className="topbar">
      <div className="brand"><span className="brand-mark">A/</span><span>AgentScope</span><span className="environment">TRIAGE-V1</span></div>
      <div className="top-actions">
        <span className={source === "api" ? "pulse" : "pulse offline"}><i />{source === "loading" ? "Connecting" : source === "api" ? "API telemetry" : "Fixture preview"}</span>
        <a className="ghost-button" href="https://github.com/muhammed-ali-dev/AgentScope" target="_blank" rel="noreferrer">Source <span>↗</span></a>
      </div>
    </header>

    <section className="intro">
      <div><p className="eyebrow">TRIAGE-V1 / MISSION CONTROL</p><h1>See the moment<br /><em>an agent drifts.</em></h1><p className="lede">Trace the handoff from intent to evidence to action. Replay the failure, compare the branch, and ship with the evidence attached.</p></div>
      <div className="intro-meta">
        <div className="meta-line"><span>Dataset</span><strong>{benchmark?.version || "triage-v1 fixture preview"}</strong></div>
        <div className="meta-line"><span>Agent</span><strong>{selected.agent_version || "triage-agent@0.1.0"}</strong></div>
        <div className="meta-line"><span>Last completed run</span><strong>{formatTimestamp(lastRunAt)}</strong></div>
      </div>
    </section>

    <nav className="tabs" aria-label="Workspace views">
      {tabs.map((tab) => <button key={tab} className={activeTab === tab ? "tab active" : "tab"} onClick={() => setActiveTab(tab)}>{tab}{tab === "Regression gate" && regressionCases !== undefined && <span className="tab-count">{regressionCases}</span>}</button>)}
    </nav>

    {notice && <div aria-live="polite" className={notice.includes("failed") || notice.includes("unavailable") ? "notice warning-notice" : "notice"}>{notice}<button onClick={() => setNotice(null)} aria-label="Dismiss message">×</button></div>}

    {activeTab === "Overview" && <>
      <section className="metric-grid">
        <Metric label={source === "fixture" ? "Preview runs" : "Runs inspected"} value={String(runs.length)} note={`${benchmark?.cases.length ?? previewRuns.length} loaded scenarios`} accent="orange" />
        <Metric label="Regression gate" value={regressionCases === undefined ? "Not loaded" : `${regressionDetected} / ${regressionCases}`} note="Executed seeded mutations" accent="green" />
        <Metric label="Recorded LLM cost" value={`$${totalCost.toFixed(4)}`} note={`${llmCalls} calls across loaded runs`} accent="blue" />
        <Metric label="Debugging time" value="Not measured" note="Operator study pending" accent="neutral" />
      </section>
      <OverviewPanels runs={runs} benchmark={benchmark} evaluation={evaluation} onOpen={(tab) => setActiveTab(tab)} />
    </>}

    {activeTab === "Runs" && <RunWorkspace
      runs={filteredRuns}
      selected={selected}
      query={query}
      action={action}
      diff={diff}
      onQuery={setQuery}
      onSelect={setSelected}
      onRefresh={() => void loadWorkspace()}
      onReplay={() => void replaySelected()}
      onCompare={() => void compareScenario()}
    />}

    {activeTab === "Regression gate" && <RegressionGate evaluation={evaluation} source={source} onCompare={(caseId) => void compareScenario(caseId)} diff={diff} action={action} />}

    {activeTab === "Cost lab" && <CostLab runs={runs} diff={diff} action={action} onCompare={(caseId) => void compareScenario(caseId)} />}

    <footer><span>AgentScope / measurement before narrative</span><span>{source === "api" ? "API data" : "labeled fixture preview"} · schema 0.1.0</span></footer>
  </main>;
}

function Metric({ label, value, note, accent }: { label: string; value: string; note: string; accent: string }) {
  return <div className={`metric ${accent}`}><span className="metric-label">{label}</span><strong>{value}</strong><span className="metric-note">{note}</span></div>;
}

function OverviewPanels({ runs, benchmark, evaluation, onOpen }: { runs: Run[]; benchmark: Benchmark | null; evaluation: Evaluation | null; onOpen: (tab: string) => void }) {
  const errorRuns = runs.filter((run) => run.spans.some((span) => span.status === "error"));
  const tags = benchmark?.tags || {};
  return <section className="bottom-grid">
    <div className="signal-panel">
      <div className="section-heading"><div><p className="eyebrow">EVAL SIGNALS</p><h2>Recorded evidence</h2></div><span className="quiet-label">CURRENT LOAD</span></div>
      {evaluation?.seeded_regressions.results.slice(0, 2).map((result, index) => <div className="signal-row" key={result.case_id}><span className="signal-index">0{index + 1}</span><div><strong>{caseTitles[result.case_id]}</strong><p>{result.case_id} · {result.failures[0] || "Mutation detected by contract"}</p></div><span className="signal-tag warn">Detected</span></div>)}
      {errorRuns.slice(0, 1).map((run, index) => <div className="signal-row" key={run.run_id}><span className="signal-index">0{(evaluation?.seeded_regressions.results.slice(0, 2).length || 0) + index + 1}</span><div><strong>{caseTitles[run.scenario_id]}</strong><p>{run.scenario_id} · {run.spans.filter((span) => span.status === "error").length} error span recorded</p></div><span className="signal-tag error-tag">Trace</span></div>)}
      {!evaluation && !errorRuns.length && <div className="empty-state"><strong>No evaluation signals loaded</strong><span>Connect the telemetry API to execute the seeded regression suite.</span></div>}
    </div>
    <div className="dataset-panel">
      <p className="eyebrow">BENCHMARK DATASET</p>
      <div className="dataset-number">{benchmark?.cases.length ?? "—"}<span> registered scenarios</span></div>
      {benchmark ? <><div className="bar"><i style={{ width: `${(tags.debug / benchmark.cases.length) * 100}%` }} /><i style={{ width: `${(tags.regression / benchmark.cases.length) * 100}%` }} /><i style={{ width: `${(tags.cost / benchmark.cases.length) * 100}%` }} /></div><div className="legend"><span><i className="orange" />Debug {tags.debug}</span><span><i className="green-dot" />Regression {tags.regression}</span><span><i className="blue-dot" />Cost {tags.cost}</span></div></> : <p className="dataset-fallback">Manifest counts load from `/v1/benchmark`; the page is currently using fixture previews.</p>}
      <button className="text-button" onClick={() => onOpen("Regression gate")}>Open regression gate <span>→</span></button>
    </div>
  </section>;
}

function RunWorkspace({ runs, selected, query, action, diff, onQuery, onSelect, onRefresh, onReplay, onCompare }: { runs: Run[]; selected: Run; query: string; action: string; diff: DiffPayload | null; onQuery: (value: string) => void; onSelect: (run: Run) => void; onRefresh: () => void; onReplay: () => void; onCompare: () => void }) {
  return <>
    <section className="workspace-grid">
      <div className="run-panel">
        <div className="section-heading"><div><p className="eyebrow">RUN EXPLORER</p><h2>Recorded traces</h2></div><button className="icon-button" title="Refresh runs" onClick={onRefresh}>↻</button></div>
        <label className="search"><span>⌕</span><input value={query} onChange={(event) => onQuery(event.target.value)} placeholder="Filter by scenario or run ID" /></label>
        <div className="run-list">{runs.map((run) => <button className={selected.run_id === run.run_id ? "run-row selected" : "run-row"} key={run.run_id} onClick={() => onSelect(run)}><span className={`status-dot ${run.status}`} /><span className="run-name"><strong>{run.scenario_id} / {String(run.output.title)}</strong><small>{run.run_id} · {run.condition}</small></span><span className="run-kind">{run.spans.length} spans</span><span className="chevron">›</span></button>)}{!runs.length && <div className="empty-state"><strong>No matching runs</strong><span>Clear the filter to return to the loaded trace set.</span></div>}</div>
      </div>
      <div className="trace-panel">
        <div className="section-heading"><div><p className="eyebrow">TRACE DETAIL / {selected.scenario_id}</p><h2>{String(selected.output.title)}</h2></div><div className="action-group"><button className="secondary-button" disabled={action !== "idle"} onClick={onCompare}>{action === "comparing" ? "Comparing…" : "Compare versions"}</button><button className="primary-button" disabled={action !== "idle"} onClick={onReplay}>{action === "replaying" ? "Replaying…" : "Replay run"} <span>↗</span></button></div></div>
        <div className="trace-summary"><div><span>Condition</span><strong>{selected.condition}</strong></div><div><span>Token usage</span><strong>{runTokens(selected).toLocaleString()}</strong></div><div><span>Recorded duration</span><strong>{runDuration(selected)}</strong></div></div>
        <Timeline run={selected} />
      </div>
    </section>
    {diff && diff.diff.scenario_id === selected.scenario_id && <DiffView payload={diff} />}
  </>;
}

function Timeline({ run }: { run: Run }) {
  return <div className="timeline">{run.spans.map((span, index) => <div className={`span-row ${span.status === "error" ? "error" : ""}`} key={span.span_id}><div className="timeline-rail"><span className={`span-icon ${span.kind}`}>{span.kind === "llm" ? "∿" : span.kind === "tool" ? "◇" : span.kind === "retrieval" ? "⌁" : "○"}</span>{index < run.spans.length - 1 && <i />}</div><div className="span-content"><div className="span-title"><strong>{span.name}</strong><span>{span.kind}</span></div><p>{span.status === "error" ? "Error recorded in this branch" : span.kind === "llm" ? `${String(span.metadata.model || "model")}: ${Number(span.metadata.input_tokens || 0)} input / ${Number(span.metadata.output_tokens || 0)} output tokens` : span.kind === "retrieval" ? `Corpus ${String(span.metadata.corpus_version || "unknown")} · ${Array.isArray(span.metadata.documents) ? span.metadata.documents.join(", ") : String(span.metadata.documents || "no documents")}` : span.kind === "tool" ? `${Number(span.metadata.latency_ms || 0)}ms · ${span.metadata.timeout ? "timeout" : "result available"}` : "Root execution context"}</p></div><span className="span-time">{span.metadata.latency_ms ? `${span.metadata.latency_ms}ms` : span.ended_at && span.started_at ? runDuration({ ...run, started_at: span.started_at, ended_at: span.ended_at }) : "—"}</span></div>)}</div>;
}

function DiffView({ payload }: { payload: DiffPayload }) {
  const items = [
    ["LLM calls", payload.diff.llm_call_delta],
    ["Trace spans", payload.diff.span_count_delta],
    ["Cost (USD)", payload.diff.cost_delta_usd],
  ] as const;
  return <section className="diff-panel"><div className="section-heading"><div><p className="eyebrow">VERSION DIFF / {payload.diff.scenario_id}</p><h2>{payload.before.condition} → {payload.after.condition}</h2></div><span className={payload.diff.output_changed ? "diff-status changed" : "diff-status"}>{payload.diff.output_changed ? "Output changed" : "Output preserved"}</span></div><div className="diff-grid">{items.map(([label, value]) => <div key={label}><span>{label}</span><strong className={Number(value) < 0 ? "good" : Number(value) > 0 ? "bad" : ""}>{Number(value) > 0 ? "+" : ""}{label === "Cost (USD)" ? Number(value).toFixed(4) : value}</strong></div>)}</div></section>;
}

function RegressionGate({ evaluation, source, onCompare, diff, action }: { evaluation: Evaluation | null; source: string; onCompare: (caseId: string) => void; diff: DiffPayload | null; action: string }) {
  if (!evaluation) return <section className="full-panel"><div className="empty-state large"><strong>{source === "loading" ? "Loading regression suite" : "Regression suite unavailable"}</strong><span>{source === "loading" ? "Reading deterministic evaluator results." : "Start the FastAPI service to execute and inspect seeded mutations."}</span></div></section>;
  return <section className="full-panel"><div className="section-heading gate-heading"><div><p className="eyebrow">DETERMINISTIC EVAL</p><h2>Seeded regression gate</h2></div><div className="gate-score"><strong>{evaluation.seeded_regressions.detected} / {evaluation.seeded_regressions.cases}</strong><span>mutations detected</span></div></div><div className="eval-list">{evaluation.seeded_regressions.results.map((result) => <div className="eval-row" key={result.case_id}><span className="eval-id">{result.case_id}</span><div><strong>{caseTitles[result.case_id]}</strong><p>{result.failures[0] || "Expected contract violation detected"}</p></div><span className="signal-tag warn">Detected</span><button className="secondary-button" disabled={action !== "idle"} onClick={() => onCompare(result.case_id)}>Inspect diff</button></div>)}</div>{diff && diff.diff.scenario_id.startsWith("R") && <DiffView payload={diff} />}</section>;
}

function CostLab({ runs, diff, action, onCompare }: { runs: Run[]; diff: DiffPayload | null; action: string; onCompare: (caseId: string) => void }) {
  const costRuns = runs.filter((run) => run.scenario_id.startsWith("C"));
  return <section className="full-panel"><div className="section-heading gate-heading"><div><p className="eyebrow">COST LAB</p><h2>Compare execution policies</h2></div><div className="gate-score"><strong>${costRuns.reduce((total, run) => total + runCost(run), 0).toFixed(4)}</strong><span>loaded fixture cost</span></div></div><div className="cost-table"><div className="cost-head"><span>Scenario</span><span>Condition</span><span>LLM calls</span><span>Tokens</span><span>Cost</span><span /></div>{costRuns.map((run) => <div className="cost-row" key={run.run_id}><strong>{run.scenario_id} / {caseTitles[run.scenario_id]}</strong><span>{run.condition}</span><span>{run.spans.filter((span) => span.kind === "llm").length}</span><span>{runTokens(run).toLocaleString()}</span><span>${runCost(run).toFixed(4)}</span><button className="secondary-button" disabled={action !== "idle"} onClick={() => onCompare(run.scenario_id)}>Compare</button></div>)}{!costRuns.length && <div className="empty-state"><strong>No cost scenarios loaded</strong><span>Load the benchmark API to inspect C1–C4.</span></div>}</div>{diff && diff.diff.scenario_id.startsWith("C") && <DiffView payload={diff} />}</section>;
}
