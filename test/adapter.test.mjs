import { describe, it, expect } from "vitest";
import { fromOTLP, fromOpenInference, fromOTLPMulti, fromOpenInferenceMulti, createMonitor } from "../src/adapters/otlp.js";

// build OTLP/JSON typed attributes + a span helper
const A = (o) => Object.entries(o).map(([key, v]) => ({
  key, value: typeof v === "number" ? { intValue: String(v) } : { stringValue: String(v) },
}));
let clock = 1_700_000_000_000_000_000n;
const span = (attrs, events = [], ms = 500) => {
  const start = clock; clock += 10_000_000n; // 10ms apart
  return {
    startTimeUnixNano: String(start),
    endTimeUnixNano: String(start + BigInt(ms) * 1_000_000n),
    attributes: A(attrs),
    events: events.map((e) => ({ name: e.name, attributes: A(e.attrs) })),
  };
};
const otlp = (spans) => ({ resourceSpans: [{ scopeSpans: [{ spans }] }] });

describe("fromOTLP (OpenTelemetry GenAI)", () => {
  const trace = fromOTLP(
    otlp([
      span(
        { "gen_ai.operation.name": "invoke_agent", "gen_ai.agent.name": "trip-agent", "gen_ai.request.model": "gpt-4o", "gen_ai.usage.input_tokens": 40, "gen_ai.usage.output_tokens": 60 },
        [
          { name: "gen_ai.user.message", attrs: { content: "Plan a trip to Lisbon" } },
          { name: "gen_ai.assistant.message", attrs: { content: "Done — booked the trip." } },
        ]
      ),
      span(
        { "gen_ai.operation.name": "execute_tool", "gen_ai.tool.name": "search_flights", "gen_ai.tool.call.arguments": '{"to":"LIS"}' },
        [{ name: "gen_ai.tool.message", attrs: { content: '{"price":286}' } }]
      ),
      span(
        { "gen_ai.operation.name": "execute_tool", "gen_ai.tool.name": "load_skill", "gen_ai.tool.call.arguments": '{"name":"budget"}' },
        [{ name: "gen_ai.tool.message", attrs: { content: '{"cap":5000}' } }]
      ),
    ]),
    { asker: "Sam" }
  );

  it("maps agent + model + asker", () => {
    expect(trace.agent).toBe("trip-agent");
    expect(trace.model).toBe("gpt-4o");
    expect(trace.asker).toBe("Sam");
  });

  it("opens with the user prompt", () => {
    expect(trace.steps[0]).toMatchObject({ kind: "prompt" });
    expect(trace.steps[0].brain).toContain("Lisbon");
  });

  it("captures the input/output token breakdown for cost attribution", () => {
    // the agent span's usage (40 in / 60 out) flows onto the answer step
    expect(trace.steps.find((s) => s.kind === "answer").cost).toMatchObject({ tokens: 100, tokensIn: 40, tokensOut: 60 });
  });

  it("reads cache-read tokens (OTel + OpenInference keys)", () => {
    const ot = fromOTLP(otlp([span({ "gen_ai.operation.name": "invoke_agent", "gen_ai.agent.name": "a", "gen_ai.usage.input_tokens": 100, "gen_ai.usage.output_tokens": 20, "gen_ai.usage.cache_read_input_tokens": 80 })]));
    expect(ot.steps.find((s) => s.kind === "answer").cost.tokensCached).toBe(80);
    const oi = fromOpenInference(otlp([span({ "openinference.span.kind": "AGENT", "agent.name": "a", "llm.token_count.prompt": 100, "llm.token_count.completion": 20, "llm.token_count.prompt_details.cache_read": 64 })]));
    expect(oi.steps.find((s) => s.kind === "answer").cost.tokensCached).toBe(64);
  });

  it("turns each tool execution into ask + return with parsed I/O", () => {
    const ask = trace.steps.find((s) => s.kind === "ask" && s.tool === "search_flights");
    expect(ask.input).toEqual({ to: "LIS" });
    const ret = trace.steps.find((s) => s.kind === "return" && s.tool === "search_flights");
    expect(ret.output).toEqual({ price: 286 });
    expect(ret.replyType).toBe("data"); // heuristic default
    expect(ret.brainMode).toBe("reason");
  });

  it("classifies skill/steering tools as instructions (act)", () => {
    const ret = trace.steps.find((s) => s.kind === "return" && s.tool === "load_skill");
    expect(ret.replyType).toBe("instruction");
    expect(ret.brainMode).toBe("act");
    expect(ret.skill).toBe("load_skill");
  });

  it("ends with the final answer", () => {
    const last = trace.steps[trace.steps.length - 1];
    expect(last.kind).toBe("answer");
    expect(last.brain).toContain("booked");
  });

  it("honours opt-in annotations + a classify() hook", () => {
    const t1 = fromOTLP(otlp([span({ "gen_ai.operation.name": "execute_tool", "gen_ai.tool.name": "lookup", "agentthinkingui.reply_type": "instruction", "agentthinkingui.skill": "house_rules" })]));
    expect(t1.steps.find((s) => s.kind === "return").skill).toBe("house_rules");

    const t2 = fromOTLP(otlp([span({ "gen_ai.operation.name": "execute_tool", "gen_ai.tool.name": "lookup" })]), {
      classify: (name) => (name === "lookup" ? { replyType: "instruction", skill: "X" } : undefined),
    });
    expect(t2.steps.find((s) => s.kind === "return").replyType).toBe("instruction");
  });
});

describe("fromOTLPMulti (multi-agent span tree → FlowGraph)", () => {
  const mspan = (spanId, parentSpanId, attrs, events) => ({ spanId, parentSpanId, ...span(attrs, events) });
  const tree = otlp([
    mspan("o", undefined, { "gen_ai.operation.name": "invoke_agent", "gen_ai.agent.name": "Planner", "gen_ai.request.model": "x" },
      [{ name: "gen_ai.user.message", attrs: { content: "Plan the trip" } }, { name: "gen_ai.assistant.message", attrs: { content: "Delegated and assembled." } }]),
    mspan("f", "o", { "gen_ai.operation.name": "invoke_agent", "gen_ai.agent.name": "Flights" }),
    mspan("ft", "f", { "gen_ai.operation.name": "execute_tool", "gen_ai.tool.name": "search_flights", "gen_ai.tool.call.arguments": '{"to":"LIS"}' }, [{ name: "gen_ai.tool.message", attrs: { content: '{"price":286}' } }]),
    mspan("h", "o", { "gen_ai.operation.name": "invoke_agent", "gen_ai.agent.name": "Hotels" }),
    mspan("ht", "h", { "gen_ai.operation.name": "execute_tool", "gen_ai.tool.name": "search_hotels", "gen_ai.tool.call.arguments": "{}" }, [{ name: "gen_ai.tool.message", attrs: { content: '{"pick":"Baixa"}' } }]),
  ]);
  const g = fromOTLPMulti(tree, { asker: "John" });

  it("makes an agent node per invoke_agent span", () => {
    expect(g.nodes.map((n) => n.name).sort()).toEqual(["Flights", "Hotels", "Planner"]);
  });
  it("links parent → child agents as parallel edges", () => {
    expect(g.edges.length).toBe(2);
    expect(g.edges.every((e) => e.from === "o" && e.kind === "parallel")).toBe(true);
  });
  it("builds each agent's trace from its OWN subtree (tools belong to the child)", () => {
    const flights = g.nodes.find((n) => n.name === "Flights");
    expect(flights.trace.steps.some((s) => s.kind === "ask" && s.tool === "search_flights")).toBe(true);
    const planner = g.nodes.find((n) => n.name === "Planner");
    expect(planner.trace.steps.some((s) => s.kind === "ask")).toBe(false);
  });
});

describe("createMonitor (push-based live ingestion)", () => {
  const tool = (i) => span({ "gen_ai.operation.name": "execute_tool", "gen_ai.tool.name": "t" + i, "gen_ai.tool.call.arguments": "{}" }, [{ name: "gen_ai.tool.message", attrs: { content: "{}" } }]);

  it("accumulates pushed spans and re-derives the trace each time", () => {
    const mon = createMonitor({ format: "otel", asker: "you" });
    const r1 = mon.push(otlp([span({ "gen_ai.operation.name": "invoke_agent", "gen_ai.agent.name": "a" }), tool(0)]));
    const n1 = r1.steps.length;
    const r2 = mon.push(otlp([tool(1), tool(2)]));
    expect(r2.steps.length).toBeGreaterThan(n1); // grew as spans arrived
    expect(mon.result).toBe(r2);
    expect(mon.spans.length).toBe(4); // agent + 3 tools accumulated
    expect(mon.reset().steps.length).toBeLessThan(r2.steps.length); // cleared
  });

  it("supports multi mode → a FlowGraph that grows", () => {
    const mon = createMonitor({ multi: true });
    mon.push(otlp([
      { spanId: "o", ...span({ "gen_ai.operation.name": "invoke_agent", "gen_ai.agent.name": "Root" }) },
      { spanId: "w", parentSpanId: "o", ...span({ "gen_ai.operation.name": "invoke_agent", "gen_ai.agent.name": "Worker" }) },
    ]));
    expect(mon.result.nodes.map((n) => n.name).sort()).toEqual(["Root", "Worker"]);
  });
});

describe("scale (load) — large traces build correctly", () => {
  it("turns 5,000 tool spans into 2 + 2·N steps without error", () => {
    const spans = [span({ "gen_ai.operation.name": "invoke_agent", "gen_ai.agent.name": "a", "gen_ai.request.model": "m" },
      [{ name: "gen_ai.user.message", attrs: { content: "go" } }, { name: "gen_ai.assistant.message", attrs: { content: "done" } }])];
    for (let i = 0; i < 5000; i++) spans.push(span({ "gen_ai.operation.name": "execute_tool", "gen_ai.tool.name": "t", "gen_ai.tool.call.arguments": "{}" }));
    const tr = fromOTLP(otlp(spans));
    expect(tr.steps.length).toBe(2 + 2 * 5000); // prompt + N·(ask+return) + answer
  });
});

describe("fromOpenInferenceMulti (OI span tree → FlowGraph)", () => {
  const mspan = (spanId, parentSpanId, attrs) => ({ spanId, parentSpanId, ...span(attrs) });
  const g = fromOpenInferenceMulti(otlp([
    mspan("o", undefined, { "openinference.span.kind": "AGENT", "agent.name": "Coordinator", "llm.input_messages.0.message.content": "Triage", "llm.output_messages.0.message.content": "Routed." }),
    mspan("b", "o", { "openinference.span.kind": "AGENT", "agent.name": "Billing" }),
    mspan("bt", "b", { "openinference.span.kind": "TOOL", "tool.name": "lookup_invoice", "input.value": "{}", "output.value": "{}" }),
  ]), { asker: "you" });

  it("makes an agent node per AGENT span (OI keys)", () => {
    expect(g.nodes.map((n) => n.name).sort()).toEqual(["Billing", "Coordinator"]);
  });
  it("links parent → child and builds the child's trace from its own tools", () => {
    expect(g.edges.some((e) => e.from === "o" && e.to === "b")).toBe(true);
    const billing = g.nodes.find((n) => n.name === "Billing");
    expect(billing.trace.steps.some((s) => s.kind === "ask" && s.tool === "lookup_invoice")).toBe(true);
  });
});

describe("error handling (universal across both adapters)", () => {
  it("OTel: a tool span with status ERROR → the return step carries the error", () => {
    const t = { ...span({ "gen_ai.operation.name": "execute_tool", "gen_ai.tool.name": "db_query", "gen_ai.tool.call.arguments": "{}" }), status: { code: 2, message: "connection timeout" } };
    expect(fromOTLP(otlp([t])).steps.find((s) => s.kind === "return").error).toBe("connection timeout");
  });
  it("OpenInference: the same span status maps the error", () => {
    const t = { ...span({ "openinference.span.kind": "TOOL", "tool.name": "db_query", "input.value": "{}", "output.value": "{}" }), status: { code: "STATUS_CODE_ERROR" } };
    expect(fromOpenInference(otlp([t])).steps.find((s) => s.kind === "return").error).toBeTruthy();
  });
  it("detects recorded `exception` events", () => {
    const t = span({ "gen_ai.operation.name": "execute_tool", "gen_ai.tool.name": "x" }, [{ name: "exception", attrs: { "exception.message": "boom" } }]);
    expect(fromOTLP(otlp([t])).steps.find((s) => s.kind === "return").error).toBe("boom");
  });
  it("multi-agent: an agent whose own span errored is marked status error", () => {
    const ms = (spanId, parentSpanId, attrs, events, status) => ({ spanId, parentSpanId, ...span(attrs, events), ...(status ? { status } : {}) });
    const g = fromOTLPMulti(otlp([
      ms("o", undefined, { "gen_ai.operation.name": "invoke_agent", "gen_ai.agent.name": "Root" }),
      ms("w", "o", { "gen_ai.operation.name": "invoke_agent", "gen_ai.agent.name": "Worker" }),
      ms("wt", "w", { "gen_ai.operation.name": "execute_tool", "gen_ai.tool.name": "db" }, [], { code: 2, message: "fail" }),
    ]));
    expect(g.nodes.find((n) => n.name === "Worker").status).toBe("error");
    expect(g.nodes.find((n) => n.name === "Root").status).toBe("done");
  });
});

describe("fromOpenInference", () => {
  it("reads the openinference.* / llm.* / tool.* keys", () => {
    const trace = fromOpenInference(
      otlp([
        span({ "openinference.span.kind": "AGENT", "agent.name": "qa", "llm.model_name": "claude", "llm.input_messages.0.message.content": "What is the refund policy?", "llm.output_messages.0.message.content": "Full refund within 14 days." }),
        span({ "openinference.span.kind": "TOOL", "tool.name": "search_docs", "input.value": '{"q":"refund"}', "output.value": '{"hits":3}' }),
      ])
    );
    expect(trace.agent).toBe("qa");
    expect(trace.model).toBe("claude");
    expect(trace.steps[0].brain).toContain("refund policy");
    const ask = trace.steps.find((s) => s.kind === "ask");
    expect(ask.tool).toBe("search_docs");
    expect(ask.input).toEqual({ q: "refund" });
    expect(trace.steps[trace.steps.length - 1].brain).toContain("Full refund");
  });
});
