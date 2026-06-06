# The protocol is the floor, not the ceiling

*Why AgentThinkingUI backs OpenTelemetry + OpenInference, why a protocol can never
carry everything a domain expert needs — and how you fill the gap.*

## Why two protocols

We deliberately support exactly two ingestion standards — **OpenTelemetry GenAI**
and **OpenInference** — and nothing bespoke. They're where the ecosystem already
converged (Bedrock AgentCore, LangGraph, CrewAI, OpenAI Agents SDK, Google ADK,
Pydantic AI, Strands, Arize Phoenix, LlamaIndex…), so most teams can render a run
with **no re-instrumentation**. One adapter surface, broad reach.

## Why a protocol can't carry everything

A trace protocol is built to be *general* — it records the **structure** of a run:
which tool, when, how long, how many tokens, what status. That's the part every
agent has in common, and it's exactly the part an **engineer** needs to triage
infra and logic.

But the thing a **domain expert** needs to judge correctness — *the reasoning, the
specific inputs that mattered, the policy text the agent was working from, the
business context* — is application-specific by definition. A general protocol
can't standardize that, and in practice spans often omit it entirely. So if you
treat the protocol as the *boundary* of what you can show, the domain expert is
stuck looking at a green, structurally-perfect trace that tells them nothing about
whether the *answer* was right.

## The principle: the Trace is the boundary, not the span

AgentThinkingUI renders a **`Trace`**, not spans. The adapter is one *source* of a
Trace, not its definition. So the protocol is the **floor** — it gets you ~80% for
free, with a `spanId` stamped on every step — and **you own the ceiling**: you fill
the application-specific rest from wherever your system already keeps it. Three
ways, all keyed on `spanId`:

1. **Compose the Trace.** Build the skeleton from the adapter, then merge your
   stored reasoning/inputs/context onto each step by `spanId`. It renders in the
   native bubbles, exactly as if the protocol had carried it.
   ([recipe](../integrations.md#backfill-what-otel-drops-compose-your-trace))
2. **`classify`.** Supply the *semantic* layer the protocol doesn't model at all —
   whether a tool reply is **data** (reason) or an **instruction** (act). A hook,
   opt-in span attributes, or a heuristic.
3. **`renderDetail(step)`.** Render content that doesn't fit the schema — a raw log
   blob, your own widget — inline in the inspector.

```js
const trace = fromOpenInference(spans);          // floor: structure (free, no re-instrumentation)
for (const s of trace.steps) {
  const extra = yourStore.get(s.spanId);         // ceiling: the domain content the protocol dropped
  if (extra) s.brain = extra.reasoning;          // → renders as the agent's thinking
}
<AgentThinkingUI trace={trace} />
```

## Why not a new "fetch the missing content" event?

It's tempting to add a hook that fires per step so the host can return missing
content. We deliberately **don't** — it would duplicate two things you already
have: `onSelect` tells you which step is showing, and composing the Trace (or
`renderDetail`) puts the content in. Pre-fill, classify, render-custom already
cover *pre-known*, *semantic*, and *arbitrary* content respectively, with no extra
API and no re-render loop. Fewer, composable primitives beat a special-purpose
event.

## The bet

A standard protocol is the right *floor* — broad, free, no lock-in. But the
content that lets a domain expert say *"that decision was wrong"* is yours, not the
protocol's. So the library never makes the protocol the boundary: it gives you the
structure for free and a clean seam — joined by `spanId` — to add everything the
protocol couldn't know.
