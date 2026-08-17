"use client";

import { useEffect, useMemo, useState } from "react";

type Span = { span_id: string; kind: string; name: string; status: string; input: Record<string, unknown>; output: Record<string, unknown>; metadata: Record<string, unknown>; };
type Run = { run_id: string; scenario_id: string; condition: string; status: string; output: Record<string, unknown>; spans: Span[]; };

const cases = [
  ["D2", "Stale policy retrieval", "debug", "Root cause localized"],
  ["D5", "Tool timeout", "debug", "Fallback fabricated resolution"],
  ["R1", "Priority taxonomy mutation", "regression", "Gate candidate"],
  ["C1", "Duplicate planning call", "cost", "2 unnecessary calls"],
];
const caseTitles: Record<string, string> = Object.fromEntries(cases.map(([id, title]) => [id, title]));

const seedRuns: Run[] = cases.map(([id, title, tag]) => ({
  run_id: `run-${id.toLowerCase()}-8f2c`, scenario_id: id, condition: tag === "cost" ? "baseline" : "agentscope", status: "ok",
  output: { title, tag },
  spans: [
    { span_id: `${id}-1`, kind: "agent", name: "triage.run", status: "ok", input: { ticket_id: `ticket-${id.toLowerCase()}` }, output: {}, metadata: {} },
    { span_id: `${id}-2`, kind: "llm", name: "classify.intent", status: "ok", input: { purpose: "classification", prompt_hash: "p_84f1" }, output: {}, metadata: { model: "fixture-gpt", input_tokens: 188, output_tokens: 42, cost_usd: 0.0031 } },
    { span_id: `${id}-3`, kind: "retrieval", name: "policy.search", status: "ok", input: { query: title }, output: {}, metadata: { corpus_version: "2026-04", documents: "policy-2026-04, policy-refund, policy-legacy" } },
    { span_id: `${id}-4`, kind: "tool", name: id === "D5" ? "account.lookup.retry" : "account.lookup", status: id === "D5" ? "error" : "ok", input: { customer_id: "cus_7J3M" }, output: {}, metadata: { latency_ms: id === "D5" ? 2000 : 91, timeout: id === "D5" } },
    ...(tag === "cost" ? [{ span_id: `${id}-5`, kind: "llm", name: "duplicate.plan", status: "ok", input: { purpose: "duplicate planning", prompt_hash: "p_84f1" }, output: {}, metadata: { model: "fixture-gpt", input_tokens: 188, output_tokens: 42, cost_usd: 0.0031 } }] : []),
  ],
}));

const tabs = ["Overview", "Runs", "Regression gate", "Cost lab"];

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState("Overview");
  const [runs, setRuns] = useState(seedRuns);
  const [selected, setSelected] = useState(seedRuns[0]);
  const [query, setQuery] = useState("");
  useEffect(() => {
    fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/v1/runs`).then((response) => response.ok ? response.json() : Promise.reject()).then((remoteRuns: Run[]) => {
      const enriched = remoteRuns.map((run) => ({ ...run, output: { ...run.output, title: caseTitles[run.scenario_id] || run.scenario_id } }));
      if (enriched.length) { setRuns(enriched); setSelected(enriched[0]); }
    }).catch(() => undefined);
  }, []);
  const filtered = useMemo(() => runs.filter((run) => `${run.scenario_id} ${run.output.title}`.toLowerCase().includes(query.toLowerCase())), [query, runs]);
  const totalCost = runs.reduce((sum, run) => sum + run.spans.reduce((inner, span) => inner + Number(span.metadata.cost_usd || 0), 0), 0);

  return <main className="shell">
    <header className="topbar">
      <div className="brand"><span className="brand-mark">A/</span><span>AgentScope</span><span className="environment">LOCAL BENCHMARK</span></div>
      <div className="top-actions"><span className="pulse"><i />Telemetry online</span><button className="ghost-button" title="Open settings">Settings <span>↗</span></button></div>
    </header>
    <section className="intro">
      <div><p className="eyebrow">TRIAGE-V1 / MISSION CONTROL</p><h1>See the moment<br /><em>an agent drifts.</em></h1><p className="lede">Trace the handoff from intent to evidence to action. Replay the failure, compare the branch, and ship with the evidence attached.</p></div>
      <div className="intro-meta"><div className="meta-line"><span>Dataset</span><strong>triage-v1</strong></div><div className="meta-line"><span>Agent</span><strong>triage-agent@0.1.0</strong></div><div className="meta-line"><span>Last eval</span><strong>14 Aug 2026 / 18:42</strong></div></div>
    </section>
    <nav className="tabs" aria-label="Workspace views">{tabs.map((tab) => <button key={tab} className={activeTab === tab ? "tab active" : "tab"} onClick={() => setActiveTab(tab)}>{tab}{tab === "Regression gate" && <span className="tab-count">4</span>}</button>)}</nav>
    <section className="metric-grid">
      <Metric label="Runs inspected" value="48" note="triage-v1 / 16 scenarios" accent="orange" />
      <Metric label="Regression gate" value="4 / 4" note="Seeded mutations caught" accent="green" />
      <Metric label="LLM cost" value={`$${totalCost.toFixed(3)}`} note="Recorded fixture usage" accent="blue" />
      <Metric label="Debugging time" value="Not measured" note="Run the operator study" accent="neutral" />
    </section>
    <section className="workspace-grid">
      <div className="run-panel">
        <div className="section-heading"><div><p className="eyebrow">RUN EXPLORER</p><h2>Recent traces</h2></div><button className="icon-button" title="Refresh runs">↻</button></div>
        <label className="search"><span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Filter by scenario or run ID" /></label>
        <div className="run-list">{filtered.map((run) => <button className={selected.run_id === run.run_id ? "run-row selected" : "run-row"} key={run.run_id} onClick={() => setSelected(run)}><span className={`status-dot ${run.status}`} /><span className="run-name"><strong>{run.scenario_id} / {run.output.title as string}</strong><small>{run.run_id} · {run.condition}</small></span><span className="run-kind">{run.spans.length} spans</span><span className="chevron">›</span></button>)}</div>
      </div>
      <div className="trace-panel">
        <div className="section-heading"><div><p className="eyebrow">TRACE DETAIL / {selected.scenario_id}</p><h2>{selected.output.title as string}</h2></div><button className="primary-button" onClick={() => setActiveTab("Runs")}>Replay run <span>↗</span></button></div>
        <div className="trace-summary"><div><span>Condition</span><strong>{selected.condition}</strong></div><div><span>Outcome</span><strong className="good">{selected.scenario_id.startsWith("D") ? "Root cause found" : "Ready to evaluate"}</strong></div><div><span>Duration</span><strong>2.84s</strong></div></div>
        <div className="timeline">{selected.spans.map((span, index) => <div className={`span-row ${span.status === "error" ? "error" : ""}`} key={span.span_id}><div className="timeline-rail"><span className={`span-icon ${span.kind}`}>{span.kind === "llm" ? "∿" : span.kind === "tool" ? "◇" : span.kind === "retrieval" ? "⌁" : "○"}</span>{index < selected.spans.length - 1 && <i />}</div><div className="span-content"><div className="span-title"><strong>{span.name}</strong><span>{span.kind}</span></div><p>{span.status === "error" ? "Timeout detected · retry branch opened" : span.kind === "llm" ? `fixture-gpt · ${span.metadata.input_tokens} in / ${span.metadata.output_tokens} out` : span.kind === "retrieval" ? `Corpus ${span.metadata.corpus_version} · ${span.metadata.documents}` : span.kind === "tool" ? `${span.metadata.latency_ms}ms · ${span.metadata.timeout ? "timeout" : "result available"}` : "Root execution context"}</p></div><span className="span-time">{index === 0 ? "0.00s" : `0.${index * 71 + 31}s`}</span></div>)}</div>
      </div>
    </section>
    <section className="bottom-grid"><div className="signal-panel"><div className="section-heading"><div><p className="eyebrow">EVAL SIGNALS</p><h2>What changed</h2></div><span className="quiet-label">LAST 7 DAYS</span></div><div className="signal-row"><span className="signal-index">01</span><div><strong>Retrieval evidence shifted</strong><p>R3 / corpus-version mutation · first divergence at policy.search</p></div><span className="signal-tag warn">Review</span></div><div className="signal-row"><span className="signal-index">02</span><div><strong>Duplicate planning calls detected</strong><p>C1 / baseline condition · 2 extra LLM spans</p></div><span className="signal-tag cost">Cost</span></div><div className="signal-row"><span className="signal-index">03</span><div><strong>Tool timeout localized</strong><p>D5 / fallback branch · retry exceeded 2.0s</p></div><span className="signal-tag error-tag">Debug</span></div></div><div className="dataset-panel"><p className="eyebrow">BENCHMARK DATASET</p><div className="dataset-number">16<span> scenarios</span></div><div className="bar"><i style={{ width: "50%" }} /><i style={{ width: "25%" }} /><i style={{ width: "25%" }} /></div><div className="legend"><span><i className="orange" />Debug 8</span><span><i className="green-dot" />Regression 4</span><span><i className="blue-dot" />Cost 4</span></div><button className="text-button" onClick={() => setActiveTab("Regression gate")}>Open benchmark manifest <span>→</span></button></div></section>
    <footer><span>AgentScope / measurement before narrative</span><span>fixture mode · schema 0.1.0</span></footer>
  </main>;
}

function Metric({ label, value, note, accent }: { label: string; value: string; note: string; accent: string }) { return <div className={`metric ${accent}`}><span className="metric-label">{label}</span><strong>{value}</strong><span className="metric-note">{note}</span></div>; }
