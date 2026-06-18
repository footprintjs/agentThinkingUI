/* ============================================================
   AgentThinkingUI — "Copy for LLM" (the real "why this tool?")

   The relevance bars are a lexical PROXY, not the model's real reason. To get
   the REAL why, hand the trajectory to an LLM. This builds a single Markdown
   blob — the task + the trajectory so far + the tools the model could choose
   from (with the proxy scores) + which it picked — ready to paste into
   Claude/ChatGPT ("why did it pick this tool, and was it right?").

   Pure projection — no DOM, no clipboard. The caller wires it to
   navigator.clipboard.writeText(). Same pattern as the Lens `buildLLMText`
   and explainable-ui's NarrativePanel "Copy for LLM", scoped to a tool choice.
   ============================================================ */

const CAP = 16000; // clipboard cap — don't dump a 20MB trajectory into a paste
const isSkill = (n) => n === "load_skill" || /skill/i.test(n || "");
const compact = (v) => {
  if (v === undefined || v === null) return "";
  let s;
  try { s = typeof v === "string" ? v : JSON.stringify(v); } catch { s = String(v); }
  return s.length > 140 ? s.slice(0, 140) + "…" : s;
};

/** Build the LLM-ready "why this tool?" prompt for one step's tool choice. */
export function buildToolWhyText({ trace, step, ranked, focusName }) {
  const picked = step && step.tool;
  const focus = focusName || picked;
  const noun = isSkill(focus) ? "skill" : "tool";
  const steps = (trace && trace.steps) || [];
  const idx = steps.indexOf(step);
  const prior = idx >= 0 ? steps.slice(0, idx + 1) : steps;

  const L = [];
  L.push(`# Why did the agent pick this ${noun} — \`${focus}\`?`);
  L.push("");
  L.push(
    "I'm debugging an AI agent's tool choice. Explain WHY it picked this " +
      `${noun} at this step out of the ones it had, and whether that was the right call. ` +
      "The scores below are a rough lexical-relevance PROXY (term overlap with the task/reasoning) — " +
      "NOT the model's real reason; use the reasoning + trajectory to judge.",
  );
  L.push("");
  L.push("## Task");
  L.push((trace && trace.task) || "(none)");
  L.push("");
  L.push("## Trajectory so far");
  prior.forEach((s, i) => {
    const n = i + 1;
    if (s.kind === "ask") L.push(`${n}. CALL \`${s.tool}\`(${compact(s.input)}) — "${compact(s.brain)}"`);
    else if (s.kind === "return") L.push(`${n}. ↳ \`${s.tool}\` returned ${compact(s.output)} — "${compact(s.brain)}"`);
    else if (s.kind === "prompt") L.push(`${n}. TASK IN — "${compact(s.brain)}"`);
    else if (s.kind === "answer") L.push(`${n}. ANSWER — "${compact(s.brain)}"`);
  });
  L.push("");
  L.push("## This step");
  L.push(`Reasoning: "${compact(step && step.brain)}"`);
  L.push(`Picked: \`${picked}\``);
  L.push("");
  L.push(`## The ${noun}s it could choose from (name — relevance proxy — description)`);
  (ranked || []).forEach((r) => {
    L.push(`- \`${r.name}\` — ${r.score.toFixed(2)}${r.name === picked ? " ← PICKED" : ""}` + (r.description ? `\n    ${r.description}` : ""));
  });
  L.push("");
  L.push("## Please answer");
  L.push(`1. Why did the agent pick \`${focus}\` here?`);
  L.push("2. Was it the best choice given the task + trajectory? If not, which was better, and why?");

  let text = L.join("\n");
  if (text.length > CAP) text = text.slice(0, CAP) + "\n\n…(truncated for the clipboard)";
  return text;
}

/** Build the LLM prompt for the Description Doctor — ask for a CLEARER, more
 *  DISTINCT description for one tool/skill (its current one overlaps its siblings).
 *  The LLM should reply with ONLY the improved one-line description. */
export function buildDescribeText({ trace, ranked, focusName }) {
  const focus = focusName;
  const noun = isSkill(focus) ? "skill" : "tool";
  const me = (ranked || []).find((r) => r.name === focus);
  const others = (ranked || []).filter((r) => r.name !== focus);

  const L = [];
  L.push(`# Suggest a clearer description for the ${noun} \`${focus}\``);
  L.push("");
  L.push(
    `This ${noun}'s description overlaps with its siblings, which makes an agent's routing ` +
      `ambiguous. Rewrite ONLY \`${focus}\`'s description so it is SHARPER and DISTINCT from the ` +
      `others — one sentence, concrete about WHEN to reach for it and what sets it apart. ` +
      `Reply with ONLY the new description: no quotes, no preamble.`,
  );
  L.push("");
  if (trace && trace.task) {
    L.push("## The kind of task it serves");
    L.push(trace.task);
    L.push("");
  }
  L.push(`## Current description of \`${focus}\``);
  L.push((me && me.description) || "(none)");
  L.push("");
  L.push(`## Sibling ${noun}s — keep it distinct from these`);
  others.forEach((r) => L.push(`- \`${r.name}\` — ${r.description || "(none)"}`));

  let text = L.join("\n");
  if (text.length > CAP) text = text.slice(0, CAP) + "\n\n…(truncated)";
  return text;
}
