import React from "react";
import fs from "node:fs";
import path from "node:path";
import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { rackView, ToolRack } from "../src/stage.jsx";
import { RACK, RACK_ITEM_H, rackBoxFor, rackPinFor, rackArrowY, rackPickedY, AF_LAYOUT } from "../src/layout.js";

afterEach(cleanup);

/**
 * Rack mode (toolMenu="rack"): a vertical rack of the tools the model can use,
 * the picked one lit.
 *
 * GRAMMAR (changed): the rack used to cap itself at 7 rows and fold the rest
 * into a "+N more" summary — so a rack could not answer the question it exists
 * to answer ("picked this out of WHAT?"), and on a short arena the fold hid
 * tools the reader never knew were there. That grammar is RETIRED. Every tool is
 * a row now; when they outrun the arena the list SCROLLS; and the picked row is
 * PINNED inside it (rackPinFor) so scrolling can never carry the pick — or the
 * arrow's target — out of sight.
 *
 * jsdom has no layout engine, so what is asserted here is what the library
 * actually decides: the pure pin/arrow maths, the contract it publishes to CSS,
 * and the DOM it renders. The resulting PIXELS (a pinned row holding its slot
 * while the rest scroll under it) are verified in a real browser.
 */
const mk = (n) => Array.from({ length: n }, (_, i) => ({ name: "tool_" + i, description: "d" + i }));

describe("rackView — every tool, in first-seen order", () => {
  it("keeps EVERY tool, however many there are (no cap, no fold)", () => {
    for (const n of [1, 4, 7, 14, 40]) {
      const v = rackView(mk(n), "tool_0");
      expect(v.rows).toHaveLength(n);
      expect(v.rowCount).toBe(n);
    }
  });

  it("reports the picked tool's real index in the full list", () => {
    const v = rackView(mk(14), "tool_11");
    expect(v.pickedIndex).toBe(11); // not swapped into a truncated head
    expect(v.rows[v.pickedIndex].name).toBe("tool_11");
  });

  it("reports no pick when none is given (idle steps)", () => {
    expect(rackView(mk(4), null).pickedIndex).toBe(-1);
    expect(rackView(mk(4), "nope").pickedIndex).toBe(-1);
  });

  it("is empty-safe", () => {
    const v = rackView([], "x");
    expect(v.rows).toHaveLength(0);
    expect(v.rowCount).toBe(0);
    expect(v.pickedIndex).toBe(-1);
  });
});

describe("<ToolRack>", () => {
  it("renders one row per tool and lights ONLY the picked row", () => {
    const tools = mk(4);
    const { container } = render(React.createElement(ToolRack, { view: rackView(tools, "tool_2") }));
    expect(container.querySelectorAll(".tr-item")).toHaveLength(4);
    const on = container.querySelectorAll(".tr-item.on");
    expect(on).toHaveLength(1);
    expect(Array.from(container.querySelectorAll(".tr-item"))[2].classList.contains("on")).toBe(true);
  });

  it("marks skill rows with .skill", () => {
    const tools = [{ name: "search" }, { name: "load_skill" }, { name: "book" }];
    const { container } = render(React.createElement(ToolRack, { view: rackView(tools, "search") }));
    expect(container.querySelectorAll(".tr-item.skill")).toHaveLength(1);
  });

  it("never summarises tools away — the '+N more' row is gone at any count", () => {
    for (const n of [8, 14, 40]) {
      const { container } = render(React.createElement(ToolRack, { view: rackView(mk(n), "tool_0"), maxH: 240 }));
      expect(container.querySelector(".tr-more")).toBeNull();
      expect(container.querySelectorAll(".tr-item")).toHaveLength(n); // all of them, scrollable
      cleanup();
    }
  });

  it("renders nothing for an empty view", () => {
    const { container } = render(React.createElement(ToolRack, { view: rackView([], null) }));
    expect(container.querySelector(".tool-rack")).toBeNull();
  });

  it("shows a 'Why this tool?' button only when clickable + a tool is picked", () => {
    const view = rackView(mk(4), "tool_2");
    expect(render(React.createElement(ToolRack, { view })).container.querySelector(".tr-why")).toBeNull();
    cleanup();
    const onPick = (n) => { onPick.last = n; };
    const { container } = render(React.createElement(ToolRack, { view, onPick }));
    const btn = container.querySelector(".tr-why");
    expect(btn).toBeTruthy();
    expect(btn.textContent).toMatch(/why this tool\?/i);
    btn.click();
    expect(onPick.last).toBe("tool_2"); // focuses the picked tool
  });

  it("the Why button says 'skill' when the picked entry is a skill", () => {
    const tools = [{ name: "search" }, { name: "load_skill" }];
    const { container } = render(React.createElement(ToolRack, { view: rackView(tools, "load_skill"), onPick: () => {} }));
    expect(container.querySelector(".tr-why").textContent).toMatch(/why this skill\?/i);
  });
});

describe("<ToolRack> — the pinned pick", () => {
  const view = rackView(mk(14), "tool_9");
  const pin = rackPinFor(14, 9, 480);

  it("publishes the pin as the picked row's sticky band, and seeds the scroll to it", () => {
    const { container } = render(React.createElement(ToolRack, { view, maxH: 480, pin, scrollable: true }));
    const rack = container.querySelector(".tool-rack");
    expect(rack.style.getPropertyValue("--tr-pin-top")).toBe(pin.top + "px");
    expect(rack.style.getPropertyValue("--tr-pin-bottom")).toBe(pin.bottom + "px");
    // the list is scrolled to where the pinned row sits ON its slot at rest
    expect(container.querySelector(".tr-list").scrollTop).toBe(pin.scrollTop);
  });

  it("marks the PICKED row as pinned — not merely the first row", () => {
    const { container } = render(React.createElement(ToolRack, { view, maxH: 480, pin, scrollable: true }));
    const pinned = container.querySelectorAll(".tr-item.pinned");
    expect(pinned).toHaveLength(1);
    expect(pinned[0].classList.contains("on")).toBe(true);          // it wears the picked styling…
    expect(pinned[0].getAttribute("aria-current")).toBe("true");
    expect(pinned[0].textContent).toContain("tool_9");
    expect(pinned[0].querySelector(".tr-pinned-tag")).toBeTruthy(); // …and says WHY it is held
    expect(pinned[0].getAttribute("title")).toMatch(/picked — pinned/);
    expect(container.querySelectorAll(".tr-item")[0].classList.contains("pinned")).toBe(false);
  });

  it("pins nothing on a beat with no pick — the list just scrolls", () => {
    const idle = rackView(mk(14), null);
    expect(rackPinFor(14, -1, 480)).toBeNull();
    const { container } = render(React.createElement(ToolRack, { view: idle, maxH: 480, pin: null, scrollable: true }));
    expect(container.querySelector(".tr-item.pinned")).toBeNull();
    expect(container.querySelector(".tr-pinned-tag")).toBeNull();
    expect(container.querySelector(".tr-list").scrollTop).toBe(0);
    expect(container.querySelectorAll(".tr-item")).toHaveLength(14); // …through all of them
  });

  it("pins nothing when the whole rack fits — rows keep their natural places", () => {
    const small = rackView(mk(4), "tool_2");
    expect(rackPinFor(4, 2, 480)).toBeNull();
    const { container } = render(React.createElement(ToolRack, { view: small, maxH: 480, pin: null }));
    expect(container.querySelector(".tr-item.pinned")).toBeNull();
    expect(container.querySelector(".tr-item.on")).toBeTruthy();
  });

  it("is a keyboard tab stop ONLY when it actually scrolls", () => {
    const scrolling = render(React.createElement(ToolRack, { view, maxH: 480, pin, scrollable: true })).container;
    const list = scrolling.querySelector(".tr-list");
    expect(list.getAttribute("tabindex")).toBe("0");            // reachable, arrow-key scrollable
    expect(list.getAttribute("aria-label")).toMatch(/scrollable list of 14/);
    cleanup();
    const still = render(React.createElement(ToolRack, { view: rackView(mk(3), "tool_0"), maxH: 480 })).container;
    expect(still.querySelector(".tr-list").getAttribute("tabindex")).toBeNull(); // no useless stop
    expect(still.querySelector(".tr-list").getAttribute("aria-label")).toBe("tools the model can use");
  });

  it("is a COLUMN of a known width — that is what the bubble's band is measured against", () => {
    const wide = render(React.createElement(ToolRack, { view: rackView(mk(3), "tool_0") })).container;
    expect(wide.querySelector(".tool-rack").style.getPropertyValue("--tr-w")).toBe(RACK.w + "px");
    cleanup();
    const narrow = render(React.createElement(ToolRack, { view: rackView(mk(3), "tool_0"), compact: true })).container;
    expect(narrow.querySelector(".tool-rack").style.getPropertyValue("--tr-w")).toBe(RACK.wCompact + "px");
    expect(narrow.querySelector(".tool-rack").classList.contains("compact")).toBe(true);
  });

  it("keeps the tool NAMES in the tooltip when the compact rack hides them", () => {
    const { container } = render(React.createElement(ToolRack, { view: rackView(mk(3), "tool_0"), compact: true, onPick: () => {} }));
    expect(container.querySelector(".tr-item").getAttribute("title")).toContain("tool_0");
    expect(container.querySelector(".tr-list").getAttribute("aria-label")).toMatch(/tools the model can use/);
    expect(container.querySelector(".tr-why").textContent).toMatch(/why\?/i);
    expect(container.querySelector(".tr-why").getAttribute("title")).toMatch(/why this tool\?/i);
  });
});

/**
 * THE RACK'S OWN BOX. A rack used to be a fixed 7-row stack centred on the
 * agent's line — taller than a short arena, so the bottom rows and the "Why this
 * tool?" button were cut off by the scene's `overflow: hidden`. Its height is
 * budgeted from the arena now: the frame is slid into the scene when centring
 * would push it out, and the rows scroll inside the room they have.
 */
describe("rackBoxFor — the rack's height budget, measured from the arena", () => {
  const edges = (h, count, by, hasWhy = true) => {
    const box = rackBoxFor(h, count, by, hasWhy);
    return { box, top: box.cy - box.height / 2, bottom: box.cy + box.height / 2 + (hasWhy ? RACK.why : 0) };
  };

  it("keeps the rack AND its Why button inside the scene at every arena height", () => {
    for (let h = 140; h <= 1200; h += 13) {
      const { top, bottom } = edges(h, 14, h * AF_LAYOUT.brainY);
      expect(top).toBeGreaterThanOrEqual(0);
      expect(bottom).toBeLessThanOrEqual(h);
    }
  });

  it("keeps every tool as a row, and says when they outrun the room", () => {
    const short = rackBoxFor(365, 14, 219), tall = rackBoxFor(900, 14, 540);
    expect(short.rowCount).toBe(14);          // nothing is dropped…
    expect(tall.rowCount).toBe(14);
    expect(short.overflowing).toBe(true);     // …the short arena scrolls instead
    expect(tall.overflowing).toBe(false);     // …the tall one shows all 14 at once
    expect(short.height).toBeLessThan(tall.height);
  });

  it("stays on the agent's line when it fits, and slides in only when it must", () => {
    const by = 605 * AF_LAYOUT.brainY;
    expect(rackBoxFor(605, 4, by).cy).toBe(Math.round(by));   // a small rack does not move
    expect(rackBoxFor(365, 14, 365 * AF_LAYOUT.brainY).cy).toBeLessThan(365 * AF_LAYOUT.brainY);
  });

  it("gives the rows less room when a Why button has to hang below them", () => {
    expect(rackBoxFor(460, 14, 276, false).listMaxH).toBeGreaterThan(rackBoxFor(460, 14, 276, true).listMaxH);
  });

  it("never hands the list a max-height it cannot show a row in", () => {
    for (const h of [120, 150, 200, 460]) {
      expect(rackBoxFor(h, 14, h * 0.6).listMaxH).toBeGreaterThanOrEqual(RACK_ITEM_H);
    }
  });
});

/**
 * THE PIN — the one idea that makes an all-tools scrolling rack safe. The picked
 * row is sticky, and its band is exactly one row tall, so it is held at ONE slot
 * at every scroll position. That is also why the arrow needs no scroll listener.
 */
describe("rackPinFor — one slot, held at any scroll position", () => {
  const LIST = 480; // 10 rows of room, 14 tools → it scrolls

  it("pins nothing when there is nothing to pin", () => {
    expect(rackPinFor(14, -1, LIST)).toBeNull();      // no pick this beat
    expect(rackPinFor(4, 2, LIST)).toBeNull();        // the whole rack fits
    expect(rackPinFor(0, 0, LIST)).toBeNull();
  });

  it("describes a band exactly ONE row tall — so scrolling cannot move the row", () => {
    for (let i = 0; i < 14; i++) {
      const pin = rackPinFor(14, i, LIST);
      expect(pin.top + RACK_ITEM_H + pin.bottom).toBe(LIST);
    }
  });

  it("keeps the pinned row fully inside the viewport for EVERY pick", () => {
    for (let i = 0; i < 14; i++) {
      const pin = rackPinFor(14, i, LIST);
      expect(pin.top).toBeGreaterThanOrEqual(0);
      expect(pin.top + RACK_ITEM_H).toBeLessThanOrEqual(LIST);
    }
  });

  it("seeds the scroll so the row starts ON its slot — nothing displaced at rest", () => {
    for (let i = 0; i < 14; i++) {
      const pin = rackPinFor(14, i, LIST);
      const natural = i * RACK_ITEM_H;
      expect(pin.top).toBe(natural - pin.scrollTop);              // its own place, not a hoist
      expect(pin.scrollTop).toBeGreaterThanOrEqual(0);
      expect(pin.scrollTop).toBeLessThanOrEqual(14 * RACK_ITEM_H - LIST);
    }
  });

  it("prefers the middle of the list, and clamps at the two ends", () => {
    const middle = (LIST - RACK_ITEM_H) / 2;
    expect(rackPinFor(14, 7, LIST).top).toBe(middle);             // room on both sides
    expect(rackPinFor(14, 0, LIST).top).toBe(0);                  // first tool: top of the list
    expect(rackPinFor(14, 13, LIST).top).toBe(LIST - RACK_ITEM_H); // last tool: bottom
  });
});

describe("rackArrowY — the arrow lands on the row, pinned or not", () => {
  it("aims at the PINNED slot when the rack scrolls", () => {
    const box = rackBoxFor(605, 14, 363);
    for (let i = 0; i < 14; i++) {
      const pin = rackPinFor(14, i, box.listMaxH);
      const y = rackArrowY(box, i, pin);
      expect(y).toBe(box.cy - box.listMaxH / 2 + pin.top + RACK_ITEM_H / 2);
      // …and that is inside the pinned row's band, which no scrolling can move
      const rowTop = box.cy - box.listMaxH / 2 + pin.top;
      expect(y).toBeGreaterThanOrEqual(rowTop);
      expect(y).toBeLessThanOrEqual(rowTop + RACK_ITEM_H);
    }
  });

  it("aims at the row's natural place when the whole rack fits", () => {
    const box = rackBoxFor(605, 4, 363);
    expect(rackArrowY(box, 2, null)).toBe(rackPickedY(box.cy, 4, 2));
  });

  it("aims at the rack's centre on a beat with no pick", () => {
    const box = rackBoxFor(605, 14, 363);
    expect(rackArrowY(box, -1, null)).toBe(box.cy);
  });

  it("always lands inside the rack's frame", () => {
    for (const h of [200, 365, 605, 900]) {
      const box = rackBoxFor(h, 14, h * AF_LAYOUT.brainY);
      for (let i = 0; i < 14; i++) {
        const y = rackArrowY(box, i, rackPinFor(14, i, box.listMaxH));
        expect(y).toBeGreaterThanOrEqual(box.cy - box.height / 2);
        expect(y).toBeLessThanOrEqual(box.cy + box.height / 2);
      }
    }
  });
});

describe("the stylesheet honours the rack's budget", () => {
  const css = fs.readFileSync(path.join(process.cwd(), "src/styles.css"), "utf8");

  it("scrolls the list at the measured cap rather than letting the scene clip it", () => {
    expect(css).toMatch(/\.tr-list \{[^}]*max-height: var\(--tr-list-h[^}]*overflow-y: auto/s);
    expect(css).toMatch(/\.tr-list \{[^}]*scrollbar-width: thin/s);
    expect(css).toMatch(/\.tr-list::-webkit-scrollbar \{ width: 6px; \}/);
  });

  it("holds the picked row at the published slot, above the rows scrolling past", () => {
    expect(css).toMatch(/\.tr-item\.pinned \{[^}]*position: sticky[^}]*top: var\(--tr-pin-top[^}]*bottom: var\(--tr-pin-bottom/s);
    expect(css).toMatch(/\.tr-item\.pinned \{[^}]*z-index: 1/s);
    // opaque backing (tint composited over the card) so scrolling rows never bleed through
    expect(css).toMatch(/\.tr-item\.pinned \{[^}]*background: linear-gradient\(var\(--call-tint\), var\(--call-tint\)\), var\(--card\)/s);
  });

  it("gives the scrollable list a focus ring, and keeps no trace of the retired fold", () => {
    expect(css).toMatch(/\.tr-list:focus-visible \{ outline: 2px solid var\(--call\)/);
    expect(css).not.toMatch(/\.tr-more/);
  });

  it("sizes the rack column from the layout, not from the tool names", () => {
    expect(css).toMatch(/\.tool-rack \{[^}]*width: var\(--tr-w/s);
    expect(css).toMatch(/\.tool-rack\.compact \.tr-name,[^{]*\.tr-pinned-tag \{ display: none; \}/);
  });
});
