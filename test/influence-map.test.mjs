import React from "react";
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, cleanup, fireEvent, waitFor } from "@testing-library/react";
import { InfluenceMap, InfluenceMapOverlay, INFLUENCE_COPY } from "../src/influence-map.jsx";

afterEach(cleanup);

const view = (props) => React.createElement(InfluenceMap, props);

/* ── fixtures — shaped like real removableSources() + rerunWithoutSources() ── */
const src = (over = {}) => ({
  id: "policy-doc", kind: "injection", label: "policy-doc",
  source: "context#6", stageName: "Context", score: 0.9, ...over,
});

const mapData = (over = {}) => ({
  answer: "Refund APPROVED: Dana Reyes holds VIP override status.",
  sources: [
    src({
      id: "policy-doc", label: "policy-doc", score: 0.9,
      snippet: "Dana Reyes holds VIP override status.",
      path: [
        { fromName: "Context", toName: "CallLLM", kind: "data", key: "systemPrompt" },
        { fromName: "CallLLM", toName: "Answer", kind: "control", key: "approve rule" },
      ],
    }),
    src({ id: "weather", kind: "tool", label: "weather", source: "tool-calls#2", stageName: "ToolCalls", score: 0.2 }),
  ],
  rankedBy: "lexical-overlap",
  honestyFlags: [{ flag: "untracked-sources", note: "af's own untracked note." }],
  ...over,
});

const rerunResult = (over = {}) => ({
  answer: "Refund DENIED — outside the 30-day window.",
  answers: ["Refund DENIED — outside the 30-day window."],
  whatChanged: {
    answerFlipped: true, flips: 2, samples: 3,
    similarityToOriginal: { mean: 0.31, min: 0.2, max: 0.4, stdev: 0.08 },
    baselineChecked: false,
    summary: "Removing sources [policy-doc] changed the answer in 2/3 seeded re-runs.",
  },
  ...over,
});

/* ── the map ─────────────────────────────────────────────────────────────── */
describe("InfluenceMap — the radial map", () => {
  it("renders the answer centre + one node per source, sized by score", () => {
    const { container } = render(view({ map: mapData() }));
    expect(container.querySelector(".inf-answer-c")).toBeTruthy();
    expect(container.querySelectorAll(".inf-node").length).toBe(2);
    const [r0, r1] = [...container.querySelectorAll(".inf-node-c")].map((c) => parseFloat(c.getAttribute("r")));
    expect(r0).toBeGreaterThan(r1); // score 0.9 node bigger than the 0.2 node
  });

  it("taps a node → detail card with plain-words kind, snippet, path, and the runtimeStageId", () => {
    const onSelectSource = vi.fn();
    const { container } = render(view({ map: mapData(), onSelectSource }));
    fireEvent.click(container.querySelectorAll(".inf-node-hit")[0]);
    const detail = container.querySelector(".inf-detail");
    expect(detail).toBeTruthy();
    const txt = detail.textContent;
    expect(txt).toContain("policy-doc");
    expect(txt).toContain("Injected context");           // kind in plain words
    expect(txt).toContain("Dana Reyes holds VIP override status."); // the snippet
    expect(txt).toContain("passed data");                // data hop, plain words
    expect(txt).toContain("steered a decision");         // control hop, plain words
    expect(txt).toContain("context#6");                  // runtimeStageId
    expect(onSelectSource).toHaveBeenCalledTimes(1);
    expect(onSelectSource.mock.calls[0][0].id).toBe("policy-doc");
    // second tap deselects
    fireEvent.click(container.querySelectorAll(".inf-node-hit")[0]);
    expect(container.querySelector(".inf-detail")).toBeNull();
  });
});

/* ── honesty chips ───────────────────────────────────────────────────────── */
describe("InfluenceMap — plain-language honesty", () => {
  it("renders the flag's default copy, the always-on proxies chip, and the CTA only with onRerun", () => {
    const { container } = render(view({ map: mapData(), onRerun: () => {} }));
    const chips = [...container.querySelectorAll(".inf-chip")].map((c) => c.textContent);
    expect(chips.some((t) => t.includes("Some inputs weren't tracked"))).toBe(true); // untracked-sources default
    expect(chips.some((t) => t.includes(INFLUENCE_COPY.proxies))).toBe(true);        // proxies always on
    expect(container.querySelector(".inf-chip.cta").textContent).toContain("Want proof?"); // CTA
  });

  it("hides the CTA chip when no onRerun is wired", () => {
    const { container } = render(view({ map: mapData() }));
    expect(container.querySelector(".inf-chip.cta")).toBeNull();
    expect(container.querySelector(".inf-chip")).toBeTruthy(); // proxies still there
  });

  it("lets the host re-word one chip while the rest keep defaults", () => {
    const { container } = render(view({ map: mapData(), honestyCopy: { "untracked-sources": "Custom words" } }));
    const chips = [...container.querySelectorAll(".inf-chip")].map((c) => c.textContent);
    expect(chips.some((t) => t.includes("Custom words"))).toBe(true);
    expect(chips.some((t) => t.includes(INFLUENCE_COPY.proxies))).toBe(true); // default kept
    expect(chips.some((t) => t.includes("Some inputs weren't tracked"))).toBe(false);
  });

  it("falls back to af's own note for an unknown future flag kind", () => {
    const { container } = render(view({ map: mapData({ honestyFlags: [{ flag: "future-kind", note: "af's own note." }] }) }));
    const chips = [...container.querySelectorAll(".inf-chip")].map((c) => c.textContent);
    expect(chips.some((t) => t.includes("af's own note."))).toBe(true);
  });
});

/* ── ignore toggles + re-run seam ────────────────────────────────────────── */
describe("InfluenceMap — ignore toggles + re-run", () => {
  it("toggles two nodes and re-runs ONCE with exactly those ids in map.sources order", () => {
    const onRerun = vi.fn(() => new Promise(() => {}));
    const { container } = render(view({ map: mapData(), onRerun }));
    const toggles = container.querySelectorAll(".inf-toggle");
    fireEvent.click(toggles[1]); // ignore weather first
    fireEvent.click(toggles[0]); // then policy-doc
    expect(container.querySelector(".inf-rerun").textContent).toContain("Re-run without 2 sources");
    fireEvent.click(container.querySelector(".inf-rerun"));
    expect(onRerun).toHaveBeenCalledTimes(1);
    expect(onRerun.mock.calls[0][0]).toEqual(["policy-doc", "weather"]); // map.sources order, not click order
  });

  it("shows an honest pending state — button disabled, no result panel — while the promise is unresolved", () => {
    const onRerun = () => new Promise(() => {});
    const { container } = render(view({ map: mapData(), onRerun }));
    fireEvent.click(container.querySelectorAll(".inf-toggle")[0]);
    fireEvent.click(container.querySelector(".inf-rerun"));
    expect(container.querySelector(".inf-pending")).toBeTruthy();
    expect(container.querySelector(".inf-rerun").disabled).toBe(true);
    expect(container.querySelector(".inf-result")).toBeNull();
  });

  it("renders old vs new answers, the summary verbatim, and the flip badge on a resolved result", async () => {
    const onRerun = vi.fn(() => Promise.resolve(rerunResult()));
    const { container } = render(view({ map: mapData(), onRerun }));
    fireEvent.click(container.querySelectorAll(".inf-toggle")[0]);
    fireEvent.click(container.querySelector(".inf-rerun"));
    await waitFor(() => expect(container.querySelector(".inf-result")).toBeTruthy());
    const cols = [...container.querySelectorAll(".inf-col-body")].map((c) => c.textContent);
    expect(cols[0]).toContain("Refund APPROVED"); // original
    expect(cols[1]).toContain("Refund DENIED");   // without the source
    expect(container.querySelector(".inf-summary").textContent).toBe("Removing sources [policy-doc] changed the answer in 2/3 seeded re-runs.");
    const facts = [...container.querySelectorAll(".inf-fact")].map((f) => f.textContent);
    expect(facts.some((t) => t.includes("2/3"))).toBe(true);
    expect(facts.some((t) => t.includes("0.31"))).toBe(true);
  });

  it("shows the causal verdict chip ONLY when the result carries a verdict", async () => {
    const withVerdict = rerunResult({ verdict: { verdict: "confirmed", claim: "CAUSAL: 3/3 flips." }, whatChanged: { ...rerunResult().whatChanged, baselineChecked: true } });
    const a = render(view({ map: mapData(), onRerun: () => Promise.resolve(withVerdict) }));
    fireEvent.click(a.container.querySelectorAll(".inf-toggle")[0]);
    fireEvent.click(a.container.querySelector(".inf-rerun"));
    await waitFor(() => expect(a.container.querySelector(".inf-result")).toBeTruthy());
    expect(a.container.querySelector(".inf-verdict")).toBeTruthy();
    expect(a.container.querySelector(".inf-verdict").textContent).toContain("CAUSAL: 3/3 flips.");
    expect(a.container.querySelector(".inf-verdict.ok")).toBeTruthy();
    expect(a.container.querySelector(".inf-observed")).toBeNull();
    cleanup();

    const b = render(view({ map: mapData(), onRerun: () => Promise.resolve(rerunResult()) }));
    fireEvent.click(b.container.querySelectorAll(".inf-toggle")[0]);
    fireEvent.click(b.container.querySelector(".inf-rerun"));
    await waitFor(() => expect(b.container.querySelector(".inf-result")).toBeTruthy());
    expect(b.container.querySelector(".inf-verdict")).toBeNull();
    expect(b.container.querySelector(".inf-observed").textContent).toContain(INFLUENCE_COPY.observedOnly);
  });

  it("clears a displayed result the moment any ignore is toggled (stale-result honesty)", async () => {
    const { container } = render(view({ map: mapData(), onRerun: () => Promise.resolve(rerunResult()) }));
    fireEvent.click(container.querySelectorAll(".inf-toggle")[0]);
    fireEvent.click(container.querySelector(".inf-rerun"));
    await waitFor(() => expect(container.querySelector(".inf-result")).toBeTruthy());
    fireEvent.click(container.querySelectorAll(".inf-toggle")[1]); // change the ignore set
    expect(container.querySelector(".inf-result")).toBeNull();
  });

  it("renders an honest error line on a rejected re-run", async () => {
    const onRerun = () => Promise.reject(new Error("boom"));
    const { container } = render(view({ map: mapData(), onRerun }));
    fireEvent.click(container.querySelectorAll(".inf-toggle")[0]);
    fireEvent.click(container.querySelector(".inf-rerun"));
    await waitFor(() => expect(container.querySelector(".inf-error")).toBeTruthy());
    expect(container.querySelector(".inf-error").textContent).toContain("⚠ Couldn't re-run: boom");
  });
});

/* ── strategy selector ───────────────────────────────────────────────────── */
describe("InfluenceMap — strategy selector", () => {
  const strategies = () => [
    { name: "lexical-overlap", description: "Plain word overlap — free.", requirements: [], available: true },
    { name: "semantic-alignment", description: "Embedding alignment.", requirements: ["embedder"], available: false },
  ];

  it("greys the unavailable strategy with a lock + tooltip and never fires its callback", () => {
    const onStrategyChange = vi.fn();
    const { container } = render(view({ map: mapData(), strategies: strategies(), onStrategyChange }));
    const off = container.querySelector(".inf-strat.off");
    expect(off).toBeTruthy();
    expect(off.disabled).toBe(true);
    expect(off.textContent).toContain("🔒");
    expect(off.getAttribute("title")).toContain("Embedding alignment.");
    expect(off.getAttribute("title")).toContain("Needs: embedder.");
    fireEvent.click(off);
    expect(onStrategyChange).not.toHaveBeenCalled();
    // the rankedBy tab is lit
    expect(container.querySelector(".inf-strat.on").textContent).toContain("Lexical overlap");
    // an available click fires with the strategy name
    fireEvent.click(container.querySelectorAll(".inf-strat")[0]);
    expect(onStrategyChange).toHaveBeenCalledWith("lexical-overlap");
  });

  it("renders no tablist when no strategies are supplied", () => {
    const { container } = render(view({ map: mapData() }));
    expect(container.querySelector(".inf-strats")).toBeNull();
  });
});

/* ── prop-swap + no-spend defaults ───────────────────────────────────────── */
describe("InfluenceMap — lifecycle honesty", () => {
  it("resets selection, ignores, and any result on a keyless map swap", async () => {
    const { container, rerender } = render(view({ map: mapData(), onRerun: () => Promise.resolve(rerunResult()) }));
    fireEvent.click(container.querySelectorAll(".inf-node-hit")[0]); // select
    fireEvent.click(container.querySelectorAll(".inf-toggle")[0]);   // ignore
    fireEvent.click(container.querySelector(".inf-rerun"));
    await waitFor(() => expect(container.querySelector(".inf-result")).toBeTruthy());
    rerender(view({ map: mapData({ answer: "A fresh run" }), onRerun: () => Promise.resolve(rerunResult()) }));
    expect(container.querySelector(".inf-detail")).toBeNull();  // selection reset
    expect(container.querySelector(".inf-footer")).toBeNull();  // ignore set reset
    expect(container.querySelector(".inf-result")).toBeNull();  // result reset
  });

  it("fires no callback before a user action — opening the map costs nothing", () => {
    const onRerun = vi.fn();
    const onStrategyChange = vi.fn();
    const onSelectSource = vi.fn();
    render(view({ map: mapData(), onRerun, onStrategyChange, onSelectSource, strategies: [
      { name: "lexical-overlap", description: "x", requirements: [], available: true },
    ] }));
    expect(onRerun).not.toHaveBeenCalled();
    expect(onStrategyChange).not.toHaveBeenCalled();
    expect(onSelectSource).not.toHaveBeenCalled();
  });
});

/* ── bars view (view="bars") ─────────────────────────────────────────────── */
describe("InfluenceMap — bars view", () => {
  // scores deliberately OUT of map.sources order → sorting must reorder them
  const barsMap = (over = {}) => mapData({
    sources: [
      src({ id: "low", label: "low", score: 0.2 }),
      src({ id: "high", label: "high", score: 0.95 }),
      src({ id: "mid", label: "mid", score: 0.5 }),
    ],
    ...over,
  });

  it("lists sources sorted by score DESC (not map.sources order)", () => {
    const { container } = render(view({ map: barsMap(), view: "bars" }));
    expect(container.querySelector(".inf-bars")).toBeTruthy();
    expect(container.querySelector(".inf-svg")).toBeNull(); // no radial map
    const labels = [...container.querySelectorAll(".inf-bar-label")].map((n) => n.textContent);
    expect(labels).toEqual(["high", "mid", "low"]);
    // the answer is a plain header card, not a centre-node
    expect(container.querySelector(".inf-answer-card")).toBeTruthy();
    expect(container.querySelector(".inf-answer-c")).toBeNull();
  });

  it("bar widths track the clamped scores", () => {
    const { container } = render(view({ map: barsMap(), view: "bars" }));
    const widths = [...container.querySelectorAll(".inf-bar-fill")].map((n) => parseFloat(n.style.width));
    expect(widths).toEqual([95, 50, 20]); // high, mid, low — Math.round(score*100)
    // monotonically non-increasing, matching the sorted order
    expect(widths[0]).toBeGreaterThan(widths[1]);
    expect(widths[1]).toBeGreaterThan(widths[2]);
  });

  it("the inline ✕ fires the SAME toggle path — footer + payload in map.sources order", () => {
    const onRerun = vi.fn(() => new Promise(() => {}));
    const { container } = render(view({ map: barsMap(), view: "bars", onRerun }));
    const ignores = container.querySelectorAll(".inf-bar-ignore");
    fireEvent.click(ignores[0]); // displayed-first = "high"
    fireEvent.click(ignores[2]); // displayed-last  = "low"
    expect(container.querySelector(".inf-rerun").textContent).toContain("Re-run without 2 sources");
    fireEvent.click(container.querySelector(".inf-rerun"));
    expect(onRerun).toHaveBeenCalledTimes(1);
    // payload is map.sources order (low, high), NOT display or click order
    expect(onRerun.mock.calls[0][0]).toEqual(["low", "high"]);
  });

  it("tapping a row opens the same SourceDetail card", () => {
    const onSelectSource = vi.fn();
    const { container } = render(view({ map: barsMap(), view: "bars", onSelectSource }));
    fireEvent.click(container.querySelectorAll(".inf-bar-main")[0]); // "high"
    const detail = container.querySelector(".inf-detail");
    expect(detail).toBeTruthy();
    expect(detail.textContent).toContain("high");
    expect(onSelectSource).toHaveBeenCalledTimes(1);
    expect(onSelectSource.mock.calls[0][0].id).toBe("high");
  });

  it("shows a provenance dot only when the snippet carries a [source: …] label", () => {
    const map = barsMap({
      sources: [
        src({ id: "a", label: "a", score: 0.9, snippet: "Recalled note. [source: live]" }),
        src({ id: "b", label: "b", score: 0.5, snippet: "Cached value. [source: fallback]" }),
        src({ id: "c", label: "c", score: 0.3, snippet: "No provenance marker here." }),
      ],
    });
    const { container } = render(view({ map, view: "bars" }));
    const rows = [...container.querySelectorAll(".inf-bar-row")];
    expect(rows[0].querySelector(".inf-prov.live")).toBeTruthy();
    expect(rows[1].querySelector(".inf-prov.fallback")).toBeTruthy();
    expect(rows[2].querySelector(".inf-prov")).toBeNull(); // omitted
  });

  it("shares the honesty chips and re-run result panel with the map view", async () => {
    const { container } = render(view({ map: barsMap(), view: "bars", onRerun: () => Promise.resolve(rerunResult()) }));
    expect(container.querySelector(".inf-chip")).toBeTruthy(); // proxies chip
    fireEvent.click(container.querySelectorAll(".inf-bar-ignore")[0]);
    fireEvent.click(container.querySelector(".inf-rerun"));
    await waitFor(() => expect(container.querySelector(".inf-result")).toBeTruthy());
    expect(container.querySelector(".inf-summary").textContent).toContain("Removing sources");
  });
});

/* ── dropdown strategy control (strategyControl="dropdown") ───────────────── */
describe("InfluenceMap — dropdown strategy control", () => {
  const strategies = () => [
    { name: "lexical-overlap", description: "Plain word overlap.", requirements: [], available: true },
    { name: "keyword-density", description: "Keyword density.", requirements: [], available: true },
    { name: "semantic-alignment", description: "Embedding alignment.", requirements: ["embedder"], available: false },
  ];

  it("renders a native select with the active option selected and its description below", () => {
    const { container } = render(view({ map: mapData(), strategyControl: "dropdown", strategies: strategies() }));
    const select = container.querySelector(".inf-strat-select");
    expect(select).toBeTruthy();
    expect(container.querySelector(".inf-strats")).toBeNull(); // not the tab row
    expect(select.value).toBe("lexical-overlap");             // map.rankedBy
    expect(container.querySelector(".inf-sub").textContent).toContain("Plain word overlap."); // active description
  });

  it("greys the unavailable option (disabled + 🔒 + tooltip) and never selects it", () => {
    const { container } = render(view({ map: mapData(), strategyControl: "dropdown", strategies: strategies() }));
    const opts = [...container.querySelectorAll(".inf-strat-select option")];
    const off = opts.find((o) => o.value === "semantic-alignment");
    expect(off.disabled).toBe(true);
    expect(off.textContent).toContain("🔒");
    expect(off.getAttribute("title")).toContain("Embedding alignment.");
    expect(off.getAttribute("title")).toContain("Needs: embedder.");
    // available options carry no lock
    expect(opts.find((o) => o.value === "lexical-overlap").disabled).toBe(false);
  });

  it("fires onStrategyChange with the chosen available strategy", () => {
    const onStrategyChange = vi.fn();
    const { container } = render(view({ map: mapData(), strategyControl: "dropdown", strategies: strategies(), onStrategyChange }));
    fireEvent.change(container.querySelector(".inf-strat-select"), { target: { value: "keyword-density" } });
    expect(onStrategyChange).toHaveBeenCalledWith("keyword-density");
  });

  it("renders no select when no strategies are supplied", () => {
    const { container } = render(view({ map: mapData(), strategyControl: "dropdown" }));
    expect(container.querySelector(".inf-strat-select")).toBeNull();
  });
});

/* ── render-parity guard — defaults are byte-compatible with 0.24 ─────────── */
describe("InfluenceMap — default-prop parity", () => {
  it("view='map' + strategyControl='tabs' render identically to omitting both", () => {
    const a = render(view({ map: mapData(), strategies: [
      { name: "lexical-overlap", description: "x", requirements: [], available: true },
    ] }));
    const implicit = a.container.innerHTML;
    cleanup();
    const b = render(view({ map: mapData(), view: "map", strategyControl: "tabs", strategies: [
      { name: "lexical-overlap", description: "x", requirements: [], available: true },
    ] }));
    expect(b.container.innerHTML).toBe(implicit);
  });
});

/* ── the overlay ─────────────────────────────────────────────────────────── */
describe("InfluenceMapOverlay", () => {
  it("renders nothing when closed, a dialog with the map when open", () => {
    const closed = render(React.createElement(InfluenceMapOverlay, { open: false, map: mapData() }));
    expect(closed.container.querySelector(".atui-influence-overlay")).toBeNull();
    cleanup();
    const { container } = render(React.createElement(InfluenceMapOverlay, { open: true, map: mapData() }));
    expect(container.querySelector("[role=dialog]")).toBeTruthy();
    expect(container.querySelector("[aria-modal=true]")).toBeTruthy();
    expect(container.querySelector(".atui-influence")).toBeTruthy();
  });

  it("closes on Escape, on the scrim, and on the back button", () => {
    const onClose = vi.fn();
    const { container } = render(React.createElement(InfluenceMapOverlay, { open: true, onClose, map: mapData() }));
    fireEvent.keyDown(window, { key: "Escape" });
    fireEvent.click(container.querySelector(".atui-influence-overlay")); // scrim
    fireEvent.click(container.querySelector(".imo-back"));
    expect(onClose).toHaveBeenCalledTimes(3);
  });
});
