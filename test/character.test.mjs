import React from "react";
import { describe, it, expect, afterEach, beforeEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { Stage } from "../src/stage.jsx";
import { AgentThinkingUI } from "../src/footprint.jsx";
import { CHARACTER_NAMES, CHARACTERS, characterOf, characterLabel } from "../src/characters.jsx";

/**
 * THE CAST.
 *
 * `character` picks WHO the story's protagonist is: the brain mascot (the
 * default — published pedagogy, so no existing scene may change) or "ops-bot",
 * the footprintjs family robot whose torso is the footprint sole and whose four
 * toes are its status LEDs.
 *
 * Three things are pinned here: the DEFAULT never moves, the robot really
 * renders (scene root + figure both say so, in the family's own palette), and
 * the mood system — the one the mascot already had — reaches both faces.
 */

afterEach(cleanup);
beforeEach(() => { try { localStorage.clear(); } catch { /* ignore */ } });

const trace = (...steps) => ({ task: "t", agent: "a", model: "m", asker: "you", steps });
const STEP = { kind: "return", tool: "seo_audit", toolName: "seo_audit", replyType: "data", output: { score: 61 }, brain: "looks fine", cost: { ms: 4, tokens: 2 } };
const ACT = { ...STEP, replyType: "instruction", brainMode: "act", skill: "seo_playbook", actChecklist: [{ text: "compress" }] };
const stage = (props, step = STEP) => render(React.createElement(Stage, { trace: trace(step), step, index: 0, metaphor: true, ...props }));

describe("the character registry", () => {
  it("exports the names, mascot first", () => {
    expect(CHARACTER_NAMES).toEqual(["brain", "ops-bot"]);
  });

  it("defaults an unknown / missing name to the brain", () => {
    expect(characterOf(undefined)).toBe("brain");
    expect(characterOf("ops-bot")).toBe("ops-bot");
    expect(characterOf("opsbot")).toBe("brain");   // a string is a NAME
    expect(characterOf(42)).toBe("brain");
  });

  it("lets each character name itself — and the host's label always wins", () => {
    // the brain is named by the THEME, exactly as it always was — both of its
    // built-in names survive untouched
    expect(characterLabel("brain", "LLM as Human Brain")).toEqual({ name: "LLM as Human Brain", note: null });
    expect(characterLabel("brain", "LLM brain")).toEqual({ name: "LLM brain", note: null });
    expect(characterLabel("ops-bot", "LLM as Human Brain")).toEqual({ name: "Ops-Bot", note: "the agent at work" });
    expect(characterLabel("ops-bot", "LLM brain")).toEqual({ name: "Ops-Bot", note: "the agent at work" });
    // a name the HOST chose beats the character's own, for either face
    expect(characterLabel("ops-bot", "Support Agent").name).toBe("Support Agent");
    expect(characterLabel("brain", "Support Agent").name).toBe("Support Agent");
  });

  it("keeps the brain's art where it always was (the registry holds no copy)", () => {
    expect(CHARACTERS.brain.Art).toBe(null);
    expect(CHARACTERS.brain.label, "the brain is named by the theme, not by the registry").toBe(null);
    expect(typeof CHARACTERS["ops-bot"].Art).toBe("function");
  });
});

describe("character — the default is the brain, unchanged", () => {
  // A DOM pin. If this fails, an existing consumer's scene changed silently.
  const pinMascot = (container) => {
    expect(container.querySelector(".scene-inner.char-brain"), "scene root says brain").toBeTruthy();
    expect(container.querySelector(".scene-inner.char-ops-bot")).toBeNull();
    const brain = container.querySelector(".brain-node .brain");
    expect(brain.classList.contains("ops-bot"), "the mascot, not the robot").toBe(false);
    expect(brain.querySelector("svg.brain-svg path.brain-body")).toBeTruthy();
    expect(brain.querySelectorAll(".eyes .eye")).toHaveLength(2);
    expect(container.querySelector(".ops-bot")).toBeNull();
    // …and it still carries the metaphor as its name, with no second line
    expect(container.querySelector(".brain-label").textContent).toBe("LLM brain"); // standalone <Stage> fallback
    expect(container.querySelector(".brain-note")).toBeNull();
  };

  it("renders the mascot when no character is passed", () => {
    pinMascot(stage({}).container);
  });

  it("renders the mascot for the explicit 'brain' name", () => {
    pinMascot(stage({ character: "brain" }).container);
  });

  it("falls back to the mascot for an unrecognised name", () => {
    pinMascot(stage({ character: "opsbot" }).container);
  });

  it("keeps the container's default name + no second line", () => {
    const { container } = render(React.createElement(AgentThinkingUI, { trace: trace(STEP) }));
    expect(container.querySelector(".scene-inner.char-brain")).toBeTruthy();
    expect(container.querySelector(".brain-label").textContent).toBe("LLM as Human Brain");
    expect(container.querySelector(".brain-note")).toBeNull();
  });
});

describe("character — Ops-Bot on stage", () => {
  it("marks the scene root and draws the robot in the agent's place", () => {
    const { container } = stage({ character: "ops-bot" });
    expect(container.querySelector(".scene-inner.char-ops-bot"), "scene root carries the character").toBeTruthy();
    const bot = container.querySelector(".brain-node .brain.ops-bot");
    expect(bot).toBeTruthy();
    // it stands in the SAME box as the mascot — label offset, arc ends and the
    // thought bubble's tail all keep pointing at it
    expect(bot.classList.contains("brain")).toBe(true);
    expect(container.querySelector(".brain-svg"), "the mascot stepped aside").toBeNull();
  });

  it("draws the canonical art: the sole as a torso, its four toes as LEDs (one amber), feet and antenna", () => {
    const { container } = stage({ character: "ops-bot" });
    const svg = container.querySelector("svg.ops-bot-svg");
    // the family canvas — panned so the figure (drawn around x=74) stands on the anchor
    expect(svg.getAttribute("viewBox")).toBe("16 0 116 118");
    const fills = [...svg.querySelectorAll("circle")].map((c) => c.getAttribute("fill"));
    expect(fills.filter((f) => f === "#e9f7fb")).toHaveLength(3);   // three pale toes…
    expect(fills.filter((f) => f === "#f0a24c")).toHaveLength(2);   // …one amber toe + the beacon
    expect(svg.querySelectorAll("ellipse")).toHaveLength(2);        // two feet
    expect(svg.querySelector("rect").getAttribute("fill")).toBe("#3b93bf"); // the head
    // one palette, no theme tokens: it must read on light AND dark
    expect(svg.innerHTML).not.toContain("var(--brain-from)");
    expect(svg.querySelector("linearGradient")).toBeNull();
    // the README trap: SMIL inside an <img> freezes — motion is CSS only
    expect(svg.querySelector("animate, animateTransform, animateMotion")).toBeNull();
  });

  it("names itself under the figure, honestly", () => {
    const { container } = render(React.createElement(AgentThinkingUI, { trace: trace(STEP), character: "ops-bot" }));
    const label = container.querySelector(".brain-label");
    expect(label.textContent).toBe("Ops-Botthe agent at work");
    expect(label.querySelector(".brain-note").textContent).toBe("the agent at work");
  });

  it("still lets the host name the agent (the label wins, the second line stays)", () => {
    const { container } = render(React.createElement(AgentThinkingUI, {
      trace: trace(STEP), character: "ops-bot", labels: { agent: "Support Agent" },
    }));
    expect(container.querySelector(".brain-label").textContent).toBe("Support Agentthe agent at work");
  });

  it("flows through the container on desktop and on mobile", () => {
    for (const mobile of [false, true]) {
      const { container } = render(React.createElement(AgentThinkingUI, { trace: trace(STEP), character: "ops-bot", mobile }));
      expect(container.querySelector(".brain.ops-bot"), "mobile=" + mobile).toBeTruthy();
      cleanup();
    }
  });

  it("yields to anything more specific — agentIcon and icons.brain both win", () => {
    const icon = render(React.createElement(AgentThinkingUI, {
      trace: trace(STEP), character: "ops-bot", agentIcon: "sparkle",
    }));
    expect(icon.container.querySelector(".agent-icon.ai-sparkle")).toBeTruthy();
    expect(icon.container.querySelector(".ops-bot")).toBeNull();
    // the scene still says who the cast member is
    expect(icon.container.querySelector(".scene-inner.char-ops-bot")).toBeTruthy();
    cleanup();

    const emoji = render(React.createElement(AgentThinkingUI, {
      trace: trace(STEP), character: "ops-bot", icons: { brain: { kind: "emoji", value: "🦊" } },
    }));
    expect(emoji.container.querySelector(".brain-emoji").textContent).toBe("🦊");
    expect(emoji.container.querySelector(".ops-bot")).toBeNull();
  });
});

describe("character — the moods reach both faces", () => {
  const modeOf = (container) => {
    const el = container.querySelector(".brain-node .brain");
    return el.classList.contains("acting") ? "acting" : el.classList.contains("thinking") ? "thinking" : "none";
  };

  it.each(["brain", "ops-bot"])("switches %s with the beat (thinking ⇄ acting)", (character) => {
    expect(modeOf(stage({ character }).container)).toBe("thinking");
    cleanup();
    expect(modeOf(stage({ character }, ACT).container)).toBe("acting");
  });

  it("gives Ops-Bot the mascot's own mood parts: eyes + beacon, and an 'o' mouth when acting", () => {
    const think = stage({ character: "ops-bot" }).container.querySelector(".ops-bot");
    expect(think.querySelectorAll(".ob-eye")).toHaveLength(2);
    expect(think.querySelector(".ob-beacon")).toBeTruthy();
    // both mouths are present in both moods — CSS trades them, so the mood still
    // reads when motion is off
    expect(think.querySelector(".ob-mouth")).toBeTruthy();
    expect(think.querySelector(".ob-mouth-o")).toBeTruthy();
    cleanup();
    const act = stage({ character: "ops-bot" }, ACT).container.querySelector(".ops-bot");
    expect(act.classList.contains("acting")).toBe(true);
    expect(act.querySelector(".ob-mouth-o")).toBeTruthy();
  });
});

describe("character — the UMD/global path", () => {
  it("accepts the prop through window.AgentThinkingUI and exports the names", async () => {
    await import("../src/global.jsx"); // the UMD entry: attaches the symbols to window
    expect(window.CHARACTER_NAMES).toEqual(["brain", "ops-bot"]);
    const { container } = render(React.createElement(window.AgentThinkingUI, { trace: trace(STEP), character: "ops-bot" }));
    expect(container.querySelector(".scene-inner.char-ops-bot")).toBeTruthy();
    expect(container.querySelector(".brain.ops-bot svg.ops-bot-svg")).toBeTruthy();
    expect(container.querySelector(".brain-label").textContent).toBe("Ops-Botthe agent at work");
    cleanup();
    // and the default is the same through that door
    const dflt = render(React.createElement(window.AgentThinkingUI, { trace: trace(STEP) }));
    expect(dflt.container.querySelector(".scene-inner.char-brain")).toBeTruthy();
    expect(dflt.container.querySelector(".brain-svg path.brain-body")).toBeTruthy();
  });
});
