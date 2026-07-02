/**
 * onBacktrack seam — "Where did this come from?" variable chips.
 *
 * Same host-owns-data contract as onExplain: chips render ONLY when the
 * host provides both step.variables (the state keys the step produced) AND
 * an onBacktrack handler; clicking hands (variable, step) to the host.
 */
import React from "react";
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, cleanup, fireEvent } from "@testing-library/react";
import { AgentThinkingUI } from "../src/footprint.jsx";
import "../demo/trace.js";

const BASE = window.AGENT_TRACES.offsite;
const ui = (props) => React.createElement(AgentThinkingUI, props);
afterEach(cleanup);

/** Clone the fixture with variables on the first step. */
function withVariables(vars) {
  return { ...BASE, steps: BASE.steps.map((s, i) => (i === 0 ? { ...s, variables: vars } : s)) };
}

describe("onBacktrack — variable chips", () => {
  it("renders a chip per step.variables entry and hands (variable, step) to the host", () => {
    const onBacktrack = vi.fn();
    const trace = withVariables(["history", "quote"]);
    const { container, getByText } = render(ui({ trace, onBacktrack }));
    expect(getByText("Where did this come from?")).toBeTruthy();
    expect(container.querySelectorAll(".var-chip").length).toBe(2);
    fireEvent.click(getByText("quote"));
    expect(onBacktrack).toHaveBeenCalledTimes(1);
    const [variable, step] = onBacktrack.mock.calls[0];
    expect(variable).toBe("quote");
    expect(step.variables).toContain("quote");
  });

  it("renders NOTHING without a handler (host owns the seam)", () => {
    const { container } = render(ui({ trace: withVariables(["history"]) }));
    expect(container.querySelector(".var-chip")).toBeNull();
  });

  it("renders NOTHING without step.variables (optional field, older traces unaffected)", () => {
    const onBacktrack = vi.fn();
    const { container } = render(ui({ trace: BASE, onBacktrack }));
    expect(container.querySelector(".var-chip")).toBeNull();
  });
});
