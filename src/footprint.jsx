/* global React, Stage, Inspector, Timeline, Notepad, usePlayback */
/* ============================================================
   AgentFootprint — default container.
   Wires the four view components into the ready-made shell:
     • Timeline   (time-travel transport + scrubber)
     • Stage      (the runtime "thinking" scene)
     • Inspector  (per-step detail)
     • Notepad    (chronological journal)
   plus playback + a resizable split. Consumers can either render
   <AgentFootprint trace={...} /> for the full experience, or drop the
   four components into their own layout (they're each independent).
   ============================================================ */
function AgentFootprint({ trace, metaphor = true, loop = false, style, mobile }) {
  const { useState, useRef } = React;
  const { index, seek, playing, setPlaying, speed, setSpeed } = usePlayback(trace, { loop });
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
      <div className="app mobile" style={style}>
        <div className="topbar">
          <div className="brandmark"><div className="brand-dot" /><div className="brand-name">Agent<b>ThinkingUI</b></div></div>
          <div className="task-pill"><span className="rec" /><span className="lbl">replay</span><span className="txt">{trace.task}</span></div>
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
        <Timeline trace={trace} index={index} setIndex={seek} playing={playing} setPlaying={setPlaying} speed={speed} setSpeed={setSpeed} minimal />
      </div>
    );
  }

  return (
    <div className={"app" + (mobile ? " mobile" : "")} style={style}>
      <div className="topbar">
        <div className="brandmark">
          <div className="brand-dot" />
          <div className="brand-name">Agent<b>ThinkingUI</b></div>
        </div>
        <div className="task-pill">
          <span className="rec" />
          <span className="lbl">replay</span>
          <span className="txt">{trace.task}</span>
        </div>
        <div className="spacer" />
        <div className="agent-tag">{trace.agent} · {trace.model}</div>
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
  );
}

window.AgentThinkingUI = AgentFootprint;
window.AgentFootprint = AgentFootprint; // alias — AgentThinkingUI by the AgentFootprint org
