import { describe, it, expect } from "vitest";
import { buildToolWhyText } from "../src/copyForLLM.js";
import { toolRelevance } from "../src/relevance.js";

/**
 * buildToolWhyText: the "Copy for LLM" payload for a tool choice. The relevance
 * bars are a proxy; this hands the task + trajectory + tool menu (with scores)
 * to a real LLM. Pure text — the caller writes it to the clipboard.
 */
const SEEN = [
  { name: "get_interface_status", description: "interface status, flap counters for a switch port" },
  { name: "search_hotels", description: "find hotels in a city" },
];
const askStep = { kind: "ask", tool: "get_interface_status", input: { iface: "fc1/3" }, brain: "pulling interface status" };
const trace = {
  task: "fc1/3 interface is flapping on the switch port",
  steps: [{ kind: "prompt", brain: "got the report" }, askStep],
};
const ranked = toolRelevance("pulling interface status fc1/3 flapping switch port", SEEN);

describe("buildToolWhyText", () => {
  const text = buildToolWhyText({ trace, step: askStep, ranked, focusName: "get_interface_status" });

  it("frames the question around the picked tool", () => {
    expect(text).toMatch(/Why did the agent pick this tool/);
    expect(text).toContain("`get_interface_status`");
    expect(text).toContain("← PICKED");
  });

  it("includes the task, the trajectory, the candidate menu with scores, and the ask", () => {
    expect(text).toContain("## Task");
    expect(text).toContain("fc1/3 interface is flapping");
    expect(text).toContain("## Trajectory so far");
    expect(text).toContain("CALL `get_interface_status`");
    expect(text).toContain("search_hotels"); // the other candidate is listed
    expect(text).toContain("## Please answer");
  });

  it('says "skill" when the focused entry is a skill', () => {
    const t = buildToolWhyText({ trace, step: askStep, ranked, focusName: "load_skill" });
    expect(t).toMatch(/Why did the agent pick this skill/);
  });

  it("caps the payload so a huge trajectory doesn't blow the clipboard", () => {
    const big = {
      task: "x",
      steps: Array.from({ length: 500 }, (_, i) => ({ kind: "ask", tool: "t" + i, input: { q: "y".repeat(200) }, brain: "z".repeat(200) })),
    };
    const t = buildToolWhyText({ trace: big, step: big.steps[400], ranked, focusName: "t400" });
    expect(t.length).toBeLessThanOrEqual(16000 + 60);
    expect(t).toMatch(/truncated/);
  });
});
