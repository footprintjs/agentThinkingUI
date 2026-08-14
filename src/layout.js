/* ============================================================
   AgentThinkingUI — LAYOUT
   Pure geometry for the runtime scene. No React, no DOM — given the
   container size and the brain's vertical anchor, it returns the
   positions + arc paths. Keeping this separate means the visual
   composition can be tuned (or replaced) without touching rendering,
   playback, or theming.
   ============================================================ */
export const AF_LAYOUT = {
  brainX: 0.25,       // brain centre, fraction of width
  brainY: 0.60,       // brain centre, fraction of height (fixed → no per-step jump)
  brainYMobile: 0.72, // mobile pins the brain lower so the callout has room above
  toolX:  0.73,       // toolbox centre, fraction of width
};

// One knob for the cast (brain + toolbox + tool card). It drives BOTH the CSS
// icon sizes (via the `--af-icon-scale` custom property the scene sets) AND the
// arc edge offsets below, so the connectors always meet the icons at any size.
// Capped at `max` (icons never grow past it → a fixed ceiling) and shrinks once
// the container drops below `ref` (responsive on small panels).
export const ICON_SCALE = { max: 0.82, min: 0.56, ref: 880 };
export function iconScaleFor(w) {
  const s = (w || ICON_SCALE.ref) / ICON_SCALE.ref;
  return Math.max(ICON_SCALE.min, Math.min(ICON_SCALE.max, s));
}

/* ---- the thought bubble's size budget ------------------------------------
   A bubble is `width: max-content` under a max-width, so three words stay snug
   and a long body wraps. What decides WHERE it wraps is that cap — and a FIXED
   cap (the old 268px) turns a markdown body into a very tall column: the same
   text at 268px wide ran ~412px tall, overflowing a 460px scene. So the cap is
   MEASURED from the container: a fraction of the scene width, clamped to a
   readable line, and quantised so text streaming in can't jitter the width.

   Height is the LAST resort. A bubble hangs above the agent, so its room is
   everything between the top of the scene and the agent's head; only past that
   does the body scroll inside the bubble. */
export const BUBBLE = {
  frac: 0.70,        // of the scene width — the widest a bubble may grow
  min: 232,          // …but never narrower than a comfortable line
  max: 624,          // …nor wider than a comfortable measure
  gutter: 24,        // keep the cap inside a very narrow scene
  step: 8,           // quantise the cap → a 1px resize can't restyle the bubble
  ref: 880,          // fallback scene width when unmeasured (0/undefined)
  refH: 460,         // …and height
  compactFrac: 0.46, // the side-by-side (data + instruction) pair share the budget
  compactMin: 168,
  agent: 61,         // the agent's half-box + the bubble's margin, below the bubble
  crown: 8,          // breathing room above the bubble
  chrome: 58,        // the bubble's own padding + hand-written tag
  minBody: 120,      // scroll rather than shrink the body past this…
  hardMinBody: 56,   // …unless the scene is SHORTER than that: a squeezed panel
                     // gets a smaller bubble (down to ~3 lines) rather than one
                     // that spills past the top of the scene and gets clipped
  maxBody: 420,
};

const quantise = (v, step) => Math.round(v / step) * step;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// Width cap (+ the compact pair's cap, + the body-height cap) for the thought
// bubbles, from the MEASURED scene. A `w`/`h` of 0 or undefined means "not
// measured yet" → fall back to the reference size (same convention as
// iconScaleFor). Pure: the browser still does the measuring of the TEXT.
export function bubbleBoxFor(w, h, brainY = AF_LAYOUT.brainY) {
  const W = w || BUBBLE.ref, H = h || BUBBLE.refH;
  const hi = clamp(W - BUBBLE.gutter, 120, BUBBLE.max);
  const lo = Math.min(BUBBLE.min, hi);
  const maxW = clamp(quantise(W * BUBBLE.frac, BUBBLE.step), lo, hi);
  const compactW = Math.max(Math.min(BUBBLE.compactMin, maxW), quantise(maxW * BUBBLE.compactFrac, BUBBLE.step));
  const avail = Math.round(H * brainY - BUBBLE.agent - BUBBLE.crown - BUBBLE.chrome);
  const floor = Math.min(BUBBLE.minBody, Math.max(BUBBLE.hardMinBody, avail));
  const maxBodyH = clamp(avail, floor, BUBBLE.maxBody);
  return { maxW, compactW, maxBodyH };
}

// The bubble's tail sits this far from its LEFT edge (not its centre): the
// column is anchored so the tail lands on the agent's head, which is what lets
// a wide bubble grow rightward into the scene instead of off the left edge.
export const BUBBLE_TAIL_X = 44;

// Rack ("toolMenu: 'rack'") row pitch in px — the vertical distance between tool
// rows. Single source for BOTH the CSS row height (--tr-item-h, set inline) and
// the arrow geometry (rackPickedY), so the arrowhead lands dead-centre on a row.
export const RACK_ITEM_H = 48;
// Vertical centre of the picked tool's row, for a rack centred on `cy`. Rows are
// stacked top→bottom; the block is centred so row `index` of `count` sits at
// cy + (index + 0.5 − count/2) × itemH.
export function rackPickedY(cy, count, index, itemH = RACK_ITEM_H) {
  if (!count || index < 0) return cy;
  return cy + (index + 0.5 - count / 2) * itemH;
}

// both sweeping arcs + anchors. ask dips LOW to the toolbox; the reply
// rises HIGH, starting from the popped tool card.
export function arcLayout(w, h, by, straight, iconScale = 1, toolY = by, straightLine = false) {
  const L = AF_LAYOUT;
  const bx = w * L.brainX;
  const tx = w * L.toolX, ty = by;
  // only the BRAIN shrinks (its edge offset tracks iconScale); the toolbox stays
  // full size so the tool card + "saw N" menu remain readable → tLeft is fixed.
  // `toolY` is the tool-END y: defaults to centre (ty), but rack mode points it
  // at the picked tool's row so the arrowhead lands on the chosen tool.
  const bRight = bx + 58 * iconScale, tLeft = tx - 62;
  const midX = (bRight + tLeft) / 2;
  const off = Math.min(106, h * 0.2);

  if (straight) {
    // two parallel horizontal lanes, clearly separated on the y-axis
    const lane = 17;
    return {
      down: { d: `M ${bRight} ${by + lane} L ${tLeft} ${toolY + lane}`, hx: tLeft, hy: toolY + lane, ang: 0 },
      up:   { d: `M ${tLeft} ${toolY - lane} L ${bRight} ${by - lane}`, hx: bRight, hy: by - lane, ang: 180 },
      bx, by, tx, ty, midX, off,
    };
  }

  // RACK mode draws the brain→tool "ask" as a STRAIGHT line (it points right at
  // the picked row — cleaner than a sweep). The tool→brain "reply" stays CURVED
  // (like the old one), and CARD mode keeps both curved to the toolbox.
  const down = straightLine ? {
    d: `M ${bRight} ${by + 10} L ${tLeft} ${toolY + 10}`,
    hx: tLeft, hy: toolY + 10, ang: Math.atan2((toolY + 10) - (by + 10), tLeft - bRight) * 180 / Math.PI,
  } : {
    d: `M ${bRight} ${by + 10} Q ${midX} ${by + off} ${tLeft} ${toolY + 10}`,
    hx: tLeft, hy: toolY + 10, ang: Math.atan2((toolY + 10) - (by + off), tLeft - midX) * 180 / Math.PI,
  };
  const up = {
    d: `M ${tLeft} ${toolY - 10} Q ${midX} ${by - off} ${bRight} ${by - 10}`,
    hx: bRight, hy: by - 10, ang: Math.atan2((by - 10) - (by - off), bRight - midX) * 180 / Math.PI,
  };
  return { down, up, bx, by, tx, ty, midX, off };
}
