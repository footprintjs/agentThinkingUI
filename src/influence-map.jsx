import React from "react";
import { AgentThemeContext } from "./context.js";
import * as AgentTheme from "./theme.js";
import { influenceLayout, INFLUENCE_LAYOUT } from "./influence-layout.js";

const { useState, useMemo, useEffect } = React;

/* ============================================================
   AgentThinkingUI — <InfluenceMap> (the influence map)

   The player answers "WHAT did the agent do?"; BacktrackView answers
   "WHY did one decision go that way?". The Influence Map answers a
   product question for a NON-technical reader: "what influenced this
   answer, and what happens without it?" — the final answer at the
   centre, every removable source orbiting it, each sized + metered by
   its influence score (a proxy — clues, not proof), and an honest
   re-run seam: ignore a source, re-run, see old vs new side by side.

   Pure UI, exactly like the rest of atui: the DATA arrives as ONE
   plain serialized `map` prop shaped like agentfootprint's
   `removableSources(report)` output; ACTIONS leave via callbacks
   (`onRerun(ignoredSourceIds)`, `onStrategyChange(name)`); the re-run
   RESULT re-enters through the promise `onRerun` resolves. The library
   never imports agentfootprint, never makes a call, and never spends on
   mount — opening the map costs $0.

     answer       — the original run's answer (centre-node caption below)
     answerLabel? — the centre-node caption (default "Answer")
     question?    — an optional header context line
     sources[]    — removableSources(report), ranked: { id, kind, label,
                    source (runtimeStageId), stageName, score, snippet?, path? }
     rankedBy?    — the strategy that ranked this map (lights its tab)
     honestyFlags?— the report's honesty flags → plain-language chips

   The honesty discipline is a product feature, not chrome: scores clamp
   to [0,1] and read as estimates; the ONLY causal language on screen is
   a host-supplied `verdict` after a baseline-checked re-run; unknown
   honesty-flag kinds fall back to af's own note. Copy lives in ONE
   overridable map (`INFLUENCE_COPY`, merged with the `honestyCopy` prop).
   ============================================================ */

/* Plain-language honesty copy — ONE overridable map. Keys = agentfootprint
   HonestyFlagKind values + two atui-only chips + the re-run-result framing.
   A host re-words any entry via the `honestyCopy` prop. */
export const INFLUENCE_COPY = Object.freeze({
  // af HonestyFlagKind → human chip
  "slice-truncated": "The trace was cut short to stay fast — the most distant influences may be missing from this map.",
  "untracked-sources": "Some inputs weren't tracked — this map may be missing pieces.",
  "no-control-deps": "This maps what data flowed in, not which decisions steered the path.",
  "no-read-tracking": "Reads weren't recorded on this run — connections here are inferred from writes only.",
  "no-llm-call-ids": "Model calls weren't individually tagged — sources are matched to the answer approximately.",
  "baseline-unstable": "Even with nothing removed, re-runs gave different answers — treat every claim on this map with extra caution.",
  // always-on / CTA chips (not flag-driven)
  proxies: "Scores estimate alignment — clues, not proof.",
  rerunCta: "Want proof? Remove a source and re-run.",
  // re-run-result framing
  observedOnly: "Observed on re-runs — not proof. The unchanged scenario wasn't re-checked.",
  verdictConfirmed: "Proven by re-run: removing it changed the answer.",
  verdictNotConfirmed: "Re-run says: the answer held without it.",
  verdictInconclusive: "Re-runs disagreed — no reliable conclusion.",
});

const IDLE = Object.freeze({ running: false, result: null, error: null });

// plain-language kind badge in the detail card
const KIND_LABEL = { tool: "Tool call", injection: "Injected context", memory: "Memory" };

// causal verdict tier → copy key + chip tone
const VERDICT = {
  confirmed: { copyKey: "verdictConfirmed", cls: "ok" },
  "not-confirmed": { copyKey: "verdictNotConfirmed", cls: "neutral" },
  inconclusive: { copyKey: "verdictInconclusive", cls: "warn" },
};

const clamp01 = (v) => (Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0);

// `semantic-alignment` → "Semantic alignment" (a friendly display label; hosts
// wanting more can re-word `description` or wrap the component).
function deKebab(name) {
  const s = String(name || "").replace(/-/g, " ").trim();
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : "";
}

// truncate a node label for the SVG caption; the full text rides in a <title>
function truncLabel(s, max = 16) {
  s = String(s == null ? "" : s);
  return s.length > max ? s.slice(0, max - 1) + "…" : s;
}

// a snippet may carry a "[source: live]" / "[source: fallback]" provenance
// marker (as agentfootprint stamps on recorded content) — surface it in the
// bars row as a small live/fallback dot; omitted entirely when absent.
function provenanceOf(snippet) {
  if (!snippet) return null;
  const m = /\[source:\s*([^\]]+)\]/i.exec(String(snippet));
  if (!m) return null;
  const label = m[1].trim();
  return { kind: /live/i.test(label) ? "live" : "fallback", label };
}

// one path hop in plain words — a data hop passed a value, a control hop steered
// a decision; the state key (or decide() rule label) is quoted when present.
function hopText(h) {
  const base = h.kind === "control"
    ? "steered a decision" + (h.key ? " (rule ‘" + h.key + "’)" : "")
    : "passed data" + (h.key ? " (‘" + h.key + "’)" : "");
  // af's EdgePathStep walks backward: `from` is the downstream step, `to` the
  // upstream source — so the plain-words arrow points to -> from (data flow).
  return h.toName + " → " + h.fromName + " — " + base;
}

// an SVG arc path from 12 o'clock sweeping score·360° just outside the node —
// size AND meter both encode the same clamped score (the "sized/metered" spec).
function meterArc(cx, cy, R, score) {
  const s = clamp01(score);
  const sweep = s * 360;
  if (sweep <= 0.001) return "";
  const capped = Math.min(sweep, 359.999); // a full circle can't be a single arc
  const rad = (d) => (d * Math.PI) / 180;
  const a0 = -90;
  const a1 = a0 + capped;
  const x0 = cx + R * Math.cos(rad(a0));
  const y0 = cy + R * Math.sin(rad(a0));
  const x1 = cx + R * Math.cos(rad(a1));
  const y1 = cy + R * Math.sin(rad(a1));
  const large = capped > 180 ? 1 : 0;
  return "M " + x0 + " " + y0 + " A " + R + " " + R + " 0 " + large + " 1 " + x1 + " " + y1;
}

/* the strategy selector — same greyed/tooltip/lock skeleton as WhyTool's
   scorer tabs, but the items COME AS A PROP and availability is host-declared
   (`available`), not introspected. The active tab lights only when the host
   actually re-ranked (`activeStrategy ?? map.rankedBy`); clicking calls
   `onStrategyChange` and the host recomputes + swaps `map`. Renders nothing
   when there are no strategies. */
function StrategyTabs({ strategies, active, onStrategyChange }) {
  if (!strategies || !strategies.length) return null;
  const activeStrat = strategies.find((s) => s.name === active);
  return (
    <div className="inf-strat-wrap">
      <div className="inf-strats" role="tablist" aria-label="influence strategy">
        {strategies.map((s) => {
          const avail = !!s.available;
          const isOn = s.name === active;
          const tip = (s.description || "") + (!avail && s.requirements && s.requirements.length
            ? " Needs: " + s.requirements.join(", ") + "."
            : "");
          return (
            <button key={s.name} type="button" role="tab" aria-selected={isOn}
              className={"inf-strat" + (isOn ? " on" : "") + (avail ? "" : " off")}
              disabled={!avail} aria-disabled={!avail} title={tip}
              onClick={avail && onStrategyChange ? () => onStrategyChange(s.name) : undefined}>
              {deKebab(s.name)}{avail ? "" : " 🔒"}
            </button>
          );
        })}
      </div>
      {activeStrat && activeStrat.description && (
        <div className="inf-sub">{activeStrat.description}</div>
      )}
    </div>
  );
}

/* the strategy selector as a native <select> — same greyed/tooltip/lock
   handling as StrategyTabs but as a dropdown (the `strategyControl="dropdown"`
   option). Unavailable strategies become disabled <option>s with a "🔒" suffix
   and a `title` tooltip; the active strategy's description shows under the
   select. onChange only fires onStrategyChange for an AVAILABLE pick — a
   disabled option can't be chosen, and with no handler the select snaps back. */
function StrategySelect({ strategies, active, onStrategyChange }) {
  if (!strategies || !strategies.length) return null;
  const activeStrat = strategies.find((s) => s.name === active);
  const value = active != null && strategies.some((s) => s.name === active) ? active : "";
  const onChange = (ev) => {
    const opt = strategies.find((s) => s.name === ev.target.value);
    if (opt && opt.available && onStrategyChange) onStrategyChange(opt.name);
  };
  return (
    <div className="inf-strat-wrap">
      <select className="inf-strat-select" aria-label="influence strategy" value={value} onChange={onChange}>
        {strategies.map((s) => {
          const avail = !!s.available;
          const tip = (s.description || "") + (!avail && s.requirements && s.requirements.length
            ? " Needs: " + s.requirements.join(", ") + "."
            : "");
          return (
            <option key={s.name} value={s.name} disabled={!avail} title={tip}>
              {deKebab(s.name)}{avail ? "" : " 🔒"}
            </option>
          );
        })}
      </select>
      {activeStrat && activeStrat.description && (
        <div className="inf-sub">{activeStrat.description}</div>
      )}
    </div>
  );
}

/* the detail card under the map — plain-words kind, the influence estimate as a
   meter, the recorded snippet as a quote, the evidence path in plain words, and
   the runtimeStageId in small mono. Also carries an ignore toggle. */
function SourceDetail({ src, ignored, onToggle }) {
  const score = clamp01(src.score);
  const pct = Math.round(score * 100);
  const kindLabel = KIND_LABEL[src.kind] || src.kind;
  return (
    <div className="inf-detail">
      <div className="inf-detail-head">
        <span className="inf-detail-label">{src.label}</span>
        <span className={"inf-kind k-" + src.kind}>{kindLabel}</span>
      </div>
      <div className="inf-detail-meter">
        <span className="inf-meter-track"><span className="inf-meter-fill" style={{ width: pct + "%" }} /></span>
        <span className="inf-meter-val">influence estimate: {pct}%</span>
      </div>
      {src.snippet && <blockquote className="inf-snippet">{src.snippet}</blockquote>}
      {Array.isArray(src.path) && src.path.length > 0 && (
        <ul className="inf-path">
          {src.path.map((h, i) => (
            <li key={i} className={"inf-hop" + (h.kind === "control" ? " is-control" : "")}>{hopText(h)}</li>
          ))}
        </ul>
      )}
      <div className="inf-detail-foot">
        <code className="inf-src">{src.source}</code>
        {src.stageName && <code className="inf-stagename">{src.stageName}</code>}
      </div>
      <button type="button" className={"inf-detail-ignore" + (ignored ? " on" : "")}
        onClick={() => onToggle(src.id)}>
        {ignored ? "Restore this source" : "Ignore this source"}
      </button>
    </div>
  );
}

/* the re-run result panel — old vs new answer side by side, the whatChanged
   summary rendered VERBATIM (never parsed), fact badges read from the FIELDS,
   and the causal verdict chip ONLY when the host ran a baseline-checked re-run
   (otherwise the honest observational framing). */
function RerunPanel({ map, result, ignoredCount, copy }) {
  const wc = result.whatChanged || {};
  const sim = wc.similarityToOriginal || {};
  const n = ignoredCount;
  const v = result.verdict;
  const tier = v ? VERDICT[v.verdict] : null;
  return (
    <div className="inf-result">
      <div className="inf-compare">
        <div className="inf-col">
          <div className="inf-col-label">Original answer</div>
          <div className="inf-col-body">{map.answer}</div>
        </div>
        <div className="inf-col">
          <div className="inf-col-label">Without {n} source{n === 1 ? "" : "s"}</div>
          <div className="inf-col-body">{result.answer}</div>
        </div>
      </div>
      {wc.summary && <div className="inf-summary">{wc.summary}</div>}
      <div className="inf-facts">
        {Number.isFinite(wc.flips) && Number.isFinite(wc.samples) && (
          <span className="inf-fact">changed in {wc.flips}/{wc.samples} re-runs</span>
        )}
        {Number.isFinite(sim.mean) && (
          <span className="inf-fact">similarity {sim.mean.toFixed(2)}</span>
        )}
      </div>
      {v && tier ? (
        <div className={"inf-verdict " + tier.cls}>
          <span className="inf-verdict-lead">{copy[tier.copyKey]}</span>
          {v.claim && <span className="inf-verdict-claim">{v.claim}</span>}
        </div>
      ) : (
        <div className="inf-observed">{copy.observedOnly}</div>
      )}
    </div>
  );
}

export function InfluenceMap({
  map,
  view = "map",
  strategyControl = "tabs",
  onRerun,
  strategies,
  onStrategyChange,
  activeStrategy,
  honestyCopy,
  onSelectSource,
  theme, labels, icons, brand,
}) {
  const resolved = useMemo(() => AgentTheme.normalize({ theme, labels, icons }), [theme, labels, icons]);
  const vars = useMemo(() => AgentTheme.toVars(resolved), [resolved]);
  const copy = useMemo(() => ({ ...INFLUENCE_COPY, ...(honestyCopy || {}) }), [honestyCopy]);

  const sources = (map && map.sources) || [];
  const layout = useMemo(() => influenceLayout(sources), [sources]);
  const isBars = view === "bars";
  // bars view: the same sources, sorted by clamped score DESC (a stable
  // sort — an explicit index tiebreak keeps equal scores in map.sources order).
  const sortedSources = useMemo(
    () => sources
      .map((s, i) => [s, i])
      .sort((a, b) => (clamp01(b[0].score) - clamp01(a[0].score)) || (a[1] - b[1]))
      .map((pair) => pair[0]),
    [sources],
  );

  const [selectedId, setSelectedId] = useState(null);
  const [ignored, setIgnored] = useState(() => new Set());
  const [rerun, setRerun] = useState(IDLE);

  // adjust-state-on-prop-change: a host swaps `map` without keying — reset the
  // selection, the ignore set, and any re-run result (a result for a different
  // map on screen would lie).
  const [prevMap, setPrevMap] = useState(map);
  if (map !== prevMap) {
    setPrevMap(map);
    setSelectedId(null);
    setIgnored(new Set());
    setRerun(IDLE);
  }

  const active = activeStrategy != null ? activeStrategy : (map && map.rankedBy);
  const selected = selectedId != null ? sources.find((s) => s.id === selectedId) : null;
  const ignoredSources = sources.filter((s) => ignored.has(s.id));
  const ignoredIds = ignoredSources.map((s) => s.id); // stable payload — map.sources order
  const ignoredLabels = ignoredSources.map((s) => s.label);

  const tapSource = (s) => {
    setSelectedId((id) => (id === s.id ? null : s.id));
    if (onSelectSource) onSelectSource(s);
  };

  // toggling ANY ignore invalidates a displayed result — the result on screen
  // is for a specific toggle set; a stale one would mislead.
  const toggleIgnore = (id) => {
    setIgnored((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setRerun(IDLE);
  };

  // fire onRerun ONLY on the explicit click — never on mount. Mirrors onExplain.
  const doRerun = () => {
    if (!onRerun || rerun.running || ignoredIds.length === 0) return;
    setRerun({ running: true, result: null, error: null });
    Promise.resolve(onRerun(ignoredIds))
      .then((r) => setRerun({ running: false, result: r || null, error: null }))
      .catch((e) => setRerun({ running: false, result: null, error: "Couldn't re-run: " + (e && e.message ? e.message : String(e)) }));
  };

  const c = layout.center;
  const answerLabel = (map && map.answerLabel) || "Answer";
  const flags = (map && map.honestyFlags) || [];
  const showCta = !!onRerun && !rerun.result && !rerun.running;

  return (
    <AgentThemeContext.Provider value={resolved}>
      <div className="atui-influence" style={vars}>
        <div className="inf-bar">
          {brand && <span className="inf-brand">{brand}</span>}
          <span className="inf-title">Influence map</span>
          {map && map.question && <span className="inf-question">{map.question}</span>}
        </div>

        {strategyControl === "dropdown"
          ? <StrategySelect strategies={strategies} active={active} onStrategyChange={onStrategyChange} />
          : <StrategyTabs strategies={strategies} active={active} onStrategyChange={onStrategyChange} />}

        {isBars ? (
          <div className="inf-bars-wrap">
            {/* the answer sits above the list as a plain header card (no centre-node) */}
            {map && map.answer && (
              <div className="inf-answer-card">
                <span className="inf-answer-cap">{answerLabel}</span>
                <div className="inf-answer-body">{map.answer}</div>
              </div>
            )}
            <ul className="inf-bars" role="list">
              {sortedSources.map((src) => {
                const score = clamp01(src.score);
                const pct = Math.round(score * 100);
                const isIgnored = ignored.has(src.id);
                const isSel = selectedId === src.id;
                const kindLabel = KIND_LABEL[src.kind] || src.kind;
                const prov = provenanceOf(src.snippet);
                return (
                  <li key={src.id} className={"inf-bar-row" + (isIgnored ? " ignored" : "") + (isSel ? " sel" : "")}>
                    <button type="button" className="inf-bar-main" aria-pressed={isSel}
                      onClick={() => tapSource(src)}>
                      <span className="inf-bar-head">
                        <span className="inf-bar-label">{src.label}</span>
                        <span className={"inf-kind k-" + src.kind}>{kindLabel}</span>
                        {prov && (
                          <span className={"inf-prov " + prov.kind} title={"source: " + prov.label}>
                            <span className={"inf-prov-dot " + prov.kind} />{prov.kind}
                          </span>
                        )}
                      </span>
                      <span className="inf-bar-meter">
                        <span className="inf-bar-track"><span className="inf-bar-fill" style={{ width: pct + "%" }} /></span>
                        <span className="inf-bar-val">{pct}%</span>
                      </span>
                    </button>
                    <button type="button" className={"inf-bar-ignore" + (isIgnored ? " on" : "")}
                      aria-pressed={isIgnored} aria-label={(isIgnored ? "restore " : "ignore ") + src.label}
                      onClick={() => toggleIgnore(src.id)}>
                      {isIgnored ? "↺" : "×"}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : (
        <React.Fragment>
        <div className="inf-stage">
          <svg className="inf-svg" viewBox={"0 0 " + layout.size + " " + layout.size} role="img"
            aria-label="influence map — the answer and the sources that fed it">
            {/* edges first, under the nodes — weight reads as influence */}
            {layout.nodes.map((node, i) => {
              const e = node.edge;
              return (
                <line key={"e" + i} className="inf-edge" x1={e.x1} y1={e.y1} x2={e.x2} y2={e.y2}
                  style={{ strokeWidth: 1 + 2 * node.score, opacity: 0.3 + 0.5 * node.score }} />
              );
            })}
            {/* centre — the answer */}
            <circle className="inf-answer-c" cx={c.x} cy={c.y} r={INFLUENCE_LAYOUT.answerR} />
            <text className="inf-answer-label" x={c.x} y={c.y} textAnchor="middle" dominantBaseline="central">{answerLabel}</text>
            {/* source nodes — sized + metered by the clamped score */}
            {layout.nodes.map((node, i) => {
              const src = sources[i];
              const isIgnored = ignored.has(src.id);
              const isSel = selectedId === src.id;
              const tx = node.x + node.r * 0.72;
              const ty = node.y - node.r * 0.72;
              const onKey = (fn) => (ev) => { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); fn(); } };
              return (
                <g key={node.id != null ? node.id : i}
                  className={"inf-node" + (isIgnored ? " ignored" : "") + (isSel ? " sel" : "")}>
                  <g role="button" tabIndex={0} aria-pressed={isSel} aria-label={src.label}
                    className="inf-node-hit"
                    onClick={() => tapSource(src)} onKeyDown={onKey(() => tapSource(src))}>
                    <title>{src.label}</title>
                    <circle className="inf-node-c" cx={node.x} cy={node.y} r={node.r} />
                    <path className="inf-meter-arc" d={meterArc(node.x, node.y, node.r + 4, node.score)} fill="none" />
                    <text className="inf-node-label" x={node.x} y={node.y + node.r + 14} textAnchor="middle">{truncLabel(src.label)}</text>
                  </g>
                  {/* the small per-node ignore toggle */}
                  <g className="inf-toggle" role="button" tabIndex={0}
                    aria-pressed={isIgnored} aria-label={(isIgnored ? "restore " : "ignore ") + src.label}
                    onClick={(ev) => { ev.stopPropagation(); toggleIgnore(src.id); }}
                    onKeyDown={onKey(() => toggleIgnore(src.id))}>
                    <circle className="inf-toggle-c" cx={tx} cy={ty} r={9} />
                    <text className="inf-toggle-i" x={tx} y={ty} textAnchor="middle" dominantBaseline="central">{isIgnored ? "↺" : "×"}</text>
                  </g>
                </g>
              );
            })}
          </svg>
        </div>

        {/* the answer under the centre node — full text, plain */}
        {map && map.answer && (
          <div className="inf-answer-text"><span className="inf-answer-cap">{answerLabel}</span>{map.answer}</div>
        )}
        </React.Fragment>
        )}

        {/* plain-language honesty chips */}
        <div className="inf-chips">
          {flags.map((f, i) => (
            <span key={i} className="inf-chip warn">{copy[f.flag] != null ? copy[f.flag] : (f.note != null ? f.note : f.flag)}</span>
          ))}
          <span className="inf-chip">{copy.proxies}</span>
          {showCta && <span className="inf-chip cta">{copy.rerunCta}</span>}
        </div>

        {/* the tapped source's detail */}
        {selected && <SourceDetail src={selected} ignored={ignored.has(selected.id)} onToggle={toggleIgnore} />}

        {/* the ignore footer — appears once anything is ignored */}
        {ignoredIds.length > 0 && (
          <div className="inf-footer">
            <div className="inf-footer-row">
              {onRerun && (
                <button type="button" className="inf-rerun" onClick={doRerun} disabled={rerun.running}>
                  Re-run without {ignoredIds.length} source{ignoredIds.length === 1 ? "" : "s"}
                </button>
              )}
              <span className="inf-ignored-list">{ignoredLabels.join(", ")}</span>
            </div>
            {rerun.running && (
              <div className="inf-pending">✨ Re-running without {ignoredLabels.join(", ")}… fresh seeded runs — this can take a moment.</div>
            )}
            {rerun.error && <div className="inf-error">⚠ {rerun.error}</div>}
            {rerun.result && <RerunPanel map={map} result={rerun.result} ignoredCount={ignoredIds.length} copy={copy} />}
          </div>
        )}
      </div>
    </AgentThemeContext.Provider>
  );
}

/* <InfluenceMapOverlay> — the host-facing modal wrapper. Byte-pattern of
   BacktrackOverlay: the host owns `open`; Esc, the scrim, and the back button
   all close it; renders null when closed; forwards everything else to
   InfluenceMap. */
export function InfluenceMapOverlay({ open, onClose, backLabel = "back", ...viewProps }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === "Escape" && onClose) onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="atui-influence-overlay" onClick={(e) => { if (e.target === e.currentTarget && onClose) onClose(); }}>
      <div className="imo-sheet" role="dialog" aria-modal="true" aria-label="influence map">
        <div className="imo-bar">
          <button type="button" className="imo-back" onClick={onClose}>‹ {backLabel}</button>
        </div>
        <InfluenceMap {...viewProps} />
      </div>
    </div>
  );
}
