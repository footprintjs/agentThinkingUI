import React from "react";
import { toolRelevance } from "./relevance.js";
import { isSkillName } from "./stage.jsx";
import { buildToolWhyText, buildDescribeText } from "./copyForLLM.js";
import { diffWords } from "./descdiff.js";
import { Prose } from "./prose.jsx";

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

// The tool menu the model saw for this call — collapsed by default; expand to
// read the descriptions a domain expert needs to debug WHY a tool was chosen.
function ToolsSeen({ tools }) {
  if (!tools || !tools.length) return null;
  return (
    <Section label={"🔧 Tools the model saw (" + tools.length + ")"} defaultOpen={false}>
      <ul className="tools-seen">
        {tools.map((t, i) => (
          <li key={(t.name || "") + i}>
            <code className="ts-name">{t.name}</code>
            {t.description ? <span className="ts-desc"> — {t.description}</span> : null}
          </li>
        ))}
      </ul>
    </Section>
  );
}

// Normalize a per-pick attribution — a stamped `step.attribution` OR an
// `onAttribute` result — into ranked rows (+ the optional multi-channel
// verdict) for the "What drove it" strategy. Clamps scores to [0,1], drops
// malformed rows/channels, null when nothing usable. Honest: these are
// similarity proxies (which context the pick ALIGNS with), never causal
// claims (ablation lives in the backtrack view, not here).
function normalizeAttribution(res) {
  if (!res) return null;
  const rowsIn = Array.isArray(res.rows) ? res.rows : Array.isArray(res) ? res : [];
  const rows = rowsIn
    .filter((r) => r && typeof r.label === "string" && typeof r.score === "number" && isFinite(r.score))
    .map((r) => ({
      label: r.label,
      score: Math.min(1, Math.max(0, r.score)),
      quote: typeof r.quote === "string" ? r.quote : undefined,
      picked: !!r.picked,
      channel: typeof r.channel === "string" ? r.channel : undefined,
    }));
  // Multi-channel verdict (the answer-first card): which context channel drove
  // the pick — the agent's rules ('system'), the user's request ('task'), or
  // earlier tool data ('data'). Ids are free-form; the label falls back to the
  // id. Order is preserved — upstream sorts the winner first, we trust it.
  const channelsIn = Array.isArray(res.channels) ? res.channels : [];
  const channels = channelsIn
    .filter((c) => c && typeof c.id === "string" && typeof c.share === "number" && isFinite(c.share))
    .map((c) => ({
      id: c.id,
      label: typeof c.label === "string" && c.label ? c.label : c.id,
      share: c.share,
      quote: typeof c.quote === "string" ? c.quote : undefined,
      citeLabel: typeof c.citeLabel === "string" ? c.citeLabel : undefined,
    }));
  if (!rows.length && !channels.length) return null;
  return {
    rows,
    headline: typeof res.headline === "string" ? res.headline : undefined,
    channels: channels.length ? channels : undefined,
    note: typeof res.note === "string" ? res.note : undefined,
  };
}

// Cap the verdict card's citation — quotes come from arbitrary agent context.
const MAX_VERDICT_QUOTE = 110;
function clipQuote(q) {
  return q.length > MAX_VERDICT_QUOTE ? q.slice(0, MAX_VERDICT_QUOTE).trimEnd() + "…" : q;
}

// "Why this tool?" — rack mode. Clicking a tool in the rack focuses it here:
// the tools the model saw, ranked by relevance to the task (bars), with the
// picked one tagged and the focused one's matched terms shown. The score is a
// lexical PROXY today (honestly labelled) — the panel swaps in real attribution
// the day a tool carries a numeric `relevance`.
function WhyTool({ trace, step, focusName, pickedName, onExplain, onScore, onAttribute }) {
  const ref = React.useRef(null);
  const [copied, setCopied] = React.useState(false);
  const [explaining, setExplaining] = React.useState(false);
  const [explanation, setExplanation] = React.useState(null);
  // Description Doctor — a suggested clearer description for the focused tool/skill.
  const [suggesting, setSuggesting] = React.useState(false);
  const [suggestion, setSuggestion] = React.useState(null);
  const [descCopied, setDescCopied] = React.useState(false);
  // Which scoring strategy the user picked (null = auto → the best available).
  const [chosenStrategy, setChosenStrategy] = React.useState(null);
  // LLM-judge scores (onScore): Map<name,{score,rationale}> once fetched.
  const [judgeScores, setJudgeScores] = React.useState(null);
  const [judging, setJudging] = React.useState(false);
  const [judgeError, setJudgeError] = React.useState(null);
  // "What drove it" attribution via onAttribute (lazy compute), when the pick
  // is not already stamped on the step. Mirrors the judge's lazy pattern.
  const [attrData, setAttrData] = React.useState(null);
  const [attributing, setAttributing] = React.useState(false);
  const [attrError, setAttrError] = React.useState(null);
  const tools = React.useMemo(() => {
    const m = new Map();
    for (const s of trace.steps) for (const t of (s.toolsSeen || [])) if (!m.has(t.name)) m.set(t.name, t);
    return [...m.values()];
  }, [trace]);
  // the panel only renders on a click (gated by `whyTool` in the parent), so on
  // (re)focus bring it into view + flash it — the click happens in the scene's
  // rack/button (left), this lands in the inspector (right).
  React.useEffect(() => {
    setCopied(false);
    setExplanation(null);
    setExplaining(false);
    setSuggestion(null);
    setSuggesting(false);
    setDescCopied(false);
    const el = ref.current;
    if (!el) return;
    if (typeof el.scrollIntoView === "function") el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.classList.add("why-flash");
    const t = setTimeout(() => { if (el) el.classList.remove("why-flash"); }, 900);
    return () => clearTimeout(t);
  }, [focusName]);
  if (tools.length < 2) return null;
  // score against THIS step's reasoning (what the model was thinking when it
  // chose) plus the task — that's the per-step "why", not just the overall ask.
  const query = [step && step.brain, trace.task].filter(Boolean).join(" ");
  const ranked = toolRelevance(query, tools);
  const focus = focusName || pickedName;
  const isProxy = ranked.some((r) => !r.provided);
  // a skill surfaces as a tool but it's an instruction — call it what it is
  const noun = isSkillName(focus) ? "skill" : "tool";

  // ── Scoring strategies the library knows, and whether each can RUN here ──
  // lexical: always (built-in term overlap). semantic: needs real per-tool
  // `relevance` (an embedding model upstream). llm: needs a live `onExplain`
  // call. Unavailable ones are shown greyed with a tooltip — never hidden,
  // never faked — so the consumer sees the strategy exists + how to enable it.
  const semanticAvailable = ranked.length > 0 && ranked.every((r) => r.provided);
  const llmAvailable = !!onScore || !!onExplain; // the model scores (onScore) and/or explains (onExplain)
  // "What drove it": per-pick attribution for THIS step — either already
  // stamped on the step (free, no call) or computed lazily via onAttribute.
  const stampedAttr = React.useMemo(() => normalizeAttribution(step && step.attribution), [step]);
  const rulesData = attrData || stampedAttr;
  const attributionAvailable = !!stampedAttr || !!onAttribute;
  const strategyAvail = { lexical: true, semantic: semanticAvailable, rules: attributionAvailable, llm: llmAvailable };
  // Default = the best AVAILABLE strategy that is FREE to run on open. Stamped
  // attribution is free (and the most direct "why" — pre-computed upstream), so
  // it leads; then stamped semantic, else lexical. onAttribute-only attribution
  // and the LLM judge each cost a call → NEVER the default (opening the panel
  // must never spend).
  const defaultStrategy = stampedAttr ? "rules" : semanticAvailable ? "semantic" : "lexical";
  const active = chosenStrategy && strategyAvail[chosenStrategy] ? chosenStrategy : defaultStrategy;
  // Answer-first framing: when the stamped multi-channel VERDICT is the default
  // view, its tab leads the picker and the rest read as "second opinions".
  const verdictDefault = defaultStrategy === "rules" && !!(stampedAttr && stampedAttr.channels);
  const strategyIds = verdictDefault ? ["rules", "lexical", "semantic", "llm"] : ["lexical", "semantic", "rules", "llm"];

  // LLM-judge: ask the host (onScore) to rate each tool 0..1 for THIS choice.
  // Lazy — fired only when the user opens the LLM tab, memoized per panel.
  const runJudge = () => {
    if (!onScore || judging || judgeScores) return;
    setJudging(true);
    setJudgeError(null);
    Promise.resolve(onScore({ trace, step, tools }))
      .then((res) => {
        const arr = Array.isArray(res) ? res : (res && res.scores) || [];
        const m = new Map();
        for (const s of arr) {
          if (s && typeof s.name === "string" && typeof s.score === "number") {
            m.set(s.name, { score: Math.min(1, Math.max(0, s.score)), rationale: s.rationale });
          }
        }
        setJudgeScores(m);
      })
      .catch((e) => setJudgeError("Couldn't score: " + (e && e.message ? e.message : String(e))))
      .then(() => setJudging(false));
  };
  const judgeRanked = judgeScores
    ? tools
        .map((t) => ({ name: t.name, description: t.description, score: judgeScores.get(t.name) ? judgeScores.get(t.name).score : 0, rationale: judgeScores.get(t.name) ? judgeScores.get(t.name).rationale : undefined }))
        .sort((a, b) => b.score - a.score)
    : null;

  // "What drove it": ask the host (onAttribute) to attribute THIS pick to its
  // context. Lazy — only when the pick isn't already stamped and the
  // user opens the tab. Memoized per panel, like the judge.
  const runAttribute = () => {
    if (!onAttribute || stampedAttr || attributing || attrData) return;
    setAttributing(true);
    setAttrError(null);
    Promise.resolve(onAttribute({ trace, step, tools }))
      .then((res) => {
        const n = normalizeAttribution(res);
        if (n) setAttrData(n);
        else setAttrError("The attributor returned nothing.");
      })
      .catch((e) => setAttrError("Couldn't attribute: " + (e && e.message ? e.message : String(e))))
      .then(() => setAttributing(false));
  };

  const STRATEGY_WHY = {
    lexical: "keyword overlap with the ask — always on, but a hint, not the model's own reason.",
    semantic: semanticAvailable
      ? "embedding cosine vs the choice context — real ranked scores."
      : "needs an embedding model — supply a numeric `relevance` per " + noun + " upstream (e.g. agentfootprint's toolChoiceRecorder + an embedder).",
    rules: attributionAvailable
      ? "which context — the agent's rules, your request, or earlier data — best explains this pick. A similarity proxy, not a causal claim."
      : "needs per-pick attribution — stamp `step.attribution` (agentfootprint's explainChoice) or wire onAttribute.",
    llm: llmAvailable
      ? (onScore
          ? "the model rates each " + noun + "'s fit 0–1 from the same context it chose with" + (onExplain ? " — and can explain in words." : ".")
          : "ask the live model for its own reason for choosing this " + noun + ".")
      : "needs a live LLM call — wire the host's onScore / onExplain to enable.",
  };
  // Plain, end-user labels (not developer jargon) — the panel is read by whoever
  // is debugging, not only engineers.
  const STRATEGY_LABEL = { lexical: "Keyword match", semantic: "Meaning match", rules: "What drove it", llm: "Ask the model" };
  // the bars are a proxy; the REAL why = hand the trajectory to an LLM. Copy it.
  const copyForLlm = async () => {
    const text = buildToolWhyText({ trace, step, ranked, focusName: focus });
    try { await navigator.clipboard.writeText(text); } catch { /* clipboard unavailable (insecure ctx) */ }
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };
  // live path: hand the same prompt to the consumer's LLM (onExplain) and render
  // the real reason in place — no copy-paste. The lib stays pure; the consumer
  // owns the call (and the key).
  const explainLive = async () => {
    if (!onExplain || explaining) return;
    setExplaining(true);
    setExplanation(null);
    try {
      const prompt = buildToolWhyText({ trace, step, ranked, focusName: focus });
      const res = await onExplain({ trace, step, tool: focus, prompt });
      const reason = typeof res === "string" ? res : (res && res.reason) || "";
      setExplanation(reason || "(the explainer returned nothing)");
    } catch (e) {
      setExplanation("⚠ Couldn't get the explanation: " + (e && e.message ? e.message : String(e)));
    } finally {
      setExplaining(false);
    }
  };
  // Description Doctor — when descriptions overlap (ambiguous routing), ask the LLM
  // (via onExplain, kind:'improve-description') for a sharper, more DISTINCT
  // description for the focused tool/skill, and render it as a red/green diff.
  const focusDesc = (ranked.find((r) => r.name === focus) || {}).description || "";
  const improveDescription = async () => {
    if (!onExplain || suggesting) return;
    setSuggesting(true);
    setSuggestion(null);
    try {
      const prompt = buildDescribeText({ trace, ranked, focusName: focus });
      const res = await onExplain({ trace, step, tool: focus, kind: "improve-description", description: focusDesc, prompt });
      const next = typeof res === "string" ? res : (res && res.reason) || "";
      setSuggestion(next.trim() || "(the explainer returned nothing)");
    } catch (e) {
      setSuggestion("⚠ Couldn't get a suggestion: " + (e && e.message ? e.message : String(e)));
    } finally {
      setSuggesting(false);
    }
  };
  const copySuggestion = async () => {
    try { await navigator.clipboard.writeText(suggestion || ""); } catch { /* clipboard unavailable */ }
    setDescCopied(true);
    setTimeout(() => setDescCopied(false), 1800);
  };
  return (
    <div ref={ref} className="why-wrap">
    <Section label={"🔍 Why this " + noun + "?"}>
      {/* Strategy selector — every scorer the library knows, greyed + tooltipped
          when its dependency is missing, so the consumer sees it EXISTS and how
          to turn it on (lexical = always; semantic = an embedding model;
          llm = a live call). Never hidden, never faked. */}
      <div className="why-strats" role="tablist" aria-label="scoring strategy">
        {strategyIds.map((id, idx) => {
          const avail = strategyAvail[id];
          const btn = (
            <button key={id} type="button" role="tab" aria-selected={active === id}
              className={"why-strat" + (active === id ? " on" : "") + (avail ? "" : " off")}
              disabled={!avail} aria-disabled={!avail} title={STRATEGY_WHY[id]}
              onClick={avail ? () => { setChosenStrategy(id); if (id === "llm") runJudge(); if (id === "rules") runAttribute(); } : undefined}>
              {STRATEGY_LABEL[id]}{avail ? "" : " 🔒"}
            </button>
          );
          // Verdict-first framing: the stamped verdict IS the answer; the other
          // strategies are second opinions. A subdued caption, nothing more —
          // tab behavior (grey/tooltip/lock) is untouched.
          if (verdictDefault && idx === 1) {
            return (
              <React.Fragment key={id}>
                <span className="why-second">second opinions:</span>
                {btn}
              </React.Fragment>
            );
          }
          return btn;
        })}
      </div>
      <div className="why-sub">{STRATEGY_WHY[active]}</div>

      {/* LLM strategy: the model's own 0..1 rating per tool (onScore), lazily
          fetched on tab-open. Bars are real (provided) — the picked tool can
          rank first even with no lexical/embedding overlap (procedural picks). */}
      {active === "llm" && onScore && (
        judging ? (
          <div className="why-sub">✨ scoring the {noun}s with the model…</div>
        ) : judgeError ? (
          <div className="why-explanation">⚠ {judgeError}</div>
        ) : judgeRanked ? (
          <ul className="why-tool">
            {judgeRanked.map((r, i) => {
              const isFocus = r.name === focus;
              const isPicked = r.name === pickedName;
              return (
                <li key={r.name + i} className={"wt-row" + (isFocus ? " focus" : "") + (isPicked ? " picked" : "")}>
                  <div className="wt-head">
                    <code className="wt-name">{r.name}</code>
                    {isPicked && <span className="wt-tag">picked</span>}
                    <span className="wt-val">{r.score.toFixed(2)}</span>
                  </div>
                  <span className="wt-meter"><span className="wt-fill" style={{ width: Math.round(r.score * 100) + "%" }} /></span>
                  {isFocus && r.rationale && <div className="wt-matched">{r.rationale}</div>}
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="why-sub">open this tab to score the {noun}s with the model.</div>
        )
      )}

      {(active === "lexical" || (active === "llm" && onExplain)) && (
        <div className="why-actions">
          {active === "lexical" && (
            <button type="button" className="why-copy" onClick={copyForLlm}
              title={"Copy the task + trajectory + " + noun + " menu as an LLM-ready prompt — paste into Claude/ChatGPT for the real why"}>
              {copied ? "✓ Copied — paste into your LLM" : "📋 Copy for LLM"}
            </button>
          )}
          {active === "llm" && onExplain && (
            <button type="button" className="why-explain" onClick={explainLive} disabled={explaining}
              title={"Ask the live LLM why the agent picked this " + noun}>
              {explaining ? "✨ Explaining…" : "✨ Explain (live)"}
            </button>
          )}
          {active === "llm" && onExplain && (
            <button type="button" className="why-doctor" onClick={improveDescription} disabled={suggesting}
              title={"Descriptions overlap? Ask the live LLM for a sharper, more distinct description for this " + noun}>
              {suggesting ? "📝 Suggesting…" : "📝 Improve description"}
            </button>
          )}
        </div>
      )}
      {active === "llm" && explanation && (
        <div className="why-explanation"><span className="we-tag">✨ live</span>{explanation}</div>
      )}
      {active === "llm" && suggestion && (
        <div className="desc-doctor">
          <div className="dd-label">Current description</div>
          <div className="dd-old">{focusDesc || "(none)"}</div>
          <div className="dd-label">Suggested ✦</div>
          <div className="dd-new">{suggestion}</div>
          <div className="dd-label">Changes</div>
          <div className="dd-diff">
            {diffWords(focusDesc, suggestion).map((seg, i) => (
              <span key={i} className={"dd-" + seg.type}>{seg.text}</span>
            ))}
          </div>
          <button type="button" className="dd-copy" onClick={copySuggestion}
            title={"Copy the suggested description to paste into your defineSkill / defineTool"}>
            {descCopied ? "✓ Copied — paste into your code" : "📋 Copy new description"}
          </button>
        </div>
      )}

      {/* "What drove it": per-pick attribution. Leads with the VERDICT CARD when
          channels are stamped — which context channel drove the pick (the
          agent's rules / the user's request / earlier tool data), the winner
          cited. Below it, the ranked context units (rules / the task / data)
          by similarity to the chosen tool, top one cited, with the "% procedural"
          headline. Context units are NOT tools, so the picked row is the
          winning UNIT, not a tool. */}
      {active === "rules" && (
        rulesData ? (
          <>
            {rulesData.channels && (
              <div className="why-verdict">
                {/* One meter per channel, upstream's order (winner first). Quotes
                    are untrusted agent context → React text nodes only. */}
                {rulesData.channels.map((c, i) => {
                  // clamp 0..100 (shares are 0..1 by contract) + round off float dust
                  const pct = Math.round(Math.min(100, Math.max(0, c.share * 100)));
                  return (
                    <div key={c.id + i} className={"wv-row" + (i === 0 ? " win" : "")}>
                      <span className="wv-label">{c.label}</span>
                      <span className="wv-meter"><span className="wv-fill" style={{ width: pct + "%" }} /></span>
                      <span className="wv-pct">{pct + "%"}</span>
                      {i === 0 && c.quote && (
                        <div className="wv-cite">
                          {c.citeLabel && <span className="wv-cite-label">{c.citeLabel}</span>}
                          {"“" + clipQuote(c.quote) + "”"}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
            {rulesData.note && <div className="wv-note">{rulesData.note}</div>}
            {rulesData.headline && <div className="why-headline">{rulesData.headline}</div>}
            {rulesData.rows.length > 0 && (
              <ul className="why-tool">
                {rulesData.rows.map((r, i) => (
                  <li key={r.label + i} className={"wt-row" + (r.picked ? " picked" : "")}>
                    <div className="wt-head">
                      <code className="wt-name">{r.label}</code>
                      {r.picked && <span className="wt-tag">top</span>}
                      <span className="wt-val">{r.score.toFixed(2)}</span>
                    </div>
                    <span className="wt-meter"><span className="wt-fill" style={{ width: Math.round(r.score * 100) + "%" }} /></span>
                    {r.quote && <div className="wt-matched">{r.quote}</div>}
                  </li>
                ))}
              </ul>
            )}
          </>
        ) : attributing ? (
          <div className="why-sub">✨ attributing the pick to its context…</div>
        ) : attrError ? (
          <div className="why-explanation">⚠ {attrError}</div>
        ) : (
          <div className="why-sub">open this tab to attribute the pick to its context.</div>
        )
      )}

      {(active === "lexical" || active === "semantic") && (
        <ul className="why-tool">
          {/* Semantic: ranked bars from real relevance. Lexical: surface the
              picked one FIRST + a shared-wording hint, NO numeric bar (a lexical
              score misreads a system-prompt / procedure-driven pick as "worst"). */}
          {(active === "semantic" ? ranked : [...ranked].sort((a, b) => (b.name === pickedName ? 1 : 0) - (a.name === pickedName ? 1 : 0))).map((r, i) => {
            const isFocus = r.name === focus;
            const isPicked = r.name === pickedName;
            const bars = active === "semantic";
            return (
              <li key={r.name + i} className={"wt-row" + (isFocus ? " focus" : "") + (isPicked ? " picked" : "")}>
                <div className="wt-head">
                  <code className="wt-name">{r.name}</code>
                  {isPicked && <span className="wt-tag">picked</span>}
                  {bars && <span className="wt-val">{r.score.toFixed(2)}</span>}
                </div>
                {bars && (
                  <span className="wt-meter"><span className="wt-fill" style={{ width: Math.round(r.score * 100) + "%" }} /></span>
                )}
                {bars ? (
                  isFocus && r.matched && r.matched.length > 0 && <div className="wt-matched">matched: {r.matched.join(", ")}</div>
                ) : (
                  <div className={"wt-matched" + (r.matched && r.matched.length ? "" : " wt-none")}>
                    {r.matched && r.matched.length ? "shares: " + r.matched.join(", ") : "no shared wording with the ask"}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Section>
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

// A prefix like "LLM reasons —" CLAIMS the sentence after it is the model's own
// words. Say it only when the trace recorded it that way: a body the framework
// wrote (`brainSource: "framework"` — a delivery / bookkeeping sentence) or an
// empty body renders plain, so one line never carries two narrators.
const isModelVoice = (step) =>
  step.brainSource !== "framework" && !!(step.brain && String(step.brain).trim());

// The prefix stays OUT of the body: the body is markdown (a heading, a table),
// and the narrator's words must never end up parsed as part of it. Rendered as
// its own span in front of the prose — one line, still one voice.
const voicePrefix = (prefix, step) => (isModelVoice(step) ? prefix : "");

// a "both" beat prints the body and the act note as one commentary — kept on one
// line when both are one-liners, split into paragraphs when either is markdown
const joinBoth = (parts) => parts.join(parts.some((p) => p.includes("\n")) ? "\n\n" : " ");

// one journal line per beat — a header, its commentary, and who is speaking
function journal(step) {
  const t = step.toolName || step.tool;
  if (step.kind === "prompt") return { title: "Task comes in", note: step.brain };
  if (step.kind === "ask")    return { title: "LLM → asks " + t, note: step.brain };
  if (step.kind === "answer") return { title: "Answer delivered to " + step.to, note: step.answer.headline };
  if (step.replyType === "data")        return { title: t + " → returns data", voice: voicePrefix("LLM reasons", step), note: step.brain || "" };
  if (step.replyType === "instruction") return { title: t + " → returns instruction", voice: voicePrefix(step.skill ? "LLM follows " + step.skill : "LLM follows the instruction", step), note: step.brain || "" };
  return { title: t + " → returns data + instruction", note: joinBoth([step.brain, step.actNote].filter(Boolean)) };
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
        <div className="note-text">
          {j.voice ? <span className="note-voice">{j.voice + " — "}</span> : null}
          <Prose text={j.note} />
        </div>
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

export function Inspector({ step, index, total, onCollapse, view, setView, link, detail, trace, toolMenu, whyTool, onExplain, onScore, onAttribute, onBacktrack }) {
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
            <div className="brain-text"><Prose text={step.brain} /></div>
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
              <div className="brain-text"><Prose text={step.brain} /></div>
            </Section>
            {step.thinking && (
              <Section label="💭 Extended thinking">
                <div className="brain-text thinking"><Prose text={step.thinking} /></div>
              </Section>
            )}
            <ToolsSeen tools={step.toolsSeen} />
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
              <div className={"brain-text " + (step.brainMode || "reason")}><Prose text={step.brain} /></div>
            </Section>

            {isBoth && (
              <Section label="Brain · acts on the instruction">
                <div style={{ marginBottom: 9 }}>
                  <span className="steer-row">steered by · {step.skill}</span>
                </div>
                <div className="brain-text act"><Prose text={step.actNote} /></div>
              </Section>
            )}
          </>
        )}

        {/* ANSWER */}
        {step.kind === "answer" && (
          <Section label={"Answer to " + step.to} dot>
            {step.thinking && (
              <>
                <div className="io-label">💭 extended thinking</div>
                <div className="brain-text thinking" style={{ marginBottom: 12 }}><Prose text={step.thinking} /></div>
              </>
            )}
            <div className="brain-text" style={{ marginBottom: 12 }}><Prose text={step.brain} /></div>
            <div className="answer-card">
              <div className="ac-head">{step.answer.headline}</div>
              {/* plan / budget / cta are OPTIONAL in the trace contract — only an
                  `headline` is required. Render each only when present so a
                  plain `{ headline }` answer doesn't crash the inspector. */}
              {step.answer.plan && <ul>{step.answer.plan.map((p, i) => <li key={i}>{p}</li>)}</ul>}
              {step.answer.budget && (
                <table className="budget-tbl">
                  <tbody>
                    {step.answer.budget.map((row, i) => (
                      <tr key={i}><td>{row[0]}</td><td>{row[1]}</td></tr>
                    ))}
                  </tbody>
                </table>
              )}
              {step.answer.cta && <button className="answer-cta">{step.answer.cta}</button>}
            </div>
            <ToolsSeen tools={step.toolsSeen} />
          </Section>
        )}

        {/* WHY THIS TOOL? — rack mode, CLICK-ONLY: appears when the user clicks a
            tool in the rack or the "Why this tool?" button (whyTool set), then
            auto-scrolls into view. Not shown on every step → keeps the UI clean. */}
        {toolMenu === "rack" && trace && whyTool && (
          <WhyTool trace={trace} step={step} focusName={whyTool} pickedName={step.tool} onExplain={onExplain} onScore={onScore} onAttribute={onAttribute} />
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
        {/* Where did this come from? — variable chips (the backtrack seam).
            Same host-owns-data contract as onExplain: atui renders chips from
            the OPTIONAL step.variables field (the state keys this step
            produced — an agentfootprint host fills it from its commit log);
            clicking hands (variable, step) to the host, which computes the
            slice (sliceToBacktrackTrace) and opens <BacktrackOverlay>. No
            variables or no handler → nothing renders. */}
        {onBacktrack && Array.isArray(step.variables) && step.variables.length > 0 && (
          <Section label="Where did this come from?">
            <div className="var-chips">
              {step.variables.map((v) => (
                <button key={v} type="button" className="var-chip" title={"backtrack '" + v + "'"}
                  onClick={() => onBacktrack(v, step)}>
                  {v}
                </button>
              ))}
            </div>
          </Section>
        )}
        {detail != null && <div className="insp-extra">{detail}</div>}
      </div>
    </div>
  );
}
