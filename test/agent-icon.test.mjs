import React from "react";
import { describe, it, expect, afterEach, beforeEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { Stage, BrainGlyph } from "../src/stage.jsx";
import { AgentThinkingUI } from "../src/footprint.jsx";
import { AGENT_ICON_NAMES } from "../src/agent-icons.jsx";

/**
 * THE AGENT ICON.
 *
 * Who stands at the centre of the scene is now the host's call: `agentIcon`
 * takes a built-in NAME (a string) or YOUR node (anything else). The built-ins
 * are stroke glyphs on one grid with one stroke weight — the same look as the
 * tool icons — tinted by the theme's brain gradient.
 *
 * Whatever stands there keeps the `.brain` box, which is what the anchor, the
 * label offset, the arc ends and the thought bubble's tail are all measured
 * from. And with NO prop, existing consumers get exactly the mascot they had.
 */

afterEach(cleanup);
beforeEach(() => { try { localStorage.clear(); } catch { /* ignore */ } });

const trace = (...steps) => ({ task: "t", agent: "a", model: "m", asker: "you", steps });
const STEP = { kind: "return", tool: "seo_audit", toolName: "seo_audit", replyType: "data", output: { score: 61 }, brain: "looks fine", cost: { ms: 4, tokens: 2 } };
const stage = (props) => render(React.createElement(Stage, { trace: trace(STEP), step: STEP, index: 0, metaphor: true, ...props }));

describe("agentIcon — the built-in set", () => {
  it("exports the names, mascot first", () => {
    expect(AGENT_ICON_NAMES).toEqual(["brain", "robot", "sparkle", "footsteps"]);
  });

  it.each(["robot", "sparkle", "footsteps"])("renders the '%s' glyph in the agent's place", (name) => {
    const { container } = stage({ agentIcon: name });
    const icon = container.querySelector(".agent-icon");
    expect(icon, name + " renders an agent icon").toBeTruthy();
    expect(icon.classList.contains("ai-" + name)).toBe(true);
    // it stands in the SAME box as the mascot — the tail/label/arcs still point at it
    expect(icon.classList.contains("brain")).toBe(true);
    expect(container.querySelector(".brain-node .agent-icon")).toBeTruthy();
    // one stroke weight, drawn on the shared grid, themed by the brain gradient
    const svg = icon.querySelector("svg.agent-icon-svg");
    expect(svg.getAttribute("viewBox")).toBe("0 0 48 48");
    expect(svg.getAttribute("stroke-width")).toBe("2.6");
    expect(svg.getAttribute("stroke")).toBe("url(#afAgentG)");
    expect(svg.querySelector("linearGradient stop").getAttribute("stop-color")).toBe("var(--brain-from)");
    // exactly one part breathes while the agent thinks
    expect(svg.querySelectorAll(".ai-pulse")).toHaveLength(1);
    // no emoji / no text — it is drawn
    expect(icon.textContent).toBe("");
  });

  it("switches the glyph's mode with the beat (thinking ⇄ acting)", () => {
    const act = { ...STEP, replyType: "instruction", brainMode: "act", skill: "seo_playbook", actChecklist: [{ text: "compress" }] };
    expect(stage({ agentIcon: "robot" }).container.querySelector(".agent-icon").classList.contains("thinking")).toBe(true);
    cleanup();
    const { container } = render(React.createElement(Stage, { trace: trace(act), step: act, index: 0, metaphor: true, agentIcon: "robot" }));
    expect(container.querySelector(".agent-icon").classList.contains("acting")).toBe(true);
  });
});

describe("agentIcon — your own node", () => {
  it("renders a custom React node in the agent's place", () => {
    const { container } = stage({ agentIcon: React.createElement("svg", { "data-testid": "mine", viewBox: "0 0 10 10" }) });
    const slot = container.querySelector(".agent-icon.agent-icon-node");
    expect(slot).toBeTruthy();
    expect(slot.classList.contains("brain")).toBe(true); // same box, same anchor
    expect(slot.querySelector('[data-testid="mine"]')).toBeTruthy();
    expect(container.querySelector(".brain-svg")).toBeNull(); // the mascot stepped aside
  });

  it("wins over the legacy icons.brain config when both are given", () => {
    const { container } = render(React.createElement(AgentThinkingUI, {
      trace: trace(STEP),
      icons: { brain: { kind: "emoji", value: "🤖" } },
      agentIcon: "sparkle",
    }));
    expect(container.querySelector(".agent-icon.ai-sparkle")).toBeTruthy();
    expect(container.querySelector(".brain-emoji")).toBeNull();
  });

  it("flows through the container on desktop and on mobile", () => {
    for (const mobile of [false, true]) {
      const { container } = render(React.createElement(AgentThinkingUI, { trace: trace(STEP), agentIcon: "footsteps", mobile }));
      expect(container.querySelector(".agent-icon.ai-footsteps"), "mobile=" + mobile).toBeTruthy();
      cleanup();
    }
  });
});

describe("agentIcon — defaults are unchanged for existing consumers", () => {
  // A DOM pin: with no prop, the scene renders exactly the mascot it always did.
  const pinMascot = (container) => {
    const brain = container.querySelector(".brain-node .brain");
    expect(brain).toBeTruthy();
    expect(brain.classList.contains("thinking")).toBe(true);
    expect(brain.classList.contains("agent-icon")).toBe(false);
    expect(brain.querySelector("svg.brain-svg path.brain-body")).toBeTruthy();
    expect(brain.querySelector(".brain-svg linearGradient").getAttribute("id")).toBe("afBrainG");
    expect(brain.querySelectorAll(".eyes .eye")).toHaveLength(2);
    expect(brain.querySelector(".mouth")).toBeTruthy();
  };

  it("renders the animated mascot when no agentIcon is passed", () => {
    pinMascot(stage({}).container);
  });

  it("renders the mascot for the explicit 'brain' name", () => {
    pinMascot(stage({ agentIcon: "brain" }).container);
  });

  it("falls back to the mascot for an unrecognised name (a string is a NAME, not art)", () => {
    pinMascot(stage({ agentIcon: "robto" }).container);
  });

  it("leaves the emoji / image avatars working", () => {
    const { container } = render(React.createElement(BrainGlyph, { icon: { kind: "emoji", value: "🦊" }, mode: "reason" }));
    expect(container.querySelector(".brain-emoji").textContent).toBe("🦊");
    cleanup();
    const img = render(React.createElement(BrainGlyph, { icon: { kind: "image", value: "/bot.png" }, mode: "reason" }));
    expect(img.container.querySelector(".brain-custom img").getAttribute("src")).toBe("/bot.png");
  });
});
