import { describe, it, expect } from "vitest";
import { influenceLayout, INFLUENCE_LAYOUT } from "../src/influence-layout.js";

const src = (over = {}) => ({ id: "s", score: 0.5, ...over });
const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);

describe("influenceLayout — constants", () => {
  it("freezes the default radial geometry", () => {
    expect(INFLUENCE_LAYOUT).toMatchObject({ size: 360, answerR: 48, orbit: 130, rMin: 14, rMax: 34 });
    expect(Object.isFrozen(INFLUENCE_LAYOUT)).toBe(true);
  });
});

describe("influenceLayout — geometry", () => {
  it("is deterministic — two calls on the same input deep-equal", () => {
    const sources = [src({ id: "a", score: 0.9 }), src({ id: "b", score: 0.2 }), src({ id: "c", score: 0.5 })];
    expect(influenceLayout(sources)).toEqual(influenceLayout(sources));
  });

  it("places rank 1 at 12 o'clock and spaces n nodes evenly clockwise", () => {
    const { nodes, center } = influenceLayout([src({ id: "a" }), src({ id: "b" }), src({ id: "c" }), src({ id: "d" })]);
    // rank 1 (index 0) sits straight up from the centre — angle -π/2, x ≈ centre, y < centre
    expect(nodes[0].angle).toBeCloseTo(-Math.PI / 2, 6);
    expect(nodes[0].x).toBeCloseTo(center.x, 6);
    expect(nodes[0].y).toBeLessThan(center.y);
    // even spacing: each successive node advances by 2π/n
    for (let i = 1; i < nodes.length; i++) {
      expect(nodes[i].angle - nodes[i - 1].angle).toBeCloseTo((2 * Math.PI) / 4, 6);
    }
  });

  it("scales the radius with the score — 0 → rMin, 1 → rMax", () => {
    const { nodes } = influenceLayout([src({ score: 0 }), src({ score: 1 }), src({ score: 0.5 })]);
    expect(nodes[0].r).toBeCloseTo(INFLUENCE_LAYOUT.rMin, 6);
    expect(nodes[1].r).toBeCloseTo(INFLUENCE_LAYOUT.rMax, 6);
    expect(nodes[2].r).toBeCloseTo((INFLUENCE_LAYOUT.rMin + INFLUENCE_LAYOUT.rMax) / 2, 6);
  });

  it("clamps rogue scores before sizing — 1.7 → rMax, -3 and NaN → rMin, never NaN coords", () => {
    const { nodes } = influenceLayout([src({ score: 1.7 }), src({ score: -3 }), src({ score: NaN }), src({ score: undefined })]);
    expect(nodes[0].r).toBeCloseTo(INFLUENCE_LAYOUT.rMax, 6);
    expect(nodes[1].r).toBeCloseTo(INFLUENCE_LAYOUT.rMin, 6);
    expect(nodes[2].r).toBeCloseTo(INFLUENCE_LAYOUT.rMin, 6);
    expect(nodes[3].r).toBeCloseTo(INFLUENCE_LAYOUT.rMin, 6);
    for (const n of nodes) {
      expect(Number.isFinite(n.x)).toBe(true);
      expect(Number.isFinite(n.y)).toBe(true);
      expect([n.edge.x1, n.edge.y1, n.edge.x2, n.edge.y2].every(Number.isFinite)).toBe(true);
    }
  });

  it("keeps every node circle inside the viewBox for n = 1..10", () => {
    for (let n = 1; n <= 10; n++) {
      const sources = Array.from({ length: n }, (_, i) => src({ id: "s" + i, score: 1 })); // worst case = rMax
      const { nodes, size } = influenceLayout(sources);
      for (const node of nodes) {
        expect(node.x - node.r).toBeGreaterThanOrEqual(0);
        expect(node.y - node.r).toBeGreaterThanOrEqual(0);
        expect(node.x + node.r).toBeLessThanOrEqual(size);
        expect(node.y + node.r).toBeLessThanOrEqual(size);
      }
    }
  });

  it("anchors each edge on the answer rim and the node rim", () => {
    const { nodes, center } = influenceLayout([src({ score: 0.9 }), src({ score: 0.3 }), src({ score: 0.6 })]);
    for (const node of nodes) {
      // start point sits on the answer circle (distance from centre ≈ answerR)
      expect(dist(node.edge.x1, node.edge.y1, center.x, center.y)).toBeCloseTo(INFLUENCE_LAYOUT.answerR, 4);
      // end point sits on the node circle (distance from the node centre ≈ r)
      expect(dist(node.edge.x2, node.edge.y2, node.x, node.y)).toBeCloseTo(node.r, 4);
    }
  });

  it("returns just the centre for an empty / non-array source list", () => {
    expect(influenceLayout([]).nodes).toEqual([]);
    expect(influenceLayout(undefined).nodes).toEqual([]);
    expect(influenceLayout([]).center).toEqual({ x: 180, y: 180 });
  });
});
