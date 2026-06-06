import React from "react";
import { describe, it, expect, afterEach, beforeEach } from "vitest";
import { render, cleanup, fireEvent } from "@testing-library/react";
import { AgentThinkingUI } from "../src/footprint.jsx";

const ui = (props) => React.createElement(AgentThinkingUI, props);
const answer = { headline: "H", plan: [], budget: [], cta: "" };
const trace = (over = {}) => ({
  task: "t", title: "T", agent: "a", model: "m", asker: "x",
  steps: [
    { kind: "prompt", brain: "hi", cost: { ms: 1, tokens: 1 } },
    { kind: "ask", tool: "x", toolName: "x", input: { q: "<img src=x onerror=alert(1)>" }, brain: "calling", cost: { ms: 1, tokens: 1 } },
    { kind: "answer", to: "x", brain: "done", answer, cost: { ms: 1, tokens: 1 } },
  ],
  ...over,
});

beforeEach(() => { try { localStorage.clear(); } catch { /* ignore */ } });
afterEach(cleanup);

describe("Timeline robustness", () => {
  it("never produces NaN widths/playhead on a zero-latency trace", () => {
    const zero = trace({ title: "Z", steps: [
      { kind: "prompt", brain: "a", cost: { ms: 0, tokens: 0 } },
      { kind: "answer", to: "x", brain: "b", answer, cost: { ms: 0, tokens: 0 } },
    ] });
    const { container } = render(ui({ trace: zero }));
    const head = container.querySelector(".playhead").style.left;
    expect(head).not.toContain("NaN");
    container.querySelectorAll(".tl-seg").forEach((s) => expect(s.style.width).not.toContain("NaN"));
  });

  it("tolerates steps missing a cost object", () => {
    const noCost = trace({ title: "NC", steps: [
      { kind: "prompt", brain: "a" },
      { kind: "answer", to: "x", brain: "b", answer },
    ] });
    expect(() => render(ui({ trace: noCost }))).not.toThrow();
  });
});

describe("accessible timeline scrubber", () => {
  it("exposes a role=slider with valuemin/max/now and is keyboard-operable", () => {
    const { container } = render(ui({ trace: trace() }));
    const track = container.querySelector(".tl-track");
    expect(track.getAttribute("role")).toBe("slider");
    expect(track.getAttribute("aria-valuemax")).toBe("3");
    expect(track.getAttribute("aria-valuenow")).toBe("1");
    fireEvent.keyDown(track, { key: "ArrowRight" });
    expect(container.querySelector(".tl-track").getAttribute("aria-valuenow")).toBe("2");
    fireEvent.keyDown(track, { key: "End" });
    expect(container.querySelector(".tl-track").getAttribute("aria-valuenow")).toBe("3");
  });

  it("icon transport buttons and tabs carry accessible names / state", () => {
    const { container, getByLabelText } = render(ui({ trace: trace() }));
    expect(getByLabelText("Play")).toBeTruthy();
    expect(getByLabelText("Next step")).toBeTruthy();
    expect(container.querySelector('[role="tablist"]')).toBeTruthy();
    expect(container.querySelectorAll('[role="tab"]').length).toBe(2);
  });
});

describe("keyboard is scoped to the player (no host hijack)", () => {
  it("advances on keydown within the player root, but ignores window keydown", () => {
    const { container } = render(ui({ trace: trace() }));
    const app = container.querySelector(".atui");
    const now = () => container.querySelector(".tl-readout .step-n").textContent;
    fireEvent.keyDown(app, { key: "ArrowRight" });
    expect(now()).toContain("02");
    // a keypress on the document body / window must NOT drive this player
    fireEvent.keyDown(window, { key: "ArrowRight" });
    expect(now()).toContain("02");
  });
});

describe("per-instance scrub persistence", () => {
  it("keys storage by trace identity so two players don't collide", () => {
    const { container } = render(ui({ trace: trace({ title: "A" }) }));
    fireEvent.keyDown(container.querySelector(".atui"), { key: "ArrowRight" });
    expect(localStorage.getItem("agentthinkingui.index:A")).toBe("1");
    expect(localStorage.getItem("agentthinkingui.index:B")).toBeNull(); // a different trace is isolated
  });

  it("storageKey={null} disables persistence entirely", () => {
    const { container } = render(ui({ trace: trace({ title: "A" }), storageKey: null }));
    fireEvent.keyDown(container.querySelector(".atui"), { key: "ArrowRight" });
    expect(localStorage.getItem("agentthinkingui.index:A")).toBeNull();
  });
});

describe("untrusted tool I/O is rendered as text, not HTML", () => {
  it("highlights JSON with spans and never injects markup from values", () => {
    const { container, getByLabelText } = render(ui({ trace: trace() }));
    fireEvent.click(getByLabelText("Next step")); // → the ask step with the evil input
    const code = container.querySelector(".code");
    expect(code).toBeTruthy();
    expect(code.querySelector("img")).toBeNull(); // no injected element
    expect(code.textContent).toContain("onerror"); // shown as literal text
    expect(code.querySelector(".k")).toBeTruthy(); // key span
    expect(code.querySelector(".s")).toBeTruthy(); // string-value span
  });
});
