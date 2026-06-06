import React from "react";

const { useState: inspUseState } = React;

// JSON syntax highlighter for the tool I/O panes. Tool output is UNTRUSTED
// (arbitrary agent/telemetry data), so we tokenize into React nodes rather than
// building an HTML string — no dangerouslySetInnerHTML, no injection surface.
const MAX_JSON = 6000; // cap rendered tool I/O — arbitrary agent output can be huge
function highlight(value) {
  let json = JSON.stringify(value === undefined ? null : value, null, 2);
  if (typeof json !== "string") return String(json);
  // bound the work + DOM: a 1MB blob would otherwise become thousands of nodes
  let trunc = 0;
  if (json.length > MAX_JSON) { trunc = json.length - MAX_JSON; json = json.slice(0, MAX_JSON); }
  const re = /("(?:\\.|[^"\\])*")(\s*:)?|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/g;
  const out = [];
  let last = 0, m, k = 0;
  while ((m = re.exec(json))) {
    if (m.index > last) out.push(json.slice(last, m.index));
    if (m[1] !== undefined) {
      if (m[2] !== undefined) { out.push(<span className="k" key={k++}>{m[1]}</span>); out.push(m[2]); } // key
      else out.push(<span className="s" key={k++}>{m[1]}</span>); // string value
    } else if (m[3] !== undefined) {
      out.push(<span className="n" key={k++}>{m[3]}</span>); // number
    }
    last = re.lastIndex;
  }
  if (last < json.length) out.push(json.slice(last));
  if (trunc) out.push(<span className="code-trunc" key="trunc">{"\n… " + trunc.toLocaleString() + " more characters truncated"}</span>);
  return out;
}

function Chevron({ open }) {
  return (
    <svg className={"acc-chev" + (open ? " open" : "")} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 6l6 6-6 6" />
    </svg>
  );
}

function Section({ label, dot, defaultOpen = true, accentDot, children }) {
  const [open, setOpen] = inspUseState(defaultOpen);
  return (
    <div className={"acc" + (open ? " open" : "")}>
      <button className="acc-head" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <Chevron open={open} />
        <span className="acc-label">{dot && <span className="tagdot" style={accentDot ? { background: accentDot } : null} />}{label}</span>
      </button>
      <div className="acc-body" style={{ display: open ? "block" : "none" }}>
        <div className="acc-inner">{children}</div>
      </div>
    </div>
  );
}

function PanelTabs({ view, setView }) {
  return (
    <div className="panel-tabs" role="tablist" aria-label="Right panel view">
      <button role="tab" aria-selected={view === "inspector"} className={view === "inspector" ? "on" : ""} onClick={() => setView("inspector")}>Inspector</button>
      <button role="tab" aria-selected={view === "notepad"} className={view === "notepad" ? "on" : ""} onClick={() => setView("notepad")}>Notepad</button>
    </div>
  );
}

// one journal line per beat — a header + its commentary
function journal(step) {
  const t = step.toolName || step.tool;
  if (step.kind === "prompt") return { title: "Task comes in", note: step.brain };
  if (step.kind === "ask")    return { title: "LLM → asks " + t, note: step.brain };
  if (step.kind === "answer") return { title: "Answer delivered to " + step.to, note: step.answer.headline };
  if (step.replyType === "data")        return { title: t + " → returns data", note: "LLM reasons — " + step.brain };
  if (step.replyType === "instruction") return { title: t + " → returns instruction", note: "LLM follows " + step.skill + " — " + step.brain };
  return { title: t + " → returns data + instruction", note: step.brain + " " + (step.actNote || "") };
}

function fmtLatency(ms) {
  const s = ms / 1000;
  if (s < 60) return (s < 10 ? s.toFixed(1) : Math.round(s)) + "s";
  const m = Math.floor(s / 60);
  return m + "m " + Math.round(s % 60) + "s";
}

function NoteEntry({ step, n, active }) {
  const k = step.kind === "return" ? step.replyType : step.kind;
  const accent = step.error ? "k-error" : k === "data" ? "k-data" : k === "instruction" ? "k-instr" : k === "both" ? "k-both"
    : k === "ask" ? "k-call" : k === "answer" ? "k-answer" : "k-prompt";
  const j = journal(step);
  return (
    <div className={"note " + accent + (active ? " active" : "")}>
      <span className="note-dot" />
      <div className="note-nb">
        <div className="note-head">
          <span className="note-n">{String(n + 1).padStart(2, "0")}</span>
          <span className="note-title">{j.title}</span>
        </div>
        <div className="note-text">{j.note}</div>
        <div className="note-meta">⏱ {fmtLatency((step.cost && step.cost.ms) || 0)} · ◇ {(step.cost && step.cost.tokens) || 0} tok</div>
      </div>
    </div>
  );
}

export function Notepad({ trace, index, onCollapse, view, setView }) {
  const listRef = React.useRef(null);
  React.useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [index]);
  const entries = trace.steps.slice(0, index + 1);
  return (
    <div className="panel inspector notepad">
      <div className="panel-head">
        <span className="h-title">Agent notepad</span>
        <PanelTabs view={view} setView={setView} />
        <button className="insp-collapse" onClick={onCollapse} title="Collapse" aria-label="Collapse panel">›</button>
      </div>
      <div className="insp-body note-list" ref={listRef}>
        {entries.map((s, i) => <NoteEntry key={i} step={s} n={i} active={i === index} />)}
      </div>
    </div>
  );
}

export function Inspector({ step, index, total, onCollapse, view, setView, link, detail }) {
  const accentClass = step.error ? "k-error" :
    step.kind === "answer" ? "k-answer" :
    step.kind === "prompt" ? "k-prompt" :
    step.kind === "ask" ? "k-call" :
    step.replyType === "both" ? "k-both" :
    step.replyType === "data" ? "k-data" : "k-instr";

  const isReturn = step.kind === "return";
  const isBoth = step.replyType === "both";
  const isAct = isReturn && step.brainMode === "act";
  const replyLabel = isBoth ? "DATA + INSTRUCTION" : step.replyType === "data" ? "DATA" : "INSTRUCTION";
  const replyExplain = isBoth
    ? "This reply carried both — the brain reasons on the data AND follows the instruction."
    : step.replyType === "data"
    ? "Raw information. The brain has to reason about what it means and what to do next."
    : "A skill / steering doc. The brain doesn't deliberate — it just executes the steps.";

  return (
    <div className={"panel inspector " + accentClass}>
      <div className="panel-head">
        <span className="h-title">Step inspector</span>
        {link && <a className="insp-link" href={link} target="_blank" rel="noopener noreferrer" title="Open this step in your trace store">open ↗</a>}
        <PanelTabs view={view} setView={setView} />
        <button className="insp-collapse" onClick={onCollapse} title="Collapse inspector" aria-label="Collapse inspector">›</button>
      </div>

      <div className="insp-body">
        {step.error && <div className="err-banner" role="alert"><span className="eb-tag">⚠ error</span><span className="eb-text">{step.error}</span></div>}
        {/* PROMPT */}
        {step.kind === "prompt" && (
          <Section label="Task received">
            <div className="brain-text">{step.brain}</div>
          </Section>
        )}

        {/* ASK — the brain calls a tool */}
        {step.kind === "ask" && (
          <>
            <Section label={"Calling · " + (step.toolName || step.tool)} dot>
              <div className="io-label">input</div>
              <pre className="code">{highlight(step.input)}</pre>
            </Section>
            <Section label="LLM brain">
              <div className="brain-text">{step.brain}</div>
            </Section>
          </>
        )}

        {/* RETURN — the tool replies, brain reasons or acts */}
        {step.kind === "return" && (
          <>
            <Section label={"Returned · " + (step.toolName || step.tool)} dot>
              <div className="io-label">output</div>
              <pre className="code">{highlight(step.output)}</pre>
            </Section>

            <div className="reply-banner">
              <span className="rb-tag">{replyLabel}</span>
              <span className="rb-text">{replyExplain}</span>
            </div>

            <Section label={isAct ? "Brain · acting (no reasoning)" : isBoth ? "Brain · reasons on the data" : "Brain · reasoning"}>
              {isAct && step.skill && (
                <div style={{ marginBottom: 9 }}>
                  <span className="steer-row">steered by · {step.skill}</span>
                </div>
              )}
              <div className={"brain-text " + (step.brainMode || "reason")}>{step.brain}</div>
            </Section>

            {isBoth && (
              <Section label="Brain · acts on the instruction">
                <div style={{ marginBottom: 9 }}>
                  <span className="steer-row">steered by · {step.skill}</span>
                </div>
                <div className="brain-text act">{step.actNote}</div>
              </Section>
            )}
          </>
        )}

        {/* ANSWER */}
        {step.kind === "answer" && (
          <Section label={"Answer to " + step.to} dot>
            <div className="brain-text" style={{ marginBottom: 12 }}>{step.brain}</div>
            <div className="answer-card">
              <div className="ac-head">{step.answer.headline}</div>
              <ul>{step.answer.plan.map((p, i) => <li key={i}>{p}</li>)}</ul>
              <table className="budget-tbl">
                <tbody>
                  {step.answer.budget.map((row, i) => (
                    <tr key={i}><td>{row[0]}</td><td>{row[1]}</td></tr>
                  ))}
                </tbody>
              </table>
              <button className="answer-cta">{step.answer.cta}</button>
            </div>
          </Section>
        )}

        {/* COST */}
        <Section label="This step cost" defaultOpen={false}>
          <div className="cost-row">
            <div className="c-item">
              <span className="c-val">{(((step.cost && step.cost.ms) || 0) / 1000).toFixed(1)}s</span>
              <span className="c-unit">latency</span>
            </div>
            <div className="c-item">
              <span className="c-val">{(step.cost && step.cost.tokens) || 0}</span>
              <span className="c-unit">tokens</span>
            </div>
          </div>
          {step.cost && (step.cost.tokensIn != null || step.cost.tokensOut != null || step.cost.tokensCached != null) && (
            <div className="cost-breakdown">
              {step.cost.tokensIn != null && <span className="cb-item"><span className="cb-dot in" />{step.cost.tokensIn} in</span>}
              {step.cost.tokensOut != null && <span className="cb-item"><span className="cb-dot out" />{step.cost.tokensOut} out</span>}
              {step.cost.tokensCached ? <span className="cb-item cached" title="cache-read (cached prompt) tokens">⚡ {step.cost.tokensCached} cached</span> : null}
            </div>
          )}
        </Section>

        {/* host-supplied detail (raw logs / custom widgets / content OTel didn't capture) */}
        {detail != null && <div className="insp-extra">{detail}</div>}
      </div>
    </div>
  );
}
