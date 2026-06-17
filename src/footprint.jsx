import React from "react";
import { Stage } from "./stage.jsx";
import { Inspector, Notepad } from "./inspector.jsx";
import { Timeline } from "./timeline.jsx";
import { usePlayback } from "./playback.js";
import { AgentThemeContext } from "./context.js";
import * as AgentTheme from "./theme.js";

/* ============================================================
   AgentThinkingUI — default container.
   Wires the four view components into the ready-made shell:
     • Timeline   (time-travel transport + scrubber)
     • Stage      (the runtime "thinking" scene)
     • Inspector  (per-step detail)
     • Notepad    (chronological journal)
   plus playback + a resizable split. Consumers can either render
   <AgentThinkingUI trace={...} /> for the full experience, or drop the
   four components into their own layout (they're each independent).
   (window.AgentFootprint remains as a deprecated alias.)
   ============================================================ */
export function AgentThinkingUI({ trace, theme, labels, icons, brand, metaphor = true, loop = false, live = false, toolMenu = "card", onExplain, style, mobile, storageKey, onRender, onSelect, linkResolver, renderDetail }) {
  const { useState, useRef, useMemo, useEffect } = React;
  const rootRef = useRef(null);
  // persist scrub position per-trace so two players on one page don't collide;
  // pass storageKey={null} to disable, or a custom string to override.
  const key = storageKey !== undefined ? storageKey
    : "agentthinkingui.index:" + (trace.title || trace.agent || trace.task || "default");
  const { index, seek, playing, setPlaying, speed, setSpeed, onKeyDown } = usePlayback(trace, { loop, live, storageKey: key });

  // Resolve theme/labels/icons and scope them to THIS player's element:
  // CSS variables ride on the .app container (not :root), so multiple players
  // can wear different brands and nothing leaks into the host app. The four
  // sub-components read the resolved icons/labels from context below.
  const TC = AgentThemeContext;
  const resolved = useMemo(() => AgentTheme.normalize({ theme, labels, icons }), [theme, labels, icons]);
  const themeVars = useMemo(() => AgentTheme.toVars(resolved), [resolved]);
  const rootStyle = { ...themeVars, ...style }; // explicit style still wins (back-compat)
  const [runtimePct, setRuntimePct] = useState(58);
  const [inspOpen, setInspOpen] = useState(true);
  const [rightView, setRightView] = useState("inspector");
  const [mobileView, setMobileView] = useState("thinking");
  // rack mode: which tool the user clicked to inspect "why?" (null = panel hidden)
  const [whyTool, setWhyTool] = useState(null);
  // clicking a rack tool / the "Why this tool?" button focuses it AND makes sure
  // the inspector is open on its tab, so the Why panel is always somewhere to scroll to
  const showWhy = (name) => { setWhyTool(name); setInspOpen(true); setRightView("inspector"); };
  const wsRef = useRef(null);

  const onSplitDown = (e) => {
    e.preventDefault();
    const move = (ev) => {
      const r = wsRef.current.getBoundingClientRect();
      const pct = ((ev.clientX - r.left) / r.width) * 100;
      setRuntimePct(Math.min(74, Math.max(36, pct)));
    };
    const up = () => {
      document.body.style.cursor = "";
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    document.body.style.cursor = "col-resize";
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  const step = trace.steps[Math.min(index, trace.steps.length - 1)] || trace.steps[0];

  // Opt-in selection events for host integration (deep-link to a span in your
  // obs dashboard, analytics, two-way sync). Fires on every beat with the step
  // (which carries `spanId`/`traceId` from the adapters); also as a DOM
  // CustomEvent so non-React/script-tag hosts can listen. Zero cost when unused.
  useEffect(() => {
    setWhyTool(null); // each step starts focused on its own picked tool
    if (onSelect) onSelect(step, index);
    const el = rootRef.current;
    if (el && typeof CustomEvent !== "undefined") {
      el.dispatchEvent(new CustomEvent("agentthinkingui:select", { bubbles: true, detail: { step, index, spanId: step && step.spanId, traceId: step && step.traceId } }));
    }
  }, [index]);
  // optional deep-link for the current step (host supplies the URL builder)
  const stepLink = linkResolver && step ? linkResolver(step) : null;
  // optional host-rendered detail for the current step (raw logs / custom widgets /
  // content OTel didn't capture) — rendered in the inspector body
  const stepDetail = renderDetail && step ? renderDetail(step, index) : null;

  // Opt-in UI render metrics. When `onRender` is supplied we wrap the tree in
  // React's <Profiler> (the standard) and forward its timing, enriched with the
  // domain context React can't know (current step / total). Zero overhead when
  // the prop is absent; like React's own Profiler it only fires in dev/profiling
  // builds. Consumers can equally wrap <AgentThinkingUI> in their own <Profiler>.
  const wrap = (tree) => onRender
    ? <React.Profiler id="agentthinkingui" onRender={(id, phase, actualDuration, baseDuration, startTime, commitTime) =>
        onRender({ id, phase, actualMs: actualDuration, baseMs: baseDuration, startTime, commitTime, step: index, steps: trace.steps.length })}>{tree}</React.Profiler>
    : tree;

  if (mobile) {
    return wrap(
      <TC.Provider value={resolved}>
      <div className="atui mobile" style={rootStyle} onKeyDown={onKeyDown} ref={rootRef}>
        <div className="topbar">
          {brand && <div className="brandmark"><div className="brand-name">{brand}</div></div>}
        </div>
        <div className="m-tabs" role="tablist" aria-label="View">
          <button role="tab" aria-selected={mobileView === "thinking"} className={mobileView === "thinking" ? "on" : ""} onClick={() => setMobileView("thinking")}>Thinking</button>
          <button role="tab" aria-selected={mobileView === "notepad"} className={mobileView === "notepad" ? "on" : ""} onClick={() => setMobileView("notepad")}>Agent notepad</button>
        </div>
        <div className="m-view">
          {mobileView === "notepad"
            ? <Notepad trace={trace} index={index} onCollapse={() => {}} view="notepad" setView={() => {}} />
            : <Stage trace={trace} step={step} index={index} metaphor={metaphor} toolMenu={toolMenu} straight />}
        </div>
        {/* transport pinned in the footer, shared by both tabs */}
        <Timeline trace={trace} index={index} setIndex={seek} playing={playing} setPlaying={setPlaying} speed={speed} setSpeed={setSpeed} minimal />
      </div>
      </TC.Provider>
    );
  }

  return wrap(
    <TC.Provider value={resolved}>
    <div className={"atui" + (mobile ? " mobile" : "")} style={rootStyle} onKeyDown={onKeyDown} ref={rootRef}>
      <div className="topbar">
        {brand && <div className="brandmark"><div className="brand-name">{brand}</div></div>}
        <div className="task-pill">
          <span className="rec" />
          <span className="lbl">replay</span>
          <span className="txt" title={trace.task}>{trace.title || trace.task}</span>
        </div>
        <div className="spacer" />
      </div>

      <Timeline trace={trace} index={index} setIndex={seek}
        playing={playing} setPlaying={setPlaying} speed={speed} setSpeed={setSpeed} />

      <div className={"workspace" + (inspOpen ? "" : " insp-collapsed")} ref={wsRef}>
        <div className="ws-runtime" style={inspOpen ? { flex: `0 0 ${runtimePct}%` } : { flex: "1 1 auto" }}>
          <Stage trace={trace} step={step} index={index} metaphor={metaphor} toolMenu={toolMenu} onToolClick={showWhy} />
        </div>

        {inspOpen ? (
          <>
            <div className="splitter" onPointerDown={onSplitDown} title="Drag to resize">
              <span className="grip" />
            </div>
            <div className="ws-insp">
              {rightView === "notepad"
                ? <Notepad trace={trace} index={index} onCollapse={() => setInspOpen(false)} view={rightView} setView={setRightView} />
                : <Inspector step={step} index={index} total={trace.steps.length} onCollapse={() => setInspOpen(false)} view={rightView} setView={setRightView} link={stepLink} detail={stepDetail} trace={trace} toolMenu={toolMenu} whyTool={whyTool} onExplain={onExplain} />}
            </div>
          </>
        ) : (
          <button className="insp-rail" onClick={() => setInspOpen(true)} title="Expand inspector">
            <span className="chev">‹</span>
            <span className="rail-label">Step inspector</span>
          </button>
        )}
      </div>
    </div>
    </TC.Provider>
  );
}
