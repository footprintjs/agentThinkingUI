import React from "react";
import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup, act } from "@testing-library/react";
import { AgentThinkingUI } from "../src/footprint.jsx";

// UI-RENDER performance: how the *player* renders (DOM footprint + render cost),
// not the agent's token/latency numbers. The headline metric is DOM node count —
// it must stay bounded as the trace grows (timeline switches to a gradient past
// the cap; the inspector shows only the current step), so a 1000-step run renders
// as cheaply as a 10-step one. Timings are logged (jsdom ≈ React commit cost, not
// paint) for the README; only the DOM bound is asserted (timing is machine-noisy).

const answer = { headline: "H", plan: [], budget: [], cta: "" };
const gen = (n) => {
  const steps = [{ kind: "prompt", brain: "task", cost: { ms: 5, tokens: 3 } }];
  for (let i = 0; i < n; i++) {
    steps.push({ kind: "ask", tool: "search", toolName: "search", input: { i }, brain: "calling", cost: { ms: 4, tokens: 2 } });
    steps.push({ kind: "return", tool: "search", toolName: "search", replyType: "data", output: { ok: i }, brain: "reason", cost: { ms: 6, tokens: 5 } });
  }
  steps.push({ kind: "answer", to: "you", brain: "done", answer, cost: { ms: 5, tokens: 4 } });
  return { task: "t", title: "T" + n, agent: "a", model: "m", asker: "you", steps };
};
const nodes = (c) => c.querySelectorAll("*").length;

afterEach(cleanup);

describe("UI render performance (the player's own rendering)", () => {
  const measure = (steps) => {
    const t = gen(Math.round((steps - 2) / 2));
    const t0 = performance.now();
    let c;
    act(() => { c = render(React.createElement(AgentThinkingUI, { trace: t, storageKey: null })).container; });
    const mountMs = performance.now() - t0;
    return { dom: nodes(c), mountMs, total: t.steps.length };
  };

  it("keeps DOM bounded as the trace grows (10 → ~1200 steps)", () => {
    const small = measure(22);     // ~10 tool calls
    const big = measure(1202);     // ~600 tool calls
    console.log(`\n[ui-perf] small trace: ${small.total} steps → ${small.dom} DOM nodes, mount ${small.mountMs.toFixed(1)}ms`);
    // the headline UI metric: a 60× longer trace does NOT blow up the DOM
    expect(big.dom).toBeLessThan(small.dom * 1.5);
    expect(big.dom).toBeLessThan(400);
  });

  it("reports UI render metrics via the onRender prop (React Profiler)", () => {
    const seen = [];
    act(() => { render(React.createElement(AgentThinkingUI, { trace: gen(3), storageKey: null, onRender: (m) => seen.push(m) })); });
    expect(seen.length).toBeGreaterThan(0);
    const m = seen[0];
    expect(m.id).toBe("agentthinkingui");
    expect(m.phase).toBe("mount");
    expect(typeof m.actualMs).toBe("number");
    expect(m.steps).toBe(gen(3).steps.length); // enriched with player context
  });

  it("stays bounded when tailing the newest beat of a long trace", () => {
    const t = gen(600); // 1202 steps
    let utils;
    act(() => { utils = render(React.createElement(AgentThinkingUI, { trace: t, storageKey: null })); });
    act(() => { utils.rerender(React.createElement(AgentThinkingUI, { trace: t, storageKey: null, live: true })); }); // tail to newest
    expect(nodes(utils.container)).toBeLessThan(400); // still bounded at the tail
  });
});
