import React from "react";

const { useRef: tlUseRef } = React;

function Icon({ type }) {
  const p = { width: 18, height: 18, viewBox: "0 0 24 24", fill: "currentColor" };
  switch (type) {
    case "play": return <svg {...p}><path d="M8 5v14l11-7z" /></svg>;
    case "pause": return <svg {...p}><rect x="6" y="5" width="4" height="14" rx="1" /><rect x="14" y="5" width="4" height="14" rx="1" /></svg>;
    case "prev": return <svg {...p}><path d="M7 5v14M19 5l-9 7 9 7z" stroke="currentColor" strokeWidth="2.2" fill="none" strokeLinejoin="round" strokeLinecap="round" /></svg>;
    case "next": return <svg {...p}><path d="M17 5v14M5 5l9 7-9 7z" stroke="currentColor" strokeWidth="2.2" fill="none" strokeLinejoin="round" strokeLinecap="round" /></svg>;
    case "restart": return <svg {...p}><path d="M4 12a8 8 0 1 0 8-8 8 8 0 0 0-6 2.7M4 4v4h4" stroke="currentColor" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>;
    default: return null;
  }
}

export function Timeline({ trace, index, setIndex, playing, setPlaying, speed, setSpeed, minimal }) {
  const trackRef = tlUseRef(null);
  const steps = trace.steps;

  // segment widths weighted by latency → a real time axis
  const totalMs = steps.reduce((a, s) => a + s.cost.ms, 0);
  let acc = 0;
  const segs = steps.map((s) => {
    const start = (acc / totalMs) * 100;
    const w = (s.cost.ms / totalMs) * 100;
    acc += s.cost.ms;
    return { start, w };
  });
  const cur = Math.min(index, steps.length - 1); // live traces can grow/shrink under us
  const head = segs[cur].start + segs[cur].w / 2;

  const elapsedMs = steps.slice(0, index + 1).reduce((a, s) => a + s.cost.ms, 0);
  const elapsedTok = steps.slice(0, index + 1).reduce((a, s) => a + s.cost.tokens, 0);

  const segKind = (s) => s.kind === "return" ? s.replyType : s.kind;

  const scrubTo = (clientX) => {
    const r = trackRef.current.getBoundingClientRect();
    const frac = Math.min(1, Math.max(0, (clientX - r.left) / r.width)) * 100;
    for (let i = 0; i < segs.length; i++) {
      if (frac <= segs[i].start + segs[i].w || i === segs.length - 1) { setIndex(i); return; }
    }
  };

  const onDown = (e) => {
    setPlaying(false);
    trackRef.current.parentElement.classList.add("scrubbing");
    scrubTo(e.clientX);
    const move = (ev) => scrubTo(ev.clientX);
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      if (trackRef.current) trackRef.current.parentElement.classList.remove("scrubbing");
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  return (
    <div className={"panel timeline" + (minimal ? " minimal" : "")}>
      <div className="tl-track-wrap">
        <div className="tl-track" ref={trackRef} onPointerDown={onDown}>
          {steps.map((s, i) => (
            <div
              key={i}
              className={"tl-seg s-" + segKind(s) + (s.error ? " err" : "") + (i > cur ? " future" : "")}
              style={{ width: segs[i].w + "%" }}
              title={`Step ${i + 1}`}
              onPointerDown={(e) => { e.stopPropagation(); setPlaying(false); setIndex(i); }}
            />
          ))}
        </div>
        <div className="playhead" style={{ left: head + "%" }} />
      </div>

      <div className="tl-controls">
        <div className="tl-btns">
          <button className="tl-btn" onClick={() => setIndex(Math.max(0, index - 1))} title="Previous step"><Icon type="prev" /></button>
          <button className="tl-btn play" onClick={() => { if (index === steps.length - 1 && !playing) setIndex(0); setPlaying(!playing); }} title={playing ? "Pause" : "Play"}>
            <Icon type={playing ? "pause" : "play"} />
          </button>
          <button className="tl-btn" onClick={() => setIndex(Math.min(steps.length - 1, index + 1))} title="Next step"><Icon type="next" /></button>
          <button className="tl-btn" onClick={() => { setIndex(0); setPlaying(false); }} title="Restart"><Icon type="restart" /></button>
        </div>

        <div className="tl-readout">
          <span className="step-n">{String(cur + 1).padStart(2, "0")} <span>/ {String(steps.length).padStart(2, "0")}</span></span>
        </div>

        <div className="tl-meter">
          <span className="m">⏱ {(elapsedMs / 1000).toFixed(1)}s</span>
          <span className="m">◇ {elapsedTok.toLocaleString()} tok</span>
        </div>

        <div className="tl-spacer" />

        <div className="legend">
          <span className="lg"><span className="sw" style={{ background: "var(--call)" }} />Call</span>
          <span className="lg"><span className="sw" style={{ background: "var(--data)" }} />Data → reason</span>
          <span className="lg"><span className="sw" style={{ background: "var(--instr)" }} />Instruction → act</span>
          <span className="lg"><span className="sw" style={{ background: "var(--answer)" }} />Answer</span>
        </div>

        <div className="speed-group">
          {[0.5, 1, 2].map((sp) => (
            <button key={sp} className={speed === sp ? "on" : ""} onClick={() => setSpeed(sp)}>{sp}×</button>
          ))}
        </div>
      </div>
    </div>
  );
}
