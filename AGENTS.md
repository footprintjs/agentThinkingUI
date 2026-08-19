# AGENTS.md — using AgentThinkingUI

A guide for AI agents (and the humans pairing with them) on how to **use this
library** in another app. For working *on* this repo, see [`CLAUDE.md`](./CLAUDE.md).

## What it is

AgentThinkingUI is a **framework-agnostic player for an agent's runtime footprint**.
Give it a recorded trace of an agent run and it replays the loop as an animated,
scrubbable story. It is not tied to any vendor, model, or framework — if you can
serialize a run into the trace shape below, it plays.

## Mental model (what the visuals mean)

The LLM **brain** thinks, then reaches for a **tool** to get what it's missing.
The reply is one of three shapes, and the loop repeats until the **answer**:

- **data** → the brain **reasons** over new facts (colour: data/teal)
- **instruction** → a **skill / steering doc** tells it **how to act** (instruction/amber)
- **both** → data + instruction at once (reason on one half, act on the other)

## Integrate it

Scoped ES modules; React is a peer dependency. Two ways:

**App / bundler (ESM):**
```bash
npm install agentthinkingui react react-dom
```
```jsx
import { AgentThinkingUI } from "agentthinkingui";
import "agentthinkingui/styles.css";

<AgentThinkingUI trace={trace} />
```

**Script tag / no bundler (UMD bundle):** load React, then
`dist/agentthinkingui.umd.js` (it sets `window.AgentThinkingUI`, `window.AgentTheme`,
…) + `dist/agentthinkingui.css`. See `demo/index.html`.

`AgentThinkingUI` is the primary export; `AgentFootprint` is a **deprecated alias**.
The four view pieces — `Timeline`, `Stage`, `Inspector`, `Notepad` — are also
exported and can be composed by hand with the state from `usePlayback(trace)`.

### Container props

| Prop | Type | Notes |
|------|------|-------|
| `trace` | `Trace` | the recorded run (required) |
| `theme` | `{ colors, fonts }` | scoped CSS-variable theming (reactive) |
| `labels` | `{ agent, toolbox }` | display names |
| `icons` | `{ brain, toolbox }` | `{kind:'default'\|'emoji'\|'image', value}` |
| `agentIcon` | `'brain'\|'robot'\|'sparkle'\|'footsteps'` \| `ReactNode` | who stands on stage. A **string is a built-in name**, anything else is **your node** (`agentIcon={<MyLogo/>}`). Omitted = the animated mascot, unchanged. Wins over `icons.brain`; an unknown name falls back to the mascot. Also accepted by `<Stage>`; `AGENT_ICON_NAMES` is exported |
| `brand` | `ReactNode` | optional wordmark/logo for the top bar — **the library ships none**; your app supplies its own |
| `metaphor` | `boolean` | show the storytelling tags (default true) |
| `loop` | `boolean` | auto-loop playback |
| `mobile` | `boolean` | stacked mobile layout (tabs + footer transport) |
| `toolMenu` | `'card' \| 'rack'` | tool-menu layout (default `card`). `rack` = a vertical rack of **every** tool the model saw — all of them, always: the rack is sized from the scene (never clipped by it) and the list **scrolls** when the tools outrun the arena, so no tool is summarised away. The picked one is lit and **pinned**: it holds its place while the rest scroll past, so the connector arrow always lands on it. A scrolling list is a keyboard tab stop; a scene too narrow to carry both a labelled rack and a readable thought bubble gets an icons-only rack (names stay in the tooltip) + the **"Why this tool?"** inspector panel (relevance bars, **Copy for LLM**, **Explain (live)**) — see the spec below |
| `onExplain` | `(ctx) => Promise<string \| { reason, score }>` | rack mode: wire the Why-panel's "✨ Explain (live)" button to YOUR LLM (`ctx = { trace, step, tool, prompt }`). The library makes no LLM calls itself |

> **Tool-choice explainability + the skill-graph routing it visualizes:** see the consolidated, usage-oriented spec at `agentfootprint/docs/design/skill-graph-spec.md` (rack/Why-panel/Copy-for-LLM/`onExplain` are ✅ shipped here; agentfootprint's declarative `skillGraph()` it draws is ✅ usable v1, v2 hardening ✅ shipped in agentfootprint 8.3–8.5 (cursor-honored picks, build-time refusals, deep checkup)).

## The trace contract (what to emit)

Record your agent run into this shape. It describes the *shape* of a loop, not
any one framework.

```ts
type Trace = {
  task: string; agent: string; model: string; asker: string;
  steps: Step[];
};

type Step =
  | { kind: "prompt";  brain: string; cost: Cost }                       // task comes in
  | { kind: "ask";     tool: string; toolName?: string; input: object;   // brain calls a tool
      brain: string; cost: Cost }
  | { kind: "return";  tool: string; toolName?: string;                  // tool replies
      replyType: "data" | "instruction" | "both";
      output: object; brain: string; cost: Cost;
      brainMode?: "reason" | "act";                       // data→reason, instruction→act
      brainSource?: "model" | "framework";               // who wrote `brain` (see below)
      skill?: string; actChecklist?: { text: string }[];  // for instruction / both
      actNote?: string }
  | { kind: "answer";  to: string; brain: string; answer: Answer; cost: Cost };

type Cost = { ms?: number; tokens?: number };   // absent = not recorded (the views show "—", never 0.0s)
```

- `brain` (and `actNote` / `thinking`) is rendered as **markdown** — headings,
  bold/italic, inline + fenced code, lists, tables, quotes, rules — in the
  notepad, the inspector and the thought bubble. Emit the model's text as it
  wrote it; a plain sentence still renders as a plain sentence, and a wide table
  scrolls inside its own beat. It is treated as untrusted: raw HTML in a body
  stays literal text, links render inert (not clickable) and images render as
  alt text.
- `replyType: "data"` → set `brainMode: "reason"`.
- `replyType: "instruction"` → set `brainMode: "act"`, `skill`, and `actChecklist`.
- `replyType: "both"` → both bubbles; include data in `output` and the
  `skill`/`actChecklist`/`actNote` for the instruction half.
- `brainSource` — who wrote the `brain` sentence. Leave it off (or `"model"`) for
  the model's own words: the notepad narrates those as *"LLM reasons — …"* /
  *"LLM follows <skill> — …"*. Set `"framework"` when **your runtime** supplied
  the line (a delivery / bookkeeping sentence such as *"The tool returned its
  result."*) and the notepad prints it plain — the "LLM …" prefix is a claim
  about authorship, so it is only made when the trace records it. On `ask` and
  `answer` beats it is recorded for downstream consumers; nothing is prefixed
  there. The OTLP / OpenInference adapters stamp it for you (`"framework"` on
  their fallback narration, `"model"` on a real assistant message).

## Replay a saved agentfootprint run

An [agentfootprint](https://footprintjs.github.io/agentfootprint/) run has two
doors into this player. **Live:** attach its own `agentThinkingTrace()` recorder
and read `getTrace()` — the narration is the run's own voice. **Archived:** hand
the recording (or the envelope `persistRecording` wrote around it) to
`fromRecording`:

```js
import { fromRecording } from "agentthinkingui";

const trace = fromRecording(envelopeJson, { asker: "you" });   // or the bare { snapshot, events, structure }
<AgentThinkingUI trace={trace} />
```

Turn starts → prompt beats · LLM calls → the reasoning + cost on the ask they
drove (or the answer) · tool calls → ask + return (`read_skill` → an
`instruction` beat) · `tool_progress` → activity on that call's beat ·
`context.evaluated.cursorMove` → one skill-routing line · `turn_end` → closes a
turn nothing answered. A multi-turn recording becomes ONE trace segmented by
turn.

It is honest about being post-hoc: every sentence it writes carries
`brainSource: "framework"` (only the model's recorded words are `"model"`), and
any fact the recording does not carry stays **absent** — no `cost`, no `tokens`,
and the views render "—" rather than a `0.0s · 0 tok` that nobody measured.
Anything that is not a recording is refused with a three-sentence message naming
what you passed and where to go.

## Bring your existing traces (OpenTelemetry / OpenInference)

Already instrumented with OpenTelemetry GenAI (AWS Bedrock AgentCore, LangGraph,
CrewAI, AutoGen, OpenAI Agents SDK, Google ADK, Pydantic AI, Strands…) or
OpenInference (Arize/Phoenix/LlamaIndex)? Convert OTLP spans straight to a trace —
no re-instrumentation:

```js
import { fromOTLP, fromOpenInference, fromOTLPMulti, fromOpenInferenceMulti } from "agentthinkingui";

const trace = fromOTLP(otlpJson, { asker: "Sam" });    // or fromOpenInference(spans)
<AgentThinkingUI trace={trace} />

// multi-agent: a span tree → a FlowGraph for <MultiAgentFlow> (each agent's drill-down
// trace is built from that agent span's children). OTel or OpenInference:
const flow = fromOTLPMulti(otlpJson, { asker: "Sam" }); // or fromOpenInferenceMulti(spans)
<MultiAgentFlow trace={flow} />

// live monitoring: push spans as they arrive, feed the result to a `live` player
import { createMonitor } from "agentthinkingui";
const mon = createMonitor({ format: "otel" });          // { multi:true } → FlowGraph
exporter.onBatch((batch) => setTrace(mon.push(batch))); // pass a custom `reader` for other conventions
```

It maps agent span → trace, tool executions → ask+return, the first user message →
prompt, the final assistant message → answer, and span duration + token usage →
cost. The **reply type** (`data`/`instruction`/`both`) isn't in those standards, so
it's decided by, in order: an `opts.classify(toolName, attrs)` hook → opt-in span
attributes `agentthinkingui.reply_type` / `.skill` → a heuristic (skill/steering/
policy/guardrail tools → instruction, else data).

**Live monitoring:** accumulate spans as they finish and re-run the adapter on the
growing set, feeding the result to `<AgentThinkingUI live trace={…} />` — the player
tails the newest beat:

```js
const acc = [];
onSpanEnd((span) => { acc.push(span); setTrace(fromOTLP(acc, opts)); });
```

## Multi-agent — `<MultiAgentFlow>`

For teams of agents, render a **control-flow graph** that drills into each agent's
single-agent player. It takes a `FlowGraph`:

```ts
type FlowGraph = {
  task: string; asker?: string;
  nodes: ({ id; kind?: "agent"; name; role?; status?; icon?; trace: Trace }
        | { id; kind: "decision"; label }
        | { id; kind: "merge" | "start" | "end"; label? })[];
  edges: { from; to; kind: "seq" | "parallel" | "conditional" | "loop"; label?; taken? }[];
};
```

```jsx
<MultiAgentFlow trace={flow} live={false} />
```

The four edge kinds compose every named pattern (Hierarchical, Debate, Router,
Reflexion, Swarm, Tree-of-Thoughts — see `docs/multi-agent-flow.md`). Each `agent`
node carries a full `Trace` (so steps/cost/icons work per-agent), shows the animated
brain mascot (or a per-agent `icon`), and **drills into the full interactive
`<AgentThinkingUI>`**. The map has its own **team time-travel** (all agents' beats
interleaved into one scrubbable timeline + commentary + team notepad); `live` tails
the newest beat as the graph grows. Build one from real telemetry with
`fromOTLPMulti`.

## Theming (match the host app)

Pass `theme` / `labels` / `icons` as props — they normalize and apply CSS
variables **scoped to the player's own element** (not `:root`), so it's reactive
and won't leak into the host. A colour is a hex (shades derived) or a full
`{ base, deep, tint }` triad. `theme.fonts` carries the four families
(`display`/`body`/`mono`/`hand`) plus `scale` (a single multiplier over the type
ramp). The theme engine is importable on its own —
`import { normalize, toVars, apply } from "agentthinkingui"` (or `AgentTheme.*`
from the UMD bundle). Page-level `window.AGENT_THEME` globals still work as a
back-compat default with the UMD bundle.

## Gotchas

- **React is a peer dependency** — install/provide `react` + `react-dom` (>=18).
- **Import the stylesheet** — `import "agentthinkingui/styles.css"` (ESM) or link
  `dist/agentthinkingui.css` (script tag); styles aren't inlined into the JS.
- **Script-tag path uses the UMD bundle** — load React first, then
  `dist/agentthinkingui.umd.js`; it attaches `window.AgentThinkingUI` (+ the rest).

See the [README](./README.md) and the [live demo](https://footprintjs.github.io/agentThinkingUI/).
