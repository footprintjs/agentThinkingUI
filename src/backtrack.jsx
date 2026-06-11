import React from "react";
import { BrainGlyph } from "./stage.jsx";
import { AgentThemeContext } from "./context.js";
import * as AgentTheme from "./theme.js";

const { useState, useMemo, useEffect, useRef } = React;

/* <BacktrackOverlay> — the host-facing entry point. The board can be
   triggered from ANY decision point in a main UI; this wraps it as a
   centered modal on desktop and a full-screen view with a back button
   on small screens (the styles flip on one media query). Esc, the
   scrim, and the back button all close it. The host keeps ownership
   of `open` — controlled component, no internal visibility state. */
export function BacktrackOverlay({ open, onClose, backLabel = "back", trace, theme, labels, icons, brand, autoPlay }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === "Escape" && onClose) onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="atui-backtrack-overlay" onClick={(e) => { if (e.target === e.currentTarget && onClose) onClose(); }}>
      <div className="bto-sheet" role="dialog" aria-modal="true" aria-label="why — backtrack">
        <div className="bto-bar">
          <button type="button" className="bto-back" onClick={onClose}>‹ {backLabel}</button>
        </div>
        <BacktrackView trace={trace} theme={theme} labels={labels} icons={icons} brand={brand} autoPlay={autoPlay} />
      </div>
    </div>
  );
}

/* ============================================================
   AgentThinkingUI — <BacktrackView> (the "why?" board)

   The player answers "WHAT did the agent do?"; BacktrackView answers
   "WHY did it decide that?" — one decision walked backwards to the
   piece of context (or code) that caused it. A decision point is ANY
   step under investigation: the final answer, a mid-loop tool choice,
   or a deterministic rule/predicate (decide(), an if on a tool
   result). Takes a BacktrackTrace:

     claim       — the headline question ("approved 47 days late — why?")
     mode        — "causal" (ablation-tested) | "correlational" (ranking only)
     modeLabel?  — override for the mode chip (e.g. "exact chain · proxy ranking")
     answer      — { text, label?, tone?: "error"|"question" } the decision
     decidedAt   — { id, label?, kind?: "llm"|"rule", note? } who decided
     suspects[]  — ranked; every input that PROVABLY reached the decision:
                   { kind, flavor?, name, text?, score,
                     rank?,           // true position in the source report (when cards are a subset)
                     upperBound?,     // score is a path-only upper bound (no content signal)
                     edge?: { key, weight?, kind? },        // last hop
                     path?: [{ key, kind?, via? }],         // full hop chain
                     bornAt?: { id, via? },
                     custody?: [{ step, detail, at?, variable?, content?, highlight? }],
                     verdict?: { kind, flips?, samples?, claim? } }
     trail?      — for deterministic decisions with no ablation verdict:
                   { title, custody: [...], claim? } — exact recorded hops
     folded?     — one line for slice hops not shown as cards
     scoreNote?  — one line under the score chart (margins, tie warnings)
     baseline?   — the no-ablation control line
     honesty[]   — the report's own claims-discipline lines, verbatim

   Framework-agnostic like the Trace contract: anything that can
   serialize a causal slice can feed it. agentfootprint's
   localizeContextBug report maps 1:1 (see demo/backtrack-trace.js).

   The reveal is beats, scrubbable like everything else here. Causal:
   the bug → who answered → what it was given → the scores → the test →
   the culprit. Ranking-only: the decision → who decided → what it was
   given → the scores → the ranking (or "the trail" when exact custody
   is supplied). The custody rows are themselves a rewind player: click
   a hop to see the recorded state (what the model saw, what mutated).
   ============================================================ */

function beatsFor(trace, hasTrail) {
  if (trace.mode === "causal") return ["the bug", "who answered", "what it was given", "the scores", "the test", "the culprit"];
  return ["the decision", "who decided", "what it was given", "the scores", hasTrail ? "the trail" : "the ranking"];
}

/** suspect cards shown per page — a flat row stops reading past three */
const PAGE_SIZE = 3;

/* the decider figure: the LLM brain, or a decision diamond for
   deterministic rule/predicate stages (decide(), if-on-tool-result) */
function DeciderGlyph({ kind, icon }) {
  if (kind === "rule") return <div className="bt-diamond"><span>?</span></div>;
  return <BrainGlyph icon={icon} mode="reason" />;
}

/* mono evidence block with the culprit span highlighted inside it */
function Evidence({ content, highlight }) {
  if (!content) return null;
  if (!highlight || content.indexOf(highlight) === -1) return <pre className="bt-evidence">{content}</pre>;
  const parts = content.split(highlight);
  return (
    <pre className="bt-evidence">
      {parts.map((p, i) => (
        <React.Fragment key={i}>{p}{i < parts.length - 1 && <mark className="bt-mark">{highlight}</mark>}</React.Fragment>
      ))}
    </pre>
  );
}

function Suspect({ s, beat, rank, testBeat }) {
  const v = s.verdict;
  const confirmed = v && v.kind === "confirmed";
  const tested = beat >= testBeat && v && v.kind !== "none";
  const w = s.edge && typeof s.edge.weight === "number" ? s.edge.weight : null;
  return (
    <div className={"bt-suspect" + (confirmed ? " confirmed" : "") + (tested && !confirmed ? " cleared" : "")}>
      {/* the edge that fed the decision — thickness follows the influence weight */}
      <div className="bt-stemwrap">
        <span className="bt-stem" style={w != null ? { width: Math.max(2, Math.round(w * 5)) } : undefined} />
        {s.edge && (
          <span className={"bt-edge" + (s.edge.kind === "control" ? " is-control" : "")}>
            {s.edge.kind === "control" ? "control · " : ""}
            {s.edge.key}
            {w != null ? " · w " + w.toFixed(2) : ""}
          </span>
        )}
      </div>
      <div className="bt-su-card">
        <div className="bt-su-head">
          <span className="bt-su-rank">#{rank}</span>
          <span className={"bt-su-kind k-" + s.kind}>{s.flavor || s.kind}</span>
        </div>
        <div className="bt-su-name">{s.name}</div>
        {s.text && <div className="bt-su-text">“{s.text}”</div>}
        {s.path && s.path.length > 0 && (
          <div className="bt-su-path">
            {s.path.map((h, i) => (
              <span key={i} className={"bt-hop" + (h.kind === "control" ? " is-control" : "")}>
                ← {h.kind === "control" ? "[control: " + h.key + "]" : h.key}{h.via ? " — " + h.via : ""}
              </span>
            ))}
          </div>
        )}
        <div className={"bt-meter " + (s.upperBound ? "ub" : s.score >= 0.8 ? "hot" : s.score >= 0.6 ? "warm" : "cool")}>
          <i className="bt-fill" style={{ width: Math.round(Math.max(0, Math.min(1, s.score)) * 100) + "%" }} />
          <span className="bt-meter-val">influence {s.score.toFixed(2)}{s.upperBound ? "*" : ""}</span>
        </div>
        {s.bornAt && (
          <div className="bt-su-born">born at <code>{s.bornAt.id}</code>{s.bornAt.via ? " · " + s.bornAt.via : ""}</div>
        )}
        {tested && (confirmed
          ? <div className="bt-stamp">CAUSAL ✓ {v.flips}/{v.samples} flips</div>
          : <div className="bt-cleared-tag">not confirmed · {v.flips}/{v.samples} flips</div>)}
      </div>
    </div>
  );
}

/* The chain-of-custody card — also the REWIND player: each hop with
   recorded state is clickable; the pane below replays exactly what was
   seen/written at that moment, with the culprit span highlighted. */
function CustodyCard({ tone, title, custody, claim, revealed, sectionRef }) {
  const evidenced = (custody || []).map((c, i) => (c.content ? i : -1)).filter((i) => i >= 0);
  const [sel, setSel] = useState(evidenced.length ? evidenced[0] : -1);
  // adjust-state-on-prop-change: a consumer may swap `trace` without keying
  // the component — reset the selection so it never indexes stale custody
  const [prevCustody, setPrevCustody] = useState(custody);
  if (custody !== prevCustody) {
    setPrevCustody(custody);
    setSel(evidenced.length ? evidenced[0] : -1);
  }
  const cur = sel >= 0 && custody ? custody[sel] : null;
  const step = (d) => {
    const at = evidenced.indexOf(sel);
    const next = evidenced[at + d];
    if (next !== undefined) setSel(next);
  };
  return (
    <div className={"bt-culprit tone-" + tone} ref={sectionRef}>
      <div className="bt-cu-head"><span className="bt-pin">{tone === "error" ? "📌" : "🧾"}</span> {title}</div>
      {custody && custody.length > 0 && (
        <ul className="bt-custody">
          {custody.map((c, i) => (
            <li key={i}
              className={(c.content ? "has-evidence" : "") + (i === sel ? " sel" : "")}
              style={revealed ? { animationDelay: 0.15 + i * 0.3 + "s" } : undefined}
              onClick={c.content ? () => setSel(i) : undefined}>
              <span className="bt-cu-step">{c.step}</span>
              <span className="bt-cu-detail">{c.detail}{c.content && <span className="bt-cu-eye"> ⊙</span>}</span>
            </li>
          ))}
        </ul>
      )}
      {cur && (
        <div className="bt-rewind">
          <div className="bt-rw-bar">
            <span className="bt-rw-label">⏪ rewind — the recorded state at this hop</span>
            <span className="bt-rw-where">{cur.variable && <code>{cur.variable}</code>}{cur.at && <> @ <code>{cur.at}</code></>}</span>
            <span className="bt-rw-nav">
              <button type="button" onClick={() => step(-1)} disabled={evidenced.indexOf(sel) <= 0} aria-label="earlier hop">‹</button>
              <button type="button" onClick={() => step(1)} disabled={evidenced.indexOf(sel) >= evidenced.length - 1} aria-label="later hop">›</button>
            </span>
          </div>
          <Evidence content={cur.content} highlight={cur.highlight} />
        </div>
      )}
      {claim && <div className="bt-cu-claim">{claim}</div>}
    </div>
  );
}

export function BacktrackView({ trace, theme, labels, icons, brand, autoPlay = true, onBeat }) {
  const resolved = useMemo(() => AgentTheme.normalize({ theme, labels, icons }), [theme, labels, icons]);
  const vars = useMemo(() => AgentTheme.toVars(resolved), [resolved]);

  const suspects = trace.suspects || [];
  const culprit = suspects.find((s) => s.verdict && s.verdict.kind === "confirmed");
  const causal = trace.mode === "causal";
  // one custody card: the confirmed culprit (causal) or the supplied exact trail
  const trail = culprit
    ? { tone: "error", title: <>the culprit — {culprit.flavor || culprit.kind} <b>‘{culprit.name}’</b></>, custody: culprit.custody, claim: culprit.verdict && culprit.verdict.claim }
    : trace.trail
      ? { tone: "exact", title: trace.trail.title || "the trail — exact recorded hops", custody: trace.trail.custody, claim: trace.trail.claim }
      : null;
  const BEATS = beatsFor(trace, !!trail);
  const last = BEATS.length - 1;
  const testBeat = causal ? 4 : last; // when verdict stamps / final layer land

  const [beat, setBeat] = useState(autoPlay ? 0 : last);
  const [auto, setAuto] = useState(autoPlay);
  const [page, setPage] = useState(0); // suspects paginate PAGE_SIZE at a time
  // adjust-state-on-prop-change: BEATS length differs across modes (5 causal /
  // 4 ranked) — a trace swap without a key must never leave beat > last
  const [prevTrace, setPrevTrace] = useState(trace);
  if (trace !== prevTrace) {
    setPrevTrace(trace);
    setBeat(autoPlay ? 0 : last);
    setAuto(autoPlay);
    setPage(0);
  }
  useEffect(() => {
    if (!auto || beat >= last) return;
    const t = setTimeout(() => setBeat((b) => b + 1), 1800);
    return () => clearTimeout(t);
  }, [auto, beat, last]);
  useEffect(() => { if (onBeat) onBeat(beat, BEATS[beat]); }, [beat]);

  // clicking the stepper scrolls the newly revealed section into view —
  // the stepper is sticky, so the reveal can land off-screen otherwise.
  // Only on explicit seeks (never during autoplay: scrolling a page the
  // user is reading is rude), and instant under prefers-reduced-motion.
  const secRefs = useRef({});
  const pendingScroll = useRef(null);
  const scrollToBeat = (b) => {
    const key =
      b === 0 ? "answer" :
      b === 1 ? "brain" :
      b === 2 ? "suspects" :
      b === 3 ? "suspects" :
      causal && b === 4 ? "suspects" : // the test: stamps land on the cards
      trail ? "trail" : "honesty";
    const el = secRefs.current[key];
    if (!el || typeof el.scrollIntoView !== "function") return;
    const reduced = typeof window !== "undefined" && window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "center" });
  };
  const seek = (i) => {
    const next = Math.max(0, Math.min(last, i));
    setAuto(false);
    if (next === beat) { scrollToBeat(next); return; } // re-center on the active dot
    pendingScroll.current = next;
    setBeat(next);
  };
  useEffect(() => {
    if (pendingScroll.current !== beat) return;
    pendingScroll.current = null;
    scrollToBeat(beat);
  }, [beat]);

  // cumulative beat classes (s1..) + "final" so the stylesheet never enumerates ">= N"
  const sceneCls = "bt-scene" +
    [1, 2, 3, 4, 5].map((n) => (beat >= n ? " s" + n : "")).join("") +
    (beat >= last ? " final" : "");

  const decKind = (trace.decidedAt && trace.decidedAt.kind) || "llm";
  const decNote = (trace.decidedAt && trace.decidedAt.note) || (decKind === "rule"
    ? <>the rule decided from <b>what it read</b> — every operand below is recorded fact</>
    : <>the brain answered from <b>what it was given</b> — everything below provably reached this call, and nothing else did</>);

  return (
    <AgentThemeContext.Provider value={resolved}>
      <div className="atui-backtrack" style={vars}>
        <div className="bt-bar">
          {brand && <span className="bt-brand">{brand}</span>}
          <span className="bt-why"><span className="rec" />why?</span>
          <span className="bt-claim">{trace.claim}</span>
          <span className={"bt-mode" + (causal ? " causal" : "")}>
            {trace.modeLabel || (causal ? "causal — ablation-tested" : "correlational — ranking only")}
          </span>
        </div>

        <div className={sceneCls}>
          {/* beat 0 — the decision under investigation */}
          <div ref={(el) => { secRefs.current.answer = el; }} className={"bt-answer" + (trace.answer.tone === "question" ? " tone-question" : "")}>
            <span className="bt-x">{trace.answer.tone === "question" ? "?" : "✕"}</span>
            <div className="bt-answer-body">
              <div className="bt-kicker">{trace.answer.label || "the decision under investigation"}</div>
              <div className="bt-answer-text">{trace.answer.text}</div>
            </div>
          </div>

          {/* beat 1 — who decided */}
          <div ref={(el) => { secRefs.current.brain = el; }} className="bt-brainblock">
            <div className="bt-uplink"><span className="bt-upstem" /><span className="bt-upchip">decided at <code>{trace.decidedAt.id}</code></span></div>
            <div className="bt-brainrow">
              <div className="bt-brainfig"><DeciderGlyph kind={decKind} icon={resolved.icons.brain} /></div>
              <div className="bt-brainnote">{decNote}</div>
            </div>
          </div>

          {/* beat 2 — the provable candidate set, influence-ranked.
              Paginated PAGE_SIZE at a time: real slices carry many suspects
              and a flat row stops reading as a ranking. */}
          <div ref={(el) => { secRefs.current.suspects = el; }} className="bt-suspectblock">
            {suspects.length > PAGE_SIZE && (
              <div className="bt-su-pager">
                <span className="bt-su-count">suspects {page * PAGE_SIZE + 1}–{Math.min(suspects.length, (page + 1) * PAGE_SIZE)} of {suspects.length}</span>
                <span className="bt-rw-nav">
                  <button type="button" onClick={() => setPage(page - 1)} disabled={page === 0} aria-label="previous suspects">‹</button>
                  <button type="button" onClick={() => setPage(page + 1)} disabled={(page + 1) * PAGE_SIZE >= suspects.length} aria-label="more suspects">›</button>
                </span>
              </div>
            )}
            <div className="bt-suspects">
              {suspects.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE).map((s, i) => {
                const at = page * PAGE_SIZE + i;
                return <Suspect key={at} s={s} beat={beat} rank={s.rank || at + 1} testBeat={testBeat} />;
              })}
            </div>
          </div>
          {trace.scoreNote && <div className="bt-sc-note">{trace.scoreNote}</div>}
          {trace.folded && <div className="bt-folded">{trace.folded}</div>}

          {/* final beat — the culprit / the exact trail, with the rewind player */}
          {trail && <CustodyCard sectionRef={(el) => { secRefs.current.trail = el; }} {...trail} revealed={beat >= last} />}

          {/* the report's own claims discipline — shown once scores are on screen */}
          {trace.honesty && trace.honesty.length > 0 && (
            <div ref={(el) => { secRefs.current.honesty = el; }} className="bt-honesty">
              {trace.baseline && <span className="bt-h-line">baseline: {trace.baseline}</span>}
              {trace.honesty.map((h, i) => <span key={i} className="bt-h-line">{h}</span>)}
            </div>
          )}
        </div>

        <div className="bt-stepper">
          <button type="button" className="bt-nav" onClick={() => seek(beat - 1)} disabled={beat === 0} aria-label="previous">‹</button>
          {BEATS.map((b, i) => (
            <button type="button" key={i} className={"bt-dot" + (i === beat ? " on" : i < beat ? " past" : "")} onClick={() => seek(i)}>
              <span className="bt-dot-i" /><span className="bt-dot-label">{b}</span>
            </button>
          ))}
          <button type="button" className="bt-nav" onClick={() => seek(beat + 1)} disabled={beat === last} aria-label="next">›</button>
        </div>
      </div>
    </AgentThemeContext.Provider>
  );
}
