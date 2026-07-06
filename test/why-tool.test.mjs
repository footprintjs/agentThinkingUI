import React from "react";
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, cleanup, fireEvent } from "@testing-library/react";
import { Inspector } from "../src/inspector.jsx";

afterEach(cleanup);

/**
 * "Why this tool?" inspector panel (rack mode) — CLICK-ONLY. It appears only
 * when the user clicks a tool in the rack or the "Why this tool?" button
 * (whyTool set), not on every step. It ranks the tools the model saw by
 * relevance (bars), tags the picked one, shows the focused tool's matched terms,
 * and says "skill" when the focused entry is a skill. Card mode shows none of it.
 */
const SEEN = [
  { name: "get_interface_status", description: "interface status, flap counters for a switch port" },
  { name: "search_hotels", description: "find hotels in a city" },
  { name: "load_skill", description: "load a steering doc" },
];
const askStep = {
  kind: "ask", tool: "get_interface_status", toolName: "Interface status",
  input: { iface: "fc1/3" }, brain: "pulling interface status", cost: { ms: 10, tokens: 5 }, toolsSeen: SEEN,
};
const trace = { task: "fc1/3 interface is flapping on the switch port", steps: [askStep] };

const renderInsp = (props) =>
  render(
    React.createElement(Inspector, {
      step: askStep, index: 0, total: 1, onCollapse: () => {}, view: "inspector", setView: () => {},
      trace, ...props,
    }),
  );

describe("<Inspector> — Why this tool? (rack mode, click-only)", () => {
  it("appears only when a tool is clicked (whyTool set), not by default", () => {
    expect(renderInsp({ toolMenu: "rack", whyTool: null }).container.querySelector(".why-tool")).toBeNull();
    expect(renderInsp({ toolMenu: "rack", whyTool: "get_interface_status" }).container.querySelector(".why-tool")).toBeTruthy();
  });

  it("offers a 'Copy for LLM' button (the proxy isn't the real why)", () => {
    const { container } = renderInsp({ toolMenu: "rack", whyTool: "get_interface_status" });
    const btn = container.querySelector(".why-copy");
    expect(btn).toBeTruthy();
    expect(btn.textContent).toMatch(/copy for llm/i);
  });

  it("surfaces the seen tools with the picked one first and NO numeric bars (proxy)", () => {
    const { container, getByText } = renderInsp({ toolMenu: "rack", whyTool: "get_interface_status" });
    expect(getByText(/Why this tool\?/)).toBeTruthy();
    expect(container.querySelectorAll(".why-tool .wt-row")).toHaveLength(3);
    const picked = container.querySelector(".wt-row.picked");
    expect(picked.querySelector(".wt-tag")?.textContent).toMatch(/picked/i);
    expect(container.querySelector(".wt-row").classList.contains("picked")).toBe(true); // picked ranks first
    // The lexical proxy must NOT show a numeric score/bar — it misreads a
    // system-prompt / procedure-driven pick. Only a shared-wording hint.
    expect(container.querySelector(".why-tool .wt-val")).toBeNull();
    expect(container.querySelector(".why-tool .wt-meter")).toBeNull();
    expect(container.querySelectorAll(".why-tool .wt-matched").length).toBeGreaterThan(0);
  });

  it("focuses the clicked tool and shows its matched terms", () => {
    const { container } = renderInsp({ toolMenu: "rack", whyTool: "get_interface_status" });
    const focus = container.querySelector(".wt-row.focus");
    expect(focus.querySelector(".wt-name").textContent).toBe("get_interface_status");
    expect(container.querySelector(".wt-matched").textContent.toLowerCase()).toContain("interface");
  });

  it('says "Why this skill?" when the focused entry is a skill', () => {
    const { getByText } = renderInsp({ toolMenu: "rack", whyTool: "load_skill" });
    expect(getByText(/Why this skill\?/)).toBeTruthy();
  });

  it("shows nothing in card mode even if whyTool is set", () => {
    expect(renderInsp({ toolMenu: "card", whyTool: "get_interface_status" }).container.querySelector(".why-tool")).toBeNull();
  });

  it("offers 'Explain (live)' only when onExplain is wired", () => {
    expect(renderInsp({ toolMenu: "rack", whyTool: "get_interface_status" }).container.querySelector(".why-explain")).toBeNull();
    const onExplain = vi.fn().mockResolvedValue("because…");
    expect(renderInsp({ toolMenu: "rack", whyTool: "get_interface_status", onExplain }).container.querySelector(".why-explain")).toBeTruthy();
  });

  it("calls onExplain with the tool-choice context + prompt and renders the reason in place", async () => {
    const onExplain = vi.fn().mockResolvedValue("It picked it because the step was about the interface flap.");
    const { container, findByText } = renderInsp({ toolMenu: "rack", whyTool: "get_interface_status", onExplain });
    fireEvent.click(container.querySelector(".why-explain")); // target the button, not the subtitle that names it
    await findByText(/because the step was about the interface flap/);
    const ctx = onExplain.mock.calls[0][0];
    expect(ctx.tool).toBe("get_interface_status");
    expect(ctx.prompt).toMatch(/Why did the agent pick/);
    expect(ctx.step).toBe(askStep);
  });

  it("renders an error message if onExplain rejects", async () => {
    const onExplain = vi.fn().mockRejectedValue(new Error("no API key"));
    const { container, findByText } = renderInsp({ toolMenu: "rack", whyTool: "get_interface_status", onExplain });
    fireEvent.click(container.querySelector(".why-explain")); // target the button, not the subtitle that names it
    await findByText(/Couldn't get the explanation: no API key/);
  });
});
