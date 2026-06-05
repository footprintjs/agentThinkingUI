/* ============================================================
   AgentFootprint — LAYOUT
   Pure geometry for the runtime scene. No React, no DOM — given the
   container size and the brain's vertical anchor, it returns the
   positions + arc paths. Keeping this separate means the visual
   composition can be tuned (or replaced) without touching rendering,
   playback, or theming.
   ============================================================ */
window.AF_LAYOUT = {
  brainX: 0.25,       // brain centre, fraction of width
  brainY: 0.60,       // brain centre, fraction of height (fixed → no per-step jump)
  brainYMobile: 0.72, // mobile pins the brain lower so the callout has room above
  toolX:  0.73,       // toolbox centre, fraction of width
};

// both sweeping arcs + anchors. ask dips LOW to the toolbox; the reply
// rises HIGH, starting from the popped tool card.
window.arcLayout = function arcLayout(w, h, by, straight) {
  const L = window.AF_LAYOUT;
  const bx = w * L.brainX;
  const tx = w * L.toolX, ty = by;
  const bRight = bx + 58, tLeft = tx - 62;
  const midX = (bRight + tLeft) / 2;
  const off = Math.min(106, h * 0.2);
  const toolX = tx - 52, toolY = ty - 52;       // the popped tool card (above the box)

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
};
