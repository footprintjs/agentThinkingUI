import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";
import { fromRecording } from "../src/adapters/recording.js";

/**
 * `fromRecording` — door two: an archived agentfootprint run → a Trace.
 *
 * The fixtures are REAL bytes. `scripts/gen-recording-fixture.mjs` runs an
 * actual agentfootprint agent on the mock provider and freezes what came out;
 * nothing here is hand-authored, so a mapping that only works against an
 * imagined event shape fails on contact.
 *
 *   recording.envelope.json  ONE run inside the versioned envelope — a tool that
 *                            reports progress, a skill read, a tool that throws,
 *                            an opt-in recorded system prompt.
 *   recording.bare.json      TWO runs under one recorder, frozen bare — the
 *                            unwrapped shape and the multi-turn case.
 */
const fixture = (name) =>
  JSON.parse(readFileSync(fileURLToPath(new URL("./fixtures/" + name, import.meta.url)), "utf8"));

const ENVELOPE = fixture("recording.envelope.json");
const BARE = fixture("recording.bare.json");

const kinds = (t) => t.steps.map((s) => s.kind);
const beat = (t, kind, tool) => t.steps.find((s) => s.kind === kind && (tool === undefined || s.tool === tool));

describe("fromRecording — the two accepted shapes", () => {
  it("unwraps the versioned envelope by its format marker", () => {
    expect(ENVELOPE.format).toMatch(/^agentfootprint\.recording\./);
    const trace = fromRecording(ENVELOPE);
    expect(trace.steps.length).toBeGreaterThan(0);
    expect(trace.task).toContain("checkout");
  });

  it("reads a bare { snapshot, events, structure } recording", () => {
    expect(BARE.format).toBeUndefined();
    expect(Array.isArray(BARE.events)).toBe(true);
    const trace = fromRecording(BARE);
    expect(trace.steps.length).toBeGreaterThan(0);
  });

  it("reads the SAME beats whether the recording arrives wrapped or bare", () => {
    const wrapped = fromRecording(ENVELOPE);
    const unwrapped = fromRecording(ENVELOPE.recording);
    expect(unwrapped).toEqual(wrapped);
  });

  it("accepts a future envelope version (the marker is a prefix, not an equality)", () => {
    const next = { ...ENVELOPE, format: "agentfootprint.recording.v99" };
    expect(fromRecording(next).steps.length).toBe(fromRecording(ENVELOPE).steps.length);
  });

  it("names the agent, the model and the asker", () => {
    const trace = fromRecording(ENVELOPE, { asker: "Sam" });
    expect(trace.agent).toBe("agent");         // the run's own agentId
    expect(trace.model).toBe("mock-small");    // read off the first LLM call
    expect(trace.asker).toBe("Sam");
    expect(beat(trace, "answer").to).toBe("Sam");
    // overrides win over the recorded facts
    const named = fromRecording(ENVELOPE, { agent: "triage-bot", model: "claude-x", title: "Run 7" });
    expect([named.agent, named.model, named.title]).toEqual(["triage-bot", "claude-x", "Run 7"]);
  });
});

describe("fromRecording — event family → beat", () => {
  const trace = fromRecording(ENVELOPE);

  it("agent.turn_start → the prompt beat, carrying the user's words", () => {
    const prompt = trace.steps[0];
    expect(prompt.kind).toBe("prompt");
    expect(prompt.brain).toContain("What does the checkout service depend on");
    expect(trace.task).toBe(prompt.brain);
  });

  it("stream.tool_start / tool_end → ask + return with the real I/O", () => {
    const ask = beat(trace, "ask", "walk_graph");
    expect(ask.input).toEqual({ root: "checkout" });
    const ret = beat(trace, "return", "walk_graph");
    expect(ret.output).toMatchObject({ root: "checkout", reaches: 5 });
    expect(ret.replyType).toBe("data");
    expect(ret.brainMode).toBe("reason");
  });

  it("stream.llm_end (tool calls) → the iteration's reasoning + cost on its ask", () => {
    const ask = beat(trace, "ask", "walk_graph");
    expect(ask.brain).toContain("Checkout is the root");
    expect(ask.cost).toMatchObject({ tokens: 68, tokensIn: 53, tokensOut: 15 });
    expect(ask.cost.ms).toBeGreaterThan(0);
    expect(ask.toolsSeen.map((t) => t.name)).toContain("walk_graph");
  });

  it("stream.llm_end (no tool calls) → the answer beat", () => {
    const answer = beat(trace, "answer");
    expect(answer.brain).toContain("pager gateway is down");
    expect(answer.answer.headline).toContain("pager gateway is down");
    expect(answer.cost).toMatchObject({ tokensIn: 179, tokensOut: 31 });
  });

  it("read_skill → an INSTRUCTION beat naming the skill", () => {
    const ret = beat(trace, "return", "escalation-runbook");
    expect(ret.replyType).toBe("instruction");
    expect(ret.brainMode).toBe("act");
    expect(ret.skill).toBe("escalation-runbook");
    expect(ret.toolName).toBe("read_skill");
  });

  it("a tool that threw → the return beat carries the recorded failure", () => {
    const ret = beat(trace, "return", "page_oncall");
    expect(ret.error).toBe("pager gateway unreachable (503)");
  });

  it("context.evaluated.cursorMove → one skill-routing line, leading the next beat", () => {
    const first = beat(trace, "ask", "walk_graph");
    expect(first.brain).toContain("Skill routing: entered dependency-triage.");
    const picked = beat(trace, "ask", "page_oncall");
    expect(picked.brain).toContain("Skill routing: the model picked escalation-runbook.");
    // `by: 'stay'` moved nothing, so nothing is narrated: exactly two lines in the run
    const lines = trace.steps.filter((s) => /Skill routing:/.test(s.brain || ""));
    expect(lines).toHaveLength(2);
  });

  it("stream.llm_start.systemPromptText → the opt-in prompt rides the beat it drove", () => {
    const ask = beat(trace, "ask", "walk_graph");
    expect(ask.systemPrompt).toContain("read-only dependency triage assistant");
  });

  it("stream.tool_progress → activity on the call it belongs to, not beats of its own", () => {
    const ask = beat(trace, "ask", "walk_graph");
    expect(ask.activity).toHaveLength(5);
    expect(ask.activity[0].payload).toEqual({ done: 1, total: 5, hop: "api-gateway" });
    expect(ask.activity[4].payload).toMatchObject({ done: 5, hop: "inventory" });
    expect(typeof ask.activity[0].atMs).toBe("number");
    // the reports did NOT become steps
    expect(kinds(trace).filter((k) => k === "ask")).toHaveLength(3);
    // …and a tool that reported nothing carries no activity key at all
    expect(beat(trace, "ask", "page_oncall").activity).toBeUndefined();
  });

  it("agent.turn_end closes a turn the events never answered", () => {
    // drop the terminal llm_end: the turn now ends on turn_end alone
    const events = ENVELOPE.recording.events.filter(
      (e) => !(e.type === "agentfootprint.stream.llm_end" && e.payload.toolCallCount === 0),
    );
    const t = fromRecording({ ...ENVELOPE, recording: { ...ENVELOPE.recording, events } });
    const answer = beat(t, "answer");
    expect(answer.brain).toContain("pager gateway is down"); // finalContent
    expect(answer.cost).toMatchObject({ tokensIn: 477, tokensOut: 87 }); // the turn's totals
    expect(answer.cost.ms).toBeGreaterThan(0);
  });
});

describe("fromRecording — honesty labels (a replay reconstructs shape, not voice)", () => {
  const trace = fromRecording(ENVELOPE);

  it("stamps the model's own recorded words as model-authored", () => {
    expect(beat(trace, "ask", "walk_graph").brainSource).toBe("model");
    expect(beat(trace, "answer").brainSource).toBe("model");
  });

  it("stamps EVERY sentence the adapter wrote as framework-authored", () => {
    const derived = trace.steps.filter((s) => s.kind === "return");
    expect(derived.every((s) => s.brainSource === "framework")).toBe(true);
    expect(beat(trace, "return", "walk_graph").brain).toBe("walk_graph returned its result.");
    expect(beat(trace, "return", "page_oncall").brain).toBe("page_oncall failed.");
    expect(beat(trace, "return", "escalation-runbook").brain).toContain("Read the skill escalation-runbook");
  });

  it("never claims the model reasoned over a tool result (that beat is a delivery line)", () => {
    for (const s of trace.steps.filter((x) => x.kind === "return")) {
      expect(s.brain).not.toMatch(/reason/i);
    }
  });
});

describe("fromRecording — absent facts stay absent (no 0.0s · 0 tok)", () => {
  const trace = fromRecording(ENVELOPE);

  it("a prompt beat has no cost at all — it was never timed", () => {
    expect(trace.steps[0].cost).toBeUndefined();
  });

  it("a tool return is timed but NOT tokenized — `tokens` is absent, not 0", () => {
    const ret = beat(trace, "return", "walk_graph");
    expect(typeof ret.cost.ms).toBe("number");
    expect("tokens" in ret.cost).toBe(false);
    expect(ret.cost.tokensIn).toBeUndefined();
  });

  it("no beat anywhere carries an invented zero", () => {
    for (const s of trace.steps) {
      if (!s.cost) continue;
      if ("tokens" in s.cost) expect(s.cost.tokens).toBeGreaterThan(0);
    }
  });

  it("a second ask in one iteration carries no cost — the LLM call paid once", () => {
    const events = ENVELOPE.recording.events;
    const start = events.find((e) => e.type === "agentfootprint.stream.tool_start");
    const idx = events.indexOf(start);
    const parallel = {
      ...start,
      payload: { ...start.payload, toolCallId: "call-walk-2", toolName: "walk_graph" },
    };
    const t = fromRecording({
      ...ENVELOPE,
      recording: { ...ENVELOPE.recording, events: [...events.slice(0, idx + 1), parallel, ...events.slice(idx + 1)] },
    });
    const asks = t.steps.filter((s) => s.kind === "ask" && s.tool === "walk_graph");
    expect(asks).toHaveLength(2);
    expect(asks[0].cost).toBeDefined();
    expect(asks[1].cost).toBeUndefined();   // absent, not { ms: 0, tokens: 0 }
    expect(asks[1].brainSource).toBe("framework");
    expect(asks[1].brain).toBe("Calling walk_graph.");
  });
});

describe("fromRecording — multi-turn", () => {
  const trace = fromRecording(BARE);

  it("segments a two-run recording into one trace, a prompt beat per turn", () => {
    expect(kinds(trace)).toEqual([
      "prompt", "ask", "return", "answer",
      "prompt", "ask", "return", "answer",
    ]);
    expect(trace.steps[0].brain).toContain("What does the checkout service depend on");
    expect(trace.steps[4].brain).toContain("Page whoever owns the deepest hop");
  });

  it("task names the FIRST turn (a trace has one headline; the rest are beats)", () => {
    expect(trace.task).toBe(trace.steps[0].brain);
  });

  it("re-narrates the routing each turn (the same hop in a new turn is news)", () => {
    const routed = trace.steps.filter((s) => /Skill routing: entered/.test(s.brain || ""));
    expect(routed).toHaveLength(2);
  });
});

describe("fromRecording — the teaching refusal", () => {
  const READS =
    "fromRecording reads an agentfootprint recording — the { snapshot, events, structure } " +
    "recordRun(agent) freezes, or the versioned envelope persistRecording writes around one.";
  const RECORD =
    "To get one, record the run: recordRun(agent) from agentfootprint/observe freezes exactly " +
    "what this reads — call it BEFORE agent.run(), a run cannot be recorded after it.";

  const refusal = (input) => {
    try {
      fromRecording(input);
    } catch (e) {
      return e;
    }
    throw new Error("expected a refusal");
  };

  it("says three things in order: what it reads, what you passed, where to go", () => {
    const e = refusal({ nope: true });
    expect(e).toBeInstanceOf(TypeError);
    expect(e.message).toBe(
      READS +
        " What you passed looks like an object with none of a recording's parts (no events, no snapshot). " +
        RECORD,
    );
  });

  it("names OpenTelemetry spans and sends them to their own door", () => {
    const spans = [{ spanId: "a", startTimeUnixNano: "1", attributes: [] }];
    expect(refusal(spans).message).toBe(
      READS +
        " What you passed looks like an array of OpenTelemetry-style spans. " +
        "OpenTelemetry / OpenInference spans have their own door — use fromOTLP or fromOpenInference.",
    );
    expect(refusal({ resourceSpans: [] }).message).toContain("an OTLP payload (resourceSpans)");
  });

  it("names a JSON string and says to parse it", () => {
    expect(refusal(JSON.stringify(BARE)).message).toBe(
      READS +
        " What you passed looks like a string. " +
        "If that text is the recording's JSON, parse it first — fromRecording(JSON.parse(text)).",
    );
  });

  it("names a trace that is already a trace", () => {
    const trace = fromRecording(BARE);
    expect(refusal(trace).message).toBe(
      READS +
        " What you passed looks like an AgentThinkingUI trace (it already has task + steps). " +
        "That is already an AgentThinkingUI trace — hand it straight to <AgentThinkingUI trace={…} />.",
    );
  });

  it("names a bare footprintjs snapshot and says what is missing", () => {
    const e = refusal({ commitLog: [{ idx: 0 }] });
    expect(e.message).toContain("a footprintjs run snapshot (a commit log, with no agent events around it)");
    expect(e.message).toContain("the beats live in the agent EVENTS beside it");
  });

  it("names an empty envelope", () => {
    expect(refusal({ format: "agentfootprint.recording.v1", recording: {} }).message).toBe(
      READS +
        " What you passed looks like a recording envelope with nothing readable inside it (no events, no snapshot). " +
        RECORD,
    );
  });

  it("refuses a recording with no beats rather than handing back an empty trace", () => {
    const e = refusal({ snapshot: {}, events: [], structure: {} });
    expect(e.message).toBe(
      READS +
        " What you passed looks like a recording with no agent beats in it (no turns, no LLM calls, no tool calls). " +
        RECORD,
    );
  });

  it("names nothing at all", () => {
    expect(refusal(undefined).message).toContain("looks like nothing (undefined)");
    expect(refusal(null).message).toContain("looks like nothing (null)");
    expect(refusal(7).message).toContain("looks like a number");
  });
});

describe("fromRecording — the classify hook", () => {
  it("lets a host override a tool's reply shape", () => {
    const trace = fromRecording(ENVELOPE, {
      classify: (toolName) =>
        toolName === "walk_graph" ? { replyType: "instruction", skill: "graph-walking" } : undefined,
    });
    const ret = trace.steps.find((s) => s.kind === "return" && s.toolName === "walk_graph");
    expect(ret.replyType).toBe("instruction");
    expect(ret.skill).toBe("graph-walking");
    expect(ret.brainMode).toBe("act");
  });
});
