/* ============================================================
   AgentThinkingUI — trace adapters
   Convert standard agent telemetry into the AgentThinkingUI trace
   (see types/trace.d.ts). Most frameworks/runtimes converge on
   OpenTelemetry GenAI spans (AWS Bedrock AgentCore, LangGraph, CrewAI,
   AutoGen, OpenAI Agents SDK, Google ADK, Pydantic AI, Strands…), so a
   single OTLP reader covers the ecosystem; OpenInference (Arize/Phoenix/
   LlamaIndex) is the same shape with different attribute keys.

   Structure maps cleanly: agent span → Trace; tool execution → ask+return;
   first user message → prompt; final assistant message → answer; span
   duration + token usage → cost.

   The data/instruction/both distinction is OUR semantic and is NOT in the
   standards, so reply-type is decided by (in priority order):
     1. opts.classify(toolName, attrs)  → { replyType, skill, actChecklist }
     2. opt-in span attributes `agentthinkingui.reply_type` / `.skill`
     3. a heuristic: skill/steering/policy/guardrail tools → instruction; else data
   ============================================================ */

// ---- OTLP value plumbing -------------------------------------------------
function attrVal(v) {
  if (v == null) return undefined;
  if (typeof v !== "object") return v; // some exporters emit plain values
  if ("stringValue" in v) return v.stringValue;
  if ("intValue" in v) return Number(v.intValue);
  if ("doubleValue" in v) return v.doubleValue;
  if ("boolValue" in v) return v.boolValue;
  if ("arrayValue" in v) return (v.arrayValue.values || []).map(attrVal);
  if ("kvlistValue" in v) return kvToObj(v.kvlistValue.values);
  return undefined;
}
function kvToObj(list) { const o = {}; for (const e of list || []) o[e.key] = attrVal(e.value); return o; }
const flatAttrs = (span) => kvToObj(span.attributes);

function collectSpans(otlp) {
  if (Array.isArray(otlp)) return otlp.slice();
  const out = [];
  for (const rs of (otlp && otlp.resourceSpans) || [])
    for (const ss of rs.scopeSpans || rs.instrumentationLibrarySpans || [])
      for (const sp of ss.spans || []) out.push(sp);
  return out;
}
const nano = (x) => { try { return BigInt(typeof x === "string" ? x : Math.round(Number(x))); } catch { return 0n; } };
const durMs = (sp) => Math.max(0, Number(nano(sp.endTimeUnixNano) - nano(sp.startTimeUnixNano)) / 1e6) || 0;
const tryJSON = (s) => { if (typeof s !== "string") return s; try { return JSON.parse(s); } catch { return s; } };
const asObject = (v) => (v && typeof v === "object" && !Array.isArray(v)) ? v : (v == null ? {} : { value: v });
const eventAttrs = (sp, name) => { const e = (sp.events || []).find((ev) => ev.name === name); return e ? flatAttrs(e) : null; };
const firstContent = (o) => o && (o.content || o["gen_ai.message.content"] || o.message || o.body || o["gen_ai.event.content"]);

// universal error detection (works for OTel + OpenInference — both are OTLP spans):
// span status ERROR, or a recorded `exception` event.
function spanError(sp) {
  const st = sp.status;
  if (st && (st.code === 2 || st.code === "STATUS_CODE_ERROR" || st.code === "ERROR")) return st.message || "error";
  const ex = (sp.events || []).find((e) => e.name === "exception");
  if (ex) { const a = flatAttrs(ex); return a["exception.message"] || a["exception.type"] || "exception"; }
  return null;
}

// ---- attribute readers (the only thing that differs per convention) ------
const OTEL = {
  op: (a) => a["gen_ai.operation.name"],
  isTool: (a) => a["gen_ai.operation.name"] === "execute_tool" || !!a["gen_ai.tool.name"],
  isChat: (a) => ["chat", "text_completion", "generate_content"].includes(a["gen_ai.operation.name"]),
  agent: (a) => a["gen_ai.agent.name"] || a["gen_ai.agent.id"],
  model: (a) => a["gen_ai.request.model"] || a["gen_ai.response.model"],
  toolName: (a) => a["gen_ai.tool.name"],
  toolInput: (a, sp) => tryJSON(a["gen_ai.tool.call.arguments"] ?? a["gen_ai.tool.input"] ?? (eventAttrs(sp, "gen_ai.tool.message") || {}).arguments),
  toolOutput: (a, sp) => tryJSON(a["gen_ai.tool.result"] ?? firstContent(eventAttrs(sp, "gen_ai.tool.message")) ?? a["gen_ai.tool.output"]),
  inTok: (a) => a["gen_ai.usage.input_tokens"],
  outTok: (a) => a["gen_ai.usage.output_tokens"],
  cacheTok: (a) => a["gen_ai.usage.cache_read_input_tokens"] ?? a["gen_ai.usage.cached_tokens"] ?? a["gen_ai.usage.cache_read_tokens"],
  userMsg: (a, sp) => firstContent(eventAttrs(sp, "gen_ai.user.message")) ?? a["gen_ai.prompt.0.content"] ?? a["gen_ai.input.messages"],
  assistantMsg: (a, sp) => firstContent(eventAttrs(sp, "gen_ai.assistant.message")) ?? firstContent(eventAttrs(sp, "gen_ai.choice")) ?? a["gen_ai.completion.0.content"] ?? a["gen_ai.output.messages"],
};
const OPENINFERENCE = {
  op: (a) => a["openinference.span.kind"],
  isTool: (a) => ["TOOL", "RETRIEVER"].includes(a["openinference.span.kind"]),
  isChat: (a) => a["openinference.span.kind"] === "LLM",
  agent: (a) => a["agent.name"],
  model: (a) => a["llm.model_name"],
  toolName: (a) => a["tool.name"],
  toolInput: (a) => tryJSON(a["input.value"]),
  toolOutput: (a) => tryJSON(a["output.value"]),
  inTok: (a) => a["llm.token_count.prompt"],
  outTok: (a) => a["llm.token_count.completion"],
  cacheTok: (a) => a["llm.token_count.prompt_details.cache_read"] ?? a["llm.token_count.cache_read"],
  userMsg: (a) => a["llm.input_messages.0.message.content"] ?? tryJSON(a["input.value"]),
  assistantMsg: (a) => a["llm.output_messages.0.message.content"] ?? tryJSON(a["output.value"]),
};

// reply-type: our semantic layer (heuristic + opt-in attrs + caller hook)
const STEER_RE = /skill|steer|policy|guardrail|rule|instruction|playbook/i;
function classifyReply(toolName, a, opts) {
  if (opts.classify) { const r = opts.classify(toolName, a); if (r && r.replyType) return r; }
  const tagged = a["agentthinkingui.reply_type"];
  if (tagged) return { replyType: tagged, skill: a["agentthinkingui.skill"], actChecklist: a["agentthinkingui.checklist"] };
  if (toolName && STEER_RE.test(toolName)) return { replyType: "instruction", skill: a["agentthinkingui.skill"] || toolName };
  return { replyType: "data" };
}

function toText(v) { return v == null ? "" : (typeof v === "string" ? v : JSON.stringify(v)); }

// ---- the builder (shared by both conventions) ----------------------------
function buildTrace(otlp, R, opts = {}) {
  const spans = collectSpans(otlp)
    .map((sp) => ({ sp, a: flatAttrs(sp), start: nano(sp.startTimeUnixNano) }))
    .sort((x, y) => (x.start < y.start ? -1 : x.start > y.start ? 1 : 0));

  const agentSpan = spans.find((s) => R.op(s.a) === "invoke_agent" || R.op(s.a) === "create_agent" || R.op(s.a) === "AGENT") || spans[0];
  // `spans` is sorted by start, so `chats` and `tools` are too — we exploit that
  // ordering below to pair each tool with its surrounding chats in O(T + C).
  const chats = spans.filter((s) => R.isChat(s.a));
  const tools = spans.filter((s) => R.isTool(s.a));
  const cost = (s) => {
    const tin = Number(R.inTok(s.a)) || 0, tout = Number(R.outTok(s.a)) || 0;
    const cached = Number(R.cacheTok && R.cacheTok(s.a)) || 0;
    const c = { ms: Math.round(durMs(s.sp)), tokens: tin + tout };
    if (tin) c.tokensIn = tin;
    if (tout) c.tokensOut = tout;
    if (cached) c.tokensCached = cached;
    return c;
  };
  // split a cost across the synthetic ask+return halves, keeping the breakdown
  const halveCost = (c) => {
    const h = { ms: Math.round(c.ms / 2), tokens: Math.round(c.tokens / 2) };
    if (c.tokensIn != null) h.tokensIn = Math.round(c.tokensIn / 2);
    if (c.tokensOut != null) h.tokensOut = Math.round(c.tokensOut / 2);
    if (c.tokensCached != null) h.tokensCached = Math.round(c.tokensCached / 2);
    return h;
  };

  const agentName = (agentSpan && R.agent(agentSpan.a)) || spans.map((s) => R.agent(s.a)).find(Boolean) || "agent";
  const model = spans.map((s) => R.model(s.a)).find(Boolean) || "unknown";
  const userText = toText(opts.task || (agentSpan && R.userMsg(agentSpan.a, agentSpan.sp)) || (chats[0] && R.userMsg(chats[0].a, chats[0].sp)));

  // stamp the source span/trace id onto each step so hosts can deep-link back to
  // their trace store (Langfuse/Phoenix/…). Optional — absent if the spans lack ids.
  const idOf = (sp) => (sp ? { ...(sp.spanId ? { spanId: sp.spanId } : {}), ...(sp.traceId ? { traceId: sp.traceId } : {}) } : {});
  const steps = [];
  if (userText) steps.push({ kind: "prompt", brain: userText, cost: (chats[0] && cost(chats[0])) || { ms: 0, tokens: 0 }, ...idOf((agentSpan && agentSpan.sp) || (chats[0] && chats[0].sp)) });

  // two-pointer over the time-sorted chats: `ci` only moves forward as tools
  // advance, so the whole loop is O(T + C) (was O(T·C) with a per-tool reversed
  // copy). For each tool: `before` = last chat that started before it (the
  // reasoning that led to the call), `after` = first chat once it returned.
  let ci = 0;
  for (const t of tools) {
    const a = t.a, name = R.toolName(a) || "tool";
    while (ci < chats.length && chats[ci].start < t.start) ci += 1;
    const before = ci > 0 ? chats[ci - 1] : undefined;
    const after = chats[ci]; // first chat at/after the call (starts are monotonic & distinct)
    const c = cost(t), half = halveCost(c);
    // record WHO wrote each `brain` body: the model's own message, or our
    // fallback narration. The views only put "LLM …" in front of model text.
    const asked = toText(before && R.assistantMsg(before.a, before.sp));
    steps.push({
      kind: "ask", tool: name, toolName: name, input: asObject(R.toolInput(a, t.sp)),
      brain: asked || ("Calling " + name), brainSource: asked ? "model" : "framework", cost: half,
      ...idOf(t.sp),
    });
    const cls = classifyReply(name, a, opts);
    // many runtimes emit no assistant message between tools; fall back to a
    // generic narration so the reasoning bubble is never blank.
    const reasoned = toText(after && R.assistantMsg(after.a, after.sp));
    const ret = {
      kind: "return", tool: name, toolName: name, replyType: cls.replyType,
      output: asObject(R.toolOutput(a, t.sp)),
      brainMode: cls.replyType === "instruction" ? "act" : "reason",
      brain: reasoned || (cls.replyType === "instruction"
        ? "Following " + (cls.skill || name)
        : "Reasoning over the result from " + name),
      brainSource: reasoned ? "model" : "framework",
      cost: half,
      ...idOf(t.sp),
    };
    if (cls.replyType !== "data") { ret.skill = cls.skill || name; ret.actChecklist = cls.actChecklist || []; }
    if (cls.replyType === "both") ret.actNote = toText(cls.actNote);
    const err = spanError(t.sp); if (err) ret.error = err;
    steps.push(ret);
  }

  const lastChat = chats[chats.length - 1];
  const answerText = toText((agentSpan && R.assistantMsg(agentSpan.a, agentSpan.sp)) || (lastChat && R.assistantMsg(lastChat.a, lastChat.sp)));
  const agentErr = agentSpan && spanError(agentSpan.sp);
  const answerStep = {
    kind: "answer", to: opts.asker || "user",
    brain: answerText || (agentErr ? "Run failed." : "Done."),
    brainSource: answerText ? "model" : "framework",
    answer: { headline: (answerText || (agentErr || "Done.")).slice(0, 120), plan: [], budget: [], cta: opts.cta || "" },
    cost: (lastChat && cost(lastChat)) || (agentSpan && cost(agentSpan)) || { ms: 0, tokens: 0 },
    ...idOf((agentSpan && agentSpan.sp) || (lastChat && lastChat.sp)),
  };
  if (agentErr) answerStep.error = agentErr;
  steps.push(answerStep);

  return {
    task: userText || opts.task || agentName + " run",
    title: opts.title || agentName,
    agent: agentName, model,
    asker: opts.asker || "user",
    steps,
  };
}

/** OpenTelemetry GenAI (OTLP/JSON, or a flat span array) → Trace. */
export function fromOTLP(otlp, opts = {}) { return buildTrace(otlp, OTEL, opts); }

/** OpenInference (Arize/Phoenix/LlamaIndex) spans → Trace. */
export function fromOpenInference(otlp, opts = {}) { return buildTrace(otlp, OPENINFERENCE, opts); }

// shared span-TREE → FlowGraph builder (reader-agnostic, like buildTrace)
function buildMulti(otlp, R, opts = {}) {
  const spans = collectSpans(otlp);
  const byId = {}; spans.forEach((s) => { if (s.spanId) byId[s.spanId] = s; });
  const kids = {}; spans.forEach((s) => { if (s.parentSpanId) (kids[s.parentSpanId] = kids[s.parentSpanId] || []).push(s); });
  // parse each span's attributes once (flatAttrs walks the whole attr list)
  const attrCache = new Map();
  const attrs = (s) => { let a = attrCache.get(s); if (!a) { a = flatAttrs(s); attrCache.set(s, a); } return a; };
  const isAgent = (s) => { const a = attrs(s), op = R.op(a); return op === "invoke_agent" || op === "create_agent" || op === "AGENT" || !!R.agent(a); };
  const agentSpans = spans.filter(isAgent);

  // 0–1 agents → a single-agent graph wrapping the whole run
  if (agentSpans.length <= 1) {
    const tr = buildTrace(spans, R, opts);
    return { task: tr.task, asker: tr.asker, nodes: [{ id: (agentSpans[0] && agentSpans[0].spanId) || "agent", kind: "agent", name: tr.agent, trace: tr }], edges: [] };
  }

  const agentIds = new Set(agentSpans.map((s) => s.spanId));
  // nearest agent-ancestor per agent span — computed ONCE (was walked 3×/node)
  const nearest = {};
  agentSpans.forEach((s) => {
    let p = s.parentSpanId, found = null;
    while (p && byId[p]) { if (agentIds.has(p)) { found = p; break; } p = byId[p].parentSpanId; }
    nearest[s.spanId] = found;
  });
  const ownSpans = (root) => { // subtree of root, minus nested agents' subtrees
    const out = [], stack = [root];
    while (stack.length) { const s = stack.pop(); out.push(s); (kids[s.spanId] || []).forEach((c) => { if (!agentIds.has(c.spanId)) stack.push(c); }); }
    return out;
  };

  const nodes = agentSpans.map((s) => {
    const a = attrs(s);
    const own = ownSpans(s);
    const tr = buildTrace(own, R, { asker: opts.asker, title: R.agent(a) });
    return { id: s.spanId, kind: "agent", name: R.agent(a) || tr.agent || "agent", role: a["gen_ai.agent.description"], status: own.some(spanError) ? "error" : "done", trace: tr, ...(s.spanId ? { spanId: s.spanId } : {}), ...(s.traceId ? { traceId: s.traceId } : {}) };
  });

  const childCount = {}; agentSpans.forEach((s) => { const p = nearest[s.spanId]; if (p) childCount[p] = (childCount[p] || 0) + 1; });
  const edges = [];
  agentSpans.forEach((s) => { const p = nearest[s.spanId]; if (p) edges.push({ from: p, to: s.spanId, kind: childCount[p] > 1 ? "parallel" : "seq" }); });

  const root = agentSpans.find((s) => !nearest[s.spanId]) || agentSpans[0];
  const rootNode = nodes.find((n) => n.id === root.spanId);
  return { task: opts.task || (rootNode && rootNode.trace.task) || "multi-agent run", asker: opts.asker || "user", nodes, edges };
}

/** OpenTelemetry GenAI span TREE → a multi-agent FlowGraph for <MultiAgentFlow>.
    Each invoke_agent span becomes an agent node (its Trace built from its own
    subtree, excluding nested agents); parent→child agent links become edges
    (parallel when a parent has several child agents, else seq). The drill-down
    Trace per agent is built programmatically from that agent's child spans. */
export function fromOTLPMulti(otlp, opts = {}) { return buildMulti(otlp, OTEL, opts); }

/** OpenInference span TREE → a multi-agent FlowGraph (same as fromOTLPMulti, OI keys). */
export function fromOpenInferenceMulti(otlp, opts = {}) { return buildMulti(otlp, OPENINFERENCE, opts); }

/* Live monitoring: accumulate spans as they finish and re-run the adapter on the
   growing set, then hand the result to <AgentThinkingUI live trace={...} />.
   (Pure + cheap; the player tails the newest beat.) Example:
     const acc = [];
     onSpanEnd(span => { acc.push(span); setTrace(fromOTLP(acc, opts)); });
*/

/**
 * Push-based monitor for live sources. Feed it spans as they arrive (an OTLP
 * payload or a flat array, in either convention) and read the up-to-date
 * Trace/FlowGraph to hand to <AgentThinkingUI live> / <MultiAgentFlow live>.
 *
 *   const mon = createMonitor({ format: "otel", asker: "you" });
 *   exporter.onBatch(otlp => setTrace(mon.push(otlp)));   // single agent
 *   // or { multi: true } → returns a FlowGraph for <MultiAgentFlow>
 *
 * Re-derives from the accumulated spans on each push (O(n)); for typical live
 * runs that's negligible. `format` selects the reader (otel | openinference);
 * pass `reader` to plug a custom convention (see the reader maps above).
 */
export function createMonitor(opts = {}) {
  const reader = opts.reader || (opts.format === "openinference" ? OPENINFERENCE : OTEL);
  const spans = [];
  const build = () => (opts.multi ? buildMulti(spans, reader, opts) : buildTrace(spans, reader, opts));
  let current = build();
  return {
    /** append spans (OTLP object or flat array) and return the updated result */
    push(input) { for (const s of collectSpans(input)) spans.push(s); current = build(); return current; },
    /** the current Trace (or FlowGraph when `multi`) */
    get result() { return current; },
    /** a copy of the accumulated raw spans */
    get spans() { return spans.slice(); },
    /** clear and start over */
    reset() { spans.length = 0; current = build(); return current; },
  };
}
