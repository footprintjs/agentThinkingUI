import { readFileSync } from "node:fs";
import React from "react";
import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup, fireEvent } from "@testing-library/react";
import { Inspector, Notepad } from "../src/inspector.jsx";
import { AgentThinkingUI } from "../src/footprint.jsx";
import { fromRecording } from "../src/adapters/recording.js";

afterEach(cleanup);

/**
 * The screen half of door two: what a REPLAYED run must show, and must not.
 *
 *   1. An absent number is shown as absent. A beat whose source recorded no
 *      timing (or no token count) renders "—", never "0.0s · 0 tok" — the
 *      reconstruction that made three teams read a real number where there was
 *      none.
 *   2. Progress filed from inside a still-running call renders as activity on
 *      that call's beat, not as beats of its own.
 *   3. A system prompt the run opted in to recording is readable; one it never
 *      recorded shows nothing at all.
 */

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

const renderNotepad = (steps) =>
  render(
    React.createElement(Notepad, {
      trace: { task: "t", agent: "a", model: "m", asker: "you", steps },
      index: steps.length - 1,
      onCollapse: () => {},
      view: "notepad",
      setView: () => {},
    }),
  );

const askStep = {
  kind: "ask",
  tool: "walk_graph",
  toolName: "walk_graph",
  input: { root: "checkout" },
  brain: "walking the graph",
  cost: { ms: 342, tokens: 68 },
};

describe("absent cost — shown as absent, never as zero", () => {
  it("the inspector shows — for a beat with no cost at all", () => {
    const { container } = renderInspector({ kind: "prompt", brain: "do the thing" });
    const vals = Array.from(container.querySelectorAll(".c-val")).map((e) => e.textContent);
    expect(vals).toEqual(["—", "—"]);
    expect(container.textContent).not.toContain("0.0s");
  });

  it("the inspector shows the latency it HAS and — for the tokens it doesn't", () => {
    const { container } = renderInspector({ ...askStep, cost: { ms: 2000 } });
    const vals = Array.from(container.querySelectorAll(".c-val")).map((e) => e.textContent);
    expect(vals).toEqual(["2.0s", "—"]);
  });

  it("marks the absent number as not recorded, so — is never read as a value", () => {
    const { container } = renderInspector({ ...askStep, cost: { ms: 2000 } });
    expect(container.querySelector(".unrec").getAttribute("title")).toBe("not recorded in this trace");
  });

  it("the notepad meta line does the same (this is where 0.0s · 0 tok was read)", () => {
    const { container } = renderNotepad([{ kind: "prompt", brain: "do the thing" }]);
    const meta = container.querySelector(".note-meta").textContent.replace(/\s+/g, " ").trim();
    expect(meta).toBe("⏱ — · ◇ — tok");
    expect(meta).not.toContain("0.0s");
    expect(meta).not.toContain("0 tok");
  });

  it("…and still prints real numbers when the trace carries them", () => {
    const { container } = renderNotepad([askStep]);
    const meta = container.querySelector(".note-meta").textContent.replace(/\s+/g, " ").trim();
    expect(meta).toBe("⏱ 0.3s · ◇ 68 tok");
  });
});

describe("tool progress — activity on the call, not beats of its own", () => {
  const withActivity = {
    ...askStep,
    activity: [
      { payload: { done: 1, total: 3, hop: "api-gateway" }, atMs: 120 },
      { payload: { done: 2, total: 3, hop: "checkout" }, atMs: 240 },
      { payload: "still walking", atMs: 360 },
    ],
  };

  it('renders a collapsed "While it worked (N)" section, expandable to the reports', () => {
    const { container, getByText } = renderInspector(withActivity);
    const header = getByText(/While it worked \(3\)/);
    const acc = header.closest(".acc");
    expect(acc.querySelector(".acc-body").style.display).toBe("none");

    fireEvent.click(acc.querySelector(".acc-head"));
    expect(acc.querySelector(".acc-body").style.display).toBe("block");
    const rows = container.querySelectorAll(".activity li");
    expect(rows).toHaveLength(3);
    expect(rows[0].textContent).toContain('"hop":"api-gateway"');
    expect(rows[2].textContent).toContain("still walking"); // a plain-string payload stays text
  });

  it("stamps each report's time into the run when the recording had one", () => {
    const { container } = renderInspector(withActivity);
    expect(Array.from(container.querySelectorAll(".act-at")).map((e) => e.textContent)).toEqual(["0.1s", "0.2s", "0.4s"]);
  });

  it("renders no reports section, and no time, when nothing reported", () => {
    const { container } = renderInspector(askStep);
    expect(container.querySelector(".activity")).toBeNull();
    const headers = Array.from(container.querySelectorAll(".acc-label")).map((e) => e.textContent);
    expect(headers.some((h) => /While it worked/.test(h))).toBe(false);
  });

  it("keeps an untrusted payload as text (a report never becomes markup)", () => {
    const { container } = renderInspector({
      ...askStep,
      activity: [{ payload: "<img src=x onerror=alert(1)>" }],
    });
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector(".act-body").textContent).toContain("<img src=x onerror=alert(1)>");
  });
});

describe("the recorded system prompt — present only when the run recorded it", () => {
  it("shows the assembled prompt, with its length, on the beat it drove", () => {
    const text = "You are a read-only dependency triage assistant.";
    const { container, getByText } = renderInspector({ ...askStep, systemPrompt: text });
    const header = getByText(new RegExp("System prompt as sent \\(" + text.length + " chars\\)"));
    fireEvent.click(header.closest(".acc").querySelector(".acc-head"));
    expect(container.querySelector(".sysprompt").textContent).toBe(text);
  });

  it("shows nothing when the run did not record one (absence, not an empty box)", () => {
    const { container } = renderInspector(askStep);
    expect(container.querySelector(".sysprompt")).toBeNull();
  });
});

describe("the whole player, over a real recorded run", () => {
  const trace = fromRecording(
    JSON.parse(readFileSync("test/fixtures/recording.envelope.json", "utf8")),
    { asker: "Sam" },
  );

  it("mounts and walks every beat of an archived run — absent costs and all", () => {
    const { container, getByTitle } = render(React.createElement(AgentThinkingUI, { trace, storageKey: null }));
    expect(container.querySelector(".flowscene")).toBeTruthy();
    expect(container.querySelector(".timeline")).toBeTruthy();

    const next = getByTitle("Next step");
    for (let i = 0; i < trace.steps.length - 1; i++) fireEvent.click(next);
    expect(container.querySelector(".answer-card")).toBeTruthy();
    // the run's error beat is on the record, and nothing anywhere claims 0.0s
    expect(container.textContent).not.toContain("0.0s");
  });

  it("shows the progress reports the recording carried, on the call that made them", () => {
    const { container, getByTitle } = render(React.createElement(AgentThinkingUI, { trace, storageKey: null }));
    fireEvent.click(getByTitle("Next step")); // → the walk_graph ask
    const header = Array.from(container.querySelectorAll(".acc-label")).find((e) => /While it worked/.test(e.textContent));
    expect(header.textContent).toContain("(5)");
    fireEvent.click(header.closest(".acc-head"));
    expect(container.querySelector(".activity").textContent).toContain("inventory");
  });
});
