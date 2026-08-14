import React from "react";
import fs from "node:fs";
import path from "node:path";
import { describe, it, expect, afterEach, beforeEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { Stage } from "../src/stage.jsx";
import { bubbleBoxFor, BUBBLE, BUBBLE_TAIL_X, AF_LAYOUT } from "../src/layout.js";

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
    expect(v.tail).toBe(BUBBLE_TAIL_X + "px");
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
    expect(css).toMatch(/\.cloud::before \{[^}]*left: var\(--af-bubble-tail/);
    expect(css).toMatch(/\.cloud \{[^}]*transition: max-width/s);
    // …and holds still for readers who asked for less motion
    expect(css).toMatch(/prefers-reduced-motion[^@]*\.cloud, [^@]*\.skilldoc \{ transition: none !important; \}/s);
  });
});
