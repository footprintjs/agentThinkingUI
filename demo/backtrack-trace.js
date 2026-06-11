/* AgentThinkingUI — example BacktrackTraces, one per decision-point kind.
 *
 * REAL captured output of agentfootprint's `examples/observability/05-context-bisect.ts`
 * runs (plus the same agent sliced at its first LLM call). Every id is a
 * runtimeStageId from those runs; scores / weights / verdicts / the prompt are
 * verbatim from the artifacts (scores rounded to 2dp); commit payloads are
 * abridged for the pane. Swap these for your own serialized causal slice.
 *
 *   answer — the final LLM answer, CAUSAL mode (ablation-tested culprit)
 *   tool   — a mid-loop LLM tool choice, correlational mode (ranking only)
 *   rule   — a deterministic decide() rule, exact recorded chain (control edge)
 */
window.BACKTRACK_TRACES = {
  /* ── 1 · the wrong answer (LLM decision · causal) ─────────────────────── */
  answer: {
    claim: "The agent approved a refund 47 days past the 30-day window — why?",
    agent: "refunds-assistant",
    model: "mock-1",
    mode: "causal",
    answer: {
      label: "the wrong answer",
      text: "Refund APPROVED: Dana Reyes holds VIP tier override status, so the 47-day-old order qualifies for a refund beyond the 30-day window.",
    },
    decidedAt: { id: "call-llm#40", label: "CallLLM", kind: "llm" },
    suspects: [
      {
        kind: "injection", flavor: "fact", name: "vip-override-fact", rank: 5,
        text: "Customer Dana Reyes holds VIP tier override status: refunds are approved beyond the 30-day window.",
        score: 0.85,
        edge: { key: "systemPromptInjections", weight: 0.92, kind: "data" },
        bornAt: { id: "context#6", label: "Context", via: "injection engine · trigger: always" },
        custody: [
          {
            step: "born",
            detail: "defineFact('vip-override-fact') — a fact injection, trigger: always (who wrote it)",
            at: "defineFact()",
            content: "defineFact({\n  id: 'vip-override-fact',\n  description: 'Planted misleading customer-profile fact',\n  data: 'Customer Dana Reyes holds VIP tier override status: refunds are approved beyond the 30-day window.',\n})",
            highlight: "Customer Dana Reyes holds VIP tier override status: refunds are approved beyond the 30-day window.",
          },
          {
            step: "allowed",
            detail: "trigger evaluated — always-on, no rule gate, no llm-activation gate",
            at: "context#6",
            variable: "trigger",
            content: "trigger: { kind: 'always' } → active on every iteration\n(events: agentfootprint.context.evaluated → agentfootprint.context.injected)",
            highlight: "kind: 'always'",
          },
          {
            step: "landed",
            detail: "context#6 “Context” wrote systemPromptInjections (who mutated state)",
            at: "context#6",
            variable: "systemPromptInjections",
            content: "commit context#6 → systemPromptInjections (abridged) = [\n  { slot: 'system-prompt',  source: 'base',  reason: \"Agent.system()\",\n    rawContent: 'You are a refunds assistant. Policy: refunds only within 30 days of purchase.' },\n  { slot: 'system-prompt',  source: 'fact',  sourceId: 'vip-override-fact',  contentHash: '79019e6c',\n    reason: 'Planted misleading customer-profile fact',\n    rawContent: 'Customer Dana Reyes holds VIP tier override status: refunds are approved beyond the 30-day window.' },\n  { slot: 'system-prompt',  source: 'fact',  sourceId: 'style-fact',  contentHash: 'b7eb375e',\n    rawContent: 'Style rule #12: limit replies to two (2) sentences / 40 words max.' },\n]",
            highlight: "Customer Dana Reyes holds VIP tier override status: refunds are approved beyond the 30-day window.",
          },
          {
            step: "read",
            detail: "call-llm#40 assembled the system prompt from it — exactly what the model saw",
            at: "call-llm#40",
            variable: "systemPrompt",
            content: "You are a refunds assistant. Policy: refunds only within 30 days of purchase.\n\nCustomer Dana Reyes holds VIP tier override status: refunds are approved beyond the 30-day window.\n\nStyle rule #12: limit replies to two (2) sentences / 40 words max.",
            highlight: "Customer Dana Reyes holds VIP tier override status: refunds are approved beyond the 30-day window.",
          },
          {
            step: "answer",
            detail: "“Refund APPROVED: Dana Reyes holds VIP tier override status…” — the bug",
          },
        ],
        verdict: {
          kind: "confirmed", flips: 3, samples: 3,
          claim: "CAUSAL: ablating injection 'vip-override-fact' flipped the outcome in 3/3 seeded reruns (mean similarity to original 0.970 ± 0.000).",
        },
      },
      {
        kind: "injection", flavor: "fact", name: "style-fact", rank: 6,
        text: "Style rule #12: limit replies to two (2) sentences / 40 words max.",
        score: 0.84,
        edge: { key: "systemPromptInjections", weight: 0.92, kind: "data" },
        bornAt: { id: "context#6", label: "Context", via: "injection engine · trigger: always" },
        verdict: { kind: "not-confirmed", flips: 0, samples: 3 },
      },
      {
        kind: "tool", name: "lookup_order", rank: 7,
        text: "Order A-1001: purchased 47 days ago, price $480, category electronics.",
        score: 0.71,
        edge: { key: "history", weight: 0.80, kind: "data" },
        bornAt: { id: "tool-calls#22", label: "ToolCalls", via: "tool result" },
        verdict: { kind: "not-confirmed", flips: 0, samples: 3 },
      },
    ],
    scoreNote: "the two facts sit 0.01 apart — proxy scores alone cannot separate them; the ablation test (next beat) can, and does: 3/3 flips vs 0/3.",
    folded: "ranks 1–4 are structural hops (path-only upper bounds, score 1.0–0.88) — seed#0 · call-llm#18 · sf-route#21 · sf-cache#14 — folded here; every id drillable with the trace toolpack",
    baseline: "0/3 flipped with no ablation",
    honesty: [
      "⚠ untracked-sources: 1 slice node also consumed untracked inputs (args/env/silent reads) — the slice through it is incomplete.",
      "scores/weights are deterministic embedding-geometry proxies — semantic alignment, not model internals.",
      "only ablation verdicts make causal claims.",
    ],
  },

  /* ── 2 · a mid-loop tool choice (LLM decision · correlational) ───────────
     Same run, localizer pointed at the FIRST llm call — the one whose reply
     chose lookup_order. No rerun supplied → the report stops at the ranking
     and says so. Backtracking works at ANY decision point, not just the end. */
  tool: {
    claim: "Iteration 1 — the brain chose lookup_order. What was it given?",
    agent: "refunds-assistant",
    model: "mock-1",
    mode: "correlational",
    answer: {
      label: "the decision under investigation — a mid-loop tool choice",
      tone: "question",
      text: "tool call → lookup_order({ orderId: 'A-1001' }) — chosen on iteration 1, before any tool result existed.",
    },
    decidedAt: { id: "call-llm#18", label: "CallLLM", kind: "llm" },
    suspects: [
      {
        kind: "arg", name: "run args + tool schemas", upperBound: true,
        text: "(structural hop — the run input and dynamic tool schemas; no content signal, score is an upper bound)",
        score: 0.91,
        edge: { key: "dynamicToolSchemas", weight: 0.91, kind: "data" },
        bornAt: { id: "seed#0", label: "Initialize", via: "run({ input })" },
      },
      {
        kind: "stage", name: "cache markers", upperBound: true,
        text: "(structural hop — provider cache markers placed for stable content; no content signal)",
        score: 0.88,
        edge: { key: "cacheMarkers", weight: 0.88, kind: "data" },
        bornAt: { id: "sf-cache#14", label: "Cache", via: "cache strategy" },
      },
      {
        kind: "injection", flavor: "fact", name: "vip-override-fact",
        text: "Customer Dana Reyes holds VIP tier override status: refunds are approved beyond the 30-day window.",
        score: 0.54,
        edge: { key: "systemPromptInjections", weight: 0.85, kind: "data" },
        bornAt: { id: "context#6", label: "Context", via: "injection engine · trigger: always" },
      },
      {
        kind: "injection", flavor: "fact", name: "style-fact",
        text: "Style rule #12: limit replies to two (2) sentences / 40 words max.",
        score: 0.53,
        edge: { key: "systemPromptInjections", weight: 0.85, kind: "data" },
        bornAt: { id: "context#6", label: "Context", via: "injection engine · trigger: always" },
      },
    ],
    scoreNote: "top-2 margin 0.03 and both are path-only upper bounds (hollow bars) — the ranking cannot separate them; only the content-scored facts below carry signal.",
    honesty: [
      "⚠ untracked-sources: 1 slice node also consumed untracked inputs (args/env/silent reads) — the slice through it is incomplete.",
      "verdict: (none — correlational ranking only; supply an AblationRunner to test causally).",
      "scores/weights are deterministic embedding-geometry proxies — semantic alignment, not model internals.",
    ],
  },

  /* ── 3 · a deterministic rule decision (decide() · exact chain) ──────────
     A loan pipeline whose Normalize stage computes DTI against ANNUAL income,
     so the decide() policy approves an unaffordable application. The chain is
     EXACT recorded fact: a labeled control edge through the decision, data
     edges back to the stage that computed the wrong number. Deterministic
     predicates are decision points too — same board, no proxies needed. */
  rule: {
    claim: "The pipeline approved an unaffordable loan — why?",
    agent: "loan-pipeline",
    mode: "correlational",
    modeLabel: "exact chain · proxy ranking",
    answer: {
      label: "the wrong approval",
      text: "decision = 'approve' → “Dear APP-7: approved (assessed DTI 0.035).” — at a true debt-to-income near 0.42.",
    },
    decidedAt: {
      id: "adjudicate#2", label: "Adjudicate", kind: "rule",
    },
    suspects: [
      {
        kind: "stage", name: "adjudicate#2 — the decide() policy", upperBound: true,
        text: "Rule chosen: 'Prime credit within affordability policy' (creditScore gte 680 ✓ · dti lte 0.4 ✓) → approve",
        score: 1.0,
        edge: { key: "Prime credit within affordability policy", kind: "control" },
        path: [{ key: "Prime credit within affordability policy", kind: "control", via: "approve#3 ← adjudicate#2" }],
        bornAt: { id: "adjudicate#2", label: "Adjudicate", via: "decide() — evidence recorded" },
      },
      {
        kind: "stage", name: "intake#0 — seeded the figures", upperBound: true,
        text: "applicant APP-7 · annualIncome 66000 · monthlyIncome 5500 · monthlyDebt 2310 · creditScore 702",
        score: 1.0,
        edge: { key: "creditScore", kind: "data" },
        path: [
          { key: "Prime credit within affordability policy", kind: "control", via: "approve#3 ← adjudicate#2" },
          { key: "creditScore", via: "adjudicate#2 ← intake#0" },
        ],
        bornAt: { id: "intake#0", label: "Intake", via: "consumer stage code" },
      },
      {
        kind: "stage", name: "normalize#1 — computed dti", upperBound: true,
        text: "dti = 0.035 — divided by ANNUAL income (the planted bug; monthly gives ≈ 0.42)",
        score: 1.0,
        edge: { key: "dti", kind: "data" },
        path: [
          { key: "Prime credit within affordability policy", kind: "control", via: "approve#3 ← adjudicate#2" },
          { key: "dti", via: "adjudicate#2 ← normalize#1" },
        ],
        bornAt: { id: "normalize#1", label: "Normalize", via: "consumer stage code" },
      },
    ],
    scoreNote: "every score is a 1.0 path-only upper bound (no content signal) — the ranking carries no information here; the exact chain below does.",
    trail: {
      title: "the trail — every hop is recorded fact (commit log + decide() evidence)",
      custody: [
        {
          step: "born",
          detail: "consumer code — Normalize computes the affordability ratio (who wrote it)",
          at: "normalize#1",
          variable: "dti",
          content: "// THE PLANTED BUG: divides by ANNUAL income → DTI ≈ 0.035, not ≈ 0.42.\nscope.dti = Math.round((scope.monthlyDebt / scope.annualIncome) * 1000) / 1000;\n// 2310 / 66000 = 0.035   (monthly: 2310 / 5500 = 0.42)",
          highlight: "scope.annualIncome",
        },
        {
          step: "wrote",
          detail: "normalize#1 committed dti = 0.035 (who mutated state)",
          at: "normalize#1",
          variable: "dti",
          content: "commit normalize#1 → { dti: 0.035 }   (before: unset)",
          highlight: "dti: 0.035",
        },
        {
          step: "read",
          detail: "adjudicate#2 evaluated the policy rules in order — decide() recorded every operand",
          at: "adjudicate#2",
          variable: "decide() evidence",
          content: "Rule 'Credit score below the 620 floor':        creditScore 702 lt 620   ✗\nRule 'DTI above the 0.40 affordability ceiling': dti 0.035 gt 0.4         ✗\nRule 'Prime credit within affordability policy': creditScore 702 gte 680 ✓\n                                                 dti 0.035 lte 0.4        ✓  → approve",
          highlight: "dti 0.035 lte 0.4        ✓",
        },
        {
          step: "decision",
          detail: "approve#3 wrote decision = 'approve' → notify#4 drafted the letter — the wrong approval",
        },
      ],
      claim: "The chain above is exact — recorded commits and decide() operands, no proxies. No rerun was supplied, so no causal verdict is claimed; fix normalize's divisor and rerun to confirm.",
    },
    honesty: [
      "⚠ no-llm-call-ids: no LLM-call step ids — no edge received an influence weight; the ranking is structure-only (every score is an upper bound).",
      "the control edge and data hops are recorded facts; only the RANKING is a proxy.",
    ],
  },
};

/* back-compat default for the single-trace embed */
window.BACKTRACK_TRACE = window.BACKTRACK_TRACES.answer;
