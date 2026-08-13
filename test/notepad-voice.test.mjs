import React from "react";
import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { Notepad } from "../src/inspector.jsx";
import { Stage } from "../src/stage.jsx";
import { fromOTLP } from "../src/adapters/otlp.js";

afterEach(cleanup);

/**
 * One narrator per line.
 *
 * The notepad prefixes a beat with "LLM reasons — " / "LLM follows <skill> — ",
 * which CLAIMS the sentence after it is the model's own words. A trace may
 * instead put the FRAMEWORK's delivery sentence in `brain` ("The tool returned
 * its result. SEO will share it with the LLM next.") — stamped
 * `brainSource: "framework"`. Those render plain: no "LLM …" prefix, so the
 * line never reads as two narrators at once.
 */
const FRAMEWORK_LINE = "The tool returned its result. SEO will share it with the LLM next.";

const trace = (...steps) => ({ task: "t", agent: "a", model: "m", asker: "you", steps });
const notes = (container) => [...container.querySelectorAll(".note-text")].map((n) => n.textContent);
const show = (t) => render(React.createElement(Notepad, {
  trace: t, index: t.steps.length - 1, onCollapse: () => {}, view: "notepad", setView: () => {},
}));

const dataBeat = (extra) => ({
  kind: "return", tool: "seo_audit", toolName: "seo_audit", replyType: "data",
  output: { score: 61 }, cost: { ms: 4, tokens: 2 }, ...extra,
});
const instrBeat = (extra) => ({
  kind: "return", tool: "read_skill", toolName: "read_skill", replyType: "instruction",
  skill: "triage", output: {}, cost: { ms: 4, tokens: 2 }, ...extra,
});

describe("notepad — the 'LLM …' prefix marks model-authored text only", () => {
  it("keeps the prefix on a data beat whose body is the model's own text", () => {
    const { container } = show(trace(dataBeat({ brain: "Score is 61 — the meta descriptions are missing." })));
    expect(notes(container)[0]).toBe("LLM reasons — Score is 61 — the meta descriptions are missing.");
  });

  it("drops the prefix when the body is the framework's delivery sentence", () => {
    const { container } = show(trace(dataBeat({ brain: FRAMEWORK_LINE, brainSource: "framework" })));
    expect(notes(container)[0]).toBe(FRAMEWORK_LINE);
    expect(notes(container)[0]).not.toContain("LLM reasons");
  });

  it("an explicit brainSource:'model' reads the same as an unstamped beat", () => {
    const { container } = show(trace(dataBeat({ brain: "Reading the score.", brainSource: "model" })));
    expect(notes(container)[0]).toBe("LLM reasons — Reading the score.");
  });

  it("instruction beats follow the same rule (and never dangle a bare prefix)", () => {
    const { container } = show(trace(
      instrBeat({ brain: "Following the triage checklist, step 1 first." }),
      instrBeat({ brain: "The skill doc was handed to the LLM.", brainSource: "framework" }),
      instrBeat({ brain: "" }),
    ));
    const [own, framework, empty] = notes(container);
    expect(own).toBe("LLM follows triage — Following the triage checklist, step 1 first.");
    expect(framework).toBe("The skill doc was handed to the LLM.");
    expect(empty).toBe(""); // no body → no orphaned "LLM follows triage — "
  });

  it("a both beat joins body + act note without an empty gap", () => {
    const { container } = show(trace({
      kind: "return", tool: "t", toolName: "t", replyType: "both", skill: "s",
      output: {}, brain: "", actNote: "Then it applies the fix.", cost: { ms: 1, tokens: 0 },
    }));
    expect(notes(container)[0]).toBe("Then it applies the fix.");
  });
});

describe("adapters record who wrote each brain line", () => {
  const A = (o) => Object.entries(o).map(([key, v]) => ({ key, value: { stringValue: String(v) } }));
  let clock = 1_700_000_000_000_000_000n;
  const span = (attrs, events = []) => {
    const start = clock; clock += 10_000_000n;
    return {
      startTimeUnixNano: String(start),
      endTimeUnixNano: String(start + 5_000_000n),
      attributes: A(attrs),
      events: events.map((e) => ({ name: e.name, attributes: A(e.attrs) })),
    };
  };
  const otlp = (spans) => ({ resourceSpans: [{ scopeSpans: [{ spans }] }] });
  const run = (assistant) => fromOTLP(otlp([
    span({ "gen_ai.operation.name": "invoke_agent", "gen_ai.agent.name": "seo-agent" },
      [{ name: "gen_ai.user.message", attrs: { content: "audit the site" } }]),
    ...(assistant
      ? [span({ "gen_ai.operation.name": "chat" }, [{ name: "gen_ai.assistant.message", attrs: { content: assistant } }])]
      : []),
    span({ "gen_ai.operation.name": "execute_tool", "gen_ai.tool.name": "seo_audit" },
      [{ name: "gen_ai.tool.message", attrs: { content: '{"score":61}' } }]),
  ]));

  it("stamps 'framework' on synthesized narration so the notepad stays single-voiced", () => {
    const t = run(null);
    const ret = t.steps.find((s) => s.kind === "return");
    expect(ret.brain).toContain("Reasoning over the result"); // our own sentence
    expect(ret.brainSource).toBe("framework");
    const { container } = show(t);
    expect(notes(container).some((n) => n.includes("LLM reasons — Reasoning over the result"))).toBe(false);
  });

  it("stamps 'model' when a real assistant message supplied the line", () => {
    const t = run("I will run the SEO audit first.");
    const ask = t.steps.find((s) => s.kind === "ask");
    expect(ask.brain).toBe("I will run the SEO audit first.");
    expect(ask.brainSource).toBe("model");
  });
});

describe("stage thought bubble — same rule for its tag", () => {
  const stage = (step) => render(React.createElement(Stage, {
    trace: trace(step), step, index: 0, metaphor: true,
  }));
  const tag = (container) => container.querySelector(".cloud .ctag")?.textContent ?? "";

  it("tags the bubble 'thinking' when the words are the model's", () => {
    const { container } = stage(dataBeat({ brain: "The score is low." }));
    expect(tag(container)).toContain("thinking");
  });

  it("tags it neutrally when the framework wrote the words", () => {
    const { container } = stage(dataBeat({ brain: FRAMEWORK_LINE, brainSource: "framework" }));
    expect(tag(container)).toContain("what happened");
    expect(tag(container)).not.toContain("thinking");
  });
});
