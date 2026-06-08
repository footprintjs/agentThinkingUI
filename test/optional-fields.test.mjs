import React from "react";
import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup, fireEvent } from "@testing-library/react";
import { AgentThinkingUI } from "../src/footprint.jsx";

afterEach(cleanup);

/**
 * Regression: a VALID trace may omit every OPTIONAL field —
 *   - a `return` instruction step without `actChecklist`
 *   - an `answer` with only `headline` (no plan / budget / cta)
 * The player must render every beat without crashing. (Found by the
 * agentfootprint `agentThinkingTrace` recorder, whose traces are exactly this
 * shape — minimal, contract-valid. Previously crashed in SkillDoc /
 * Inspector with "Cannot read properties of undefined (reading 'map')".)
 */
const MINIMAL = {
  task: "is fc1/3 healthy?",
  agent: "Neo",
  model: "mock",
  asker: "you",
  steps: [
    { kind: "prompt", brain: "is fc1/3 healthy?", cost: { ms: 0, tokens: 0 } },
    { kind: "ask", tool: "triage", toolName: "read_skill", input: { id: "triage" }, brain: "load the procedure", cost: { ms: 10, tokens: 5 } },
    // instruction reply WITHOUT actChecklist
    { kind: "return", tool: "triage", toolName: "read_skill", replyType: "instruction", skill: "triage", output: { value: "ok" }, brain: "", brainMode: "act", cost: { ms: 2, tokens: 0 } },
    { kind: "ask", tool: "get_status", toolName: "get_status", input: { host: "x" }, brain: "check status", cost: { ms: 8, tokens: 4 } },
    { kind: "return", tool: "get_status", toolName: "get_status", replyType: "data", output: { down: 1 }, brain: "", brainMode: "reason", cost: { ms: 1, tokens: 0 } },
    // answer with ONLY a headline
    { kind: "answer", to: "you", brain: "done", answer: { headline: "fc1/3 is down" }, cost: { ms: 5, tokens: 3 } },
  ],
};

describe("<AgentThinkingUI> — contract-valid trace with optional fields omitted", () => {
  it("renders every beat without crashing (no actChecklist / plan / budget / cta)", () => {
    const { container, getByTitle } = render(React.createElement(AgentThinkingUI, { trace: MINIMAL }));
    const next = getByTitle("Next step");
    // Walking every beat renders SkillDoc (instruction) + the answer card —
    // pre-fix this threw on the missing optional arrays.
    for (let i = 0; i < MINIMAL.steps.length - 1; i++) fireEvent.click(next);
    expect(container.querySelector(".answer-card")).toBeTruthy();
    expect(container.querySelector(".ac-head").textContent).toContain("fc1/3 is down");
  });
});
