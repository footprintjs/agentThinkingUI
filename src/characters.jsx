import React from "react";

/* ============================================================
   AgentThinkingUI — the scene's CHARACTERS.

   Who the story's protagonist is. `character="brain"` (the DEFAULT) is the
   animated mascot drawn in stage.jsx — published pedagogy, so no scene changes
   unless a host asks. `character="ops-bot"` is the family mascot: the footprint
   sole is its torso and the sole's four toes are its status LEDs, one amber
   because somebody is on watch.

   A character carries its art AND its own name, because the two must agree: the
   brain keeps whatever the theme calls it ("LLM as Human Brain"), the robot says
   plainly who is standing there. An explicit `labels.agent` still wins over both.

   This is a registry, not a switch — a new face is one entry plus its art.
   ============================================================ */

/* --- the art -------------------------------------------------------------
   Ops-Bot is drawn on the family's canonical 116×118 canvas, in ONE palette
   (no theme tokens: it reads on light AND on dark). The paths are the owner's,
   untouched; the only additions are class hooks for the mood system and the
   "acting" mouth. The viewBox is PANNED by 16 (its size is the canonical
   116×118) because the figure is drawn around x=74 — dead-centre vertically,
   16 right of centre horizontally — and it has to stand on the agent's anchor,
   where the label, the connector arcs and the bubble's tail all point.

   Motion is CSS-only (styles.css, "ops-bot") and honours prefers-reduced-motion.
   No SMIL: an <animate> inside an <img> freezes. */
export function OpsBot({ mode }) {
  return (
    <div className={"brain ops-bot " + (mode === "act" ? "acting" : "thinking")}>
      <svg className="ops-bot-svg" viewBox="16 0 116 118" aria-hidden="true">
        {/* antenna — mast, beacon (the light that breathes while it thinks) and two signal arcs */}
        <path d="M84 12q6 6 0 12" stroke="#f0a24c" strokeWidth="2.4" fill="none" strokeLinecap="round" />
        <path d="M90 8q10 10 0 20" stroke="#f0a24c" strokeWidth="2.4" fill="none" strokeLinecap="round" opacity=".7" />
        <line x1="74" y1="14" x2="74" y2="26" stroke="#28607f" strokeWidth="3" strokeLinecap="round" />
        <circle className="ob-beacon" cx="74" cy="12" r="4" fill="#f0a24c" />
        {/* head + face */}
        <rect x="52" y="26" width="44" height="32" rx="10" fill="#3b93bf" />
        <circle className="ob-eye" cx="66" cy="42" r="4" fill="#0d2a3a" /><circle className="ob-eye" cx="82" cy="42" r="4" fill="#0d2a3a" />
        <path className="ob-mouth" d="M67 51q7 4 14 0" stroke="#0d2a3a" strokeWidth="2.4" fill="none" strokeLinecap="round" />
        {/* the ACT mouth: an "o", the same beat the mascot's mouth keeps (hidden while thinking) */}
        <circle className="ob-mouth-o" cx="74" cy="52" r="3.2" stroke="#0d2a3a" strokeWidth="2.4" fill="none" />
        {/* torso = the footprint sole; its four toes are the status LEDs (one amber = on watch) */}
        <path d="M74 60c-16 0-24 12-22 26 2 12 10 22 22 22s20-10 22-22c2-14-6-26-22-26z" fill="#5eb3d6" />
        <circle cx="62" cy="76" r="3" fill="#e9f7fb" /><circle cx="70" cy="72" r="3" fill="#e9f7fb" /><circle cx="78" cy="72" r="3" fill="#f0a24c" /><circle cx="86" cy="76" r="3" fill="#e9f7fb" />
        <ellipse cx="64" cy="110" rx="6" ry="4.2" fill="#28607f" /><ellipse cx="84" cy="110" rx="6" ry="4.2" fill="#28607f" />
      </svg>
    </div>
  );
}

/* --- the registry --------------------------------------------------------
   `Art: null` = the built-in mascot in stage.jsx (kept there: it is also the
   figure <MultiAgentFlow> and <BacktrackView> draw). `label: null` = "named by
   the theme, as it always has been" — the brain answers to `labels.agent` and
   to its own defaults, and this feature must not put a word in its mouth.
   `note` is the small honest second line under the name; the brain has none,
   because its name already says what it is. */
export const CHARACTERS = {
  brain:     { label: null,      note: null,                Art: null },
  "ops-bot": { label: "Ops-Bot", note: "the agent at work", Art: OpsBot },
};

/** the built-in names, mascot first — e.g. to build a picker */
export const CHARACTER_NAMES = ["brain", "ops-bot"];

export function isCharacterName(v) {
  return typeof v === "string" && CHARACTER_NAMES.indexOf(v) !== -1;
}

/** the character, defaulted — an unknown name is the brain, never a blank stage */
export function characterOf(v) {
  return isCharacterName(v) ? v : "brain";
}

// The two names the brain has ever answered to on its own: the container's
// default and the standalone <Stage> fallback. Anything else in `labels.agent`
// came from the HOST, and a host's name always wins over a character's.
const BRAIN_LABELS = ["LLM as Human Brain", "LLM brain"];

/**
 * What to write under the figure: `{ name, note }`.
 * The host's `labels.agent` wins; otherwise a character that brought a name of
 * its own uses it; otherwise the label is left exactly as the theme resolved it.
 */
export function characterLabel(character, hostLabel) {
  const C = CHARACTERS[characterOf(character)];
  const hostNamed = hostLabel && BRAIN_LABELS.indexOf(hostLabel) === -1;
  return { name: (!hostNamed && C.label) || hostLabel, note: C.note };
}
