import { describe, it, expect } from "vitest";
import { arcLayout, AF_LAYOUT } from "../src/layout.js";

describe("AF_LAYOUT anchors", () => {
  it("uses fixed fractional anchors so the brain/toolbox never jump", () => {
    expect(AF_LAYOUT).toMatchObject({ brainX: 0.25, brainY: 0.6, toolX: 0.73, brainYMobile: 0.72 });
  });
});

describe("arcLayout geometry", () => {
  it("scales brain + toolbox to the container; toolbox sits level with the brain", () => {
    const g = arcLayout(1000, 500, 300, false);
    expect(g.bx).toBe(250); // 0.25 * 1000
    expect(g.tx).toBe(730); // 0.73 * 1000
    expect(g.by).toBe(300);
    expect(g.ty).toBe(300); // ty === by
  });

  it("curved mode draws quadratic arcs with a dip, clamped at 106", () => {
    const g = arcLayout(1000, 500, 300, false);
    expect(g.down.d).toContain("Q");
    expect(g.up.d).toContain("Q");
    expect(g.off).toBe(100); // min(106, 500 * 0.2)
    expect(arcLayout(1000, 2000, 1200, false).off).toBe(106); // clamp on tall scenes
  });

  it("straight (mobile) mode draws two horizontal lanes separated on the y-axis", () => {
    const g = arcLayout(1000, 500, 300, true);
    expect(g.down.d).not.toContain("Q"); // straight line, not a curve
    expect(g.down.d).toContain("L");
    expect(g.down.d).toContain("317"); // by + lane (17)
    expect(g.up.d).toContain("283"); // by - lane (17)
    expect(g.down.ang).toBe(0);
    expect(g.up.ang).toBe(180);
  });

  it("anchors the arrow heads on the right targets (ask → tool, reply → brain)", () => {
    const g = arcLayout(1000, 500, 300, false);
    const bRight = 250 + 58;
    const tLeft = 730 - 62;
    expect(g.down.hx).toBe(tLeft); // the ask ends at the toolbox
    expect(g.up.hx).toBe(bRight); // the reply ends at the brain
  });
});
