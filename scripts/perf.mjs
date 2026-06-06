/* Performance / load benchmark for the pure hot paths (adapters + graph layout).
   Run: `npm run perf`. Prints a Markdown table (pasted into the README). These
   are the algorithmic cores; React render cost is separate (and bounded — see
   the timeline DOM cap + inspector I/O cap). */
import { fromOTLP, fromOTLPMulti, createMonitor } from "../src/adapters/otlp.js";
import { layoutFlow } from "../src/flow-layout.js";

const tv = (o) => Object.entries(o).map(([key, v]) => ({ key, value: typeof v === "number" ? { intValue: String(v) } : { stringValue: String(v) } }));
const sp = (attrs, events, id, parent) => ({
  spanId: id, parentSpanId: parent,
  startTimeUnixNano: "1700000000000000000", endTimeUnixNano: "1700000000300000000",
  attributes: tv(attrs), events: (events || []).map((e) => ({ name: e.name, attributes: tv(e.attrs) })),
});

// a single-agent OTLP run with `n` tool calls
function genOTLP(n) {
  const spans = [sp({ "gen_ai.operation.name": "invoke_agent", "gen_ai.agent.name": "agent", "gen_ai.request.model": "m", "gen_ai.usage.input_tokens": 10, "gen_ai.usage.output_tokens": 20 },
    [{ name: "gen_ai.user.message", attrs: { content: "go" } }, { name: "gen_ai.assistant.message", attrs: { content: "done" } }], "a")];
  for (let i = 0; i < n; i++) spans.push(sp({ "gen_ai.operation.name": "execute_tool", "gen_ai.tool.name": "t" + i, "gen_ai.tool.call.arguments": '{"i":' + i + "}" }, [{ name: "gen_ai.tool.message", attrs: { content: '{"ok":true}' } }], "t" + i));
  return { resourceSpans: [{ scopeSpans: [{ spans }] }] };
}
// a multi-agent OTLP tree: root + `a` child agents, each with one tool
function genMulti(a) {
  const spans = [sp({ "gen_ai.operation.name": "invoke_agent", "gen_ai.agent.name": "root" }, [], "root")];
  for (let i = 0; i < a; i++) {
    spans.push(sp({ "gen_ai.operation.name": "invoke_agent", "gen_ai.agent.name": "w" + i }, [], "w" + i, "root"));
    spans.push(sp({ "gen_ai.operation.name": "execute_tool", "gen_ai.tool.name": "t" + i }, [{ name: "gen_ai.tool.message", attrs: { content: "{}" } }], "wt" + i, "w" + i));
  }
  return { resourceSpans: [{ scopeSpans: [{ spans }] }] };
}
// a layered graph: `layers` columns of `width` agent nodes, fully connected between columns
function genGraph(layers, width) {
  const nodes = [], edges = [];
  for (let c = 0; c < layers; c++) for (let r = 0; r < width; r++) nodes.push({ id: c + "_" + r, kind: "agent" });
  for (let c = 0; c < layers - 1; c++) for (let r = 0; r < width; r++) for (let r2 = 0; r2 < width; r2++) edges.push({ from: c + "_" + r, to: (c + 1) + "_" + r2, kind: "seq" });
  return { nodes, edges };
}

function bench(label, fn, iters) {
  fn(); // warm up
  const t0 = performance.now();
  for (let i = 0; i < iters; i++) fn();
  const ms = (performance.now() - t0) / iters;
  return { label, ms };
}

const rows = [];
const push = (label, ms, n, unit) => rows.push({ label, ms: ms.toFixed(ms < 1 ? 3 : 1), rate: Math.round(n / (ms / 1000)).toLocaleString() + " " + unit });

for (const n of [100, 1000, 10000]) {
  const otlp = genOTLP(n);
  const { ms } = bench(`fromOTLP · ${n} tool spans`, () => fromOTLP(otlp), n >= 10000 ? 20 : 200);
  push(`fromOTLP — ${n.toLocaleString()} tool spans`, ms, n, "spans/s");
}
for (const a of [10, 100, 500]) {
  const otlp = genMulti(a);
  const { ms } = bench(`fromOTLPMulti · ${a} agents`, () => fromOTLPMulti(otlp), a >= 500 ? 50 : 300);
  push(`fromOTLPMulti — ${a.toLocaleString()} agents`, ms, a, "agents/s");
}
for (const [L, W] of [[10, 5], [50, 8], [100, 12]]) {
  const g = genGraph(L, W);
  const V = L * W;
  const { ms } = bench(`layoutFlow · ${V} nodes`, () => layoutFlow(g.nodes, g.edges), V >= 1000 ? 50 : 300);
  push(`layoutFlow — ${V.toLocaleString()} nodes / ${((L - 1) * W * W).toLocaleString()} edges`, ms, V, "nodes/s");
}
// live monitor: 2000 incremental pushes of one span each (streaming re-derive)
{
  const mon = createMonitor({ format: "otel" });
  const one = (i) => ({ resourceSpans: [{ scopeSpans: [{ spans: [sp({ "gen_ai.operation.name": "execute_tool", "gen_ai.tool.name": "t" + i }, [], "t" + i)] }] }] });
  const N = 2000;
  const t0 = performance.now();
  for (let i = 0; i < N; i++) mon.push(one(i));
  const ms = performance.now() - t0;
  rows.push({ label: `createMonitor — ${N.toLocaleString()} incremental pushes`, ms: ms.toFixed(1) + " total", rate: Math.round(N / (ms / 1000)).toLocaleString() + " pushes/s" });
}

const node = process.version;
console.log(`\nAgentThinkingUI — performance (Node ${node})\n`);
console.log("| operation | time | throughput |");
console.log("|---|---|---|");
for (const r of rows) console.log(`| ${r.label} | ${typeof r.ms === "string" && r.ms.includes("total") ? r.ms : r.ms + " ms"} | ${r.rate} |`);
console.log("");
