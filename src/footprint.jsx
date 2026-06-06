/* global React, Stage, Inspector, Timeline, Notepad, usePlayback */
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
function AgentThinkingUI({ trace, theme, labels, icons, brand, metaphor = true, loop = false, style, mobile }) {
  const { useState, useRef, useMemo, useContext } = React;
  const { index, seek, playing, setPlaying, speed, setSpeed } = usePlayback(trace, { loop });

  // Resolve theme/labels/icons and scope them to THIS player's element:
  // CSS variables ride on the .app container (not :root), so multiple players
  // can wear different brands and nothing leaks into the host app. The four
  // sub-components read the resolved icons/labels from context below.
  const TC = window.AgentThemeContext || (window.AgentThemeContext = React.createContext(null));
  const resolved = useMemo(() => window.AgentTheme.normalize({ theme, labels, icons }), [theme, labels, icons]);
  const themeVars = useMemo(() => window.AgentTheme.toVars(resolved), [resolved]);
  const rootStyle = { ...themeVars, ...style }; // explicit style still wins (back-compat)
  const [runtimePct, setRuntimePct] = useState(58);
  const [inspOpen, setInspOpen] = useState(true);
  const [rightView, setRightView] = useState("inspector");
  const [mobileView, setMobileView] = useState("thinking");
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

  const step = trace.steps[index];

  if (mobile) {
    return (
      <TC.Provider value={resolved}>
      <div className="app mobile" style={rootStyle}>
        <div className="topbar">
          {brand && <div className="brandmark"><div className="brand-name">{brand}</div></div>}
        </div>
        <div className="m-tabs">
          <button className={mobileView === "thinking" ? "on" : ""} onClick={() => setMobileView("thinking")}>Thinking</button>
          <button className={mobileView === "notepad" ? "on" : ""} onClick={() => setMobileView("notepad")}>Agent notepad</button>
        </div>
        <div className="m-view">
          {mobileView === "notepad"
            ? <Notepad trace={trace} index={index} onCollapse={() => {}} view="notepad" setView={() => {}} />
            : <Stage trace={trace} step={step} index={index} metaphor={metaphor} straight />}
        </div>
        {/* transport pinned in the footer, shared by both tabs */}
        <Timeline trace={trace} index={index} setIndex={seek} playing={playing} setPlaying={setPlaying} speed={speed} setSpeed={setSpeed} minimal />
      </div>
      </TC.Provider>
    );
  }

  return (
    <TC.Provider value={resolved}>
    <div className={"app" + (mobile ? " mobile" : "")} style={rootStyle}>
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
          <Stage trace={trace} step={step} index={index} metaphor={metaphor} />
        </div>

        {inspOpen ? (
          <>
            <div className="splitter" onPointerDown={onSplitDown} title="Drag to resize">
              <span className="grip" />
            </div>
            <div className="ws-insp">
              {rightView === "notepad"
                ? <Notepad trace={trace} index={index} onCollapse={() => setInspOpen(false)} view={rightView} setView={setRightView} />
                : <Inspector step={step} index={index} total={trace.steps.length} onCollapse={() => setInspOpen(false)} view={rightView} setView={setRightView} />}
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

window.AgentThinkingUI = AgentThinkingUI;
window.AgentFootprint = AgentThinkingUI; // deprecated alias
