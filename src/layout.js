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
  edge: 12,          // the band's left inset — the bubble may reach this far left
  rail: 16,          // …and must stop this far short of the tool column (the rack)
  step: 8,           // quantise the cap → a 1px resize can't restyle the bubble
  ref: 880,          // fallback scene width when unmeasured (0/undefined)
  refH: 460,         // …and height
  compactFrac: 0.46, // the side-by-side (data + instruction) pair share the budget
  compactMin: 168,
  agent: 61,         // the agent's half-box + the bubble's margin, below the bubble
                     // (bubbleHeadroom() is the same distance, tracking icon scale)
  crown: 8,          // breathing room above the bubble
  chrome: 58,        // the bubble's own padding + hand-written tag
  minBody: 120,      // scroll rather than shrink the body past this…
  hardMinBody: 56,   // …unless the scene is SHORTER than that: a squeezed panel
                     // gets a smaller bubble (down to ~3 lines) rather than one
                     // that spills past the top of the scene and gets clipped
  maxBody: 420,
};

// The gap between the agent's centre and the BOTTOM of its thought column: the
// mascot's half-height (which tracks --af-icon-scale) plus the bubble's margin.
// BUBBLE.agent is the same distance at scale 1, used for the height budget.
export function bubbleHeadroom(iconScale = 1) {
  return Math.round(49 * iconScale + 12);
}

const quantise = (v, step) => Math.round(v / step) * step;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// Width cap (+ the compact pair's cap, + the body-height cap) for the thought
// bubbles, from the MEASURED scene. A `w`/`h` of 0 or undefined means "not
// measured yet" → fall back to the reference size (same convention as
// iconScaleFor). Pure: the browser still does the measuring of the TEXT.
//
// `railLeft` (optional) is the x of the tool column's left edge — the rack's, in
// rack mode. Given one, the bubble's budget becomes the BAND that ends before it
// (edge → railLeft − rail) instead of a fraction of the whole scene: a bubble
// then cannot reach the rack at any body length, and the room it spends is the
// wasted LEFT of the scene rather than the rack's column. The returned band
// (bandLeft/bandRight) + `lead` are what the scene hands to CSS; see the
// .thoughtpos rules in styles.css for how the lead makes the bubble grow
// rightward first and leftward only once the right-hand room is used up.
export function bubbleBoxFor(w, h, brainY = AF_LAYOUT.brainY, railLeft = 0) {
  const W = w || BUBBLE.ref, H = h || BUBBLE.refH;
  const hi = clamp(W - BUBBLE.gutter, 120, BUBBLE.max);
  const lo = Math.min(BUBBLE.min, hi);
  // the widest the bubble may EVER grow: the band when there is a rail to keep
  // clear of, the old fraction-of-the-scene budget when there isn't
  const ceiling = railLeft > 0 ? Math.max(120, Math.floor(railLeft - BUBBLE.rail - BUBBLE.edge)) : hi;
  const top = Math.min(hi, ceiling);
  // the band is quantised DOWN (a rounded-up cap would poke past the rail)
  const want = railLeft > 0 ? Math.floor(ceiling / BUBBLE.step) * BUBBLE.step : quantise(W * BUBBLE.frac, BUBBLE.step);
  const maxW = clamp(want, Math.min(lo, top), top);
  const compactW = Math.max(Math.min(BUBBLE.compactMin, maxW), quantise(maxW * BUBBLE.compactFrac, BUBBLE.step));
  const avail = Math.round(H * brainY - BUBBLE.agent - BUBBLE.crown - BUBBLE.chrome);
  const floor = Math.min(BUBBLE.minBody, Math.max(BUBBLE.hardMinBody, avail));
  const maxBodyH = clamp(avail, floor, BUBBLE.maxBody);
  // where the band sits, where the tail lands inside it, and the shrinkable lead
  // that parks a SHORT bubble on the agent's head (see .thoughtpos)
  const bandLeft = BUBBLE.edge;
  const bx = W * AF_LAYOUT.brainX;
  const tail = Math.max(BUBBLE_TAIL_X, Math.round(bx - bandLeft));
  const lead = Math.max(0, Math.round(bx - BUBBLE_TAIL_X - bandLeft));
  return { maxW, compactW, maxBodyH, bandLeft, bandRight: bandLeft + maxW, tail, lead };
}

// The MINIMUM distance from a bubble's left edge to its tail — i.e. where a short
// bubble parks itself relative to the agent's head (`lead`, above). A bubble that
// has slid further left sits with the tail deeper inside it; the band, not the
// bubble, draws the tail, so the offset is free to grow.
export const BUBBLE_TAIL_X = 44;

// Rack ("toolMenu: 'rack'") row pitch in px — the vertical distance between tool
// rows. Single source for BOTH the CSS row height (--tr-item-h, set inline) and
// the arrow geometry (rackPickedY), so the arrowhead lands dead-centre on a row.
export const RACK_ITEM_H = 48;

/* ---- the rack's own box --------------------------------------------------
   The rack is a COLUMN of a known width (not a content-sized blob): that is what
   lets the geometry say, without measuring the DOM, where its left edge is — the
   bubble's band ends there, and the "ask" arrow stops just short of it.

   Its HEIGHT is budgeted from the scene the same way the bubble's is, but the
   rack no longer HIDES the tools that don't fit: EVERY tool is a row and the
   list scrolls. What makes that safe for the story — "the model picked THIS one
   out of N" — is the PIN: the picked row is sticky inside the list, so it never
   scrolls away, and (rackPinFor) it is pinned at ONE deterministic slot, which
   is what keeps the arrow's target pure geometry instead of a scroll listener. */
export const RACK = {
  w: 152,        // the rack column's width (labelled rows)
  wCompact: 64,  // …icons only, when the arena is too narrow to carry both
  chrome: 15,    // the rack frame's own padding + border
  why: 40,       // the "Why this tool?" button that hangs BELOW the frame
  margin: 12,    // keep the frame off the top/bottom edge of the scene
  gap: 16,       // clear air between the bubble's band and the rack
  arrow: 8,      // …and between the rack and the "ask" arrowhead
};

// How far LEFT of the tool centre the "ask" arrow must stop in rack mode, so the
// arrowhead lands just outside the rack instead of under its first column of rows.
export function rackArrowInset(compact) {
  return (compact ? RACK.wCompact : RACK.w) / 2 + RACK.arrow;
}

// x of the rack column's left edge — the line the thought bubble must stay left of.
export function rackRailLeft(w, compact) {
  return (w || BUBBLE.ref) * AF_LAYOUT.toolX - (compact ? RACK.wCompact : RACK.w) / 2;
}

// A labelled rack would leave the bubble narrower than a readable line on a
// narrow arena — there, the rack drops its labels (icons only, names still in
// the tooltip + aria) so BOTH fit. The alternative is a bubble squeezed to ~150px.
export function rackIsCompact(w) {
  return rackRailLeft(w, false) - RACK.gap - BUBBLE.edge < BUBBLE.min;
}

// The rack's vertical budget, from the MEASURED scene (pure — same contract as
// bubbleBoxFor): how tall its scrolling list may get, the height the frame will
// render at, whether the tools overflow that room, and the y it must be centred
// on so that neither it nor its "Why this tool?" button leaves the arena.
// EVERY tool is a row (`rowCount === count`); when they don't all fit, the list
// scrolls and the picked row is pinned (rackPinFor) rather than folded away.
export function rackBoxFor(h, count, by, hasWhy = true, itemH = RACK_ITEM_H) {
  const H = h || BUBBLE.refH;
  const below = hasWhy ? RACK.why : 0;
  const band = Math.max(itemH + RACK.chrome, H - 2 * RACK.margin - below);
  const listMaxH = band - RACK.chrome;                       // the rows' own room
  const rowCount = count || 0;
  const height = Math.min(rowCount * itemH, listMaxH) + RACK.chrome;
  // centre it on the agent's line when it fits; otherwise slide it into the scene
  const half = height / 2;
  const lo = RACK.margin + half, hi = H - RACK.margin - below - half;
  const want = by == null ? H * AF_LAYOUT.brainY : by;
  const cy = Math.round(hi < lo ? (lo + hi) / 2 : clamp(want, lo, hi));
  return { rowCount, listMaxH, height, cy, overflowing: rowCount * itemH > listMaxH };
}

/* ---- the PIN -------------------------------------------------------------
   When the tools outrun the room, the list scrolls — and a scrolling list would
   carry the picked tool out of sight, taking the arrow's target with it. So the
   picked row is STICKY, and pinned at exactly ONE slot:

     scrollTop  the list is scrolled to on entry, so the picked row lands on its
                preferred slot (the middle of the viewport) WITHOUT being moved
                off its natural position — no hole, nothing displaced, at rest.
     top/bottom the sticky insets. They describe a band exactly one row tall, so
                the row is held at `top` at EVERY scroll position: at rest it is
                already there, and once the reader scrolls, the sticky rules keep
                it there while the other rows slide past.

   That is the whole reason the arrow needs no scroll listener and no measuring:
   `top` is computed here, before anything renders. Returns null when there is
   nothing to pin (no pick, or the whole rack fits). */
export function rackPinFor(count, pickedIndex, listMaxH, itemH = RACK_ITEM_H) {
  if (!count || pickedIndex == null || pickedIndex < 0) return null;
  const maxScroll = Math.max(0, count * itemH - listMaxH);
  if (maxScroll <= 0) return null;              // it all fits: rows keep their places
  const natural = pickedIndex * itemH;
  const preferred = Math.max(0, Math.round((listMaxH - itemH) / 2));
  const scrollTop = clamp(natural - preferred, 0, maxScroll);
  const top = natural - scrollTop;
  return { scrollTop, top, bottom: Math.max(0, listMaxH - itemH - top) };
}

// Vertical centre of the picked tool's row, for a rack centred on `cy`. Rows are
// stacked top→bottom; the block is centred so row `index` of `count` sits at
// cy + (index + 0.5 − count/2) × itemH.
export function rackPickedY(cy, count, index, itemH = RACK_ITEM_H) {
  if (!count || index < 0) return cy;
  return cy + (index + 0.5 - count / 2) * itemH;
}

// Where the "ask" arrow must land. A rack that fits points at the picked row
// where it sits; a scrolling one points at the PINNED slot — which is a fixed
// offset inside the list, so this stays pure geometry at any scroll position.
// No pick (the model is only thinking) → the rack's own centre.
export function rackArrowY(box, pickedIndex, pin, itemH = RACK_ITEM_H) {
  if (!box || pickedIndex == null || pickedIndex < 0) return box ? box.cy : 0;
  if (pin) return box.cy - box.listMaxH / 2 + pin.top + itemH / 2;
  return rackPickedY(box.cy, box.rowCount, pickedIndex, itemH);
}

// both sweeping arcs + anchors. ask dips LOW to the toolbox; the reply
// rises HIGH, starting from the popped tool card.
export function arcLayout(w, h, by, straight, iconScale = 1, toolY = by, straightLine = false, toolInset = 62) {
  const L = AF_LAYOUT;
  const bx = w * L.brainX;
  const tx = w * L.toolX, ty = by;
  // only the BRAIN shrinks (its edge offset tracks iconScale); the toolbox stays
  // full size so the tool card + "saw N" menu remain readable → tLeft is fixed.
  // `toolY` is the tool-END y: defaults to centre (ty), but rack mode points it
  // at the picked tool's row so the arrowhead lands on the chosen tool.
  // `toolInset` is how far LEFT of the tool centre the arrow stops — the toolbox's
  // own 62px by default, the rack's half-width in rack mode (a wide rack would
  // otherwise swallow the arrowhead).
  const bRight = bx + 58 * iconScale, tLeft = tx - toolInset;
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
