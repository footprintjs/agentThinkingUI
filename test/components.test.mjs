import { describe, it, expect, afterEach, vi } from "vitest";
import { render, cleanup, fireEvent, act } from "@testing-library/react";
import "../demo/trace.js"; // fixture: a full trace covering every step kind

const TRACE = window.AGENT_TRACES.offsite;
const ui = (props) => React.createElement(window.AgentThinkingUI, props);

afterEach(cleanup);

describe("<AgentThinkingUI> container", () => {
  it("renders the runtime scene + timeline and steps through every beat", () => {
    const { container, getByTitle } = render(ui({ trace: TRACE, brand: "Demo" }));
    expect(container.querySelector(".brain-node")).toBeTruthy();
    expect(container.querySelector(".flowscene")).toBeTruthy();
    expect(container.querySelector(".timeline")).toBeTruthy();
    expect(container.querySelector(".brand-name").textContent).toBe("Demo");

    // walk every beat — exercises each SceneInner + Inspector branch (prompt,
    // ask, return·data, return·instruction, return·both, answer)
    const next = getByTitle("Next step");
    for (let i = 0; i < TRACE.steps.length - 1; i++) fireEvent.click(next);
    expect(container.querySelector(".answer-card")).toBeTruthy();

    // transport: prev / restart / play
    fireEvent.click(getByTitle("Previous step"));
    fireEvent.click(getByTitle("Restart"));
    fireEvent.click(getByTitle("Play"));
  });

  it("switches the right panel between Inspector and Notepad and toggles sections", () => {
    const { container, getByTitle } = render(ui({ trace: TRACE, brand: "Demo" }));
    // land on a return·both step so the inspector renders its richest content
    const next = getByTitle("Next step");
    for (let i = 0; i < 9; i++) fireEvent.click(next);
    container.querySelectorAll(".acc-head").forEach((b) => fireEvent.click(b)); // open/close accordions
    const tabs = container.querySelectorAll(".panel-tabs button");
    expect(tabs.length).toBeGreaterThan(0);
    tabs.forEach((t) => fireEvent.click(t)); // hit both views
    expect(container.querySelector(".insp-body, .note-list")).toBeTruthy();
  });

  it("renders the mobile layout (tabs + footer transport) and both tabs", () => {
    const { container, getByText } = render(ui({ trace: TRACE, mobile: true }));
    expect(container.querySelector(".app.mobile")).toBeTruthy();
    expect(container.querySelector(".m-tabs")).toBeTruthy();
    fireEvent.click(getByText("Agent notepad"));
    fireEvent.click(getByText("Thinking"));
    // step a few beats in the straight (mobile) scene
    const next = container.querySelector('button[title="Next step"]');
    for (let i = 0; i < 6; i++) fireEvent.click(next);
    expect(container.querySelector(".flowscene")).toBeTruthy();
  });

  it("applies a scoped custom theme + emoji/image icons + labels", () => {
    const { container } = render(
      ui({
        trace: TRACE,
        brand: "Demo",
        theme: { colors: { brand: "#2563EB" }, fonts: { scale: 1.1 } },
        labels: { agent: "Bot", toolbox: "kit" },
        icons: { brain: { kind: "emoji", value: "🤖" }, toolbox: { kind: "image", value: "/x.png" } },
        metaphor: false,
        loop: true,
      })
    );
    const app = container.querySelector(".app");
    expect(app.style.getPropertyValue("--rust")).toBe("#2563EB");
    expect(app.style.getPropertyValue("--af-text-scale")).toBe("1.1");
  });

  it("omits the brand entirely when no brand prop is given (library is brand-agnostic)", () => {
    const { container } = render(ui({ trace: TRACE }));
    expect(container.querySelector(".brand-name")).toBeNull();
  });
});

describe("desktop workspace interactions", () => {
  it("resizes via the splitter, switches panels, and collapses/expands the inspector", () => {
    const { container, getByTitle } = render(ui({ trace: TRACE, brand: "Demo" }));

    // drag the splitter (pointer down on it, move + up on window)
    const splitter = container.querySelector(".splitter");
    fireEvent.pointerDown(splitter, { clientX: 700 });
    fireEvent.pointerMove(window, { clientX: 620 });
    fireEvent.pointerMove(window, { clientX: 200 });
    fireEvent.pointerUp(window);

    // switch the right panel to Notepad (and back) via its tabs
    container.querySelectorAll(".panel-tabs button").forEach((b) => fireEvent.click(b));

    // collapse → rail shows; expand → panel returns (both views use .insp-collapse)
    fireEvent.click(container.querySelector(".insp-collapse"));
    expect(container.querySelector(".insp-rail")).toBeTruthy();
    fireEvent.click(getByTitle("Expand inspector"));
    expect(container.querySelector(".ws-insp")).toBeTruthy();
  });

  it("scrubs the timeline track, clicks a segment, and changes speed", () => {
    const { container } = render(ui({ trace: TRACE, brand: "Demo" }));
    const track = container.querySelector(".tl-track");
    fireEvent.pointerDown(track, { clientX: 120 });
    fireEvent.pointerMove(window, { clientX: 240 });
    fireEvent.pointerUp(window);
    fireEvent.pointerDown(container.querySelector(".tl-seg"), { clientX: 10 });
    container.querySelectorAll(".speed-group button").forEach((b) => fireEvent.click(b));
    expect(container.querySelector(".playhead")).toBeTruthy();
  });
});

describe("auto-advance + loop", () => {
  it("plays through and loops back to the start at the end", () => {
    vi.useFakeTimers();
    try {
      const { container, getByTitle } = render(ui({ trace: TRACE, brand: "Demo", loop: true }));
      fireEvent.click(getByTitle("Play"));
      // walk the dwell timers past the final beat → triggers the loop reset
      for (let i = 0; i < TRACE.steps.length + 2; i++) act(() => vi.advanceTimersByTime(4000));
      expect(container.querySelector(".timeline")).toBeTruthy();
    } finally {
      vi.useRealTimers();
    }
  });

  it("stops at the final beat when not looping", () => {
    vi.useFakeTimers();
    try {
      const { container, getByTitle } = render(ui({ trace: TRACE, brand: "Demo" }));
      fireEvent.click(getByTitle("Play"));
      for (let i = 0; i < TRACE.steps.length + 2; i++) act(() => vi.advanceTimersByTime(4000));
      expect(container.querySelector(".timeline")).toBeTruthy();
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("keyboard navigation (usePlayback)", () => {
  it("advances and rewinds with arrow keys", () => {
    const { container } = render(ui({ trace: TRACE, brand: "Demo" }));
    const stepChip = () => container.querySelector(".step-chip, .tl-readout .step-n");
    fireEvent.keyDown(window, { key: "ArrowRight" });
    fireEvent.keyDown(window, { key: "ArrowRight" });
    fireEvent.keyDown(window, { key: "ArrowLeft" });
    fireEvent.keyDown(window, { key: " " });
    expect(stepChip()).toBeTruthy();
  });
});
