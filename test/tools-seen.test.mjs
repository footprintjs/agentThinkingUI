import React from "react";
import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup, fireEvent } from "@testing-library/react";
import { Inspector } from "../src/inspector.jsx";

afterEach(cleanup);

/**
 * "Tools the model saw": ask/answer beats may carry `toolsSeen` (the tool menu —
 * name + description — the model had at its disposal for that call). The inspector
 * renders it as a collapsed section; expand to read the descriptions a domain
 * expert needs to debug WHY a tool was chosen. Beats without it show no section.
 */
const TOOLS = [
  {
    name: "get_interface_counters",
    description: "CRC / link-failure counters for an interface",
  },
  {
    name: "load_show_tech",
    description: "SFP Rx/Tx diagnostics from show-tech",
  },
];

const askStep = {
  kind: "ask",
  tool: "get_interface_counters",
  toolName: "get_interface_counters",
  input: { interface: "fc1/3" },
  brain: "pulling counters",
  cost: { ms: 10, tokens: 5 },
  toolsSeen: TOOLS,
};

const renderInspector = (step) =>
  render(
    React.createElement(Inspector, {
      step,
      index: 1,
      total: 3,
      onCollapse: () => {},
      view: "inspector",
      setView: () => {},
    }),
  );

describe("<Inspector> — tools the model saw", () => {
  it('shows a collapsed "Tools the model saw (N)" section, expandable to descriptions', () => {
    const { container, getByText } = renderInspector(askStep);

    // The labelled section is present with the count.
    const header = getByText(/Tools the model saw \(2\)/);
    expect(header).toBeTruthy();

    // Collapsed by default → body hidden.
    const acc = header.closest(".acc");
    expect(acc?.querySelector(".acc-body")?.style.display).toBe("none");

    // Expand → descriptions visible.
    fireEvent.click(acc.querySelector(".acc-head"));
    expect(acc.querySelector(".acc-body")?.style.display).toBe("block");
    expect(container.querySelector(".tools-seen").textContent).toContain(
      "CRC / link-failure counters",
    );
    expect(container.querySelectorAll(".tools-seen li")).toHaveLength(2);
  });

  it("renders no tools section on a beat without toolsSeen", () => {
    const { container } = renderInspector({ ...askStep, toolsSeen: undefined });
    const headers = Array.from(container.querySelectorAll(".acc-label")).map(
      (e) => e.textContent,
    );
    expect(headers.some((h) => /Tools the model saw/.test(h))).toBe(false);
  });
});
