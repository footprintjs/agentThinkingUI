import React from "react";
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, cleanup, fireEvent } from "@testing-library/react";
import { AgentThinkingUI } from "../src/footprint.jsx";
import { MultiAgentFlow } from "../src/multi-agent-flow.jsx";

const answer = { headline: "H", plan: [], budget: [], cta: "" };
const trace = {
  task: "t", title: "T", agent: "a", model: "m", asker: "x",
  steps: [
    { kind: "prompt", brain: "hi", cost: { ms: 1, tokens: 1 }, spanId: "S0", traceId: "TR" },
    { kind: "answer", to: "x", brain: "done", answer, cost: { ms: 1, tokens: 1 }, spanId: "S1", traceId: "TR" },
  ],
};
const mini = (n) => ({ task: n, agent: n, model: "m", asker: "o", steps: [
  { kind: "prompt", brain: n + " working", cost: { ms: 1, tokens: 1 } },
  { kind: "answer", to: "o", brain: "done", answer, cost: { ms: 1, tokens: 1 } },
] });
const graph = { task: "team", nodes: [
  { id: "p", kind: "agent", name: "Planner", spanId: "SP", trace: mini("Planner") },
  { id: "f", kind: "agent", name: "Flights", spanId: "SF", trace: mini("Flights") },
], edges: [{ from: "p", to: "f", kind: "seq" }] };

afterEach(cleanup);

describe("<AgentThinkingUI> host hooks", () => {
  it("fires onSelect with the current step (carrying spanId) on mount + step change", () => {
    const onSelect = vi.fn();
    const { getByLabelText } = render(React.createElement(AgentThinkingUI, { trace, storageKey: null, onSelect }));
    expect(onSelect).toHaveBeenCalled();
    expect(onSelect.mock.calls[0][0].spanId).toBe("S0"); // step 0 on mount
    fireEvent.click(getByLabelText("Next step"));
    const last = onSelect.mock.calls[onSelect.mock.calls.length - 1];
    expect(last[0].spanId).toBe("S1"); // advanced
    expect(last[1]).toBe(1);           // index
  });

  it("renders a deep-link affordance from linkResolver", () => {
    const { container } = render(React.createElement(AgentThinkingUI, { trace, storageKey: null, linkResolver: (s) => s.spanId ? "https://obs.example/span/" + s.spanId : null }));
    const link = container.querySelector(".insp-link");
    expect(link).toBeTruthy();
    expect(link.getAttribute("href")).toBe("https://obs.example/span/S0");
  });

  it("renders host-supplied detail via renderDetail (content OTel didn't capture)", () => {
    const { container } = render(React.createElement(AgentThinkingUI, {
      trace, storageKey: null,
      renderDetail: (s) => React.createElement("div", { "data-testid": "raw" }, "raw log for " + s.spanId),
    }));
    const extra = container.querySelector(".insp-extra [data-testid=raw]");
    expect(extra).toBeTruthy();
    expect(extra.textContent).toBe("raw log for S0");
  });

  it("dispatches a DOM CustomEvent for non-React hosts", () => {
    const { container } = render(React.createElement(AgentThinkingUI, { trace, storageKey: null }));
    const seen = [];
    container.querySelector(".atui").addEventListener("agentthinkingui:select", (e) => seen.push(e.detail));
    fireEvent.click(container.querySelector('button[title="Next step"]'));
    expect(seen.some((d) => d.spanId === "S1")).toBe(true);
  });
});

describe("<MultiAgentFlow> host hooks", () => {
  it("fires onNodeOpen when an agent is drilled into", () => {
    const onNodeOpen = vi.fn();
    const { container } = render(React.createElement(MultiAgentFlow, { trace: graph, onNodeOpen }));
    fireEvent.click(container.querySelector(".agent-card"));
    expect(onNodeOpen).toHaveBeenCalled();
    expect(onNodeOpen.mock.calls[0][0].name).toBe("Planner");
    expect(container.querySelector(".flowscene")).toBeTruthy(); // drilled in
  });

  it("renders a deep-link affordance on agent cards from linkResolver", () => {
    const { container } = render(React.createElement(MultiAgentFlow, { trace: graph, linkResolver: (n) => n.spanId ? "https://obs.example/agent/" + n.spanId : null }));
    expect(container.querySelectorAll(".agent-card .ac-extlink").length).toBe(2);
  });
});
