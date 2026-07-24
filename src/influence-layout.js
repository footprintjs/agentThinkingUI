/* ============================================================
   AgentThinkingUI — INFLUENCE MAP layout
   Pure geometry for the radial influence map. No React, no DOM —
   given the ranked source list (each with a 0..1 proxy score), it
   returns the answer centre + one orbiting node per source, sized by
   its clamped score, with the answer→node edge endpoints on the two
   rims. Keeping this separate means the drawing can be tuned (or
   replaced) without touching rendering, honesty copy, or the re-run
   seam. Precedent: layout.js / flow-layout.js.
   ============================================================ */
export const INFLUENCE_LAYOUT = Object.freeze({
  size: 360,   // square viewBox side
  answerR: 48, // centre (answer) node radius
  orbit: 130,  // ring radius for source nodes
  rMin: 14,    // node radius at score 0
  rMax: 34,    // node radius at score 1
});

// clamp a proxy score to [0,1] — scores are estimates, so a NaN / negative /
// out-of-range value must never blow up the drawing (mirrors the bt-meter clamp).
function clampScore(v) {
  return Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0;
}

/**
 * Radial layout for the influence map. `sources` is the ranked source list
 * (rank 1 first). Rank 1 sits at 12 o'clock; the rest space out clockwise.
 * Node radius scales with the clamped score; the edge runs from the answer
 * rim to the node rim along the unit vector. Deterministic — pure function of
 * the input order + scores.
 */
export function influenceLayout(sources, opts = {}) {
  const L = { ...INFLUENCE_LAYOUT, ...opts };
  const c = L.size / 2;
  const list = Array.isArray(sources) ? sources : [];
  const n = list.length;
  const nodes = list.map((s, i) => {
    const score = clampScore(s && s.score);
    const angle = -Math.PI / 2 + (i * 2 * Math.PI) / (n || 1); // rank 1 at 12 o'clock, clockwise
    const x = c + L.orbit * Math.cos(angle);
    const y = c + L.orbit * Math.sin(angle);
    const r = L.rMin + score * (L.rMax - L.rMin);
    // edge from the answer rim to the node rim along the unit vector
    const ex1 = c + L.answerR * Math.cos(angle);
    const ey1 = c + L.answerR * Math.sin(angle);
    const ex2 = x - r * Math.cos(angle);
    const ey2 = y - r * Math.sin(angle);
    return { id: s && s.id, x, y, r, angle, score, edge: { x1: ex1, y1: ey1, x2: ex2, y2: ey2 } };
  });
  return { size: L.size, center: { x: c, y: c }, nodes };
}
