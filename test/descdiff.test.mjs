import { describe, it, expect } from "vitest";
import { diffWords } from "../src/descdiff.js";
import { buildDescribeText } from "../src/copyForLLM.js";
import { toolRelevance } from "../src/relevance.js";

/**
 * The Description Doctor: diffWords powers the red-strikethrough / green-add view,
 * and buildDescribeText is the LLM prompt asking for a sharper, distinct description.
 */
describe("diffWords", () => {
  it("marks removed words 'del', added words 'ins', shared words 'same'", () => {
    const segs = diffWords("find hotels in a city", "find hotels in a city for a date range");
    const text = (type) => segs.filter((s) => s.type === type).map((s) => s.text).join("");
    expect(text("same")).toContain("find hotels in a city");
    expect(text("ins")).toContain("date range");
    expect(text("del").trim()).toBe(""); // nothing removed, only appended
  });

  it("captures a replacement as del + ins", () => {
    const segs = diffWords("place a hold", "reserve a room");
    const kinds = new Set(segs.map((s) => s.type));
    expect(kinds.has("del")).toBe(true);
    expect(kinds.has("ins")).toBe(true);
    expect(segs.filter((s) => s.type === "ins").map((s) => s.text).join("")).toContain("reserve");
    expect(segs.filter((s) => s.type === "del").map((s) => s.text).join("")).toContain("place");
  });

  it("an empty old description → all insertions (green)", () => {
    const segs = diffWords("", "a brand new description");
    expect(segs.every((s) => s.type === "ins")).toBe(true);
  });

  it("identical text → all 'same', no del/ins", () => {
    const segs = diffWords("same words here", "same words here");
    expect(segs.every((s) => s.type === "same")).toBe(true);
  });
});

describe("buildDescribeText", () => {
  const tools = [
    { name: "search_flights", description: "find transport" },
    { name: "search_hotels", description: "find places" },
  ];
  it("asks for a sharper, DISTINCT description and lists the siblings", () => {
    const ranked = toolRelevance("book a trip", tools);
    const text = buildDescribeText({ trace: { task: "book a trip" }, ranked, focusName: "search_flights" });
    expect(text).toMatch(/clearer|sharper|distinct/i);
    expect(text).toContain("search_flights"); // the focus
    expect(text).toContain("search_hotels"); // a sibling to stay distinct from
    expect(text).toMatch(/only the new description/i); // instruct the LLM to reply with just the description
  });
});
