/* ============================================================
   AgentThinkingUI — tool relevance (the "why this tool?" proxy)

   A LEXICAL relevance proxy: term overlap between the task and each tool's
   name + description. It is NOT the model's actual reason — it's a cheap,
   dependency-free "which tools look textually relevant to the ask" signal,
   honestly labelled in the UI. The panel is designed to SWAP IN real
   attribution later: if a tool entry carries a numeric `relevance` (e.g. an
   embedding or ablation score computed upstream), that value is used verbatim
   and this proxy is skipped for it.
   ============================================================ */

// generic verbs/articles that match almost any tool — drop them so the overlap
// reflects DOMAIN terms (interface, refund, hotel), not plumbing (get, list).
const STOP = new Set(
  ("the a an of to for and or in on at by with from is are be was were it this that " +
    "your you we our us i me my get set list find search load show check fetch call " +
    "run do does done make made use used via per all any some only just into out up")
    .split(" "),
);

// naive singularise so hotel/hotels, flight/flights, port/ports match — but keep
// false-plurals intact (status, analysis, class) by skipping us/is/ss endings.
const stem = (w) => (w.length > 4 && w.endsWith("s") && !/(ss|us|is)$/.test(w) ? w.slice(0, -1) : w);

export function relevanceTerms(s) {
  const m = (s || "").toLowerCase().replace(/[_\-/.]/g, " ").match(/[a-z0-9]+/g) || [];
  return m.filter((w) => w.length > 2 && !STOP.has(w)).map(stem);
}

// Rank tools by relevance to `task`. Returns a NEW array sorted high→low, each:
//   { name, description, score (0..1), matched: string[], provided: boolean }
// `provided` is true when the score came from an upstream `relevance` field
// (real attribution) rather than this lexical proxy.
export function toolRelevance(task, tools) {
  const taskTerms = new Set(relevanceTerms(task));
  const scored = (tools || []).map((t) => {
    if (typeof t.relevance === "number") {
      return { name: t.name, description: t.description, score: t.relevance, matched: [], provided: true };
    }
    const tt = relevanceTerms((t.name || "") + " " + (t.description || ""));
    const matched = [...new Set(tt.filter((w) => taskTerms.has(w)))];
    // overlap count, dampened by task size so longer asks don't inflate everything
    const raw = taskTerms.size ? matched.length / Math.sqrt(taskTerms.size) : 0;
    return { name: t.name, description: t.description, score: raw, matched, provided: false };
  });
  // normalise the PROXY scores so the most-relevant tool reads 1.0 (bars are
  // relative); provided scores are assumed already 0..1 and left untouched.
  const maxProxy = Math.max(1e-9, ...scored.filter((s) => !s.provided).map((s) => s.score));
  return scored
    .map((s) => ({ ...s, score: s.provided ? s.score : s.score / maxProxy }))
    .sort((a, b) => b.score - a.score);
}
