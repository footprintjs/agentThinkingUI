import React from "react";
import { AgentThemeContext } from "./context.js";
import { arcLayout, AF_LAYOUT, iconScaleFor, RACK_ITEM_H, RACK, rackArrowY, rackBoxFor, rackPinFor, rackIsCompact, rackRailLeft, rackArrowInset, bubbleBoxFor, bubbleHeadroom } from "./layout.js";
import { Prose } from "./prose.jsx";
import { AgentIconGlyph, isAgentIconName } from "./agent-icons.jsx";
import { CHARACTERS, characterOf, characterLabel } from "./characters.jsx";

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

// A skill surfaces to the model as a tool, but it's an instruction (a steering
// doc), not an action. We can't always tell from the trace alone, so use the
// same naming convention the rest of the UI leans on: `load_skill`, or any tool
// whose name reads as a skill. Used only to pick the menu glyph — purely cosmetic.
export function isSkillName(name) {
  return name === "load_skill" || /skill/i.test(name || "");
}

// The small glyph for one entry in the tool menu: a steering-doc mark for skills
// (mirrors SkillDoc's paper motif), otherwise the tool's own icon.
function MenuGlyph({ name }) {
  if (isSkillName(name)) {
    return (
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M4 5a2 2 0 0 1 2-2h11v16H6a2 2 0 0 0-2 2z" /><path d="M8 7h6M8 10h6" />
      </svg>
    );
  }
  return <ToolIcon name={name} />;
}

// Rack mode ("toolMenu: 'rack'") shows EVERY tool the model could see, in
// first-seen order — no cap and no "+N more" summary (retired: a rack that hides
// tools can't answer "out of what?"). When they outrun the arena the list
// SCROLLS, and the picked row is pinned inside it (rackPinFor) so it never
// scrolls away. Pure data — exported for testing.
export function rackView(tools, picked) {
  if (!tools || !tools.length) return { rows: [], pickedIndex: -1, rowCount: 0 };
  const pickedIndex = picked ? tools.findIndex((t) => t.name === picked) : -1;
  return { rows: tools, pickedIndex, rowCount: tools.length };
}

// The rack: a vertical stack of EVERY tool the model can use (icon + name
// beneath), the picked one lit and the rest dimmed — "the model chose this out of
// N", laid out spatially so the connector arrow can point right at the chosen
// tool. Takes a precomputed `view` (from rackView) so the scene can derive the
// arrow target from the same layout. Skills get the doc glyph; tools get the tool
// icon. When `onPick` is supplied, rows are clickable — click a tool to see WHY it
// scored (the inspector's "Why this tool?" panel).
//
// `maxH` is the room the arena has for the ROWS (from rackBoxFor) — past it the
// list scrolls, so no tool is ever hidden and none is ever clipped. `pin`
// (rackPinFor) is what makes a scrolling rack safe: it seeds the scroll so the
// picked row lands on its slot, and that slot becomes the row's sticky band, so
// the pick stays visible — and the arrow stays honest — at any scroll position.
// `compact` drops the labels on an arena too narrow to carry both a rack and a
// readable bubble — the names stay in the tooltip and the aria label.
export function ToolRack({ view, onPick, compact, maxH, pin, scrollable }) {
  const { rows, pickedIndex } = view || {};
  const listRef = sUseRef(null);
  const seed = pin ? pin.scrollTop : 0;
  // Seed the scroll ONCE per beat (the scene remounts on every step), so the
  // pinned row starts on its slot without having been moved off its natural
  // place. This is the only imperative line in the rack — and it sets a value
  // the geometry already computed, it does not read one back.
  useLayoutEffect(() => {
    if (listRef.current) listRef.current.scrollTop = seed;
  }, [seed]);
  if (!rows || !rows.length) return null;
  const clickable = typeof onPick === "function";
  return (
    <div
      className={"tool-rack" + (clickable ? " clickable" : "") + (compact ? " compact" : "")}
      style={{
        "--tr-item-h": RACK_ITEM_H + "px",
        "--tr-w": (compact ? RACK.wCompact : RACK.w) + "px",
        "--tr-list-h": maxH > 0 ? maxH + "px" : "none",
        "--tr-pin-top": (pin ? pin.top : 0) + "px",
        "--tr-pin-bottom": (pin ? pin.bottom : 0) + "px",
      }}
    >
      {/* the scroll container is a tab stop when it actually scrolls, so the list
          is reachable (and arrow-scrollable) without a mouse */}
      <div
        className="tr-list"
        ref={listRef}
        role="list"
        tabIndex={scrollable ? 0 : undefined}
        aria-label={"tools the model can use" + (scrollable ? " — scrollable list of " + rows.length : "")}
      >
        {rows.map((t, i) => {
          const on = i === pickedIndex;
          return (
            <div
              key={(t.name || "") + i}
              role={clickable ? "button" : "listitem"}
              tabIndex={clickable ? 0 : undefined}
              onClick={clickable ? () => onPick(t.name) : undefined}
              onKeyDown={clickable ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onPick(t.name); } } : undefined}
              className={"tr-item" + (on ? " on" : "") + (on && pin ? " pinned" : "") + (isSkillName(t.name) ? " skill" : "")}
              aria-current={on ? "true" : undefined}
              title={t.name + (t.description ? " — " + t.description : "")
                + (on ? (pin ? "  (picked — pinned while the rest scroll)" : "  (picked)") : clickable ? "  (click: why?)" : "")}
            >
              <span className="tr-ico"><MenuGlyph name={t.name} /></span>
              <span className="tr-name">{t.name}</span>
              {on && pin && <span className="tr-pinned-tag" aria-hidden="true">picked</span>}
            </div>
          );
        })}
      </div>
      {/* "Why this tool?" trigger — floats BELOW the rack (absolute, so it doesn't
          shift the rows off-centre → the arrow geometry stays accurate). Focuses
          the picked tool in the inspector's Why panel; says "skill" for skills. */}
      {clickable && pickedIndex >= 0 && (
        <button type="button" className="tr-why" onClick={() => onPick(rows[pickedIndex].name)}
          title={"Why this " + (isSkillName(rows[pickedIndex].name) ? "skill" : "tool") + "?"}>
          {compact ? "🔍 Why?" : "🔍 Why this " + (isSkillName(rows[pickedIndex].name) ? "skill" : "tool") + "?"}
        </button>
      )}
    </div>
  );
}

// "saw N, picked 1" — under the popped tool card, a compact row of the tools the
// model HAD for this call (`step.toolsSeen`). The picked one is lit; the rest are
// dimmed. Shows the prompt's tool menu at a glance: the model chose this out of N.
// Renders nothing unless the model actually chose among ≥2 (a single tool = no
// "choice" to show). Skills get the doc glyph; tools get the tool icon.
export function ToolMenu({ seen, picked }) {
  if (!seen || seen.length < 2) return null;
  return (
    <div className="tool-menu" aria-label={"the model saw " + seen.length + " tools and picked " + picked}>
      <span className="tm-label">saw {seen.length}</span>
      <span className="tm-icons">
        {seen.map((t, i) => {
          const isPicked = t.name === picked;
          return (
            <span
              key={(t.name || "") + i}
              className={"tm-ico" + (isPicked ? " picked" : "") + (isSkillName(t.name) ? " skill" : "")}
              title={t.name + (t.description ? " — " + t.description : "") + (isPicked ? "  (picked)" : "")}
            >
              <MenuGlyph name={t.name} />
            </span>
          );
        })}
      </span>
    </div>
  );
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
// single-agent scene AND by <MultiAgentFlow> agent cards.
//
// `agentIcon` is the newer, more specific way to say who the agent is, and it
// WINS over the legacy `icons.brain` config when both are given. The rule for
// its value is one line: a STRING is a built-in NAME, anything else is YOUR
// node. An unrecognised name falls back to the mascot rather than printing
// itself into the scene (to draw literal text, pass a node: <span>🦊</span>).
//
// `character` picks WHICH mascot stands there when nothing more specific was
// asked for (characters.jsx). It is the last word before the built-in brain,
// so anything the host named explicitly — a node, a glyph name, an emoji or an
// image — still wins over it. Default "brain" = today's scene, untouched.
export function BrainGlyph({ icon, mode, agentIcon, character }) {
  if (agentIcon != null && agentIcon !== false) {
    if (typeof agentIcon !== "string") {
      return (
        <div className={"brain agent-icon agent-icon-node " + (mode === "act" ? "acting" : "thinking")}>{agentIcon}</div>
      );
    }
    // "brain" (and any unknown name) falls through to the default mascot below
    if (agentIcon !== "brain" && isAgentIconName(agentIcon)) return <AgentIconGlyph name={agentIcon} mode={mode} />;
  }
  const cfg = icon || { kind: "default" };
  if (cfg.kind === "image" && cfg.value) {
    return <div className="brain brain-custom"><img src={cfg.value} alt="" /></div>;
  }
  if (cfg.kind === "emoji" && cfg.value) {
    return <div className="brain brain-custom brain-emoji">{cfg.value}</div>;
  }
  const Art = CHARACTERS[characterOf(character)].Art;
  if (Art) return <Art mode={mode} />;
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

function Brain({ mode, agentIcon, character }) {
  return <BrainGlyph icon={afIcons(React.useContext(AgentThemeContext)).brain} mode={mode} agentIcon={agentIcon} character={character} />;
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
      <div className="ctext"><Prose text={text} /></div>
    </div>
  );
}

// The model's extended-thinking chain-of-thought, shown above the action as a
// collapsible "💭 thinking" callout (it can be long — preview collapsed, full on
// expand). Only rendered when the beat carries `thinking`.
function ThinkingCallout({ text }) {
  const [open, setOpen] = React.useState(false);
  if (!text) return null;
  const preview = text.length > 90 ? text.slice(0, 90).trimEnd() + "…" : text;
  return (
    <div className={"thinking-callout" + (open ? " open" : "")}>
      <button type="button" className="tc-toggle" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <span className="tc-ico" aria-hidden="true">💭</span>
        <span className="tc-label">thinking</span>
        <span className="tc-chev" aria-hidden="true">{open ? "▾" : "▸"}</span>
      </button>
      <div className="tc-text">{open ? <Prose text={text} /> : preview}</div>
    </div>
  );
}

function SkillDoc({ skill, checklist = [], metaphor, compact }) {
  // `actChecklist` is OPTIONAL in the trace contract — an instruction reply can
  // be a steering doc with no explicit checklist. Default to [] and only render
  // the list when there are items (don't crash on a valid checklist-less trace).
  return (
    <div className={"skilldoc" + (compact ? " compact" : "")}>
      {metaphor && <div className="sd-tag">acting<Dots /></div>}
      <div className="sd-head">
        <span className="sd-clip">§</span>
        <span className="sd-name">{skill}</span>
        <span className="sd-kicker">steering doc</span>
      </div>
      {checklist.length > 0 && (
        <ul className="sd-list">
          {checklist.map((c, i) => (
            <li key={i} style={{ animationDelay: 0.85 + i * 0.2 + "s" }}>
              <span className="box">✓</span><span>{c.text}</span>
            </li>
          ))}
        </ul>
      )}
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

function SceneInner({ step, dims, metaphor, straight, toolMenu, rackTools, onToolClick, agentIcon, character }) {
  const { w, h } = dims;
  const resolved = React.useContext(AgentThemeContext);
  // who is on stage — defaulted here (an unknown name is the brain) so the
  // scene's marker class and the figure can never disagree
  const char = characterOf(character);

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
  const brainYFrac = straight ? (L.brainYMobile || 0.72) : (L.brainY || 0.6);
  const by = h * brainYFrac;
  // one scale for the cast — capped + container-responsive; feeds the CSS icon
  // sizes (via --af-icon-scale on the scene) AND the arc geometry, in lockstep.
  const iconScale = iconScaleFor(w);
  // rack mode: the toolbox is a vertical rack of all tools; the arrow points at
  // the PICKED tool's row, so derive its y from the same layout the rack renders.
  const useRack = toolMenu === "rack" && Array.isArray(rackTools) && rackTools.length > 0;
  // …and the rack is a COLUMN of a known width whose rows scroll inside a height
  // budgeted from the arena, centred where it stays inside the scene. Its left
  // edge is the rail the bubble must stay clear of — that is the ONE decision
  // that keeps the two apart (see bubbleBoxFor).
  const rackCompact = useRack && rackIsCompact(w);
  const rackBox = useRack ? rackBoxFor(h, rackTools.length, by, typeof onToolClick === "function") : null;
  const rackV = useRack ? rackView(rackTools, isTool ? step.tool : null) : null;
  // a rack whose tools outrun the arena scrolls, and pins the picked row at one
  // computed slot — so the arrow below has a target that no scrolling can move
  const rackPin = useRack ? rackPinFor(rackV.rowCount, rackV.pickedIndex, rackBox.listMaxH) : null;
  // the bubbles' size budget, from the MEASURED scene: how wide they may grow
  // before wrapping (never past the rack), and (last resort) how tall the body
  // may get before it scrolls. Rides the same custom-property channel as the icon scale.
  const box = bubbleBoxFor(w, h, brainYFrac, useRack ? rackRailLeft(w, rackCompact) : 0);
  const toolY = rackBox ? rackArrowY(rackBox, rackV.pickedIndex, rackPin) : by;
  // rack mode: the brain→tool "ask" is a straight line pointing at the picked row,
  // stopping just short of the rack column (not 62px short of the toolbox)
  const G = arcLayout(w, h, by, straight, iconScale, toolY, useRack,
    useRack ? rackArrowInset(rackCompact) : undefined);
  const active = isTool ? (dir === "ask" ? G.down : G.up) : null;

  // "thinking" / "calling" attribute the bubble's words to the brain. When the
  // trace says the framework wrote them (brainSource:"framework"), tag it
  // neutrally instead of putting the runtime's sentence in the model's mouth.
  const frameworkVoice = step.brainSource === "framework";
  const cloudTag = frameworkVoice ? "what happened" :
    step.kind === "prompt" ? "reading the ask" :
    step.kind === "ask" ? "calling" :
    step.kind === "answer" ? "wrapping up" : "thinking";

  // The model's extended-thinking sits ABOVE the action callout (when present).
  const thinkingEl = step.thinking ? <ThinkingCallout text={step.thinking} /> : null;

  // The bubble column is a BAND of the scene — from its left edge to the rail —
  // rather than a box hanging off the agent, so it can spend the wasted LEFT of
  // the arena and can never reach the tool column. It sits just above the agent's
  // head; `lead` inside it parks a short bubble ON that head (see .thoughtpos).
  const headroom = bubbleHeadroom(iconScale);
  const bandStyle = {
    left: box.bandLeft, width: box.maxW, bottom: h - by + headroom,
    "--af-bubble-lead": box.lead + "px",
  };
  // single bubble hugs above the brain; BOTH = think (teal, left) + act (amber, right) over the brain
  let thought = null, dualThoughts = null;
  if (isBoth) {
    // the pair sits side by side (compact caps + the 12px gap), kept on-screen —
    // and, in rack mode, kept inside the same band the single bubble uses
    const half = box.compactW + 8;
    const right = Math.min(w - half - 12, box.bandRight - half);
    const dualLeft = Math.max(half + 12, Math.min(right, G.bx + 78));
    dualThoughts = (
      <div className="dual-thoughts" style={{ left: dualLeft, bottom: h - by + headroom }}>
        {thinkingEl}
        <Cloud tag={cloudTag} text={step.brain} metaphor={metaphor} compact tone="data" />
        <SkillDoc skill={step.skill} checklist={step.actChecklist} metaphor={metaphor} compact />
      </div>
    );
  } else {
    // the cloud draws a tail down onto the agent's head; the steering doc doesn't
    thought = (
      <div className={"thoughtpos" + (isAct ? "" : " tailed")} style={bandStyle}>
        <span className="tp-lead" aria-hidden="true" />
        <div className="tp-col">
          {thinkingEl}
          {isAct
            ? <SkillDoc skill={step.skill} checklist={step.actChecklist} metaphor={metaphor} />
            : <Cloud tag={cloudTag} text={step.brain} metaphor={metaphor} />}
        </div>
      </div>
    );
  }

  const brainMode = isAct ? "act" : "reason";
  // the name under the figure: the host's `labels.agent` if it set one, else the
  // character's own — plus its small honest second line (the brain has none)
  const who = characterLabel(char, afLabels(resolved).agent);

  return (
    <div className={"scene-inner char-" + char} style={{
      "--af-icon-scale": iconScale,
      "--af-bubble-w": box.maxW + "px",
      "--af-bubble-wc": box.compactW + "px",
      "--af-bubble-h": box.maxBodyH + "px",
      "--af-bubble-tail": box.tail + "px",
    }}>
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

      {/* the agent's thought column — a scene-level BAND (see bandStyle), so it can
          use the free left of the arena without ever reaching the tool column */}
      {thought}

      {/* the agent (left) — the brain mascot by default, or the chosen character.
          It names itself unless the host passed `labels.agent`. */}
      <div className="brain-node" style={{ left: G.bx, top: G.by }}>
        <Brain mode={brainMode} agentIcon={agentIcon} character={char} />
        <div className="brain-label">{who.name}{who.note ? <span className="brain-note">{who.note}</span> : null}</div>
      </div>

      {/* toolbox (right). RACK mode: a vertical rack of every tool, picked one lit
          (the arrow points at it). CARD mode (default): the tool pops out the top
          on a call, with the "saw N" menu beneath. */}
      {useRack ? (
        <div className={"tool-node rack" + (isTool ? "" : " idle")} style={{ left: G.tx, top: rackBox.cy }}>
          <ToolRack view={rackV} onPick={onToolClick} compact={rackCompact} maxH={rackBox.listMaxH}
            pin={rackPin} scrollable={rackBox.overflowing} />
        </div>
      ) : isTool ? (
        <div className="tool-node" style={{ left: G.tx, top: G.ty }}>
          <div className="tool-out">
            <span className="to-ico"><ToolIcon name={step.tool} /></span>
            <span className="to-name">{step.toolName || step.tool}</span>
            <ToolMenu seen={step.toolsSeen} picked={step.tool} />
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

export function Stage({ trace, step, index, metaphor, straight, toolMenu, onToolClick, agentIcon, character }) {
  const sceneRef = sUseRef(null);
  const [dims, setDims] = sUseState({ w: 720, h: 460 });

  // RACK mode shows a STABLE rack across the whole run (so it doesn't reshuffle as
  // you scrub) — the union of every tool the model saw, in first-seen order. The
  // lit row changes per step; the rack itself stays put. Cheap, but memoised.
  const rackTools = React.useMemo(() => {
    if (toolMenu !== "rack") return null;
    const seen = new Map();
    for (const s of trace.steps) for (const t of (s.toolsSeen || [])) if (!seen.has(t.name)) seen.set(t.name, t);
    return [...seen.values()];
  }, [trace, toolMenu]);

  useLayoutEffect(() => {
    const el = sceneRef.current;
    if (!el) return;
    const measure = () => setDims({ w: el.clientWidth, h: el.clientHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const accentClass = step.error ? "k-error" :
    step.kind === "answer" ? "k-answer" :
    step.kind === "prompt" ? "k-prompt" :
    step.kind === "ask" ? "k-call" :
    step.replyType === "both" ? "k-both" :
    step.replyType === "data" ? "k-data" : "k-instr";

  return (
    <div className={"panel stage " + accentClass}>
      <div className="flowscene" ref={sceneRef}>
        <SceneInner key={index} step={step} dims={dims} metaphor={metaphor} straight={straight} toolMenu={toolMenu} rackTools={rackTools} onToolClick={onToolClick} agentIcon={agentIcon} character={character} />
      </div>
    </div>
  );
}
