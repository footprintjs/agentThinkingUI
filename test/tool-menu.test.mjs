import React from "react";
import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { ToolMenu, isSkillName } from "../src/stage.jsx";

afterEach(cleanup);

/**
 * "saw N, picked 1": under the popped tool card, ToolMenu shows the tools the
 * model HAD for this call (step.toolsSeen) — the picked one lit, the rest dimmed
 * — so you can read "the model chose this out of N" at a glance. Skills get the
 * doc glyph (the .skill marker); tools get the tool icon. It only renders when
 * there was an actual choice (≥2 tools).
 */
const SEEN = [
  { name: "search_flights", description: "Find flights" },
  { name: "search_hotels", description: "Find hotels" },
  { name: "load_skill", description: "Load a steering doc" },
];

const renderMenu = (props) =>
  render(React.createElement(ToolMenu, props));

describe("<ToolMenu> — saw N, picked 1", () => {
  it('shows a "saw N" label and one icon per tool the model saw', () => {
    const { container, getByText } = renderMenu({ seen: SEEN, picked: "search_flights" });
    expect(getByText(/saw 3/)).toBeTruthy();
    expect(container.querySelectorAll(".tm-ico")).toHaveLength(3);
  });

  it("lights ONLY the picked tool", () => {
    const { container } = renderMenu({ seen: SEEN, picked: "search_flights" });
    const picked = container.querySelectorAll(".tm-ico.picked");
    expect(picked).toHaveLength(1);
    // the picked icon is the first entry (search_flights)
    const all = Array.from(container.querySelectorAll(".tm-ico"));
    expect(all[0].classList.contains("picked")).toBe(true);
    expect(all[1].classList.contains("picked")).toBe(false);
  });

  it("marks a skill entry with the .skill class (distinct glyph)", () => {
    const { container } = renderMenu({ seen: SEEN, picked: "search_flights" });
    const skills = container.querySelectorAll(".tm-ico.skill");
    expect(skills).toHaveLength(1); // load_skill only
  });

  it("renders nothing when there was no real choice (0 or 1 tool)", () => {
    expect(renderMenu({ seen: undefined, picked: "x" }).container.querySelector(".tool-menu")).toBeNull();
    expect(renderMenu({ seen: [SEEN[0]], picked: "search_flights" }).container.querySelector(".tool-menu")).toBeNull();
  });

  it("exposes an accessible label naming the count and the pick", () => {
    const { container } = renderMenu({ seen: SEEN, picked: "search_flights" });
    const menu = container.querySelector(".tool-menu");
    expect(menu.getAttribute("aria-label")).toBe("the model saw 3 tools and picked search_flights");
  });
});

describe("isSkillName", () => {
  it("treats load_skill and skill-named tools as skills", () => {
    expect(isSkillName("load_skill")).toBe(true);
    expect(isSkillName("budget_skill")).toBe(true);
    expect(isSkillName("Skill_lookup")).toBe(true);
  });
  it("treats ordinary tools as not-skills", () => {
    expect(isSkillName("search_flights")).toBe(false);
    expect(isSkillName("book_hold")).toBe(false);
    expect(isSkillName("")).toBe(false);
    expect(isSkillName(undefined)).toBe(false);
  });
});
