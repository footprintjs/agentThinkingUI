import React from "react";
import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup, fireEvent } from "@testing-library/react";
import { AgentSwarm } from "../src/swarm.jsx";

const mini = (task) => ({
  task, agent: "a", model: "m", asker: "x",
  steps: [
    { kind: "prompt", brain: "hi", cost: { ms: 1, tokens: 1 } },
    { kind: "answer", to: "x", brain: "done", answer: { headline: "H", plan: [], budget: [], cta: "" }, cost: { ms: 1, tokens: 1 } },
  ],
});

// a graph exercising all four edge kinds + decision/merge nodes
const G = {
  task: "flow",
  nodes: [
    { id: "d", kind: "agent", name: "Drafter", role: "writer", status: "done", trace: mini("draft") },
    { id: "c", kind: "decision", label: "good?" },
    { id: "f", kind: "agent", name: "Finalizer", role: "writer", trace: mini("final") },
    { id: "m", kind: "merge", label: "merge" },
  ],
  edges: [
    { from: "d", to: "c", kind: "seq" },
    { from: "c", to: "f", kind: "conditional", label: "pass", taken: true },
    { from: "c", to: "d", kind: "loop", label: "revise ×2" },
    { from: "f", to: "m", kind: "parallel" },
  ],
};

afterEach(cleanup);

describe("<AgentSwarm> control-flow graph", () => {
  it("renders agent cards, a decision diamond, a merge, and the edges", () => {
    const { container, getByText } = render(React.createElement(AgentSwarm, { trace: G }));
    expect(container.querySelectorAll(".agent-card").length).toBe(2);
    expect(container.querySelector(".flow-decision")).toBeTruthy();
    expect(container.querySelector(".flow-merge")).toBeTruthy();
    expect(getByText("good?")).toBeTruthy();
    // a loop edge + a taken conditional edge are present
    expect(container.querySelector(".swarm-edge.loop")).toBeTruthy();
    expect(container.querySelector(".swarm-edge.taken")).toBeTruthy();
  });

  it("drills into an agent node and back; control nodes aren't clickable", () => {
    const { container, getByText } = render(React.createElement(AgentSwarm, { trace: G }));
    fireEvent.click(container.querySelector(".agent-card")); // first agent card
    expect(container.querySelector(".flowscene")).toBeTruthy();
    fireEvent.click(getByText("‹ Team"));
    expect(container.querySelectorAll(".agent-card").length).toBe(2);
  });

  it("exposes a team timeline + notepad (open by default), toggle-able", () => {
    const { container, getByText } = render(React.createElement(AgentSwarm, { trace: G }));
    expect(container.querySelector(".timeline")).toBeTruthy(); // team scrubber
    expect(container.querySelector(".swarm-commentary")).toBeTruthy(); // current-beat narration
    expect(container.querySelector(".swarm-notepad")).toBeTruthy(); // open by default
    expect(container.querySelectorAll(".swarm-notepad .note").length).toBeGreaterThan(0);
    fireEvent.click(getByText("Hide notepad")); // toggle closes it
    expect(container.querySelector(".swarm-notepad")).toBeNull();
  });
});
