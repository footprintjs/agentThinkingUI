import React from "react";
import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup, fireEvent } from "@testing-library/react";
import { AgentThinkingUI } from "../src/footprint.jsx";

afterEach(cleanup);

/**
 * Regression: the timeline playhead must sit on the CURRENT step's segment.
 *
 * Segment widths lean on latency but every step keeps a visible slice, so a
 * trace with 0ms beats between 1000ms beats (every tool-return beat is 0ms) used
 * to diverge: the playhead was placed by a latency-cumulative `start` while the
 * segments rendered by width — so the cursor drifted left of its step, and on the
 * 0ms beats it even ran PAST 100% (off the track). "scene moves, cursor wrong."
 * Now widths are normalized to 100 and `start` is cumulative width — one axis.
 */
const TRACE = {
  task: "q",
  agent: "A",
  model: "m",
  asker: "you",
  steps: [
    { kind: "prompt", brain: "q", cost: { ms: 0, tokens: 0 } },
    { kind: "ask", tool: "a", toolName: "a", input: {}, brain: "", cost: { ms: 1000, tokens: 5 } },
    { kind: "return", tool: "a", toolName: "a", replyType: "data", output: {}, brain: "", cost: { ms: 0, tokens: 0 } },
    { kind: "ask", tool: "b", toolName: "b", input: {}, brain: "", cost: { ms: 1000, tokens: 5 } },
    { kind: "return", tool: "b", toolName: "b", replyType: "data", output: {}, brain: "", cost: { ms: 0, tokens: 0 } },
    { kind: "answer", to: "you", brain: "done", answer: { headline: "done" }, cost: { ms: 0, tokens: 0 } },
  ],
};

const pct = (el, prop) => parseFloat(((el && el.style[prop]) || "0").replace("%", "")) || 0;

describe("<AgentThinkingUI> timeline — playhead stays on its step's segment", () => {
  it("playhead is within the current segment at every step (no drift on 0ms beats)", () => {
    const { container, getByTitle } = render(React.createElement(AgentThinkingUI, { trace: TRACE }));
    const next = getByTitle("Next step");

    for (let i = 0; i < TRACE.steps.length; i++) {
      const widths = Array.from(container.querySelectorAll(".tl-seg")).map((e) => pct(e, "width"));
      expect(widths.length).toBe(TRACE.steps.length);
      // widths tile exactly 0..100 — no overflow
      expect(Math.round(widths.reduce((a, b) => a + b, 0))).toBe(100);

      const start = widths.slice(0, i).reduce((a, b) => a + b, 0);
      const head = pct(container.querySelector(".playhead"), "left");
      // playhead sits within the current step's segment, and never off the track
      expect(head).toBeGreaterThanOrEqual(start - 0.5);
      expect(head).toBeLessThanOrEqual(start + widths[i] + 0.5);
      expect(head).toBeLessThanOrEqual(100);

      if (i < TRACE.steps.length - 1) fireEvent.click(next);
    }
  });
});
