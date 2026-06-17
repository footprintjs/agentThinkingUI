import React from "react";
import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { rackView, ToolRack, RACK_CAP } from "../src/stage.jsx";

afterEach(cleanup);

/**
 * Rack mode (toolMenu="rack"): a vertical rack of every tool the model can use,
 * the picked one lit. rackView is the pure layout (rows + the picked row index +
 * total row count, so the scene can point the arrow at the picked row), with a
 * height cap (CAP rows; past that, CAP-1 tools + a "+N more" row, but the picked
 * tool is ALWAYS kept visible). ToolRack renders it.
 */
const mk = (n) => Array.from({ length: n }, (_, i) => ({ name: "tool_" + i, description: "d" + i }));

describe("rackView — cap + picked-visible layout", () => {
  it("shows every tool when within the cap", () => {
    const tools = mk(4);
    const v = rackView(tools, "tool_2");
    expect(v.rows).toHaveLength(4);
    expect(v.moreCount).toBe(0);
    expect(v.pickedIndex).toBe(2);
    expect(v.rowCount).toBe(4);
  });

  it("caps to (CAP-1) tools + a '+N more' row past the cap", () => {
    const tools = mk(RACK_CAP + 5); // 12 with default cap 7
    const v = rackView(tools, "tool_1"); // picked is in the head
    expect(v.rows).toHaveLength(RACK_CAP - 1); // 6 head rows
    expect(v.moreCount).toBe(tools.length - (RACK_CAP - 1)); // 6
    expect(v.pickedIndex).toBe(1);
    expect(v.rowCount).toBe(RACK_CAP); // 6 head + 1 "more" row
  });

  it("keeps the picked tool visible even when it falls in the overflow", () => {
    const tools = mk(RACK_CAP + 5); // 12
    const pickedName = "tool_10"; // index 10, well past the head
    const v = rackView(tools, pickedName);
    // picked is swapped into the last head slot → still rendered
    expect(v.rows.some((t) => t.name === pickedName)).toBe(true);
    expect(v.pickedIndex).toBe(v.rows.length - 1);
    expect(v.rows).toHaveLength(RACK_CAP - 1);
  });

  it("reports no pick when none is given (idle steps)", () => {
    expect(rackView(mk(4), null).pickedIndex).toBe(-1);
    expect(rackView(mk(4), "nope").pickedIndex).toBe(-1);
  });

  it("is empty-safe", () => {
    const v = rackView([], "x");
    expect(v.rows).toHaveLength(0);
    expect(v.rowCount).toBe(0);
    expect(v.pickedIndex).toBe(-1);
  });
});

describe("<ToolRack>", () => {
  it("renders one row per tool and lights ONLY the picked row", () => {
    const tools = mk(4);
    const { container } = render(React.createElement(ToolRack, { view: rackView(tools, "tool_2") }));
    expect(container.querySelectorAll(".tr-item")).toHaveLength(4);
    const on = container.querySelectorAll(".tr-item.on");
    expect(on).toHaveLength(1);
    expect(Array.from(container.querySelectorAll(".tr-item"))[2].classList.contains("on")).toBe(true);
  });

  it("marks skill rows with .skill", () => {
    const tools = [{ name: "search" }, { name: "load_skill" }, { name: "book" }];
    const { container } = render(React.createElement(ToolRack, { view: rackView(tools, "search") }));
    expect(container.querySelectorAll(".tr-item.skill")).toHaveLength(1);
  });

  it("renders a '+N more' row past the cap", () => {
    const { container } = render(React.createElement(ToolRack, { view: rackView(mk(RACK_CAP + 5), "tool_0") }));
    const more = container.querySelector(".tr-more");
    expect(more).toBeTruthy();
    expect(more.textContent).toContain("more");
  });

  it("renders nothing for an empty view", () => {
    const { container } = render(React.createElement(ToolRack, { view: rackView([], null) }));
    expect(container.querySelector(".tool-rack")).toBeNull();
  });
});
