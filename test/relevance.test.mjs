import { describe, it, expect } from "vitest";
import { toolRelevance, relevanceTerms } from "../src/relevance.js";

/**
 * toolRelevance: the "why this tool?" proxy. Ranks the tools the model saw by
 * LEXICAL term overlap with the task (a proxy, not the model's real reason),
 * normalised so the top tool reads 1.0. If a tool carries a numeric `relevance`
 * (real attribution computed upstream), that value is used verbatim.
 */
describe("relevanceTerms", () => {
  it("keeps domain terms, drops stopwords + short tokens, splits on punctuation", () => {
    const t = relevanceTerms("get_interface_status for the FC1/3 port");
    expect(t).toContain("interface");
    expect(t).toContain("status");
    expect(t).toContain("port");
    expect(t).not.toContain("get"); // stopword
    expect(t).not.toContain("the"); // stopword
    expect(t).not.toContain("for"); // stopword
  });
});

describe("toolRelevance", () => {
  const tools = [
    { name: "get_interface_status", description: "interface status, flap counters for a switch port" },
    { name: "search_hotels", description: "find hotels in a city for a date range" },
    { name: "load_skill", description: "load a steering doc before committing" },
  ];

  it("ranks the on-topic tool first and normalises its score to 1.0", () => {
    const ranked = toolRelevance("fc1/3 interface is flapping on the switch port", tools);
    expect(ranked[0].name).toBe("get_interface_status");
    expect(ranked[0].score).toBeCloseTo(1, 5);
    // the irrelevant tool scores below the on-topic one
    const hotels = ranked.find((r) => r.name === "search_hotels");
    expect(hotels.score).toBeLessThan(ranked[0].score);
  });

  it("reports the matched terms for the explanation", () => {
    const ranked = toolRelevance("interface flapping on the switch", tools);
    const top = ranked[0];
    expect(top.matched).toEqual(expect.arrayContaining(["interface"]));
    expect(top.provided).toBe(false);
  });

  it("uses an upstream numeric `relevance` verbatim (real-attribution swap-in)", () => {
    const provided = [
      { name: "a", relevance: 0.91 },
      { name: "b", relevance: 0.22 },
    ];
    const ranked = toolRelevance("whatever", provided);
    expect(ranked[0].name).toBe("a");
    expect(ranked[0].score).toBe(0.91);
    expect(ranked[0].provided).toBe(true);
    expect(ranked[1].score).toBe(0.22);
  });

  it("is empty-safe and handles an empty task", () => {
    expect(toolRelevance("x", [])).toEqual([]);
    const ranked = toolRelevance("", tools);
    expect(ranked).toHaveLength(3);
    ranked.forEach((r) => expect(r.score).toBe(0)); // no task terms → no overlap
  });
});
