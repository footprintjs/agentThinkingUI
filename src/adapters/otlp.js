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
  const chats = spans.filter((s) => R.isChat(s.a));
  const tools = spans.filter((s) => R.isTool(s.a));
  const find = (arr, pred) => arr.find(pred);
  const cost = (s) => ({ ms: Math.round(durMs(s.sp)), tokens: (Number(R.inTok(s.a)) || 0) + (Number(R.outTok(s.a)) || 0) });

  const agentName = (agentSpan && R.agent(agentSpan.a)) || spans.map((s) => R.agent(s.a)).find(Boolean) || "agent";
  const model = spans.map((s) => R.model(s.a)).find(Boolean) || "unknown";
  const userText = toText(opts.task || (agentSpan && R.userMsg(agentSpan.a, agentSpan.sp)) || (chats[0] && R.userMsg(chats[0].a, chats[0].sp)));

  const steps = [];
  if (userText) steps.push({ kind: "prompt", brain: userText, cost: (chats[0] && cost(chats[0])) || { ms: 0, tokens: 0 } });

  for (const t of tools) {
    const a = t.a, name = R.toolName(a) || "tool";
    const before = find([...chats].reverse(), (c) => c.start < t.start);
    const after = find(chats, (c) => c.start > t.start);
    const c = cost(t), half = { ms: Math.round(c.ms / 2), tokens: Math.round(c.tokens / 2) };
    steps.push({
      kind: "ask", tool: name, toolName: name, input: asObject(R.toolInput(a, t.sp)),
      brain: toText(before && R.assistantMsg(before.a, before.sp)) || ("Calling " + name), cost: half,
    });
    const cls = classifyReply(name, a, opts);
    const ret = {
      kind: "return", tool: name, toolName: name, replyType: cls.replyType,
      output: asObject(R.toolOutput(a, t.sp)),
      brainMode: cls.replyType === "instruction" ? "act" : "reason",
      brain: toText(after && R.assistantMsg(after.a, after.sp)),
      cost: half,
    };
    if (cls.replyType !== "data") { ret.skill = cls.skill || name; ret.actChecklist = cls.actChecklist || []; }
    if (cls.replyType === "both") ret.actNote = toText(cls.actNote);
    steps.push(ret);
  }

  const lastChat = chats[chats.length - 1];
  const answerText = toText((agentSpan && R.assistantMsg(agentSpan.a, agentSpan.sp)) || (lastChat && R.assistantMsg(lastChat.a, lastChat.sp)));
  steps.push({
    kind: "answer", to: opts.asker || "user",
    brain: answerText || "Done.",
    answer: { headline: (answerText || "Done.").slice(0, 120), plan: [], budget: [], cta: opts.cta || "" },
    cost: (lastChat && cost(lastChat)) || (agentSpan && cost(agentSpan)) || { ms: 0, tokens: 0 },
  });

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

/** OpenTelemetry span TREE → a multi-agent FlowGraph for <AgentSwarm>.
    Each invoke_agent span becomes an agent node (its Trace built from its own
    subtree, excluding nested agents); parent→child agent links become edges
    (parallel when a parent has several child agents, else seq). */
export function fromOTLPMulti(otlp, opts = {}) {
  const R = OTEL;
  const spans = collectSpans(otlp);
  const byId = {}; spans.forEach((s) => { if (s.spanId) byId[s.spanId] = s; });
  const kids = {}; spans.forEach((s) => { if (s.parentSpanId) (kids[s.parentSpanId] = kids[s.parentSpanId] || []).push(s); });
  const isAgent = (s) => { const a = flatAttrs(s); const op = R.op(a); return op === "invoke_agent" || op === "create_agent" || !!a["gen_ai.agent.name"]; };
  const agentSpans = spans.filter(isAgent);

  // 0–1 agents → a single-agent graph wrapping the whole run
  if (agentSpans.length <= 1) {
    const tr = buildTrace(spans, R, opts);
    return { task: tr.task, asker: tr.asker, nodes: [{ id: (agentSpans[0] && agentSpans[0].spanId) || "agent", kind: "agent", name: tr.agent, trace: tr }], edges: [] };
  }

  const agentIds = new Set(agentSpans.map((s) => s.spanId));
  const nearestAgent = (s) => { let p = s.parentSpanId; while (p && byId[p]) { if (agentIds.has(p)) return p; p = byId[p].parentSpanId; } return null; };
  const ownSpans = (root) => { // subtree of root, minus nested agents' subtrees
    const out = [], stack = [root];
    while (stack.length) { const s = stack.pop(); out.push(s); (kids[s.spanId] || []).forEach((c) => { if (!agentIds.has(c.spanId)) stack.push(c); }); }
    return out;
  };

  const nodes = agentSpans.map((s) => {
    const a = flatAttrs(s);
    const tr = buildTrace(ownSpans(s), R, { asker: opts.asker, title: R.agent(a) });
    const code = s.status && s.status.code;
    return { id: s.spanId, kind: "agent", name: R.agent(a) || tr.agent || "agent", role: a["gen_ai.agent.description"], status: (code === 2 || code === "STATUS_CODE_ERROR") ? "error" : "done", trace: tr };
  });

  const childCount = {}; agentSpans.forEach((s) => { const p = nearestAgent(s); if (p) childCount[p] = (childCount[p] || 0) + 1; });
  const edges = [];
  agentSpans.forEach((s) => { const p = nearestAgent(s); if (p) edges.push({ from: p, to: s.spanId, kind: childCount[p] > 1 ? "parallel" : "seq" }); });

  const root = agentSpans.find((s) => !nearestAgent(s)) || agentSpans[0];
  const rootNode = nodes.find((n) => n.id === root.spanId);
  return { task: opts.task || (rootNode && rootNode.trace.task) || "multi-agent run", asker: opts.asker || "user", nodes, edges };
}

/* Live monitoring: accumulate spans as they finish and re-run the adapter on the
   growing set, then hand the result to <AgentThinkingUI live trace={...} />.
   (Pure + cheap; the player tails the newest beat.) Example:
     const acc = [];
     onSpanEnd(span => { acc.push(span); setTrace(fromOTLP(acc, opts)); });
*/
