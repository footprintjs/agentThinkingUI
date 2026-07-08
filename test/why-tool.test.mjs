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

  const strat = (container, name) => [...container.querySelectorAll(".why-strat")].find((b) => new RegExp(name).test(b.textContent));

  it("lists all four scoring strategies (keyword / meaning / by the rules / ask the model)", () => {
    const { container } = renderInsp({ toolMenu: "rack", whyTool: "get_interface_status" });
    expect(strat(container, "Keyword")).toBeTruthy();
    expect(strat(container, "Meaning")).toBeTruthy();
    expect(strat(container, "By the rules")).toBeTruthy();
    expect(strat(container, "Ask the model")).toBeTruthy();
  });

  it("greys the model (LLM) strategy tab (disabled) unless onExplain is wired", () => {
    const off = strat(renderInsp({ toolMenu: "rack", whyTool: "get_interface_status" }).container, "Ask the model");
    expect(off.disabled).toBe(true);
    expect(off.classList.contains("off")).toBe(true);
    const on = strat(renderInsp({ toolMenu: "rack", whyTool: "get_interface_status", onExplain: vi.fn() }).container, "Ask the model");
    expect(on.disabled).toBe(false);
  });

  it("Explain (live) is under the model tab: switch to it, then it calls onExplain and renders the reason", async () => {
    const onExplain = vi.fn().mockResolvedValue("It picked it because the step was about the interface flap.");
    const { container, findByText } = renderInsp({ toolMenu: "rack", whyTool: "get_interface_status", onExplain });
    expect(container.querySelector(".why-explain")).toBeNull(); // hidden until the model strategy is active
    fireEvent.click(strat(container, "Ask the model"));
    fireEvent.click(container.querySelector(".why-explain"));
    await findByText(/because the step was about the interface flap/);
    const ctx = onExplain.mock.calls[0][0];
    expect(ctx.tool).toBe("get_interface_status");
    expect(ctx.prompt).toMatch(/Why did the agent pick/);
    expect(ctx.step).toBe(askStep);
  });

  it("renders an error message if onExplain rejects", async () => {
    const onExplain = vi.fn().mockRejectedValue(new Error("no API key"));
    const { container, findByText } = renderInsp({ toolMenu: "rack", whyTool: "get_interface_status", onExplain });
    fireEvent.click(strat(container, "Ask the model"));
    fireEvent.click(container.querySelector(".why-explain"));
    await findByText(/Couldn't get the explanation: no API key/);
  });

  it("greys the meaning (semantic) tab (tooltip) with no real relevance — default view is keyword, no numeric bars", () => {
    const { container } = renderInsp({ toolMenu: "rack", whyTool: "get_interface_status" });
    const sem = strat(container, "Meaning");
    expect(sem.disabled).toBe(true);
    expect(sem.classList.contains("off")).toBe(true);
    expect(sem.getAttribute("title")).toMatch(/embedding model/i);
    expect(container.querySelector(".why-tool .wt-meter")).toBeNull();
  });

  it("enables meaning (semantic) + shows real ranked bars when upstream relevance is provided", () => {
    const scored = { ...askStep, toolsSeen: SEEN.map((t, i) => ({ ...t, relevance: [0.92, 0.41, 0.18][i] })) };
    const { container } = renderInsp({ toolMenu: "rack", whyTool: "get_interface_status", step: scored, trace: { task: "fc1/3 interface is flapping", steps: [scored] } });
    const sem = strat(container, "Meaning");
    expect(sem.disabled).toBe(false);
    expect(sem.classList.contains("on")).toBe(true); // best available (no attribution) → default active
    expect(container.querySelector(".why-tool .wt-meter")).toBeTruthy();
    expect(container.querySelector(".why-tool .wt-val")).toBeTruthy();
  });

  it("model (LLM) strategy runs the onScore judge on tab-open and renders ranked bars (procedural pick can rank first)", async () => {
    const onScore = vi.fn().mockResolvedValue({ scores: [
      { name: "get_interface_status", score: 0.91, rationale: "the reasoning is about the interface flap" },
      { name: "search_hotels", score: 0.08 },
      { name: "load_skill", score: 0.2 },
    ] });
    const { container, findByText } = renderInsp({ toolMenu: "rack", whyTool: "get_interface_status", onScore });
    const llm = strat(container, "Ask the model");
    expect(llm.disabled).toBe(false);           // onScore alone enables the model strategy
    fireEvent.click(llm);
    await findByText(/0\.91/);                    // the judge's bar value rendered
    expect(onScore).toHaveBeenCalledTimes(1);
    const ctx = onScore.mock.calls[0][0];
    expect(ctx.step).toBe(askStep);
    expect(ctx.tools.map((t) => t.name)).toContain("get_interface_status");
    expect(container.querySelector(".why-tool .wt-meter")).toBeTruthy(); // real bars
    expect(container.querySelector(".why-explain")).toBeNull();          // no onExplain → no explain button
    // the top-scored tool is first even though lexical would rank it elsewhere
    expect(container.querySelector(".why-tool .wt-row .wt-name").textContent).toBe("get_interface_status");
  });

  // ── "By the rules" — the 4th strategy (per-rule attribution) ──
  const attributed = {
    ...askStep,
    attribution: {
      headline: "93% procedural",
      rows: [
        { label: "rule-1", score: 0.75, quote: "Call whats_here first — orient before acting.", picked: true },
        { label: "rule-2", score: 0.42, quote: "For a multi-step task, open the skill." },
        { label: "the task", score: 0.12, quote: "fc1/3 interface is flapping" },
      ],
    },
  };
  const attrTrace = { task: "fc1/3 interface is flapping on the switch port", steps: [attributed] };

  it('greys "By the rules" when the pick has no stamped attribution and no onAttribute', () => {
    const r = strat(renderInsp({ toolMenu: "rack", whyTool: "get_interface_status" }).container, "By the rules");
    expect(r.disabled).toBe(true);
    expect(r.classList.contains("off")).toBe(true);
  });

  it("stamped step.attribution powers 'By the rules' — it is the default, renders ranked rule bars + the % headline + the cited rule", () => {
    const { container } = renderInsp({ toolMenu: "rack", whyTool: "get_interface_status", step: attributed, trace: attrTrace });
    const r = strat(container, "By the rules");
    expect(r.disabled).toBe(false);
    expect(r.classList.contains("on")).toBe(true); // stamped attribution is FREE → the default view
    expect(container.querySelector(".why-headline").textContent).toMatch(/93% procedural/);
    expect(container.querySelectorAll(".why-tool .wt-row")).toHaveLength(3);
    // rules DO show a numeric bar (unlike the keyword proxy)
    expect(container.querySelector(".why-tool .wt-meter")).toBeTruthy();
    // the top-attributing rule leads, is tagged, and quotes its text
    const top = container.querySelector(".why-tool .wt-row");
    expect(top.classList.contains("picked")).toBe(true);
    expect(top.querySelector(".wt-name").textContent).toBe("rule-1");
    expect(top.querySelector(".wt-tag").textContent).toMatch(/top/i);
    expect(top.querySelector(".wt-matched").textContent).toMatch(/Call whats_here first/);
  });

  it("'By the rules' computes lazily via onAttribute on tab-open (a call, so NOT the default)", async () => {
    const onAttribute = vi.fn().mockResolvedValue({
      headline: "88% procedural",
      rows: [
        { label: "rule-1", score: 0.8, quote: "orient first", picked: true },
        { label: "the task", score: 0.1 },
      ],
    });
    const { container, findByText } = renderInsp({ toolMenu: "rack", whyTool: "get_interface_status", onAttribute });
    const r = strat(container, "By the rules");
    expect(r.disabled).toBe(false);                 // onAttribute enables it
    expect(r.classList.contains("on")).toBe(false); // but it costs a call → keyword stays the default
    fireEvent.click(r);
    await findByText(/88% procedural/);
    expect(onAttribute).toHaveBeenCalledTimes(1);
    expect(container.querySelector(".why-headline")).toBeTruthy();
  });
});
