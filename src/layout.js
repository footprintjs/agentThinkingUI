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

// both sweeping arcs + anchors. ask dips LOW to the toolbox; the reply
// rises HIGH, starting from the popped tool card.
export function arcLayout(w, h, by, straight, iconScale = 1) {
  const L = AF_LAYOUT;
  const bx = w * L.brainX;
  const tx = w * L.toolX, ty = by;
  // only the BRAIN shrinks (its edge offset tracks iconScale); the toolbox stays
  // full size so the tool card + "saw N" menu remain readable → tLeft is fixed
  const bRight = bx + 58 * iconScale, tLeft = tx - 62;
  const midX = (bRight + tLeft) / 2;
  const off = Math.min(106, h * 0.2);

  if (straight) {
    // two parallel horizontal lanes, clearly separated on the y-axis
    const lane = 17;
    return {
      down: { d: `M ${bRight} ${by + lane} L ${tLeft} ${ty + lane}`, hx: tLeft, hy: ty + lane, ang: 0 },
      up:   { d: `M ${tLeft} ${ty - lane} L ${bRight} ${by - lane}`, hx: bRight, hy: by - lane, ang: 180 },
      bx, by, tx, ty, midX, off,
    };
  }

  const down = {
    d: `M ${bRight} ${by + 10} Q ${midX} ${by + off} ${tLeft} ${ty + 10}`,
    hx: tLeft, hy: ty + 10, ang: Math.atan2((ty + 10) - (by + off), tLeft - midX) * 180 / Math.PI,
  };
  const up = {
    d: `M ${tLeft} ${ty - 10} Q ${midX} ${by - off} ${bRight} ${by - 10}`,
    hx: bRight, hy: by - 10, ang: Math.atan2((by - 10) - (by - off), bRight - midX) * 180 / Math.PI,
  };
  return { down, up, bx, by, tx, ty, midX, off };
}
