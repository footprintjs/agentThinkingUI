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

  it("lists all four scoring strategies (keyword / meaning / what drove it / ask the model)", () => {
    const { container } = renderInsp({ toolMenu: "rack", whyTool: "get_interface_status" });
    expect(strat(container, "Keyword")).toBeTruthy();
    expect(strat(container, "Meaning")).toBeTruthy();
    expect(strat(container, "What drove it")).toBeTruthy();
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

  // ── "What drove it" — the 4th strategy (per-pick attribution) ──
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

  it('greys "What drove it" when the pick has no stamped attribution and no onAttribute', () => {
    const r = strat(renderInsp({ toolMenu: "rack", whyTool: "get_interface_status" }).container, "What drove it");
    expect(r.disabled).toBe(true);
    expect(r.classList.contains("off")).toBe(true);
  });

  it("stamped step.attribution powers 'What drove it' — it is the default, renders ranked rule bars + the % headline + the cited rule", () => {
    const { container } = renderInsp({ toolMenu: "rack", whyTool: "get_interface_status", step: attributed, trace: attrTrace });
    const r = strat(container, "What drove it");
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

  it("'What drove it' computes lazily via onAttribute on tab-open (a call, so NOT the default)", async () => {
    const onAttribute = vi.fn().mockResolvedValue({
      headline: "88% procedural",
      rows: [
        { label: "rule-1", score: 0.8, quote: "orient first", picked: true },
        { label: "the task", score: 0.1 },
      ],
    });
    const { container, findByText } = renderInsp({ toolMenu: "rack", whyTool: "get_interface_status", onAttribute });
    const r = strat(container, "What drove it");
    expect(r.disabled).toBe(false);                 // onAttribute enables it
    expect(r.classList.contains("on")).toBe(false); // but it costs a call → keyword stays the default
    fireEvent.click(r);
    await findByText(/88% procedural/);
    expect(onAttribute).toHaveBeenCalledTimes(1);
    expect(container.querySelector(".why-headline")).toBeTruthy();
  });

  // ── The VERDICT CARD — multi-channel "what drove it" (answer-first) ──
  // Real numbers from agentfootprint's explainChoice on the dress-shop runs.
  const VERDICT_SEEN = [
    { name: "whats_here", description: "list what is in the current place" },
    { name: "skill_purchase", description: "the purchase steering doc" },
    { name: "search_products", description: "search the catalog" },
  ];
  // Procedural pick: whats_here — the agent's own rules drove it (88%).
  const proceduralStep = {
    kind: "ask", tool: "whats_here", toolName: "What's here",
    input: {}, brain: "orienting first, per the rules", cost: { ms: 10, tokens: 5 }, toolsSeen: VERDICT_SEEN,
    attribution: {
      headline: "88% procedural",
      note: "Best explanation: the agent's own rules. (similarity estimate — not a mind-read)",
      channels: [
        { id: "system", share: 0.88, quote: "Call whats_here first — orient before acting.", citeLabel: "Rule 1" },
        { id: "task", share: 0.10 },
        { id: "data", share: 0.03 },
      ],
      rows: [
        { label: "Rule 1", score: 0.75, quote: "Call whats_here first — orient before acting.", picked: true, channel: "system" },
        { label: "the task", score: 0.12, channel: "task" },
      ],
    },
  };
  const proceduralTrace = { task: "buy the red floral dress", steps: [proceduralStep] };
  // Data-driven pick: skill_purchase — an earlier tool's data drove it (41%).
  const dataStep = {
    ...proceduralStep,
    tool: "skill_purchase", toolName: "Purchase skill",
    attribution: {
      note: "Best explanation: data returned by an earlier tool.",
      channels: [
        { id: "data", share: 0.41, quote: "id: d42, name: red floral dress, price: 89", citeLabel: "search result" },
        { id: "system", share: 0.36, quote: "When a step returns a data field, READ it as data…", citeLabel: "Rule 3" },
        { id: "task", share: 0.22 },
      ],
      rows: [
        { label: "search result", score: 0.41, quote: "id: d42, name: red floral dress, price: 89", picked: true, channel: "data" },
      ],
    },
  };
  const dataTrace = { task: "buy the red floral dress", steps: [dataStep] };

  it("channels stamped → the verdict card leads: one .wv-row per channel, tabular %s, only the winning channel cited", () => {
    const { container } = renderInsp({ toolMenu: "rack", whyTool: "whats_here", step: proceduralStep, trace: proceduralTrace });
    const card = container.querySelector(".why-verdict");
    expect(card).toBeTruthy();
    const rows = card.querySelectorAll(".wv-row");
    expect(rows).toHaveLength(3);
    // upstream's order is trusted: the winner (system) leads
    expect([...rows].map((r) => r.querySelector(".wv-label").textContent)).toEqual(["system", "task", "data"]);
    expect([...rows].map((r) => r.querySelector(".wv-pct").textContent)).toEqual(["88%", "10%", "3%"]);
    expect(rows[0].querySelector(".wv-fill").style.width).toBe("88%");
    // the WINNING channel carries its citation (citeLabel + quote); the others don't
    const cite = rows[0].querySelector(".wv-cite");
    expect(cite).toBeTruthy();
    expect(cite.textContent).toContain("Rule 1");
    expect(cite.textContent).toContain("Call whats_here first");
    expect(card.querySelectorAll(".wv-cite")).toHaveLength(1);
    // the ranked rows still render below the card as the detailed evidence
    expect(container.querySelectorAll(".why-tool .wt-row")).toHaveLength(2);
    expect(container.querySelector(".why-headline").textContent).toMatch(/88% procedural/);
  });

  it("channels stamped → 'What drove it' is the DEFAULT tab on open; no onScore/onAttribute call fired; other tabs read as second opinions", () => {
    const onScore = vi.fn();
    const onAttribute = vi.fn();
    const { container } = renderInsp({ toolMenu: "rack", whyTool: "whats_here", step: proceduralStep, trace: proceduralTrace, onScore, onAttribute });
    const r = strat(container, "What drove it");
    expect(r.classList.contains("on")).toBe(true);   // the verdict is the default view
    expect(container.querySelector(".why-verdict")).toBeTruthy();
    expect(onScore).not.toHaveBeenCalled();          // opening the panel never spends
    expect(onAttribute).not.toHaveBeenCalled();      // stamped → free, no lazy call
    const second = container.querySelector(".why-second");
    expect(second).toBeTruthy();
    expect(second.textContent).toMatch(/second opinions:/);
  });

  it("data-driven pick: the data channel wins in upstream's order and quotes the search result", () => {
    const { container } = renderInsp({ toolMenu: "rack", whyTool: "skill_purchase", step: dataStep, trace: dataTrace });
    const rows = container.querySelectorAll(".why-verdict .wv-row");
    expect([...rows].map((r) => r.querySelector(".wv-label").textContent)).toEqual(["data", "system", "task"]);
    expect([...rows].map((r) => r.querySelector(".wv-pct").textContent)).toEqual(["41%", "36%", "22%"]);
    const cite = rows[0].querySelector(".wv-cite");
    expect(cite.textContent).toContain("search result");
    expect(cite.textContent).toContain("red floral dress");
    expect(container.querySelectorAll(".why-verdict .wv-cite")).toHaveLength(1);
  });

  it("channels absent + rows present → NO .why-verdict; today's headline + rows rendering intact (back-compat)", () => {
    const { container } = renderInsp({ toolMenu: "rack", whyTool: "get_interface_status", step: attributed, trace: attrTrace });
    expect(container.querySelector(".why-verdict")).toBeNull();
    expect(container.querySelector(".wv-note")).toBeNull();
    expect(container.querySelector(".why-second")).toBeNull();
    expect(container.querySelector(".why-headline").textContent).toMatch(/93% procedural/);
    expect(container.querySelectorAll(".why-tool .wt-row")).toHaveLength(3);
  });

  it("the plain-language note renders under the card in .wv-note", () => {
    const { container } = renderInsp({ toolMenu: "rack", whyTool: "whats_here", step: proceduralStep, trace: proceduralTrace });
    expect(container.querySelector(".wv-note").textContent).toBe(
      "Best explanation: the agent's own rules. (similarity estimate — not a mind-read)",
    );
  });

  it("out-of-range shares are clamped in the meter width (0..100%)", () => {
    const wild = { ...proceduralStep, attribution: { channels: [{ id: "system", share: 1.5 }, { id: "data", share: -0.2 }], rows: [] } };
    const { container } = renderInsp({ toolMenu: "rack", whyTool: "whats_here", step: wild, trace: { ...proceduralTrace, steps: [wild] } });
    const fills = container.querySelectorAll(".why-verdict .wv-fill");
    expect(fills).toHaveLength(2);
    expect(fills[0].style.width).toBe("100%");
    expect(fills[1].style.width).toBe("0%");
  });

  it("the winning quote is truncated to ~110 chars, rendered as text (never HTML)", () => {
    const long = "<img src=x onerror=alert(1)>" + "x".repeat(200);
    const step = { ...proceduralStep, attribution: { channels: [{ id: "system", share: 0.9, quote: long, citeLabel: "Rule 1" }, { id: "task", share: 0.1 }], rows: [] } };
    const { container } = renderInsp({ toolMenu: "rack", whyTool: "whats_here", step, trace: { ...proceduralTrace, steps: [step] } });
    const cite = container.querySelector(".wv-cite");
    expect(cite.textContent).toContain("…");                    // clipped
    expect(cite.textContent.length).toBeLessThan(140);
    expect(cite.querySelector("img")).toBeNull();               // text node, not markup
    expect(cite.textContent).toContain("<img");                 // the raw text survives AS text
  });
});
