import { describe, it, expect } from "vitest";
import { fromOTLP, fromOpenInference } from "../src/adapters/otlp.js";

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
