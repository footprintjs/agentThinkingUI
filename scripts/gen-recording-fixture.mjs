/* ============================================================
   gen-recording-fixture — freeze REAL agentfootprint recordings for the
   fromRecording tests.

   The `fromRecording` adapter reads bytes another library produces, so its
   fixtures must be those bytes — not a hand-authored guess at them. This
   script runs real agentfootprint agents (mock provider, no network, no key),
   records them with `recordRun`, and writes two files:

     test/fixtures/recording.envelope.json   ONE run, wrapped in the versioned
                                             envelope `persistRecording` writes
                                             (format `agentfootprint.recording.v1`).
                                             Exercises: a tool that reports
                                             progress mid-call, a skill read,
                                             a tool that throws, and the opt-in
                                             recorded system prompt.
     test/fixtures/recording.bare.json       TWO runs under one recorder, frozen
                                             as the bare `{ snapshot, events,
                                             structure }` `recordRun` returns —
                                             the second shape the door accepts,
                                             and the multi-turn case. (An
                                             envelope names ONE run and refuses
                                             this shape by design, which is why
                                             the multi-turn fixture is bare.)

   Regenerate:  node scripts/gen-recording-fixture.mjs
   agentfootprint is a devDependency ONLY — the shipped adapter has zero
   dependencies and never imports it.
   ============================================================ */

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { Agent, defineTool } from "agentfootprint";
import { defineSkill, skillGraph } from "agentfootprint/context";
import { mock } from "agentfootprint/providers";
import { buildRecordingEnvelope, recordRun } from "agentfootprint/observe";

const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "test", "fixtures");

const HOPS = ["api-gateway", "checkout", "pricing", "catalog", "inventory"];

// ── the agent under the recording ─────────────────────────────────────────
const walkGraph = defineTool({
  name: "walk_graph",
  description: "Walk the dependency graph from a root service.",
  inputSchema: { type: "object", properties: { root: { type: "string" } }, required: ["root"] },
  execute: async (args, ctx) => {
    const visited = [];
    for (const [i, hop] of HOPS.entries()) {
      await Promise.resolve(); // stand-in for the real hop
      visited.push(hop);
      ctx.progress({ done: i + 1, total: HOPS.length, hop }); // → stream.tool_progress
    }
    return { root: String(args.root), reaches: visited.length, services: visited };
  },
});

const pageOncall = defineTool({
  name: "page_oncall",
  description: "Page the on-call engineer for a service.",
  inputSchema: { type: "object", properties: { service: { type: "string" } }, required: ["service"] },
  execute: async () => {
    throw new Error("pager gateway unreachable (503)");
  },
});

const triage = defineSkill({
  id: "dependency-triage",
  description: "How to triage a service whose dependencies are failing.",
  body: "Walk the graph first. Any hop that fails twice is the blast radius — name it before paging.",
  tools: [walkGraph],
});
const escalation = defineSkill({
  id: "escalation-runbook",
  description: "When and how to escalate to the on-call engineer.",
  body: "Page on-call only after the failing hop is named. Include the hop and the last good check.",
  tools: [pageOncall],
});

const graph = skillGraph()
  .entry(triage)
  // The edge exists (so `read_skill('escalation-runbook')` is reachable from
  // triage and the model's own pick is ACCEPTED) but only fires by itself once a
  // page has been attempted — otherwise the cursor would already be sitting on
  // the skill the model is about to ask for, and the read is refused.
  .route(triage, escalation, { when: (r) => r.toolName === "page_oncall", label: "page attempted" })
  .build();

/** A fresh agent driven by an exact reply script — deterministic, $0. */
function buildAgent(script) {
  let i = 0;
  const provider = mock({
    respond: () => script[i++] ?? { content: "(script exhausted)", toolCalls: [], stopReason: "stop" },
  });
  return Agent.create({
    provider,
    model: "mock-small",
    maxIterations: 8,
    recordSystemPrompt: true, // opt-in: the assembled prompt rides stream.llm_start
  })
    .system("You are a read-only dependency triage assistant.")
    .skillGraph(graph)
    .build();
}

const walk = { id: "call-walk-1", name: "walk_graph", args: { root: "checkout" } };
const readSkill = { id: "call-skill-1", name: "read_skill", args: { id: "escalation-runbook" } };
const page = { id: "call-page-1", name: "page_oncall", args: { service: "inventory" } };

// ── fixture 1: ONE run, every mapped event family → the envelope ───────────
const oneRun = buildAgent([
  { content: "Checkout is the root — I'll walk its dependency graph first.", toolCalls: [walk], stopReason: "tool_use" },
  { content: "Five services deep. Before paging anyone I should read the escalation runbook.", toolCalls: [readSkill], stopReason: "tool_use" },
  { content: "The runbook says page on-call once the hop is named. Inventory is the deepest hop.", toolCalls: [page], stopReason: "tool_use" },
  { content: "The pager gateway is down (503), so nobody was raised. checkout reaches 5 services; escalate for inventory in Slack instead.", toolCalls: [], stopReason: "stop" },
]);
const recorderA = recordRun(oneRun, { boundaryDetail: "lean" });
const answerA = await oneRun.run({ message: "What does the checkout service depend on, and who owns the deepest hop?" });
recorderA.stop();
const recordingA = recorderA.toRecording();
const envelope = buildRecordingEnvelope(recorderA, { run: { complete: true } });

// ── fixture 2: TWO runs under one recorder → the bare, multi-turn shape ────
const twoTurns = buildAgent([
  { content: "Walking the graph from checkout.", toolCalls: [walk], stopReason: "tool_use" },
  { content: "checkout reaches 5 services; the deepest hop is inventory.", toolCalls: [], stopReason: "stop" },
  { content: "Paging the on-call engineer for inventory.", toolCalls: [page], stopReason: "tool_use" },
  { content: "The pager gateway is down (503) — escalate in Slack instead.", toolCalls: [], stopReason: "stop" },
]);
const recorderB = recordRun(twoTurns, { boundaryDetail: "lean" });
const turn1 = await twoTurns.run({ message: "What does the checkout service depend on?" });
const turn2 = await twoTurns.run({ message: "Page whoever owns the deepest hop." });
recorderB.stop();
const recordingB = recorderB.toRecording();

mkdirSync(OUT, { recursive: true });
// Minified on purpose: these are machine-read bytes, and a pretty-printed
// snapshot doubles a fixture nothing reads by eye.
writeFileSync(join(OUT, "recording.envelope.json"), JSON.stringify(envelope) + "\n");
writeFileSync(join(OUT, "recording.bare.json"), JSON.stringify(recordingB) + "\n");

// ── report what landed, so a regeneration that lost an event family is loud ──
const NEEDED = [
  "agentfootprint.agent.turn_start",
  "agentfootprint.agent.turn_end",
  "agentfootprint.stream.llm_start",
  "agentfootprint.stream.llm_end",
  "agentfootprint.stream.tool_start",
  "agentfootprint.stream.tool_end",
  "agentfootprint.stream.tool_progress",
  "agentfootprint.context.evaluated",
];
function report(label, recording, needed) {
  const seen = new Map();
  for (const e of recording.events) seen.set(e.type, (seen.get(e.type) ?? 0) + 1);
  console.log(`\n${label}: ${recording.events.length} events, ${seen.size} kinds`);
  for (const [type, n] of [...seen].sort()) console.log(`  ${String(n).padStart(3)}  ${type}`);
  const missing = needed.filter((t) => !seen.has(t));
  if (missing.length) {
    console.error(`\n${label} is MISSING event families the fixture must carry:\n  ` + missing.join("\n  "));
    process.exit(1);
  }
}
console.log(`one run   : ${answerA}`);
console.log(`turn 1    : ${turn1}`);
console.log(`turn 2    : ${turn2}`);
report("envelope (1 run)", recordingA, NEEDED);
report("bare (2 runs)", recordingB, NEEDED.filter((t) => t !== "agentfootprint.stream.tool_progress"));

console.log(`\nwrote ${join(OUT, "recording.envelope.json")}`);
console.log(`wrote ${join(OUT, "recording.bare.json")}`);
