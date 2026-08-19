/* ============================================================
   AgentThinkingUI — the agentfootprint RECORDING adapter ("door two").

   An agentfootprint run can reach this player two ways:

     door one (live)  the producer's own `agentThinkingTrace()` recorder builds
                      the Trace AS THE RUN HAPPENS, narrating each beat with
                      agentfootprint's commentary engine — the narrator's own
                      voice.
     door two (here)  a recording, read back later. `fromRecording` converts the
                      archived `{ snapshot, events, structure }` (or the
                      versioned envelope around it) into the same Trace shape.

   THE HONEST LIMIT, stated once so it can be stated everywhere else: a replay
   reconstructs SHAPE, not voice. Everything here is derived from typed events
   after the fact, so every sentence this file writes is stamped
   `brainSource: "framework"` and only the model's own recorded words
   (`stream.llm_end.content`, `agent.turn_end.finalContent`) are stamped
   `"model"`. The notepad's "LLM reasons — …" prefix is a claim about
   authorship, so it never appears over a line this adapter wrote. For a live
   run, prefer the producer's `agentThinkingTrace()`; for an archive, this is
   the door.

   AND THE SECOND RULE: never fill an absent fact with a zero. A tool call has
   no token count and a `turn_start` has no timing, so those beats carry no
   `tokens` / no `cost` at all — the views render "—", not "0.0s · 0 tok".
   (That reconstruction, invented by three teams hand-rolling this mapping, is
   the bug this door exists to stop repeating.)

   Zero dependencies, like every adapter here: the recording is parsed
   STRUCTURALLY, and agentfootprint is never imported.
   ============================================================ */

// ── the event names this file knows (the whole of its agentfootprint knowledge)
const TURN_START = "agentfootprint.agent.turn_start";
const TURN_END = "agentfootprint.agent.turn_end";
const LLM_START = "agentfootprint.stream.llm_start";
const LLM_END = "agentfootprint.stream.llm_end";
const TOOL_START = "agentfootprint.stream.tool_start";
const TOOL_PROGRESS = "agentfootprint.stream.tool_progress";
const TOOL_END = "agentfootprint.stream.tool_end";
const CONTEXT_EVALUATED = "agentfootprint.context.evaluated";
const RUN_CONFIGURED = "agentfootprint.agent.run_configured";

const ENVELOPE_MARKER = "agentfootprint.recording."; // any version of the envelope
const SKILL_TOOL = "read_skill"; // the producer's own skill-reading tool

const isObj = (v) => typeof v === "object" && v !== null && !Array.isArray(v);
const num = (v) => (typeof v === "number" && Number.isFinite(v) ? v : undefined);
const str = (v) => (typeof v === "string" && v ? v : undefined);
const asObject = (v) => (isObj(v) ? v : v == null ? {} : { value: v });

/* ── the door ──────────────────────────────────────────────────────────────
   Two accepted spellings of "a recording": the bare `{ snapshot, events,
   structure }` `recordRun` freezes, and the format-marked envelope
   `persistRecording` writes around one. Everything else is NAMED, not guessed
   at — see `refuse` for the three sentences. */

const READS =
  "an agentfootprint recording — the { snapshot, events, structure } recordRun(agent) freezes, " +
  "or the versioned envelope persistRecording writes around one";

const GO_TO = {
  record:
    "To get one, record the run: recordRun(agent) from agentfootprint/observe freezes exactly what this reads — call it BEFORE agent.run(), a run cannot be recorded after it.",
  parse:
    "If that text is the recording's JSON, parse it first — fromRecording(JSON.parse(text)).",
  spans:
    "OpenTelemetry / OpenInference spans have their own door — use fromOTLP or fromOpenInference.",
  already:
    "That is already an AgentThinkingUI trace — hand it straight to <AgentThinkingUI trace={…} />.",
  snapshot:
    "A footprintjs snapshot is one third of a recording; the beats live in the agent EVENTS beside it. Record the run with recordRun(agent) from agentfootprint/observe to capture all three.",
};

/** Does this object carry at least one of a recording's parts? */
function looksLikeRecording(v) {
  return Array.isArray(v.events) || isObj(v.snapshot);
}

/** Does this array look like OpenTelemetry / OpenInference spans? */
function looksLikeSpans(v) {
  const first = v[0];
  return isObj(first) && (first.startTimeUnixNano !== undefined || first.spanId !== undefined || Array.isArray(first.attributes));
}

/** Plain-language name for a value that is NOT a recording. */
function describeReceived(v) {
  if (v === undefined) return "nothing (undefined)";
  if (v === null) return "nothing (null)";
  if (typeof v === "string") return "a string";
  if (Array.isArray(v)) {
    if (looksLikeSpans(v)) return "an array of OpenTelemetry-style spans";
    if (v.length === 0) return "an empty array";
    return "an array (a recording is an object, not a list)";
  }
  if (isObj(v)) {
    if (Array.isArray(v.resourceSpans)) return "an OTLP payload (resourceSpans)";
    if (Array.isArray(v.steps) && typeof v.task === "string") return "an AgentThinkingUI trace (it already has task + steps)";
    if (Array.isArray(v.commitLog)) return "a footprintjs run snapshot (a commit log, with no agent events around it)";
    return "an object with none of a recording's parts (no events, no snapshot)";
  }
  return "a " + typeof v;
}

/** Which teaching sentence the refusal ends on. */
function goToFor(v) {
  if (typeof v === "string") return GO_TO.parse;
  if (Array.isArray(v) && looksLikeSpans(v)) return GO_TO.spans;
  if (isObj(v) && Array.isArray(v.resourceSpans)) return GO_TO.spans;
  if (isObj(v) && Array.isArray(v.steps) && typeof v.task === "string") return GO_TO.already;
  if (isObj(v) && Array.isArray(v.commitLog)) return GO_TO.snapshot;
  return GO_TO.record;
}

/** The refusal: three sentences — what this reads, what you passed, where to go. */
function refuse(received, goTo) {
  return new TypeError(
    "fromRecording reads " + READS + ". " +
    "What you passed looks like " + received + ". " +
    goTo
  );
}

/** Unwrap the envelope when there is one, accept a recording, refuse the rest. */
function openRecording(input) {
  if (isObj(input) && typeof input.format === "string" && input.format.startsWith(ENVELOPE_MARKER)) {
    const inner = input.recording;
    if (isObj(inner) && looksLikeRecording(inner)) return inner;
    throw refuse("a recording envelope with nothing readable inside it (no events, no snapshot)", GO_TO.record);
  }
  if (isObj(input) && looksLikeRecording(input)) return input;
  throw refuse(describeReceived(input), goToFor(input));
}

/* ── derived narration ─────────────────────────────────────────────────────
   Every sentence below is OURS, not the model's — each one rides with
   `brainSource: "framework"` so no view can mistake it for reasoning. */

const NARRATE = {
  calling: (tool) => "Calling " + tool + ".",
  returned: (tool) => tool + " returned its result.",
  failed: (tool) => tool + " failed.",
  skill: (skill) => "Read the skill " + skill + " — its instructions are in play from here.",
  noAnswer: "The recording ends here — no final answer was recorded.",
};

/** One line for a skill-graph cursor hop (`context.evaluated.cursorMove`). */
function routingLine(move) {
  if (!isObj(move)) return "";
  const to = str(move.to), from = str(move.from), by = str(move.by);
  if (!to || by === "stay" || by === "none") return ""; // nothing moved — nothing to say
  if (by === "entry") return "Skill routing: entered " + to + ".";
  if (by === "model-pick") return "Skill routing: the model picked " + to + ".";
  if (from && from !== to) return "Skill routing: " + from + " → " + to + " (by " + by + ").";
  return "Skill routing: " + to + " (by " + (by || "route") + ").";
}

/** First non-empty line, bounded — the answer card's headline. */
function headlineOf(s) {
  const line = (s || "").split("\n").find((l) => l.trim().length > 0) || "";
  return line.length > 140 ? line.slice(0, 140) + "…" : line || "Done";
}

/* ── costs: recorded numbers only ──────────────────────────────────────────
   A cost key is written ONLY for a number the recording actually carries.
   `undefined` back means the beat gets no `cost` at all, and the views show
   "—" rather than inventing 0. */

function llmCost(p) {
  const u = isObj(p.usage) ? p.usage : {};
  const c = {};
  const ms = num(p.durationMs), tin = num(u.input), tout = num(u.output), cached = num(u.cacheRead);
  if (ms !== undefined) c.ms = ms;
  if (tin !== undefined || tout !== undefined) c.tokens = (tin || 0) + (tout || 0);
  if (tin !== undefined) c.tokensIn = tin;
  if (tout !== undefined) c.tokensOut = tout;
  if (cached !== undefined) c.tokensCached = cached;
  return Object.keys(c).length ? c : undefined;
}

/** A tool call is timed but never tokenized — so `tokens` stays ABSENT. */
function toolCost(p) {
  const ms = num(p.durationMs);
  return ms === undefined ? undefined : { ms };
}

/** Attach a cost only when there is one to attach. */
function withCost(step, cost) {
  if (cost) step.cost = cost;
  return step;
}

/* ── the builder ───────────────────────────────────────────────────────────*/

function buildTrace(recording, opts) {
  const events = Array.isArray(recording.events) ? recording.events.filter((e) => isObj(e) && typeof e.type === "string") : [];

  const steps = [];
  const openCalls = new Map(); // toolCallId → { toolName, isSkill, skill, askStep }
  let task = "";
  let agentId, model;
  // the iteration's reasoning + cost, waiting for the ask beat(s) it drove
  let pendingBrain = "", pendingCost, pendingCostUsed = true;
  let pendingToolsSeen, pendingSystemPrompt;
  // a skill-routing line, leading the next beat (as the live recorder does)
  let pendingRouting = "", lastRoutingLine = "";
  let answeredThisTurn = false;

  /** Lead a beat with the pending routing line, then consume it. */
  const lead = (brain) => {
    if (!pendingRouting) return brain;
    const line = pendingRouting;
    pendingRouting = "";
    return brain ? line + "\n\n" + brain : line;
  };

  const classify = (toolName, payload, isSkill, skill) => {
    if (opts.classify) {
      const r = opts.classify(toolName, payload);
      if (r && r.replyType) return r;
    }
    return isSkill ? { replyType: "instruction", skill } : { replyType: "data" };
  };

  for (const e of events) {
    const p = isObj(e.payload) ? e.payload : {};

    if (e.type === RUN_CONFIGURED) {
      agentId = agentId || str(p.agentId);
      if (isObj(p.llm)) model = model || str(p.llm.model);
      continue;
    }

    if (e.type === TURN_START) {
      // A new turn opens a new segment of the SAME trace, with its own prompt
      // beat. `turn_start` carries no timing and no tokens, so this beat gets
      // no cost — an absent number, not a zero.
      const prompt = str(p.userPrompt) || "";
      if (!task) task = prompt;
      steps.push({ kind: "prompt", brain: prompt });
      answeredThisTurn = false;
      // a turn is a fresh segment: nothing carries over from the last one, and
      // its routing is narrated again (the same hop in a new turn is news).
      pendingBrain = ""; pendingCost = undefined; pendingCostUsed = true;
      pendingToolsSeen = undefined; pendingSystemPrompt = undefined;
      pendingRouting = ""; lastRoutingLine = "";
      continue;
    }

    if (e.type === CONTEXT_EVALUATED) {
      // Fires before each LLM call. The skill-graph cursor's hop is the only
      // part of it that is a BEAT-level fact; narrate a hop once, not on every
      // iteration that re-reports the same one.
      const line = routingLine(p.cursorMove);
      if (line && line !== lastRoutingLine) {
        pendingRouting = pendingRouting ? pendingRouting + "\n\n" + line : line;
        lastRoutingLine = line;
      }
      continue;
    }

    if (e.type === LLM_START) {
      model = model || str(p.model);
      const tools = Array.isArray(p.tools) ? p.tools.filter(isObj) : [];
      pendingToolsSeen = tools.length
        ? tools.map((t) => ({ name: str(t.name) || "(tool)", ...(str(t.description) ? { description: t.description } : {}) }))
        : undefined;
      // opt-in on the producer side (`recordSystemPrompt: true`); absent unless
      // the run chose to record it — never reconstructed.
      pendingSystemPrompt = str(p.systemPromptText);
      continue;
    }

    if (e.type === LLM_END) {
      const cost = llmCost(p);
      const content = str(p.content) || "";
      if ((num(p.toolCallCount) || 0) === 0) {
        // no tool calls → this iteration IS the answer
        steps.push(withCost({
          kind: "answer",
          to: opts.asker || "you",
          brain: lead(content),
          brainSource: content ? "model" : "framework",
          answer: { headline: headlineOf(content), text: content },
          ...(pendingToolsSeen ? { toolsSeen: pendingToolsSeen } : {}),
          ...(pendingSystemPrompt ? { systemPrompt: pendingSystemPrompt } : {}),
        }, cost));
        answeredThisTurn = true;
        pendingToolsSeen = undefined; pendingSystemPrompt = undefined;
      } else {
        pendingBrain = content;
        pendingCost = cost;
        pendingCostUsed = false;
      }
      continue;
    }

    if (e.type === TOOL_START) {
      const id = str(p.toolCallId);
      const toolName = str(p.toolName) || "(tool)";
      const isSkill = toolName === SKILL_TOOL;
      const skill = isSkill ? str(asObject(p.args).id) : undefined;
      const first = !pendingCostUsed; // the iteration's FIRST ask carries the LLM's own reasoning + cost
      const brain = first && pendingBrain ? pendingBrain : NARRATE.calling(toolName);
      const ask = {
        kind: "ask",
        tool: isSkill ? skill || "skill" : toolName,
        toolName,
        input: asObject(p.args),
        brain: lead(brain),
        brainSource: first && pendingBrain ? "model" : "framework",
        ...(first && pendingToolsSeen ? { toolsSeen: pendingToolsSeen } : {}),
        ...(first && pendingSystemPrompt ? { systemPrompt: pendingSystemPrompt } : {}),
      };
      // The LLM call's cost belongs to the ask it drove — ONCE. A second ask in
      // the same iteration has no cost of its own, so it carries none at all.
      if (first) withCost(ask, pendingCost);
      pendingCostUsed = true;
      steps.push(ask);
      if (id) openCalls.set(id, { toolName, isSkill, skill, ask });
      continue;
    }

    if (e.type === TOOL_PROGRESS) {
      // Filed from inside a still-running call — activity, not a beat of its
      // own. It rides the ask beat it belongs to (the call is still open).
      const open = openCalls.get(str(p.toolCallId));
      if (!open) continue;
      const at = isObj(e.meta) ? num(e.meta.runOffsetMs) : undefined;
      const report = { payload: p.payload, ...(at !== undefined ? { atMs: at } : {}) };
      open.ask.activity = open.ask.activity ? open.ask.activity.concat([report]) : [report];
      continue;
    }

    if (e.type === TOOL_END) {
      const id = str(p.toolCallId);
      const open = id ? openCalls.get(id) : undefined;
      if (!open) continue; // an end with no start: nothing to attach it to
      openCalls.delete(id);
      const failed = p.error === true;
      const cls = classify(open.toolName, p, open.isSkill, open.skill);
      const brain = failed
        ? NARRATE.failed(open.toolName)
        : open.isSkill && open.skill
          ? NARRATE.skill(open.skill)
          : NARRATE.returned(open.toolName);
      const ret = {
        kind: "return",
        tool: open.isSkill ? open.skill || "skill" : open.toolName,
        toolName: open.toolName,
        replyType: cls.replyType,
        output: asObject(p.result),
        // Nothing in a recording says the model reasoned over this result — the
        // reasoning that followed is the NEXT llm_end. So this beat gets a
        // delivery sentence, and it is stamped as ours.
        brain: lead(brain),
        brainSource: "framework",
        brainMode: cls.replyType === "instruction" ? "act" : "reason",
      };
      if (cls.replyType !== "data") {
        ret.skill = cls.skill || open.skill || open.toolName;
        ret.actChecklist = cls.actChecklist || [];
      }
      if (cls.replyType === "both" && cls.actNote) ret.actNote = cls.actNote;
      if (failed) ret.error = typeof p.result === "string" && p.result ? p.result : "tool failed";
      steps.push(withCost(ret, toolCost(p)));
      continue;
    }

    if (e.type === TURN_END) {
      // The turn's own numbers. They close a turn the events never answered
      // (a recording frozen mid-run, a run that failed) — never an answer beat
      // that already carries its own call's cost.
      if (!answeredThisTurn) {
        const content = str(p.finalContent) || "";
        const c = {};
        const ms = num(p.durationMs);
        const tin = num(p.totalInputTokens), tout = num(p.totalOutputTokens);
        if (ms !== undefined) c.ms = ms;
        if (tin !== undefined || tout !== undefined) c.tokens = (tin || 0) + (tout || 0);
        if (tin !== undefined) c.tokensIn = tin;
        if (tout !== undefined) c.tokensOut = tout;
        steps.push(withCost({
          kind: "answer",
          to: opts.asker || "you",
          brain: lead(content || NARRATE.noAnswer),
          brainSource: content ? "model" : "framework",
          answer: { headline: headlineOf(content || NARRATE.noAnswer), text: content },
        }, Object.keys(c).length ? c : undefined));
        answeredThisTurn = true;
      }
      continue;
    }
  }

  if (!steps.length) {
    throw refuse(
      "a recording with no agent beats in it (no turns, no LLM calls, no tool calls)",
      GO_TO.record,
    );
  }

  const agent = opts.agent || agentId || "agent";
  return {
    task: opts.task || task || agent + " run",
    title: opts.title || agent,
    agent,
    model: opts.model || model || "unknown",
    asker: opts.asker || "you",
    steps,
  };
}

/**
 * An agentfootprint recording → a Trace the player can replay.
 *
 * Accepts either spelling: the versioned envelope (`format` beginning
 * `agentfootprint.recording.`) or the bare `{ snapshot, events, structure }`.
 * Anything else is refused with a message that names what it received and
 * where to go instead.
 *
 * MULTI-TURN: a recorder left attached across several runs holds several turns.
 * They become ONE trace, segmented — each turn opens with its own `prompt` beat
 * and closes on its own `answer`. `task` names the FIRST turn's prompt (a Trace
 * has one headline; the rest are beats, not headlines).
 *
 * @param {unknown} input   the envelope, or the recording inside one
 * @param {object} [opts]   { asker, agent, model, task, title, classify }
 * @returns {object} Trace
 */
export function fromRecording(input, opts = {}) {
  return buildTrace(openRecording(input), opts);
}
