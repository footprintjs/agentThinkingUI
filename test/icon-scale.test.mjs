import { describe, it, expect } from "vitest";
import { iconScaleFor, arcLayout, ICON_SCALE, rackPickedY, RACK_ITEM_H } from "../src/layout.js";

/**
 * The cast (brain + toolbox + tool card) shares one scale knob. It is CAPPED at
 * a max (icons never grow past it) and SHRINKS once the container drops below a
 * reference width (responsive on small panels). The same number feeds the CSS
 * icon sizes AND the arc edge offsets, so the connectors always meet the icons.
 */
describe("iconScaleFor — capped + container-responsive", () => {
  it("caps at the max for wide containers", () => {
    expect(iconScaleFor(ICON_SCALE.ref)).toBe(ICON_SCALE.max);
    expect(iconScaleFor(ICON_SCALE.ref * 2)).toBe(ICON_SCALE.max);
    expect(iconScaleFor(99999)).toBe(ICON_SCALE.max);
  });

  it("floors at the min for very narrow containers", () => {
    expect(iconScaleFor(100)).toBe(ICON_SCALE.min);
    expect(iconScaleFor(1)).toBe(ICON_SCALE.min);
  });

  it("shrinks proportionally between the floor and the cap", () => {
    const w = 704; // 704/880 = 0.8, between min(0.56) and max(0.82)
    const s = iconScaleFor(w);
    expect(s).toBeCloseTo(0.8, 5);
    expect(s).toBeGreaterThan(ICON_SCALE.min);
    expect(s).toBeLessThan(ICON_SCALE.max);
  });

  it("never returns outside [min, max] for any width (invariant)", () => {
    for (const w of [0, 1, 50, 300, 600, 880, 1200, 5000]) {
      const s = iconScaleFor(w);
      expect(s).toBeGreaterThanOrEqual(ICON_SCALE.min);
      expect(s).toBeLessThanOrEqual(ICON_SCALE.max);
    }
  });

  it("falls back to the cap when width is missing/unmeasured (0 or undefined)", () => {
    // a transient 0 / undefined width (before the ResizeObserver fires) means
    // "unknown" → default to the cap rather than collapsing to the floor
    expect(iconScaleFor(undefined)).toBe(ICON_SCALE.max);
    expect(iconScaleFor(0)).toBe(ICON_SCALE.max);
  });
});

describe("arcLayout — edge offsets track the icon scale", () => {
  const w = 800, h = 460, by = 276;

  it("defaults to full offsets (backward compatible) when no scale is passed", () => {
    const g = arcLayout(w, h, by, false);
    const bx = w * 0.25, tx = w * 0.73;
    // up-arc head lands on the brain's right edge (bx + 58), down-arc on the toolbox left (tx - 62)
    expect(g.up.hx).toBeCloseTo(bx + 58, 5);
    expect(g.down.hx).toBeCloseTo(tx - 62, 5);
  });

  it("pulls the BRAIN-end arrowhead inward as the brain shrinks, leaving the toolbox end fixed", () => {
    const scale = 0.5;
    const g = arcLayout(w, h, by, false, scale);
    const bx = w * 0.25, tx = w * 0.73;
    // only the brain shrinks → its arrowhead moves in; the toolbox stays full size
    expect(g.up.hx).toBeCloseTo(bx + 58 * scale, 5);
    expect(g.down.hx).toBeCloseTo(tx - 62, 5);
  });

  it("aims the tool-END arrowhead at `toolY` (rack mode points it at the picked row)", () => {
    const toolY = by + 90; // a row below centre
    const g = arcLayout(w, h, by, false, 1, toolY);
    expect(g.down.hy).toBeCloseTo(toolY + 10, 5); // down-arc ends at the picked row
    // the brain end is unaffected
    const bx = w * 0.25;
    expect(g.up.hx).toBeCloseTo(bx + 58, 5);
  });

  it("defaults the tool-END y to centre when toolY is omitted", () => {
    const g = arcLayout(w, h, by, false, 1);
    expect(g.down.hy).toBeCloseTo(by + 10, 5);
  });

  it("rack mode: brain→tool 'ask' is STRAIGHT, tool→brain 'reply' stays CURVED", () => {
    const g = arcLayout(w, h, by, false, 1, by + 40, true); // straightLine = true
    expect(g.down.d).toMatch(/ L /); // ask = straight line
    expect(g.down.d).not.toMatch(/ Q /);
    expect(g.up.d).toMatch(/ Q /); // reply = curved (like the old one)
  });

  it("card mode: both arcs are curved", () => {
    const g = arcLayout(w, h, by, false, 1, by, false);
    expect(g.down.d).toMatch(/ Q /);
    expect(g.up.d).toMatch(/ Q /);
  });
});

describe("rackPickedY — arrow target for the picked rack row", () => {
  const cy = 276;
  it("centres the middle row on the rack centre", () => {
    // 1 row of 1 → centre
    expect(rackPickedY(cy, 1, 0)).toBeCloseTo(cy, 5);
    // 3 rows, middle row (index 1) → centre
    expect(rackPickedY(cy, 3, 1)).toBeCloseTo(cy, 5);
  });
  it("places the top row above and the bottom row below by half-spans", () => {
    expect(rackPickedY(cy, 4, 0)).toBeCloseTo(cy + (0 + 0.5 - 2) * RACK_ITEM_H, 5); // top
    expect(rackPickedY(cy, 4, 3)).toBeCloseTo(cy + (3 + 0.5 - 2) * RACK_ITEM_H, 5); // bottom
    expect(rackPickedY(cy, 4, 0)).toBeLessThan(cy);
    expect(rackPickedY(cy, 4, 3)).toBeGreaterThan(cy);
  });
  it("falls back to the centre with no count / no pick", () => {
    expect(rackPickedY(cy, 0, -1)).toBe(cy);
    expect(rackPickedY(cy, 4, -1)).toBe(cy);
  });
});
