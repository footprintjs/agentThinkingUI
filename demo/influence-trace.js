/* AgentThinkingUI — example Influence Maps for demo/influence.html.
 *
 * Shaped like agentfootprint's `removableSources(report)` +
 * `rerunWithoutSources({ checkBaseline })` + `listInfluenceStrategies()`
 * output. The core scores / snippets / paths / verdict claims / re-run
 * summaries mirror the REAL captured artifacts of
 * `examples/observability/05-context-bisect.ts` (the same refunds-agent
 * planted-fact run behind demo/backtrack-trace.js): the mock provider
 * APPROVES a 47-day-old refund with the planted VIP fact in the system
 * prompt and DECLINES without it; ablating the fact flips APPROVED →
 * DECLINED in 3/3 seeded reruns (mean similarity 0.970 ± 0.000), while
 * the benign style fact and the lookup tool come back not-confirmed.
 *
 * Every re-run `summary` / `verdict.claim` here is byte-for-byte the
 * template `rerunWithoutSources` / `verdictFor` emit (label =
 * "sources [<id>]"). A couple of extra illustrative sources round the
 * radial layout out to five per scenario (memory + a second tool) so the
 * map reads at scale — swap the whole object for your own serialized
 * `removableSources()` output.
 *
 * The origin generator (localizeContextBug → removableSources →
 * rerunWithoutSources, mock provider, $0) lives af-side; paste its JSON
 * over this file to regenerate.
 */

/* the two built-in strategies from listInfluenceStrategies() (verbatim
   descriptions); `available` is HOST-declared — this demo has no embedder,
   so semantic-alignment is greyed. */
const STRATEGIES = [
  {
    name: "lexical-overlap",
    description:
      "Ranks sources by plain word overlap with the final answer. Deterministic, free, no " +
      "dependencies — the simpler, cheaper option. Misses paraphrases; same proxy caveat: " +
      "overlap is not cause.",
    requirements: [],
    available: true,
  },
  {
    name: "semantic-alignment",
    description:
      "Ranks sources by how semantically close their content is to the final answer, using " +
      "embeddings (the four-signal composite). The default. Needs an embedder; scores are a " +
      "proxy for alignment, never proof of cause.",
    requirements: ["embedder"],
    available: false,
  },
];

const WRONG =
  "Refund APPROVED: Dana Reyes holds VIP tier override status, so the 47-day-old order " +
  "qualifies for a refund beyond the 30-day window.";
const RIGHT =
  "Refund DECLINED: the order was purchased 47 days ago, outside the 30-day refund window.";

/* the three REAL removable sources at the final LLM call + two illustrative */
const REFUND_SOURCES = [
  {
    id: "vip-override-fact",
    kind: "injection",
    label: "vip-override-fact",
    source: "context#6",
    stageName: "Context",
    score: 0.85,
    snippet:
      "Customer Dana Reyes holds VIP tier override status: refunds are approved beyond the 30-day window.",
    path: [
      { fromName: "CallLLM", toName: "Context", kind: "data", key: "systemPromptInjections" },
    ],
  },
  {
    id: "style-fact",
    kind: "injection",
    label: "style-fact",
    source: "context#6",
    stageName: "Context",
    score: 0.84,
    snippet: "Style rule #12: limit replies to two (2) sentences / 40 words max.",
    path: [
      { fromName: "CallLLM", toName: "Context", kind: "data", key: "systemPromptInjections" },
    ],
  },
  {
    id: "lookup_order",
    kind: "tool",
    label: "lookup_order",
    source: "tool-calls#22",
    stageName: "ToolCalls",
    score: 0.71,
    snippet: "Order A-1001: purchased 47 days ago, price $480, category electronics.",
    path: [{ fromName: "CallLLM", toName: "ToolCalls", kind: "data", key: "history" }],
  },
  {
    id: "customer-profile-note",
    kind: "memory",
    label: "customer-profile-note",
    source: "memory#3",
    stageName: "Memory",
    score: 0.44,
    snippet: "Recalled note: Dana Reyes — 3 prior orders, no disputes on file.",
    path: [{ fromName: "CallLLM", toName: "Memory", kind: "data", key: "recalledNotes" }],
  },
  {
    id: "get_policy",
    kind: "tool",
    label: "get_policy",
    source: "tool-calls#9",
    stageName: "ToolCalls",
    score: 0.38,
    snippet: "Refund policy: standard window is 30 days from purchase for all tiers.",
    path: [{ fromName: "CallLLM", toName: "ToolCalls", kind: "data", key: "history" }],
  },
];

/* re-run fixtures keyed by the SET of ignored ids (sorted, joined) — the
   demo page looks the result up by the toggles the user flipped. Each is
   exactly what rerunWithoutSources would resolve. */
const REFUND_RERUNS = {
  // CONFIRMED — remove the planted fact, baseline-checked → causal verdict
  "vip-override-fact": {
    answer: RIGHT,
    answers: [RIGHT, RIGHT, RIGHT],
    whatChanged: {
      answerFlipped: true,
      flips: 3,
      samples: 3,
      similarityToOriginal: { mean: 0.97, min: 0.97, max: 0.97, stdev: 0 },
      baselineChecked: true,
      summary:
        "Removing sources [vip-override-fact] changed the answer in 3/3 seeded re-runs " +
        "(mean similarity to the original 0.970). The unchanged scenario stayed stable — " +
        "see verdict for the causal claim.",
    },
    verdict: {
      verdict: "confirmed",
      claim:
        "CAUSAL: ablating sources [vip-override-fact] flipped the outcome in 3/3 seeded reruns " +
        "(mean similarity to original 0.970 ± 0.000).",
    },
  },
  // NOT CONFIRMED — remove the benign style fact, baseline-checked
  "style-fact": {
    answer: WRONG,
    answers: [WRONG, WRONG, WRONG],
    whatChanged: {
      answerFlipped: false,
      flips: 0,
      samples: 3,
      similarityToOriginal: { mean: 1, min: 1, max: 1, stdev: 0 },
      baselineChecked: true,
      summary:
        "Removing sources [style-fact] did not change the answer in 3/3 seeded re-runs — " +
        "as far as these re-runs can see, those sources were not driving it.",
    },
    verdict: {
      verdict: "not-confirmed",
      claim:
        "NOT CONFIRMED: ablating sources [style-fact] did not change the outcome in 3 seeded " +
        "reruns — its ranking remains a correlational proxy only.",
    },
  },
  // OBSERVATIONAL — remove the lookup tool, NO baseline → no verdict, observed only
  lookup_order: {
    answer: WRONG,
    answers: [WRONG, WRONG, WRONG],
    whatChanged: {
      answerFlipped: false,
      flips: 0,
      samples: 3,
      similarityToOriginal: { mean: 1, min: 1, max: 1, stdev: 0 },
      baselineChecked: false,
      summary:
        "Removing sources [lookup_order] did not change the answer in 3/3 seeded re-runs — " +
        "as far as these re-runs can see, those sources were not driving it.",
    },
  },
};

window.INFLUENCE_SCENARIOS = {
  /* 1 · one dominant source — the planted fact towers over the rest, and a
     baseline-checked re-run PROVES it (verdict chip). */
  dominant: {
    pick: "1 · one dominant source",
    order: 1,
    map: {
      answer: WRONG,
      answerLabel: "Answer",
      question: "The agent approved a refund 47 days past the 30-day window — what fed that?",
      sources: REFUND_SOURCES,
      rankedBy: "lexical-overlap",
      honestyFlags: [
        {
          flag: "untracked-sources",
          note: "1 slice node also consumed untracked inputs (args/env/silent reads) — the slice through it is incomplete.",
        },
      ],
    },
    strategies: STRATEGIES,
    rerunFixtures: REFUND_RERUNS,
  },

  /* 2 · missing pieces — heavy honesty flags; the re-run is observational only
     (no baseline) so no causal chip, just the honest "observed" framing. */
  missing: {
    pick: "2 · missing pieces",
    order: 2,
    map: {
      answer: WRONG,
      answerLabel: "Answer",
      question: "What influenced this answer? (this run tracked less — the map says so)",
      sources: REFUND_SOURCES,
      rankedBy: "lexical-overlap",
      honestyFlags: [
        {
          flag: "untracked-sources",
          note: "1 slice node also consumed untracked inputs (args/env/silent reads) — the slice through it is incomplete.",
        },
        {
          flag: "no-read-tracking",
          note: "read tracking was off on this run — edges are inferred from writes only.",
        },
        {
          flag: "no-llm-call-ids",
          note: "no LLM-call step ids — sources are matched to the answer approximately.",
        },
      ],
    },
    strategies: STRATEGIES,
    // only the observational (no-verdict) fixture — every toggle set resolves to it
    rerunFixtures: { lookup_order: REFUND_RERUNS.lookup_order },
  },

  /* 3 · nothing was driving it — the toggled source comes back NOT CONFIRMED:
     the answer held without it. */
  nothing: {
    pick: "3 · nothing was driving it",
    order: 3,
    map: {
      answer: WRONG,
      answerLabel: "Answer",
      question: "Does the style rule steer the verdict? Remove it and see.",
      sources: REFUND_SOURCES,
      rankedBy: "lexical-overlap",
      honestyFlags: [],
    },
    strategies: STRATEGIES,
    rerunFixtures: { "style-fact": REFUND_RERUNS["style-fact"] },
  },
};
