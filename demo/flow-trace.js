/* The four control-flow primitives compose into every named multi-agent pattern.
   Each is a FlowGraph for <AgentSwarm>; agent nodes carry a tiny Trace so the
   drill-down works. (See docs/multi-agent-flow.md.) */
(function () {
  const cost = (ms, t) => ({ ms, tokens: t });
  const ans = (h) => ({ headline: h, plan: [], budget: [], cta: "" });
  // an agent node with a minimal single-agent trace to drill into
  const emoji = (v) => ({ kind: "emoji", value: v });
  const agent = (id, name, role, status, brain, icon) => ({
    id, kind: "agent", name, role, status: status || "done", icon,
    trace: { task: name, agent: id, model: "loop", asker: "orchestrator", steps: [
      { kind: "prompt", brain: brain || (name + " — got the task."), cost: cost(220, 130) },
      { kind: "ask", tool: "work", toolName: name, input: {}, brain: "Working…", cost: cost(260, 120) },
      { kind: "return", tool: "work", toolName: name, replyType: "data", output: { ok: true }, brainMode: "reason", brain: "Got what I needed.", cost: cost(600, 320) },
      { kind: "answer", to: "orchestrator", brain: "Done.", answer: ans(name + " result"), cost: cost(240, 160) },
    ] },
  });
  const decision = (id, label) => ({ id, kind: "decision", label });
  const merge = (id, label) => ({ id, kind: "merge", label });
  const E = (from, to, kind, label, taken) => ({ from, to, kind, label, taken });

  const flows = {};

  // Hierarchical: planner → Sequence(worker×N) → synth
  flows.hierarchical = { label: "Hierarchical", graph: {
    task: "planner → workers → synthesis",
    nodes: [agent("p", "Planner", "orchestrator"), agent("w1", "Flights", "worker"), agent("w2", "Hotels", "worker"), agent("w3", "Budget", "worker"), merge("s", "synthesis")],
    edges: [E("p", "w1", "seq"), E("p", "w2", "seq"), E("p", "w3", "seq"), E("w1", "s", "seq"), E("w2", "s", "seq"), E("w3", "s", "seq")],
  } };

  // Debate: Parallel(pro, con) → judge
  flows.debate = { label: "Debate", graph: {
    task: "pro & con argue → judge decides",
    nodes: [agent("pro", "Advocate", "pro", "done", null, emoji("🙂")), agent("con", "Skeptic", "con", "done", null, emoji("🤨")), agent("j", "Judge", "arbiter", "done", null, emoji("⚖️"))],
    edges: [E("pro", "j", "parallel"), E("con", "j", "parallel")],
  } };

  // Router: Conditional → A | B | C  (one branch taken, rest dimmed)
  flows.router = { label: "Router", graph: {
    task: "route the request by intent",
    nodes: [decision("r", "intent?"), agent("a", "Billing", "handler", "done", null, emoji("💳")), agent("b", "Tech", "handler", "done", null, emoji("🛠️")), agent("c", "General", "handler", "done", null, emoji("💬"))],
    edges: [E("r", "a", "conditional", "billing", true), E("r", "b", "conditional", "tech"), E("r", "c", "conditional", "other")],
  } };

  // Reflexion: Loop( Agent → Conditional(critique) → Agent )
  flows.reflexion = { label: "Reflexion", graph: {
    task: "draft → critique → revise until good",
    nodes: [agent("d", "Drafter", "writer", "done"), decision("c", "good enough?"), agent("f", "Finalizer", "writer")],
    edges: [E("d", "c", "seq"), E("c", "f", "conditional", "pass", true), E("c", "d", "loop", "revise ×2")],
  } };

  // Swarm: Loop( Parallel(Agent×N) → merge )
  flows.swarm = { label: "Swarm", graph: {
    task: "parallel workers, merge, repeat",
    nodes: [agent("dz", "Dispatcher", "lead"), agent("s1", "Scout A", "worker", "running"), agent("s2", "Scout B", "worker", "running"), agent("s3", "Scout C", "worker"), merge("m", "merge")],
    edges: [E("dz", "s1", "parallel"), E("dz", "s2", "parallel"), E("dz", "s3", "parallel"), E("s1", "m", "seq"), E("s2", "m", "seq"), E("s3", "m", "seq"), E("m", "dz", "loop", "until converged ×3")],
  } };

  // Tree-of-Thoughts: Loop( Parallel(Agent×N) → Conditional(score) )
  flows.tree = { label: "Tree-of-Thoughts", graph: {
    task: "expand thoughts, score, keep the best",
    nodes: [agent("root", "Root", "seed"), agent("t1", "Thought A", "branch"), agent("t2", "Thought B", "branch"), agent("t3", "Thought C", "branch"), decision("sc", "score?"), agent("out", "Answer", "final")],
    edges: [E("root", "t1", "parallel"), E("root", "t2", "parallel"), E("root", "t3", "parallel"), E("t1", "sc", "seq"), E("t2", "sc", "seq"), E("t3", "sc", "seq"), E("sc", "out", "conditional", "good enough", true), E("sc", "root", "loop", "expand best ×3")],
  } };

  // …and one graph BUILT from a real OpenTelemetry multi-agent span tree, via the
  // adapter, to prove fromOTLPMulti end-to-end (Orchestrator → 3 specialists).
  const tv = (o) => Object.entries(o).map(([key, v]) => ({ key, value: typeof v === "number" ? { intValue: String(v) } : { stringValue: String(v) } }));
  const osp = (spanId, parent, attrs, events) => ({ spanId, parentSpanId: parent, startTimeUnixNano: "1700000000000000000", endTimeUnixNano: "1700000000600000000", attributes: tv(attrs), events: (events || []).map((e) => ({ name: e.name, attributes: tv(e.attrs) })) });
  const OTLP_MULTI = { resourceSpans: [{ scopeSpans: [{ spans: [
    osp("o", undefined, { "gen_ai.operation.name": "invoke_agent", "gen_ai.agent.name": "Orchestrator", "gen_ai.request.model": "loop" }, [{ name: "gen_ai.user.message", attrs: { content: "Plan a Lisbon offsite under $5,000" } }, { name: "gen_ai.assistant.message", attrs: { content: "Delegated to specialists and assembled the plan." } }]),
    osp("f", "o", { "gen_ai.operation.name": "invoke_agent", "gen_ai.agent.name": "Flights" }),
    osp("ft", "f", { "gen_ai.operation.name": "execute_tool", "gen_ai.tool.name": "search_flights", "gen_ai.tool.call.arguments": '{"to":"LIS"}' }, [{ name: "gen_ai.tool.message", attrs: { content: '{"price":286}' } }]),
    osp("h", "o", { "gen_ai.operation.name": "invoke_agent", "gen_ai.agent.name": "Hotels" }),
    osp("ht", "h", { "gen_ai.operation.name": "execute_tool", "gen_ai.tool.name": "search_hotels", "gen_ai.tool.call.arguments": "{}" }, [{ name: "gen_ai.tool.message", attrs: { content: '{"pick":"Baixa"}' } }]),
    osp("ap", "o", { "gen_ai.operation.name": "invoke_agent", "gen_ai.agent.name": "Approvals" }),
    osp("apt", "ap", { "gen_ai.operation.name": "execute_tool", "gen_ai.tool.name": "approval_policy", "gen_ai.tool.call.arguments": "{}" }, [{ name: "gen_ai.tool.message", attrs: { content: '{"needs_signoff":true}' } }]),
  ] }] }] };
  if (window.AgentAdapters && window.AgentAdapters.fromOTLPMulti) {
    flows.fromotel = { label: "From OTel ⚡", graph: window.AgentAdapters.fromOTLPMulti(OTLP_MULTI, { asker: "you" }) };
  }

  window.AGENT_FLOWS = flows;
})();
