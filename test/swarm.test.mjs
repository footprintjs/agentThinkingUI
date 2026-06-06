import React from "react";
import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup, fireEvent } from "@testing-library/react";
import { AgentSwarm, layoutFlow, countCrossings } from "../src/swarm.jsx";

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

describe("layoutFlow — layered layout + barycenter crossing reduction", () => {
  it("untangles a graph that crosses under naive insertion order", () => {
    // A,B are sources (col 0); X,Y are sinks (col 1). The edges A→Y and B→X
    // cross if col 1 keeps insertion order [X,Y]; barycenter should flip it.
    const nodes = [
      { id: "A", kind: "agent" }, { id: "B", kind: "agent" },
      { id: "X", kind: "agent" }, { id: "Y", kind: "agent" },
    ];
    const edges = [{ from: "A", to: "Y", kind: "seq" }, { from: "B", to: "X", kind: "seq" }];
    const { pos } = layoutFlow(nodes, edges);
    // two columns are formed
    expect(new Set(Object.values(pos).map((p) => p.cx)).size).toBe(2);
    // and the layout is crossing-free
    expect(countCrossings(nodes, edges, pos)).toBe(0);
  });

  it("countCrossings actually detects a crossing (metric isn't trivially zero)", () => {
    const nodes = [{ id: "A" }, { id: "B" }, { id: "X" }, { id: "Y" }];
    const edges = [{ from: "A", to: "Y", kind: "seq" }, { from: "B", to: "X", kind: "seq" }];
    // hand-built positions in the crossing (insertion) order: A,X top; B,Y bottom
    const pos = { A: { cx: 0, cy: 0 }, B: { cx: 0, cy: 100 }, X: { cx: 200, cy: 0 }, Y: { cx: 200, cy: 100 } };
    expect(countCrossings(nodes, edges, pos)).toBe(1);
  });

  it("keeps the longest-path column count (loops don't add columns)", () => {
    const nodes = [{ id: "d" }, { id: "f" }];
    const edges = [{ from: "d", to: "f", kind: "seq" }, { from: "f", to: "d", kind: "loop" }];
    const { pos } = layoutFlow(nodes, edges);
    expect(pos.f.cx).toBeGreaterThan(pos.d.cx); // f is one column to the right; the loop is ignored
  });
});

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
    fireEvent.click(getByText("‹ Back to team"));
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
