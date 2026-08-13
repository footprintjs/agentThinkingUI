import React from "react";
import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup, fireEvent } from "@testing-library/react";
import { Notepad, Inspector } from "../src/inspector.jsx";
import { Stage } from "../src/stage.jsx";
import { parseProse, parseInline, plainTextOf, MAX_PROSE } from "../src/markdown.js";

afterEach(cleanup);

/**
 * Beat bodies are MODEL text, and models write markdown. The player renders a
 * safe subset of it — headings, bold/italic, code, lists, tables — WITHOUT ever
 * building an HTML string: the body becomes React elements, so raw HTML inside
 * it stays literal text and links/images stay inert.
 */

const trace = (...steps) => ({ task: "t", agent: "a", model: "m", asker: "you", steps });
const show = (t) => render(React.createElement(Notepad, {
  trace: t, index: t.steps.length - 1, onCollapse: () => {}, view: "notepad", setView: () => {},
}));
const beat = (brain, extra) => ({
  kind: "return", tool: "seo_audit", toolName: "seo_audit", replyType: "data",
  output: { score: 61 }, brain, cost: { ms: 4, tokens: 2 }, ...extra,
});
const promptBeat = (brain) => ({ kind: "prompt", brain, cost: { ms: 1, tokens: 1 } });
const noteText = (c) => c.querySelector(".note-text");

const REPORT = [
  "## Findings",
  "",
  "The audit found **two** blockers and one `meta` warning:",
  "",
  "| Page | Score | Fix |",
  "|------|------:|:----|",
  "| /home | 61 | add meta description |",
  "| /pricing | 44 | compress hero.png |",
  "",
  "- fix the *title* tags",
  "- then re-run the audit",
  "  - compare against the baseline",
  "",
  "1. ship",
  "2. verify",
  "",
  "> the crawler was rate-limited",
  "",
  "```js",
  "audit({ deep: true })",
  "```",
].join("\n");

describe("notepad — a markdown beat body renders as elements", () => {
  it("renders headings, bold, inline code, tables, lists, quotes and fences", () => {
    const { container } = show(trace(beat(REPORT)));
    const md = noteText(container).querySelector(".md");
    expect(md).toBeTruthy();

    expect(md.querySelector("h2").textContent).toBe("Findings");
    expect(md.querySelector("strong").textContent).toBe("two");
    expect(md.querySelector("em").textContent).toBe("title");
    expect(md.querySelector(".md-code").textContent).toBe("meta");

    const table = md.querySelector("table.md-table");
    expect(table).toBeTruthy();
    expect([...table.querySelectorAll("th")].map((th) => th.textContent)).toEqual(["Page", "Score", "Fix"]);
    expect(table.querySelectorAll("tbody tr")).toHaveLength(2);
    expect(table.querySelectorAll("tbody tr")[1].querySelectorAll("td")[2].textContent).toBe("compress hero.png");
    // GFM alignment survives the round-trip
    expect(table.querySelectorAll("th")[1].style.textAlign).toBe("right");
    expect(table.querySelectorAll("th")[2].style.textAlign).toBe("left");

    const ul = md.querySelector("ul.md-list");
    expect(ul.children).toHaveLength(2);
    expect(ul.querySelector("ul.md-list").textContent).toContain("compare against the baseline"); // nested
    expect(md.querySelector("ol.md-list").children).toHaveLength(2);

    expect(md.querySelector("blockquote").textContent).toContain("rate-limited");
    expect(md.querySelector("pre.md-pre code").textContent).toBe("audit({ deep: true })");

    // and NONE of the markers are left in the visible text
    expect(md.textContent).not.toContain("##");
    expect(md.textContent).not.toContain("**");
    expect(md.textContent).not.toContain("|---");
  });

  it("keeps a long table scrollable INSIDE the beat", () => {
    const wide = ["| a | b | c | d | e |", "|---|---|---|---|---|", "| 1 | 2 | 3 | 4 | 5 |"].join("\n");
    const { container } = show(trace(beat(wide)));
    const wrap = container.querySelector(".md-tablewrap");
    expect(wrap).toBeTruthy();
    expect(wrap.querySelector("table")).toBeTruthy();
    expect(wrap.getAttribute("tabindex")).toBe("0"); // a keyboard can scroll it
  });

  it("renders soft line breaks, strikethrough, rules and wrapped list items", () => {
    const body = [
      "first line",
      "second line ~~struck~~",
      "",
      "---",
      "",
      "- an item whose text",
      "  wraps onto the next line",
      "- [a link with no destination]()",
    ].join("\n");
    const { container } = show(trace(beat(body)));
    const md = noteText(container).querySelector(".md");
    expect(md.querySelector("br")).toBeTruthy();
    expect(md.querySelector("del").textContent).toBe("struck");
    expect(md.querySelector("hr")).toBeTruthy();
    const items = md.querySelectorAll("ul.md-list > li");
    expect(items[0].textContent.replace(/\s+/g, " ")).toBe("an item whose text wraps onto the next line");
    expect(items[1].querySelector(".md-link").getAttribute("title")).toBeNull(); // empty destination → no tooltip
  });

  it("renders the same markdown in the step inspector's brain text", () => {
    const step = beat("## Findings\n\nScore **61**.");
    const { container } = render(React.createElement(Inspector, {
      step, index: 0, total: 1, onCollapse: () => {}, view: "inspector", setView: () => {},
    }));
    const brain = container.querySelector(".brain-text .md");
    expect(brain.querySelector("h2").textContent).toBe("Findings");
    expect(brain.querySelector("strong").textContent).toBe("61");
  });

  it("renders it in the stage thought bubble too", () => {
    const step = beat("**61** — meta descriptions missing");
    const { container } = render(React.createElement(Stage, { trace: trace(step), step, index: 0, metaphor: true }));
    expect(container.querySelector(".cloud .ctext strong").textContent).toBe("61");
  });

  it("renders it in the expanded thinking callout", () => {
    const step = beat("plain", { thinking: "### Plan\n\n1. audit\n2. fix" });
    const { container } = render(React.createElement(Stage, { trace: trace(step), step, index: 0, metaphor: true }));
    fireEvent.click(container.querySelector(".thinking-callout .tc-toggle"));
    expect(container.querySelector(".tc-text h3").textContent).toBe("Plan");
    expect(container.querySelectorAll(".tc-text ol.md-list li")).toHaveLength(2);
  });
});

describe("the body is untrusted: markup in it is TEXT, links are inert", () => {
  it("never turns raw HTML in a body into elements", () => {
    const evil = '<script>alert(1)</script>\n\n<img src=x onerror="alert(2)">\n\n<b>not bold</b>';
    const { container } = show(trace(beat(evil)));
    const note = noteText(container);
    expect(note.querySelector("script")).toBeNull();
    expect(note.querySelector("img")).toBeNull();
    expect(note.querySelector("b")).toBeNull();
    // …it is shown verbatim instead
    expect(note.textContent).toContain("<script>alert(1)</script>");
    expect(note.textContent).toContain("onerror");
    expect(note.textContent).toContain("<b>not bold</b>");
  });

  it("keeps HTML inside a fenced block as text as well", () => {
    const { container } = show(trace(beat("```html\n<script>alert(1)</script>\n```")));
    const pre = container.querySelector("pre.md-pre code");
    expect(pre.querySelector("script")).toBeNull();
    expect(pre.textContent).toBe("<script>alert(1)</script>");
  });

  it("renders a markdown link as inert text — no anchor, no href", () => {
    const { container } = show(trace(beat("see [the report](https://evil.example/steal?c=1) for detail")));
    const note = noteText(container);
    expect(note.querySelector("a")).toBeNull();
    const link = note.querySelector(".md-link");
    expect(link.textContent).toBe("the report");
    expect(link.getAttribute("href")).toBeNull();
    expect(link.getAttribute("title")).toContain("inert link");
    expect(note.innerHTML).not.toContain("href");
  });

  it("renders an image as its alt text — nothing is fetched", () => {
    const { container } = show(trace(beat("![tracking pixel](https://evil.example/p.png)")));
    const note = noteText(container);
    expect(note.querySelector("img")).toBeNull();
    expect(note.textContent).toContain("tracking pixel");
    expect(note.innerHTML).not.toContain("evil.example");
  });

  it("caps a pathologically long body", () => {
    const huge = "word ".repeat(MAX_PROSE); // ~100k chars
    const { container } = show(trace(beat(huge)));
    const note = noteText(container);
    expect(note.textContent).toContain("truncated");
    expect(note.textContent.length).toBeLessThan(MAX_PROSE + 200);
  });
});

describe("plain text is rendered exactly as before", () => {
  it("leaves an ordinary sentence as a bare text node — no wrapper element", () => {
    const body = "Score is 61 — the meta descriptions are missing.";
    const { container } = show(trace(promptBeat(body)));
    const note = noteText(container);
    expect(note.childElementCount).toBe(0); // no .md, no <p> — identical DOM to 0.26
    expect(note.textContent).toBe(body);
  });

  it("does not italicise snake_case or bullet-free asterisks in ordinary prose", () => {
    const body = "read_skill returned 2 * 3 results for user_id";
    const { container } = show(trace(promptBeat(body)));
    const note = noteText(container);
    expect(note.childElementCount).toBe(0);
    expect(note.textContent).toBe(body);
  });

  it("keeps the one-voice prefix out of the markdown body", () => {
    const { container } = show(trace(beat("## Findings\n\nScore **61**.")));
    const note = noteText(container);
    expect(note.querySelector(".note-voice").textContent).toBe("LLM reasons — ");
    expect(note.querySelector(".md h2").textContent).toBe("Findings"); // the prefix didn't eat the heading
    expect(note.textContent.match(/LLM reasons/g)).toHaveLength(1);    // said once, not per block
  });

  it("keeps a 'both' beat on one line, but splits it when a half is markdown", () => {
    const one = show(trace(beat("Reasoned it out.", { replyType: "both", skill: "s", actNote: "Then applied the fix." })));
    expect(noteText(one.container).textContent).toBe("Reasoned it out. Then applied the fix.");
    cleanup();
    const md = show(trace(beat("| a | b |\n|---|---|\n| 1 | 2 |", { replyType: "both", skill: "s", actNote: "Then applied the fix." })));
    const note = noteText(md.container);
    expect(note.querySelector("table")).toBeTruthy();          // the act note didn't land inside the table
    expect(note.querySelector(".md > p:last-child").textContent).toBe("Then applied the fix.");
  });

  it("still drops the prefix for a framework-authored body (0.26 rule intact)", () => {
    const line = "The tool returned its result.";
    const { container } = show(trace(beat(line, { brainSource: "framework" })));
    expect(noteText(container).textContent).toBe(line);
    expect(noteText(container).querySelector(".note-voice")).toBeNull();
  });
});

describe("the parser itself", () => {
  it("reports a plain paragraph so the view can skip the wrapper", () => {
    expect(plainTextOf(parseProse("just a sentence"))).toBe("just a sentence");
    expect(plainTextOf(parseProse("# heading"))).toBeNull();
    expect(plainTextOf(parseProse("a **bold** word"))).toBeNull();
  });

  it("honours backslash escapes", () => {
    expect(parseInline("\\*not italic\\*")).toEqual([{ t: "text", v: "*not italic*" }]);
  });

  it("treats a single newline inside a paragraph as a line break", () => {
    const [p] = parseProse("line one\nline two");
    expect(p.t).toBe("p");
    expect(p.inline.map((n) => n.t)).toEqual(["text", "br", "text"]);
  });

  it("parses nested emphasis and strikethrough", () => {
    const [p] = parseProse("***both*** and ~~gone~~");
    expect(p.inline[0].t).toBe("strong");
    expect(p.inline[0].kids[0].t).toBe("em");
    expect(p.inline.at(-1).t).toBe("del");
  });

  it("leaves an unterminated marker alone", () => {
    expect(plainTextOf(parseProse("2 * 3 = 6 and `unclosed"))).toBe("2 * 3 = 6 and `unclosed");
  });

  it("reads a horizontal rule but not a table divider", () => {
    expect(parseProse("---").map((b) => b.t)).toEqual(["hr"]);
    expect(parseProse("| a |\n| --- |\n| 1 |").map((b) => b.t)).toEqual(["table"]);
  });

  it("closes an unterminated fence at the end of the body", () => {
    const [code] = parseProse("```\nnever closed");
    expect(code).toEqual({ t: "code", lang: "", text: "never closed" });
  });

  it("handles empty and blank bodies without throwing", () => {
    expect(parseProse("")).toEqual([]);
    expect(parseProse(null)).toEqual([]);
    expect(parseProse("   \n  ")).toEqual([]);
  });
});
