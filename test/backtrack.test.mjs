import React from "react";
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, cleanup, fireEvent } from "@testing-library/react";
import { BacktrackView, BacktrackOverlay } from "../src/backtrack.jsx";

afterEach(cleanup);

const view = (props) => React.createElement(BacktrackView, props);

/* ── fixtures — shaped like demo/backtrack-trace.js ───────────────────── */
const causalTrace = (over = {}) => ({
  claim: "why approved?",
  mode: "causal",
  answer: { label: "the wrong answer", text: "APPROVED wrongly" },
  decidedAt: { id: "call-llm#40", kind: "llm" },
  suspects: [
    {
      kind: "injection", flavor: "fact", name: "bad-fact", rank: 5,
      text: "planted", score: 0.85,
      edge: { key: "systemPromptInjections", weight: 0.92, kind: "data" },
      bornAt: { id: "context#6", via: "injection engine" },
      custody: [
        { step: "born", detail: "defineFact()", at: "defineFact()", content: "data: 'planted fact body'", highlight: "planted fact body" },
        { step: "read", detail: "assembled", at: "call-llm#40", variable: "systemPrompt", content: "sys + planted fact body + style", highlight: "planted fact body" },
        { step: "answer", detail: "the bug" },
      ],
      verdict: { kind: "confirmed", flips: 3, samples: 3, claim: "CAUSAL: flips 3/3" },
    },
    {
      kind: "tool", name: "lookup", text: "data", score: 0.71,
      edge: { key: "history", weight: 0.8, kind: "data" },
      verdict: { kind: "not-confirmed", flips: 0, samples: 3 },
    },
  ],
  honesty: ["only ablation verdicts make causal claims."],
  ...over,
});

const rankedTrace = (over = {}) => ({
  claim: "why this tool?",
  mode: "correlational",
  answer: { tone: "question", text: "tool call" },
  decidedAt: { id: "call-llm#18", kind: "llm" },
  suspects: [
    { kind: "arg", name: "s1", score: 0.91, upperBound: true, edge: { key: "a", weight: 0.91 } },
    { kind: "stage", name: "s2", score: 0.88, upperBound: true, edge: { key: "b", weight: 0.88 } },
    { kind: "injection", flavor: "fact", name: "s3", score: 0.54, edge: { key: "c", weight: 0.85 } },
    { kind: "injection", flavor: "fact", name: "s4", score: 0.53, edge: { key: "c", weight: 0.85 } },
  ],
  honesty: ["ranking only."],
  ...over,
});

const ruleTrace = () => ({
  claim: "why approved loan?",
  mode: "correlational",
  modeLabel: "exact chain · proxy ranking",
  answer: { text: "decision = approve" },
  decidedAt: { id: "adjudicate#2", kind: "rule" },
  suspects: [
    {
      kind: "stage", name: "adjudicate", score: 1, upperBound: true,
      edge: { key: "Prime credit", kind: "control" },
      path: [{ key: "Prime credit", kind: "control", via: "approve#3 ← adjudicate#2" }],
    },
  ],
  trail: {
    title: "the trail",
    custody: [
      { step: "wrote", detail: "dti = 0.035", at: "normalize#1", variable: "dti", content: "commit { dti: 0.035 }", highlight: "0.035" },
      { step: "decision", detail: "approve" },
    ],
    claim: "no causal verdict is claimed.",
  },
  honesty: ["structure-only."],
});

/* ── the board ────────────────────────────────────────────────────────── */
describe("BacktrackView — beats per decision kind", () => {
  it("causal: 6 beats ending in the test → the culprit; ranked: 5 ending in the ranking; trail: ends in the trail", () => {
    const a = render(view({ trace: causalTrace(), autoPlay: false }));
    expect(a.container.querySelectorAll(".bt-dot").length).toBe(6);
    expect(a.container.textContent).toContain("the culprit");
    cleanup();
    const b = render(view({ trace: rankedTrace(), autoPlay: false }));
    expect(b.container.querySelectorAll(".bt-dot").length).toBe(5);
    expect(b.container.textContent).toContain("the ranking");
    cleanup();
    const c = render(view({ trace: ruleTrace(), autoPlay: false }));
    expect(c.container.textContent).toContain("the trail");
    expect(c.container.querySelector(".bt-culprit.tone-exact")).toBeTruthy();
  });

  it("renders the claim, the answer, the mode chip, and the decider figure by kind", () => {
    const { container } = render(view({ trace: ruleTrace(), autoPlay: false }));
    expect(container.querySelector(".bt-claim").textContent).toBe("why approved loan?");
    expect(container.querySelector(".bt-mode").textContent).toBe("exact chain · proxy ranking");
    expect(container.querySelector(".bt-diamond")).toBeTruthy(); // rule → diamond, not the brain
    cleanup();
    const llm = render(view({ trace: causalTrace(), autoPlay: false }));
    expect(llm.container.querySelector(".brain")).toBeTruthy();
  });

  it("verdict stamps land only at the test beat (causal beat 4+)", () => {
    const { container } = render(view({ trace: causalTrace(), autoPlay: false }));
    expect(container.querySelector(".bt-stamp")).toBeTruthy(); // starts at final beat
    fireEvent.click(container.querySelectorAll(".bt-dot")[2]); // back to "what it was given"
    expect(container.querySelector(".bt-stamp")).toBeNull();
    expect(container.querySelector(".bt-cleared-tag")).toBeNull();
    fireEvent.click(container.querySelectorAll(".bt-dot")[4]); // "the test"
    expect(container.querySelector(".bt-stamp").textContent).toContain("3/3");
    expect(container.querySelector(".bt-cleared-tag").textContent).toContain("0/3");
  });

  it("a ranked trace shows no stamps at any beat — verdicts are the causal tier", () => {
    const { container } = render(view({ trace: rankedTrace(), autoPlay: false }));
    expect(container.querySelector(".bt-stamp")).toBeNull();
    expect(container.querySelector(".bt-cleared-tag")).toBeNull();
  });
});

describe("BacktrackView — keyless trace swap (adjust-on-prop-change)", () => {
  it("swapping causal → ranked without a key clamps the beat and keeps the stepper coherent", () => {
    const { container, rerender } = render(view({ trace: causalTrace(), autoPlay: false })); // beat 5
    rerender(view({ trace: rankedTrace(), autoPlay: false }));
    const dots = container.querySelectorAll(".bt-dot");
    expect(dots.length).toBe(5);
    expect(container.querySelector(".bt-dot.on")).toBeTruthy(); // exactly one active dot
    const next = [...container.querySelectorAll(".bt-nav")].pop();
    expect(next.disabled).toBe(true); // at the last beat, next is disabled
  });

  it("swapping to a trail with NO custody never crashes the rewind pane", () => {
    const { rerender, container } = render(view({ trace: causalTrace(), autoPlay: false }));
    const bare = ruleTrace();
    bare.trail = { title: "t", custody: undefined };
    expect(() => rerender(view({ trace: bare, autoPlay: false }))).not.toThrow();
    expect(container.querySelector(".bt-rewind")).toBeNull();
  });

  it("swap resets suspect pagination to the first page", () => {
    const { container, rerender } = render(view({ trace: rankedTrace(), autoPlay: false }));
    fireEvent.click(container.querySelectorAll(".bt-su-pager .bt-rw-nav button")[1]); // page 2
    expect(container.textContent).toContain("suspects 4–4 of 4");
    rerender(view({ trace: rankedTrace({ claim: "fresh" }), autoPlay: false }));
    expect(container.textContent).toContain("suspects 1–3 of 4");
  });
});

describe("BacktrackView — suspects: pagination, ranks, meters, edges", () => {
  it("paginates past PAGE_SIZE and hides the pager at 3 or fewer", () => {
    const { container } = render(view({ trace: rankedTrace(), autoPlay: false }));
    expect(container.querySelector(".bt-su-pager").textContent).toContain("suspects 1–3 of 4");
    expect(container.querySelectorAll(".bt-suspect").length).toBe(3);
    fireEvent.click(container.querySelectorAll(".bt-su-pager .bt-rw-nav button")[1]);
    expect(container.querySelectorAll(".bt-suspect").length).toBe(1);
    cleanup();
    const small = render(view({ trace: causalTrace(), autoPlay: false }));
    expect(small.container.querySelector(".bt-su-pager")).toBeNull();
  });

  it("honors the rank override and falls back to position", () => {
    const { container } = render(view({ trace: causalTrace(), autoPlay: false }));
    const ranks = [...container.querySelectorAll(".bt-su-rank")].map((r) => r.textContent);
    expect(ranks).toEqual(["#5", "#2"]); // explicit rank 5, positional 2
  });

  it("upper-bound scores render the hatched meter and a starred value", () => {
    const { container } = render(view({ trace: rankedTrace(), autoPlay: false }));
    const ub = container.querySelector(".bt-meter.ub");
    expect(ub).toBeTruthy();
    expect(ub.querySelector(".bt-meter-val").textContent).toContain("0.91*");
    expect(container.querySelector(".bt-meter.cool")).toBeTruthy(); // the 0.54 fact — solid, below the warm band
  });

  it("meter zones: hot ≥ .8, warm ≥ .6, cool below", () => {
    const t = causalTrace();
    t.suspects[0].score = 0.85; // hot
    t.suspects[1].score = 0.61; // warm
    t.suspects.push({ kind: "tool", name: "cold", score: 0.2 });
    const { container } = render(view({ trace: t, autoPlay: false }));
    expect(container.querySelector(".bt-meter.hot")).toBeTruthy();
    expect(container.querySelector(".bt-meter.warm")).toBeTruthy();
    expect(container.querySelector(".bt-meter.cool")).toBeTruthy();
  });

  it("control edges are labeled and the full hop path renders", () => {
    const { container } = render(view({ trace: ruleTrace(), autoPlay: false }));
    expect(container.querySelector(".bt-edge.is-control").textContent).toContain("control · Prime credit");
    expect(container.querySelector(".bt-hop.is-control").textContent).toContain("[control: Prime credit]");
  });
});

describe("BacktrackView — the rewind player (chain of custody)", () => {
  it("defaults to the first evidenced hop and switches on row click", () => {
    const { container } = render(view({ trace: causalTrace(), autoPlay: false }));
    expect(container.querySelector(".bt-rewind").textContent).toContain("defineFact()");
    const rows = container.querySelectorAll(".bt-custody li.has-evidence");
    fireEvent.click(rows[1]); // the "read" hop
    expect(container.querySelector(".bt-rw-where").textContent).toContain("systemPrompt");
  });

  it("highlights every occurrence of the culprit span in the evidence", () => {
    const { container } = render(view({ trace: causalTrace(), autoPlay: false }));
    const rows = container.querySelectorAll(".bt-custody li.has-evidence");
    fireEvent.click(rows[1]);
    const marks = container.querySelectorAll(".bt-mark");
    expect(marks.length).toBe(1);
    expect(marks[0].textContent).toBe("planted fact body");
  });

  it("‹ › steps through evidenced hops only and disables at the ends", () => {
    const { container } = render(view({ trace: causalTrace(), autoPlay: false }));
    const [prev, next] = container.querySelectorAll(".bt-rewind .bt-rw-nav button");
    expect(prev.disabled).toBe(true);
    fireEvent.click(next);
    expect(container.querySelector(".bt-rw-where").textContent).toContain("call-llm#40");
    expect(container.querySelectorAll(".bt-rewind .bt-rw-nav button")[1].disabled).toBe(true);
  });
});

describe("BacktrackView — stepper auto-scroll", () => {
  it("scrolls the revealed section into view on an explicit seek", () => {
    const spy = vi.fn();
    const orig = Element.prototype.scrollIntoView;
    Element.prototype.scrollIntoView = spy;
    try {
      const { container } = render(view({ trace: causalTrace(), autoPlay: false }));
      fireEvent.click(container.querySelectorAll(".bt-dot")[2]);
      expect(spy).toHaveBeenCalled();
      const again = spy.mock.calls.length;
      fireEvent.click(container.querySelectorAll(".bt-dot")[2]); // re-center on active dot
      expect(spy.mock.calls.length).toBeGreaterThan(again - 1);
    } finally {
      Element.prototype.scrollIntoView = orig;
    }
  });
});

/* ── the overlay (desktop modal / mobile full-screen) ─────────────────── */
describe("BacktrackOverlay", () => {
  it("renders nothing when closed, a dialog with the board when open", () => {
    const closed = render(React.createElement(BacktrackOverlay, { open: false, trace: causalTrace(), autoPlay: false }));
    expect(closed.container.querySelector(".atui-backtrack-overlay")).toBeNull();
    cleanup();
    const { container } = render(React.createElement(BacktrackOverlay, { open: true, trace: causalTrace(), autoPlay: false }));
    expect(container.querySelector("[role=dialog]")).toBeTruthy();
    expect(container.querySelector(".atui-backtrack")).toBeTruthy();
  });

  it("closes on Escape, on the scrim, and on the back button — never on inner clicks", () => {
    const onClose = vi.fn();
    const { container } = render(React.createElement(BacktrackOverlay, { open: true, onClose, trace: causalTrace(), autoPlay: false }));
    fireEvent.keyDown(window, { key: "Escape" });
    fireEvent.click(container.querySelector(".atui-backtrack-overlay")); // scrim
    fireEvent.click(container.querySelector(".bto-back"));
    expect(onClose).toHaveBeenCalledTimes(3);
    onClose.mockClear();
    fireEvent.click(container.querySelector(".bt-answer")); // inner content
    expect(onClose).not.toHaveBeenCalled();
  });
});
