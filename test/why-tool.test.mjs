import React from "react";
import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { Inspector } from "../src/inspector.jsx";

afterEach(cleanup);

/**
 * "Why this tool?" inspector panel (rack mode). Clicking a tool in the rack
 * focuses it here; the inspector ranks the tools the model saw by relevance to
 * the task (bars), tags the picked one, and shows the focused tool's matched
 * terms. Card mode shows none of this.
 */
const SEEN = [
  { name: "get_interface_status", description: "interface status, flap counters for a switch port" },
  { name: "search_hotels", description: "find hotels in a city" },
];
const askStep = {
  kind: "ask",
  tool: "get_interface_status",
  toolName: "Interface status",
  input: { iface: "fc1/3" },
  brain: "pulling status",
  cost: { ms: 10, tokens: 5 },
  toolsSeen: SEEN,
};
const trace = { task: "fc1/3 interface is flapping on the switch port", steps: [askStep] };

const renderInsp = (props) =>
  render(
    React.createElement(Inspector, {
      step: askStep, index: 0, total: 1, onCollapse: () => {}, view: "inspector", setView: () => {},
      trace, ...props,
    }),
  );

describe("<Inspector> — Why this tool? (rack mode)", () => {
  it("ranks the tools with bars and tags the picked one", () => {
    const { container, getByText } = renderInsp({ toolMenu: "rack", whyTool: null });
    expect(getByText(/Why this tool\?/)).toBeTruthy();
    const rows = container.querySelectorAll(".why-tool .wt-row");
    expect(rows).toHaveLength(2);
    // the picked tool (get_interface_status) is tagged + ranks first (on-topic)
    const picked = container.querySelector(".wt-row.picked");
    expect(picked).toBeTruthy();
    expect(picked.querySelector(".wt-tag")?.textContent).toMatch(/picked/i);
    expect(container.querySelector(".wt-row").classList.contains("picked")).toBe(true); // first row is the pick
  });

  it("defaults focus to the picked tool and shows its matched terms", () => {
    const { container } = renderInsp({ toolMenu: "rack", whyTool: null });
    const matched = container.querySelector(".wt-matched");
    expect(matched).toBeTruthy();
    expect(matched.textContent.toLowerCase()).toContain("interface");
  });

  it("moves focus to the clicked tool (whyTool)", () => {
    const { container } = renderInsp({ toolMenu: "rack", whyTool: "search_hotels" });
    const focus = container.querySelector(".wt-row.focus");
    expect(focus.querySelector(".wt-name").textContent).toBe("search_hotels");
  });

  it("shows nothing in card mode", () => {
    const { container } = renderInsp({ toolMenu: "card", whyTool: null });
    expect(container.querySelector(".why-tool")).toBeNull();
  });
});
