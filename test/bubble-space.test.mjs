import React from "react";
import fs from "node:fs";
import path from "node:path";
import { describe, it, expect, afterEach, beforeEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { Stage } from "../src/stage.jsx";
import { bubbleBoxFor, BUBBLE, BUBBLE_TAIL_X, AF_LAYOUT, RACK, rackRailLeft, rackIsCompact, rackBoxFor } from "../src/layout.js";

/**
 * SPACE-AWARE THOUGHT BUBBLE.
 *
 * Bodies are markdown now, and a bubble with a FIXED width cap spends a long
 * one entirely on height (the field report: ~412px tall in a 460px scene, so it
 * clipped). The fix trades height for width: the cap is MEASURED from the
 * container — ~70% of the scene — so a long body wraps late and wide, while a
 * three-word body stays snug (`width: max-content` under that cap). Only past
 * the widened wrap does the body scroll inside the bubble.
 *
 * jsdom has no layout engine, so what is asserted here is everything the
 * library actually decides: the pure cap maths, and the measured values it
 * publishes to CSS. The resulting PIXELS (snug vs wide vs capped-and-wrapped)
 * are verified in a real browser — see the release probe in CHANGELOG 0.28.0.
 */

const trace = (...steps) => ({ task: "t", agent: "a", model: "m", asker: "you", steps });
const beat = (brain) => ({
  kind: "return", tool: "seo_audit", toolName: "seo_audit", replyType: "data",
  output: { score: 61 }, brain, cost: { ms: 4, tokens: 2 },
});

// three body lengths — the three cases the field report is about
const SHORT = "looks fine";
const MEDIUM = "The audit found two blockers and one meta warning on the pricing page; both are quick fixes.";
const LONG = [
  "## Findings",
  "",
  "The audit found **two** blockers and one `meta` warning. Scores are down across the",
  "board since the hero image was swapped, and the pricing page is the worst hit —",
  "it now ships 2.1MB of PNG above the fold, which pushes LCP past four seconds on a",
  "throttled connection and drags the whole crawl budget with it.",
  "",
  "- fix the *title* tags",
  "- compress `hero.png`",
  "- then re-run the audit and compare against last week's baseline",
].join("\n");

describe("bubbleBoxFor — the bubble's size budget, measured from the scene", () => {
  it("grows the width cap with the container, at ~70% of it", () => {
    expect(bubbleBoxFor(720, 460).maxW).toBe(504); // 0.70 × 720
    expect(bubbleBoxFor(600, 460).maxW).toBe(424); // 0.70 × 600 = 420 → 8px step
    expect(bubbleBoxFor(880, 460).maxW).toBeGreaterThan(bubbleBoxFor(600, 460).maxW);
  });

  it("clamps to a readable line: never wider than max, never narrower than min", () => {
    expect(bubbleBoxFor(4000, 460).maxW).toBe(BUBBLE.max);
    expect(bubbleBoxFor(300, 460).maxW).toBeGreaterThanOrEqual(BUBBLE.min);
    // …unless the scene itself is narrower — then it stays inside the scene
    const tiny = bubbleBoxFor(200, 460).maxW;
    expect(tiny).toBeLessThanOrEqual(200 - BUBBLE.gutter);
  });

  it("quantises the cap so text streaming in can't jitter the width", () => {
    for (const w of [700, 701, 702, 703, 704, 705, 706, 707]) {
      expect(bubbleBoxFor(w, 460).maxW % BUBBLE.step).toBe(0);
    }
    expect(bubbleBoxFor(720, 460).maxW).toBe(bubbleBoxFor(723, 460).maxW); // a 3px resize changes nothing
  });

  it("splits the same budget between the side-by-side (data + instruction) pair", () => {
    const { maxW, compactW } = bubbleBoxFor(720, 460);
    expect(compactW).toBeLessThan(maxW);
    expect(compactW * 2 + 12).toBeLessThanOrEqual(maxW); // the pair + its gap still fits the budget
    expect(compactW).toBeGreaterThanOrEqual(Math.min(BUBBLE.compactMin, maxW));
  });

  it("caps the BODY at the room above the agent — the last resort, past the widened wrap", () => {
    const { maxBodyH } = bubbleBoxFor(720, 460);
    // room = 460 × 0.6 (the agent's anchor) − 61 (its half-box + margin) − 8 (crown) − 58 (chrome)
    expect(maxBodyH).toBe(149);
    // a taller scene gives the body more room before it ever scrolls
    expect(bubbleBoxFor(720, 700).maxBodyH).toBeGreaterThan(maxBodyH);
    // the mobile anchor sits lower → more room above it
    expect(bubbleBoxFor(720, 460, AF_LAYOUT.brainYMobile).maxBodyH).toBeGreaterThan(maxBodyH);
  });

  it("keeps the body cap between a usable floor and a sane ceiling", () => {
    for (const h of [0, 120, 300, 460, 900, 4000]) {
      const { maxBodyH } = bubbleBoxFor(720, h);
      expect(maxBodyH).toBeGreaterThanOrEqual(BUBBLE.hardMinBody);
      expect(maxBodyH).toBeLessThanOrEqual(BUBBLE.maxBody);
    }
    // a roomy scene gets the comfortable floor…
    expect(bubbleBoxFor(720, 460).maxBodyH).toBeGreaterThanOrEqual(BUBBLE.minBody);
    // …a short one shrinks the bubble to the room it actually has, rather than
    // spilling past the top of the scene (`overflow: hidden` → clipped text)
    const short = bubbleBoxFor(400, 350);
    expect(short.maxBodyH).toBeLessThan(BUBBLE.minBody);
    expect(short.maxBodyH + BUBBLE.chrome).toBeLessThanOrEqual(350 * 0.6 - BUBBLE.agent);
    // …down to a hard floor: under ~3 lines a bubble says nothing, so a tiny
    // panel takes a small spill instead of shrinking into uselessness
    expect(bubbleBoxFor(400, 240).maxBodyH).toBe(BUBBLE.hardMinBody);
  });

  it("falls back to the reference scene when unmeasured (0 / undefined)", () => {
    expect(bubbleBoxFor(0, 0)).toEqual(bubbleBoxFor(BUBBLE.ref, BUBBLE.refH));
    expect(bubbleBoxFor(undefined, undefined)).toEqual(bubbleBoxFor(BUBBLE.ref, BUBBLE.refH));
  });
});

describe("bubbleBoxFor — the BAND: the bubble can never reach the tool rack", () => {
  it("ends the budget before the rail instead of spending 70% of the scene", () => {
    const rail = rackRailLeft(880, false);
    const free = bubbleBoxFor(880, 460);              // card mode: the old budget
    const banded = bubbleBoxFor(880, 460, AF_LAYOUT.brainY, rail);
    expect(free.bandRight).toBeGreaterThan(rail);      // …which reaches the rack
    expect(banded.bandRight).toBeLessThanOrEqual(rail - BUBBLE.rail); // …and this cannot
  });

  it("holds the gap at EVERY scene width — the invariant behind 'they never overlap'", () => {
    for (let w = 320; w <= 1600; w += 17) {
      const compact = rackIsCompact(w);
      const rail = rackRailLeft(w, compact);
      const box = bubbleBoxFor(w, 520, AF_LAYOUT.brainY, rail);
      expect(box.bandRight).toBeLessThanOrEqual(rail - BUBBLE.rail);
      expect(box.bandLeft).toBe(BUBBLE.edge);          // …spending the free LEFT
      expect(box.maxW).toBeGreaterThan(0);
    }
  });

  it("parks a SHORT bubble on the agent's head (the lead) and lets a long one slide left", () => {
    const box = bubbleBoxFor(880, 460, AF_LAYOUT.brainY, rackRailLeft(880, false));
    const bx = 880 * AF_LAYOUT.brainX;
    // lead = the gap the CSS may shrink: a short bubble starts one tail-width
    // left of the agent (exactly where it used to hang), a long one eats the lead
    expect(box.bandLeft + box.lead).toBe(Math.round(bx - BUBBLE_TAIL_X));
    expect(box.bandLeft + box.lead + BUBBLE_TAIL_X).toBe(box.bandLeft + box.tail);
    expect(box.lead).toBeGreaterThan(0);
  });

  it("keeps the old budget when there is no rail to keep clear of (card mode)", () => {
    expect(bubbleBoxFor(720, 460).maxW).toBe(504);
    expect(bubbleBoxFor(720, 460, AF_LAYOUT.brainY, 0).maxW).toBe(504);
  });

  it("drops the rack's labels rather than squeezing the bubble below a readable line", () => {
    expect(rackIsCompact(1200)).toBe(false);
    expect(rackIsCompact(380)).toBe(true);              // a phone-width scene
    const rail = rackRailLeft(380, true);
    expect(bubbleBoxFor(380, 520, AF_LAYOUT.brainY, rail).maxW)
      .toBeGreaterThan(bubbleBoxFor(380, 520, AF_LAYOUT.brainY, rackRailLeft(380, false)).maxW);
    expect(RACK.wCompact).toBeLessThan(RACK.w);
  });
});

describe("<Stage> — publishes the measured budget to the bubbles", () => {
  // jsdom reports 0 for every box; stand in for the browser's measurement of
  // the scene element so the component sees a real container size.
  const ORIG_W = Object.getOwnPropertyDescriptor(Element.prototype, "clientWidth");
  const ORIG_H = Object.getOwnPropertyDescriptor(Element.prototype, "clientHeight");
  let scene = { w: 720, h: 460 };
  const measured = (key) => ({
    configurable: true,
    get() { return this.classList && this.classList.contains("flowscene") ? scene[key] : 0; },
  });
  beforeEach(() => {
    scene = { w: 720, h: 460 };
    Object.defineProperty(Element.prototype, "clientWidth", measured("w"));
    Object.defineProperty(Element.prototype, "clientHeight", measured("h"));
  });
  afterEach(() => {
    cleanup();
    Object.defineProperty(Element.prototype, "clientWidth", ORIG_W);
    Object.defineProperty(Element.prototype, "clientHeight", ORIG_H);
  });

  const vars = (body) => {
    const step = beat(body);
    const { container } = render(React.createElement(Stage, { trace: trace(step), step, index: 0, metaphor: true }));
    const el = container.querySelector(".scene-inner");
    return {
      el,
      w: el.style.getPropertyValue("--af-bubble-w"),
      wc: el.style.getPropertyValue("--af-bubble-wc"),
      h: el.style.getPropertyValue("--af-bubble-h"),
      tail: el.style.getPropertyValue("--af-bubble-tail"),
      text: container.querySelector(".cloud .ctext").textContent,
    };
  };

  it("sets the width / compact / body-height caps from the measured scene", () => {
    const box = bubbleBoxFor(720, 460);
    const v = vars(MEDIUM);
    expect(v.w).toBe(box.maxW + "px");
    expect(v.wc).toBe(box.compactW + "px");
    expect(v.h).toBe(box.maxBodyH + "px");
    // the tail is published as its x INSIDE the band (the band draws it, not the
    // bubble — that is what lets a long bubble slide left off its own tail)
    expect(v.tail).toBe(box.tail + "px");
    expect(box.bandLeft + box.tail).toBe(720 * AF_LAYOUT.brainX); // …lands on the agent
  });

  it("re-measures rather than assuming: a wider panel widens the cap", () => {
    expect(vars(MEDIUM).w).toBe("504px");
    cleanup();
    scene = { w: 1200, h: 620 };
    expect(vars(MEDIUM).w).toBe(BUBBLE.max + "px"); // capped at the comfortable measure
  });

  it("gives short, medium and long bodies the SAME cap — width comes from the room, not the text", () => {
    // the cap is the container's; `width: max-content` under it is what keeps a
    // three-word bubble snug and lets a long one run out to the cap and wrap
    const caps = [SHORT, MEDIUM, LONG].map((b) => { const v = vars(b); cleanup(); return v.w; });
    expect(new Set(caps).size).toBe(1);
    expect(caps[0]).toBe("504px");
  });

  it("wraps the long body instead of clipping it — every line is still in the bubble", () => {
    const v = vars(LONG);
    expect(v.text).toContain("throttled connection");
    expect(v.text).toContain("compare against last week's baseline");
  });

  it("RACK MODE: the band it publishes stops before the rack, and the rack sits where the layout says", () => {
    scene = { w: 880, h: 460 };
    const tools = Array.from({ length: 14 }, (_, i) => ({ name: "tool_" + i }));
    const step = { ...beat(LONG), toolsSeen: tools };
    const { container } = render(React.createElement(Stage, {
      trace: trace(step), step, index: 0, metaphor: true, toolMenu: "rack", onToolClick: () => {},
    }));
    const el = container.querySelector(".scene-inner");
    const rail = rackRailLeft(880, rackIsCompact(880));
    const box = bubbleBoxFor(880, 460, AF_LAYOUT.brainY, rail);
    // the bubble band: published from the rail, and it ENDS before the rack
    expect(el.style.getPropertyValue("--af-bubble-w")).toBe(box.maxW + "px");
    const band = container.querySelector(".thoughtpos");
    expect(parseFloat(band.style.left)).toBe(box.bandLeft);
    expect(parseFloat(band.style.left) + parseFloat(band.style.width)).toBeLessThanOrEqual(rail - BUBBLE.rail);
    expect(band.querySelector(".tp-lead").style).toBeTruthy(); // the shrinkable lead is there
    expect(band.style.getPropertyValue("--af-bubble-lead")).toBe(box.lead + "px");
    // the rack: centred where rackBoxFor says, with its list capped to the room
    const rbox = rackBoxFor(460, tools.length, 460 * AF_LAYOUT.brainY, true);
    expect(parseFloat(container.querySelector(".tool-node.rack").style.top)).toBe(rbox.cy);
    expect(container.querySelector(".tool-rack").style.getPropertyValue("--tr-list-h")).toBe(rbox.listMaxH + "px");
    expect(container.querySelectorAll(".tr-item")).toHaveLength(rbox.rowCount); // every tool, scrolling
  });

  it("keeps the same budget on the phone layout (narrow scene → smaller cap)", () => {
    scene = { w: 360, h: 520 };
    const step = beat(MEDIUM);
    const { container } = render(React.createElement(Stage, { trace: trace(step), step, index: 0, metaphor: true, straight: true }));
    const el = container.querySelector(".scene-inner");
    const box = bubbleBoxFor(360, 520, AF_LAYOUT.brainYMobile);
    expect(el.style.getPropertyValue("--af-bubble-w")).toBe(box.maxW + "px");
    expect(box.maxW).toBeLessThanOrEqual(360 - BUBBLE.gutter); // fits the phone frame
  });
});

describe("the stylesheet honours the budget", () => {
  const css = fs.readFileSync(path.join(process.cwd(), "src/styles.css"), "utf8");

  it("sizes the bubble by content under the measured cap (snug when short, wrapped when long)", () => {
    expect(css).toMatch(/\.cloud \{[^}]*width: max-content; max-width: var\(--af-bubble-w/s);
    expect(css).toMatch(/\.skilldoc \{[^}]*max-width: var\(--af-bubble-w/s);
    expect(css).toMatch(/\.cloud\.compact[^{]*\{ max-width: var\(--af-bubble-wc/);
  });

  it("scrolls the body only as a last resort, at the measured height cap", () => {
    expect(css).toMatch(/\.ctext \{[^}]*max-height: var\(--af-bubble-h[^}]*overflow-y: auto/s);
  });

  it("keeps the tail on the agent, and eases the width without a jump", () => {
    // the BAND draws the tail (at the agent's x), so it stays on the agent's head
    // however far the bubble has slid left; the bubble itself draws none
    expect(css).toMatch(/\.thoughtpos\.tailed::before \{[^}]*left: var\(--af-bubble-tail/);
    expect(css).not.toMatch(/\.cloud::before \{/);
    expect(css).toMatch(/\.cloud \{[^}]*transition: max-width/s);
    // …and holds still for readers who asked for less motion
    expect(css).toMatch(/prefers-reduced-motion[^@]*\.cloud, [^@]*\.skilldoc \{ transition: none !important; \}/s);
  });
});
