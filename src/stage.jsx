import React from "react";
import { AgentThemeContext } from "./context.js";
import { arcLayout, AF_LAYOUT } from "./layout.js";

const { useRef: sUseRef, useState: sUseState, useLayoutEffect } = React;

export function ToolIcon({ name }) {
  const common = { width: 17, height: 17, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" };
  const paths = {
    search_flights: <path d="M3 12h12l4-4 2 1-3 3 3 3-2 1-4-4H3z" />,
    search_hotels: <g><path d="M3 18V8m18 10v-5a3 3 0 0 0-3-3H8v6" /><path d="M3 14h18M6 9.5h0" /></g>,
    book_hold: <g><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></g>,
    load_skill: <g><path d="M4 5a2 2 0 0 1 2-2h11v16H6a2 2 0 0 0-2 2z" /><path d="M8 7h6M8 10h6" /></g>,
  };
  return <svg {...common}>{paths[name] || <circle cx="12" cy="12" r="8" />}</svg>;
}

function TypeGlyph({ data }) {
  return data ? (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <rect x="4" y="6" width="16" height="2.6" rx="1.3" />
      <rect x="4" y="10.7" width="10" height="2.6" rx="1.3" />
      <rect x="4" y="15.4" width="14" height="2.6" rx="1.3" />
    </svg>
  ) : (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 6.5h9M5 11.5h9M5 16.5h5" />
      <path d="M15.5 16l2 2 4-4.5" />
    </svg>
  );
}

// the agent avatar — animated brain mascot, or an emoji/image. Reused by the
// single-agent scene AND by <AgentSwarm> agent cards.
export function BrainGlyph({ icon, mode }) {
  const cfg = icon || { kind: "default" };
  if (cfg.kind === "image" && cfg.value) {
    return <div className="brain brain-custom"><img src={cfg.value} alt="" /></div>;
  }
  if (cfg.kind === "emoji" && cfg.value) {
    return <div className="brain brain-custom brain-emoji">{cfg.value}</div>;
  }
  return (
    <div className={"brain " + (mode === "act" ? "acting" : "thinking")}>
      <svg className="brain-svg" viewBox="0 0 112 98" aria-hidden="true">
        <defs>
          <linearGradient id="afBrainG" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="var(--brain-from)" />
            <stop offset="1" stopColor="var(--brain-to)" />
          </linearGradient>
        </defs>
        <path className="brain-body" fill="url(#afBrainG)" stroke="#fff" strokeWidth="3" strokeLinejoin="round"
          d="M56 9 C64 3 77 5 81 14 C92 11 101 20 97 31 C105 36 106 48 97 54 C103 63 98 74 88 75 C85 85 73 89 65 82 C61 88 51 88 47 82 C39 89 27 85 24 75 C14 74 9 63 15 54 C6 48 7 36 15 31 C11 20 20 11 31 14 C35 5 48 3 56 9 Z" />
        <g className="brain-folds" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" opacity=".46">
          <path d="M56 13 Q51 31 56 49 Q61 67 56 80" />
          <path d="M31 33 q7 5 1 10 M27 50 q8 6 2 11 M35 64 q6 4 0 9" />
          <path d="M81 33 q-7 5 -1 10 M85 50 q-8 6 -2 11 M77 64 q-6 4 0 9" />
        </g>
      </svg>
      <div className="eyes"><span className="eye" /><span className="eye" /></div>
      <div className="mouth" />
    </div>
  );
}

function Brain({ mode }) {
  return <BrainGlyph icon={afIcons(React.useContext(AgentThemeContext)).brain} mode={mode} />;
}

// Prefer the resolved theme handed down by <AgentThinkingUI> via context; fall
// back to the page-level global so the components still work standalone.
function afIcons(R) {
  R = R || (typeof window !== "undefined" && window.AGENT_THEME_RESOLVED);
  return (R && R.icons) || {};
}
function afLabels(R) {
  R = R || (typeof window !== "undefined" && window.AGENT_THEME_RESOLVED);
  return (R && R.displayName) || { agent: "LLM brain", toolbox: "toolbox" };
}

function Dots() { return <span className="dots"><i /><i /><i /></span>; }

function Cloud({ tag, text, metaphor, compact, tone }) {
  return (
    <div className={"cloud" + (compact ? " compact" : "") + (tone === "data" ? " tone-data" : "")}>
      {metaphor && <span className="ctag">{tag}<Dots /></span>}
      <span className="ctext">{text}</span>
    </div>
  );
}

function SkillDoc({ skill, checklist, metaphor, compact }) {
  return (
    <div className={"skilldoc" + (compact ? " compact" : "")}>
      {metaphor && <div className="sd-tag">acting<Dots /></div>}
      <div className="sd-head">
        <span className="sd-clip">§</span>
        <span className="sd-name">{skill}</span>
        <span className="sd-kicker">steering doc</span>
      </div>
      <ul className="sd-list">
        {checklist.map((c, i) => (
          <li key={i} style={{ animationDelay: 0.85 + i * 0.2 + "s" }}>
            <span className="box">✓</span><span>{c.text}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Toolbox({ active }) {
  const R = React.useContext(AgentThemeContext);
  const ic = afIcons(R).toolbox || { kind: "default" };
  const label = afLabels(R).toolbox;
  if (ic.kind !== "default" && ic.value) {
    return (
      <div className={"toolbox tb-custom" + (active ? " open" : " idle")}>
        <div className={"tb-figure" + (ic.kind === "emoji" ? " tb-emoji" : "")}>
          {ic.kind === "image" ? <img src={ic.value} alt="" /> : ic.value}
        </div>
        <span className="tb-label">{label}</span>
      </div>
    );
  }
  return (
    <div className={"toolbox" + (active ? " open" : " idle")}>
      <div className="tb-lid"><span className="tb-handle" /></div>
      <div className="tb-body">
        <span className="tb-label">{label}</span>
        <div className="tb-slots"><span /><span /><span /></div>
      </div>
    </div>
  );
}

function SceneInner({ step, dims, metaphor, straight }) {
  const { w, h } = dims;
  const resolved = React.useContext(AgentThemeContext);

  const isTool = step.kind === "ask" || step.kind === "return";
  const isReturn = step.kind === "return";
  const isBoth = step.replyType === "both";
  const isData = step.replyType === "data";
  const isAct = isReturn && (step.brainMode === "act");
  const dir = step.kind === "ask" ? "ask" : "return";

  // FIXED anchor so the brain + toolbox never jump between steps. Mobile pins
  // them low (the callout grows upward into the room above); desktop keeps its
  // line. No per-step measurement → no movement.
  const L = AF_LAYOUT || {};
  const by = h * (straight ? (L.brainYMobile || 0.72) : (L.brainY || 0.6));
  const G = arcLayout(w, h, by, straight);
  const active = isTool ? (dir === "ask" ? G.down : G.up) : null;

  const cloudTag =
    step.kind === "prompt" ? "reading the ask" :
    step.kind === "ask" ? "calling" :
    step.kind === "answer" ? "wrapping up" : "thinking";

  // single bubble hugs above the brain; BOTH = think (teal, left) + act (amber, right) over the brain
  let thought = null, dualThoughts = null;
  if (isBoth) {
    const half = 196;
    const dualLeft = Math.max(half + 12, Math.min(w - half - 12, G.bx + 78));
    dualThoughts = (
      <div className="dual-thoughts" style={{ left: dualLeft, bottom: h - by + 54 }}>
        <Cloud tag="thinking" text={step.brain} metaphor={metaphor} compact tone="data" />
        <SkillDoc skill={step.skill} checklist={step.actChecklist} metaphor={metaphor} compact />
      </div>
    );
  } else if (isAct) {
    thought = <div className="thoughtpos"><SkillDoc skill={step.skill} checklist={step.actChecklist} metaphor={metaphor} /></div>;
  } else {
    thought = <div className="thoughtpos"><Cloud tag={cloudTag} text={step.brain} metaphor={metaphor} /></div>;
  }

  const brainMode = isAct ? "act" : "reason";

  return (
    <div className="scene-inner">
      {dualThoughts}
      {/* fixed flowchart connectors (brain ⇄ toolbox). only the packet flows through them. */}
      <svg className="arc-svg" width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden="true">
        <path className="arc-fixed" d={G.down.d} fill="none" />
        <polygon className="arc-fixed-head" points="-10,-6 2,0 -10,6" transform={`translate(${G.down.hx} ${G.down.hy}) rotate(${G.down.ang})`} />
        <path className="arc-fixed" d={G.up.d} fill="none" />
        <polygon className="arc-fixed-head" points="-10,-6 2,0 -10,6" transform={`translate(${G.up.hx} ${G.up.hy}) rotate(${G.up.ang})`} />
        {active && (
          <>
            <path className="arc-active" d={active.d} fill="none" stroke={isBoth ? "var(--call)" : "var(--accent)"} strokeWidth="2.5" strokeLinecap="round" />
            <polygon className="arc-head" points="-11,-6 2,0 -11,6" fill={isBoth ? "var(--call)" : "var(--accent)"}
              transform={`translate(${active.hx} ${active.hy}) rotate(${active.ang})`} />
          </>
        )}
      </svg>

      {active && (
        <>
          {isBoth ? (
            <>
              <div className="arc-rider rb-1" style={{ offsetPath: `path('${active.d}')`, WebkitOffsetPath: `path('${active.d}')` }}>
                <span className="rider-chip" style={{ background: "var(--data)" }}><TypeGlyph data /></span>
              </div>
              <div className="arc-rider rb-2" style={{ offsetPath: `path('${active.d}')`, WebkitOffsetPath: `path('${active.d}')` }}>
                <span className="rider-chip" style={{ background: "var(--instr)" }}><TypeGlyph data={false} /></span>
              </div>
            </>
          ) : (
            <div className="arc-rider" style={{ offsetPath: `path('${active.d}')`, WebkitOffsetPath: `path('${active.d}')` }}>
              {isReturn ? <span className="rider-chip"><TypeGlyph data={isData} /></span> : <span className="rider-dot" />}
            </div>
          )}
        </>
      )}

      {/* bottom commentary caption — narrates every beat, including prompt + answer */}
      <div className={"arc-tag k-cap-" + step.kind} style={{ left: w / 2, top: h - 30 }}>
        {step.kind === "ask" ? (metaphor ? "asks the toolbox" : "tool call")
          : step.kind === "return" ? (isBoth ? "data + instruction comes back" : isData ? "data comes back" : "instruction comes back")
          : step.kind === "prompt" ? "task comes in"
          : "answer is ready"}
      </div>

      {/* LLM brain (left) */}
      <div className="brain-node" style={{ left: G.bx, top: G.by }}>
        {thought}
        <Brain mode={brainMode} />
        <div className="brain-label">{afLabels(resolved).agent}</div>
      </div>

      {/* toolbox (right) — the tool pops out the top on a call */}
      {isTool ? (
        <div className="tool-node" style={{ left: G.tx, top: G.ty }}>
          <div className="tool-out">
            <span className="to-ico"><ToolIcon name={step.tool} /></span>
            <span className="to-name">{step.toolName || step.tool}</span>
          </div>
          <Toolbox active />
        </div>
      ) : (
        <div className="tool-node idle" style={{ left: G.tx, top: G.ty }}>
          <Toolbox active={false} />
        </div>
      )}
    </div>
  );
}

export function Stage({ trace, step, index, metaphor, straight }) {
  const sceneRef = sUseRef(null);
  const [dims, setDims] = sUseState({ w: 720, h: 460 });

  useLayoutEffect(() => {
    const el = sceneRef.current;
    if (!el) return;
    const measure = () => setDims({ w: el.clientWidth, h: el.clientHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const accentClass =
    step.kind === "answer" ? "k-answer" :
    step.kind === "prompt" ? "k-prompt" :
    step.kind === "ask" ? "k-call" :
    step.replyType === "both" ? "k-both" :
    step.replyType === "data" ? "k-data" : "k-instr";

  return (
    <div className={"panel stage " + accentClass}>
      <div className="flowscene" ref={sceneRef}>
        <SceneInner key={index} step={step} dims={dims} metaphor={metaphor} straight={straight} />
      </div>
    </div>
  );
}
