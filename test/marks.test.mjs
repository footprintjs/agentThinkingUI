import React from "react";
import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup, fireEvent } from "@testing-library/react";
import { AgentThinkingUI } from "../src/footprint.jsx";
import { Notepad } from "../src/inspector.jsx";
import { buildRunSummaryText } from "../src/copyForLLM.js";
import { marksAt, marksBracket } from "../src/marks.js";
import "../demo/trace.js"; // fixture: prompt · asks · data / instruction / both returns · answer

/**
 * `marks` (0.33.0) — chips a host hands the player, per beat. The player draws
 * them (scene bubble + notepad row) and prints them (the triage export); it
 * never interprets them. Two laws pinned here: a label is TEXT, never markup;
 * and no `marks` prop = a byte-identical DOM and export.
 */
const TRACE = window.AGENT_TRACES.offsite; // 14 beats: 1 = ask, 4 = instruction (act), 10 = both, 13 = answer
const ui = (props) => React.createElement(AgentThinkingUI, { storageKey: null, ...props });
const at = (index, marks) => render(ui({ trace: TRACE, index, marks }));

// what a findings-ledger host would pass — the player has no idea what these mean
const MARKS = [];
MARKS[1] = [{ label: "hypothesis", tone: "muted" }, { label: "expect high" }];
MARKS[2] = [{ label: "noise", tone: "warn" }];
MARKS[4] = [{ label: "fact", tone: "good" }];
MARKS[10] = [{ label: "ruled-out", tone: "bad", title: "ruled out by the hotel price" }];
MARKS[13] = [{ label: "stood on 3 · noise 2" }];

const chips = (root) => [...root.querySelectorAll(".atui-mark")];

afterEach(cleanup);

describe("marks — the scene's bubble (the current beat only)", () => {
  it("draws the beat's chips under the prose, in order, each wearing its tone", () => {
    const { container } = at(1, MARKS);
    const cloud = container.querySelector(".stage .cloud");
    const row = cloud.querySelector(".cbody > .atui-marks");
    expect(row).toBeTruthy();
    expect(row.getAttribute("aria-label")).toBe("marks");
    expect(cloud.querySelector(".cbody > .ctext")).toBeTruthy(); // the prose is still there, above the row
    const list = chips(row);
    expect(list.map((c) => c.textContent)).toEqual(["hypothesis", "expect high"]);
    expect(list[0].className).toBe("atui-mark tone-muted");
    expect(list[1].className).toBe("atui-mark tone-neutral"); // no tone = neutral
    expect(list[0].tagName).toBe("SPAN");
    expect(list[0].hasAttribute("tabindex")).toBe(false); // nothing focusable
    expect(list[0].hasAttribute("role")).toBe(false);
  });

  it("on an act beat the chips sit under the steering doc's checklist", () => {
    const { container } = at(4, MARKS);
    const doc = container.querySelector(".stage .skilldoc");
    expect(doc.querySelector(".sd-body > .sd-list")).toBeTruthy();
    const list = chips(doc.querySelector(".sd-body > .sd-marks"));
    expect(list.map((c) => c.textContent)).toEqual(["fact"]);
    expect(list[0].className).toBe("atui-mark tone-good");
  });

  it("on a data + instruction beat the chips ride the reasoning bubble, not the doc", () => {
    const { container } = at(10, MARKS);
    const dual = container.querySelector(".stage .dual-thoughts");
    expect(chips(dual.querySelector(".cloud")).map((c) => c.textContent)).toEqual(["ruled-out"]);
    expect(chips(dual.querySelector(".skilldoc"))).toEqual([]);
  });

  it("shows only the CURRENT beat's chips — a beat without marks draws none", () => {
    const { container } = at(3, MARKS); // marks[3] is a hole
    expect(chips(container.querySelector(".stage"))).toEqual([]);
    expect(container.querySelector(".stage .cbody")).toBeNull();
  });

  it("a label is TEXT: markup in it never becomes an element", () => {
    const marks = [];
    marks[1] = [{ label: "<b>x</b>" }];
    const { container } = at(1, marks);
    const chip = chips(container.querySelector(".stage"))[0];
    expect(chip.textContent).toBe("<b>x</b>");
    expect(chip.querySelector("b")).toBeNull();
    expect(chip.childNodes.length).toBe(1);
    expect(chip.firstChild.nodeType).toBe(3); // a text node
  });

  it("the whole label rides the title when the host gave none; the host's title wins when it did", () => {
    const marks = [];
    marks[1] = [{ label: "a very long declaration that will clip in the chip" }, { label: "short", title: "the full text on hover" }];
    const { container } = at(1, marks);
    const [a, b] = chips(container.querySelector(".stage"));
    expect(a.getAttribute("title")).toBe("a very long declaration that will clip in the chip");
    expect(b.getAttribute("title")).toBe("the full text on hover");
  });

  it("an unknown tone reads as neutral", () => {
    const marks = [];
    marks[1] = [{ label: "x", tone: "purple" }];
    const { container } = at(1, marks);
    expect(chips(container.querySelector(".stage"))[0].className).toBe("atui-mark tone-neutral");
  });

  it("tolerates a longer or shorter table, holes, and entries that are not chips", () => {
    const longer = TRACE.steps.map(() => [{ label: "m" }]).concat([[{ label: "extra" }], [{ label: "extra" }]]);
    expect(() => at(13, longer)).not.toThrow();
    cleanup();
    expect(() => at(13, [[{ label: "only the prompt" }]])).not.toThrow();
    cleanup();
    const odd = [];
    odd[1] = [null, "a string", { tone: "bad" }, { label: 7 }, { label: "" }, { label: "kept" }];
    const { container } = at(1, odd);
    expect(chips(container.querySelector(".stage")).map((c) => c.textContent)).toEqual(["kept"]);
    cleanup();
    expect(() => at(1, "not an array")).not.toThrow();
  });
});

describe("marks — the notepad row (every beat, always)", () => {
  const notepad = (marks) =>
    render(React.createElement(Notepad, { trace: TRACE, index: 13, onCollapse() {}, view: "notepad", setView() {}, marks }));

  it("each beat's row carries its chips after the title line; a beat without marks has no row", () => {
    const { container } = notepad(MARKS);
    const notes = [...container.querySelectorAll(".note")];
    expect(notes.length).toBe(14);
    const rowOf = (i) => notes[i].querySelector(".note-head + .atui-marks");
    expect(chips(rowOf(1)).map((c) => c.textContent)).toEqual(["hypothesis", "expect high"]);
    expect(chips(rowOf(2)).map((c) => c.textContent)).toEqual(["noise"]);
    expect(chips(rowOf(2))[0].className).toBe("atui-mark tone-warn");
    expect(chips(rowOf(10))[0].getAttribute("title")).toBe("ruled out by the hotel price");
    expect(chips(rowOf(13)).map((c) => c.textContent)).toEqual(["stood on 3 · noise 2"]);
    expect(rowOf(0)).toBeNull();
    expect(rowOf(3)).toBeNull();
    // the row sits between the title line and the commentary
    expect(rowOf(1).nextElementSibling.className).toBe("note-text");
  });

  it("the notepad keeps a beat's chips at every playhead (like the cost line)", () => {
    const { container } = at(13, MARKS);
    fireEvent.click([...container.querySelectorAll(".panel-tabs button")].find((b) => b.textContent === "Notepad"));
    const notes = [...container.querySelectorAll(".note")];
    expect(chips(notes[1]).map((c) => c.textContent)).toEqual(["hypothesis", "expect high"]);
  });
});

describe("marks — the zero-cost law", () => {
  const sceneAndNotepad = (marks) => {
    const { container } = at(1, marks);
    fireEvent.click([...container.querySelectorAll(".panel-tabs button")].find((b) => b.textContent === "Notepad"));
    return { stage: container.querySelector(".stage").outerHTML, notes: container.querySelector(".note-list").outerHTML };
  };

  it("no `marks` prop = the same scene and notepad DOM, byte for byte", () => {
    const without = sceneAndNotepad(undefined);
    cleanup();
    const again = sceneAndNotepad(undefined);
    expect(again).toEqual(without); // the render is deterministic, so the comparison means something
    cleanup();
    const empty = sceneAndNotepad([]);
    expect(empty).toEqual(without);
    cleanup();
    const holes = sceneAndNotepad([undefined, [], undefined]);
    expect(holes).toEqual(without);
    cleanup();
    const withMarks = sceneAndNotepad(MARKS);
    expect(withMarks.stage).not.toEqual(without.stage); // …and the prop does change something when given
    expect(withMarks.notes).not.toEqual(without.notes);
  });

  it("the mobile layout obeys the same law", () => {
    const { container } = render(ui({ trace: TRACE, index: 1, mobile: true }));
    const without = container.querySelector(".stage").outerHTML;
    cleanup();
    const { container: c2 } = render(ui({ trace: TRACE, index: 1, mobile: true, marks: [] }));
    expect(c2.querySelector(".stage").outerHTML).toBe(without);
    cleanup();
    const { container: c3 } = render(ui({ trace: TRACE, index: 1, mobile: true, marks: MARKS }));
    expect(chips(c3.querySelector(".stage")).length).toBe(2);
  });
});

describe("marks — the triage export (copyForLLM)", () => {
  it("detailed: a beat's line carries its labels in brackets", () => {
    const text = buildRunSummaryText({ trace: TRACE, mode: "detailed", marks: MARKS });
    expect(text).toMatch(/- \*\*Step 1 — called tool `search_flights`\*\* with \{.*\} \[hypothesis · expect high\]\n/);
    expect(text).toMatch(/↳ returned: .* \[noise\]\n/);
    expect(text).toMatch(/\*\*Final answer:\*\* .* \[stood on 3 · noise 2\]/);
    expect(text.match(/ \[[^[\]\n]*\]$/gm).length).toBe(5); // one bracket per marked beat, none elsewhere
  });

  it("short: the answer line carries its labels; the tool path is left alone", () => {
    const text = buildRunSummaryText({ trace: TRACE, mode: "short", marks: MARKS });
    expect(text).toMatch(/\*\*Answer:\*\* .* \[stood on 3 · noise 2\]/);
    expect(text).not.toContain("[hypothesis");
  });

  it("without marks the export is byte-identical to a call that never heard of them", () => {
    for (const mode of ["short", "detailed"]) {
      const plain = buildRunSummaryText({ trace: TRACE, mode });
      expect(buildRunSummaryText({ trace: TRACE, mode, marks: undefined })).toBe(plain);
      expect(buildRunSummaryText({ trace: TRACE, mode, marks: [] })).toBe(plain);
      expect(buildRunSummaryText({ trace: TRACE, mode, marks: [undefined, []] })).toBe(plain);
      expect(plain).not.toContain(" [");
    }
  });

  it("the pure helpers: marksAt keeps only real chips, marksBracket prints nothing for none", () => {
    expect(marksAt(undefined, 0)).toEqual([]);
    expect(marksAt([[{ label: "a" }, { nope: 1 }]], 0)).toEqual([{ label: "a" }]);
    expect(marksAt([[{ label: "a" }]], 5)).toEqual([]);
    expect(marksBracket([])).toBe("");
    expect(marksBracket([{ label: "a" }, { label: "b" }])).toBe(" [a · b]");
  });

  it("the export stays one bullet per beat: a newline or tab inside a label becomes a space", () => {
    expect(marksBracket([{ label: "line1\nline2" }, { label: "\ta\r\n b " }])).toBe(" [line1 line2 · a b]");
    expect(marksBracket([{ label: "line1\nline2" }])).not.toContain("\n");
  });
});
