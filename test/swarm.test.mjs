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
const MT = {
  task: "team task", asker: "x",
  agents: [
    { id: "root", name: "Planner", role: "orchestrator", status: "done", trace: mini("plan") },
    { id: "w1", name: "Worker One", role: "travel", parent: "root", status: "running", trace: mini("fly") },
  ],
  handoffs: [{ from: "root", to: "w1", label: "go" }],
};

afterEach(cleanup);

describe("<AgentSwarm>", () => {
  it("renders a card per agent plus the handoff edge", () => {
    const { container, getByText } = render(React.createElement(AgentSwarm, { trace: MT }));
    expect(container.querySelectorAll(".agent-card").length).toBe(2);
    expect(getByText("Planner")).toBeTruthy();
    expect(getByText("Worker One")).toBeTruthy();
    expect(container.querySelector(".swarm-edge")).toBeTruthy();
  });

  it("drills into an agent's flow and back to the team map", () => {
    const { container, getByText } = render(React.createElement(AgentSwarm, { trace: MT }));
    fireEvent.click(getByText("Worker One"));
    expect(container.querySelector(".flowscene")).toBeTruthy(); // the reused single-agent player
    expect(container.querySelector(".swarm-crumb")).toBeTruthy();
    fireEvent.click(getByText("‹ Team"));
    expect(container.querySelectorAll(".agent-card").length).toBe(2); // back on the map
  });
});
