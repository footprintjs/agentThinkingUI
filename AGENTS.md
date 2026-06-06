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
| `brand` | `ReactNode` | optional wordmark/logo for the top bar — **the library ships none**; your app supplies its own |
| `metaphor` | `boolean` | show the storytelling tags (default true) |
| `loop` | `boolean` | auto-loop playback |
| `mobile` | `boolean` | stacked mobile layout (tabs + footer transport) |

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
      skill?: string; actChecklist?: { text: string }[];  // for instruction / both
      actNote?: string }
  | { kind: "answer";  to: string; brain: string; answer: Answer; cost: Cost };

type Cost = { ms: number; tokens: number };
```

- `replyType: "data"` → set `brainMode: "reason"`.
- `replyType: "instruction"` → set `brainMode: "act"`, `skill`, and `actChecklist`.
- `replyType: "both"` → both bubbles; include data in `output` and the
  `skill`/`actChecklist`/`actNote` for the instruction half.

## Bring your existing traces (OpenTelemetry / OpenInference)

Already instrumented with OpenTelemetry GenAI (AWS Bedrock AgentCore, LangGraph,
CrewAI, AutoGen, OpenAI Agents SDK, Google ADK, Pydantic AI, Strands…) or
OpenInference (Arize/Phoenix/LlamaIndex)? Convert OTLP spans straight to a trace —
no re-instrumentation:

```js
import { fromOTLP, fromOpenInference, fromOTLPMulti, fromOpenInferenceMulti } from "agentthinkingui";

const trace = fromOTLP(otlpJson, { asker: "Sam" });    // or fromOpenInference(spans)
<AgentThinkingUI trace={trace} />

// multi-agent: a span tree → a FlowGraph for <AgentSwarm> (each agent's drill-down
// trace is built from that agent span's children). OTel or OpenInference:
const flow = fromOTLPMulti(otlpJson, { asker: "Sam" }); // or fromOpenInferenceMulti(spans)
<AgentSwarm trace={flow} />
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

## Multi-agent — `<AgentSwarm>`

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
<AgentSwarm trace={flow} live={false} />
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
