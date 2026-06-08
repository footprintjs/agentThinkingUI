import React from "react";
import { describe, it, expect, afterEach, beforeEach } from "vitest";
import { render, cleanup, fireEvent } from "@testing-library/react";
import { AgentThinkingUI } from "../src/footprint.jsx";

afterEach(cleanup);
// The player persists the scrub position per trace — clear it so each test
// starts at beat 0 (otherwise a prior test's position leaks in).
beforeEach(() => { try { localStorage.clear(); } catch { /* ignore */ } });

/**
 * Extended thinking: a beat may carry `thinking` (Claude's chain-of-thought).
 * The scene shows it as a collapsible "💭 thinking" callout above the action —
 * collapsed = preview, expanded = full reasoning. Beats without `thinking` show
 * no callout.
 */
const ASK_THINKING =
  "Let me think through fc1/3 carefully: it is flapping with CRC errors, so the most likely root cause is a DEEPMARKER degraded SFP at the physical layer.";

const TRACE = {
  task: "is fc1/3 healthy?",
  agent: "Neo",
  model: "claude",
  asker: "you",
  steps: [
    { kind: "prompt", brain: "is fc1/3 healthy?", cost: { ms: 0, tokens: 0 } },
    { kind: "ask", tool: "get_status", toolName: "get_status", input: { port: "fc1/3" }, brain: "checking status", thinking: ASK_THINKING, cost: { ms: 10, tokens: 5 } },
    { kind: "return", tool: "get_status", toolName: "get_status", replyType: "data", output: { crc: 892 }, brain: "", cost: { ms: 1, tokens: 0 } },
    { kind: "answer", to: "you", brain: "fc1/3 degraded SFP", answer: { headline: "fc1/3 degraded SFP" }, thinking: "Final: CRC + signal loss = physical-layer fault; recommend SFP swap.", cost: { ms: 5, tokens: 3 } },
  ],
};

const tcText = (container) => container.querySelector(".thinking-callout .tc-text")?.textContent ?? "";

describe("<AgentThinkingUI> — extended-thinking callout", () => {
  it("shows the chain-of-thought in a collapsible callout on a thinking beat", () => {
    const { container, getByTitle } = render(React.createElement(AgentThinkingUI, { trace: TRACE }));
    fireEvent.click(getByTitle("Next step")); // → ask beat (index 1)

    const callout = container.querySelector(".thinking-callout");
    expect(callout, "ask beat renders a thinking callout").toBeTruthy();
    expect(callout.textContent).toContain("thinking"); // the 💭 label
    // collapsed → preview only (tail hidden)
    expect(tcText(container)).not.toContain("DEEPMARKER");
    // expand → full reasoning
    fireEvent.click(callout.querySelector(".tc-toggle"));
    expect(tcText(container)).toContain("DEEPMARKER");
  });

  it("renders no callout on a beat without thinking", () => {
    const { container } = render(React.createElement(AgentThinkingUI, { trace: TRACE }));
    // index 0 = prompt, no `thinking`
    expect(container.querySelector(".thinking-callout")).toBeNull();
  });
});
