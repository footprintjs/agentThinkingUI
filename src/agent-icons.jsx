import React from "react";

/* ============================================================
   AgentThinkingUI — the agent's face.
   A small set of stroke glyphs for the figure at the centre of the scene,
   drawn on ONE 48×48 grid with ONE stroke weight and round caps/joins — the
   same look as the tool icons around them (ToolIcon / MenuGlyph), just bigger.
   They inherit the theme's brain gradient, so a re-theme re-colours them.

   Pick one with the `agentIcon` prop ("robot" | "sparkle" | "footsteps", or
   "brain" for the animated mascot, which stays the default). Pass your own
   node instead — `agentIcon={<MyLogo/>}` — to draw anything at all.
   ============================================================ */

// The built-in set. "brain" is the animated mascot in stage.jsx (the default);
// the rest are the stroke glyphs below.
export const AGENT_ICON_NAMES = ["brain", "robot", "sparkle", "footsteps"];

export function isAgentIconName(v) {
  return typeof v === "string" && AGENT_ICON_NAMES.indexOf(v) !== -1;
}

// One footprint: a sole with four toes, drawn around its own origin so the pair
// can be placed + rotated as a walking stride.
function Foot({ x, y, rot, className }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${rot})`} className={className}>
      {/* a sole, not a ring: wide at the ball, pinched at the arch, rounded heel */}
      <path d="M-4.8-4.2c0-3.8 2-6.2 4.9-6.2s4.9 2.3 4.9 5.7c0 3-1.7 4.6-2.1 6.6-.4 2 .9 2.8.9 4.8 0 2.4-1.6 4-3.7 4s-3.7-1.6-3.7-3.9c0-2 1-2.7.6-4.7-.4-2-1.8-3.5-1.8-6.3Z" />
      <path d="M-3.6-12.4h0M-1.1-13.6h0M1.5-13.4h0M3.9-12h0" strokeWidth="2.4" />
    </g>
  );
}

// The art, on a 48×48 grid. Each glyph carries exactly one `.ai-pulse` element —
// the part that breathes while the agent thinks (see styles.css).
const ART = {
  robot: (
    <g>
      <circle className="ai-pulse" cx="24" cy="4.6" r="1.9" />
      <path d="M24 6.6v3.8" />
      <rect x="10" y="10.4" width="28" height="23" rx="7.5" />
      <path d="M10 19.5H7a2.5 2.5 0 0 0-2.5 2.5v2.4A2.5 2.5 0 0 0 7 26.9h3" />
      <path d="M38 19.5h3a2.5 2.5 0 0 1 2.5 2.5v2.4a2.5 2.5 0 0 1-2.5 2.5h-3" />
      {/* filled dots, not zero-length strokes: a gradient paint server skips an
          element whose bounding box is flat in either axis (two dots on one
          baseline are), so the eyes would silently vanish */}
      <circle cx="18" cy="20.2" r="2.3" fill="url(#afAgentG)" stroke="none" />
      <circle cx="30" cy="20.2" r="2.3" fill="url(#afAgentG)" stroke="none" />
      <path d="M19.4 27.4c1.9 1.9 7.3 1.9 9.2 0" />
      <path d="M24 33.4v3.4" />
      <path d="M13.6 44.4v-2.6a5.4 5.4 0 0 1 5.4-5.4h10a5.4 5.4 0 0 1 5.4 5.4v2.6" />
    </g>
  ),
  sparkle: (
    <g>
      <path d="M21 6q2.4 13.2 15 15.2Q23.4 23.2 21 36.4 18.6 23.2 6 21.2 18.6 19.2 21 6Z" />
      <path className="ai-pulse" d="M36.4 28.6q1 6 6 6.8-5 .8-6 6.8-1-6-6-6.8 5-.8 6-6.8Z" />
    </g>
  ),
  footsteps: (
    <g>
      <Foot x={13} y={30} rot={-16} />
      <Foot x={32} y={17} rot={-16} className="ai-pulse" />
    </g>
  ),
};

// One built-in glyph. Sized + scaled by the shared `.brain` box, so it stands
// exactly where the mascot stood: same anchor, same label offset, same arcs —
// and the thought bubble's tail still lands on its head.
export function AgentIconGlyph({ name, mode }) {
  const art = ART[name];
  if (!art) return null;
  return (
    <div className={"brain agent-icon ai-" + name + " " + (mode === "act" ? "acting" : "thinking")}>
      <svg
        className="agent-icon-svg" viewBox="0 0 48 48" aria-hidden="true"
        fill="none" stroke="url(#afAgentG)" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"
      >
        <defs>
          <linearGradient id="afAgentG" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="var(--brain-from)" />
            <stop offset="1" stopColor="var(--brain-to)" />
          </linearGradient>
        </defs>
        {art}
      </svg>
    </div>
  );
}
