# Use AgentThinkingUI on top of your observability stack

AgentThinkingUI is **complementary** to LLM/agent observability platforms, not a
replacement. They record, store and evaluate traces (developer-facing waterfalls,
metrics, evals); AgentThinkingUI is the **last-mile, user-facing** view you embed
in your *own* product to show users, operators or stakeholders **what the agent
did** — a branded, animated, scrubbable replay.

Because the ecosystem converges on **OpenTelemetry GenAI** and **OpenInference**,
there's no re-instrumentation: hand the spans your platform already has to the
matching adapter.

## The pattern

The spans live in your backend (or the platform's API). Your server returns them
to the browser as JSON; the browser converts + renders:

```jsx
import { fromOpenInference, fromOTLP, fromOTLPMulti } from "agentthinkingui";
import "agentthinkingui/styles.css";

// your API returns the platform's spans for one run (OTLP/JSON, or an
// OpenInference attribute array) — nothing agentthinkingui-specific is stored
const spans = await fetch(`/api/runs/${runId}/spans`).then((r) => r.json());

const trace = fromOpenInference(spans, { asker: "you" });   // pick the adapter
<AgentThinkingUI trace={trace} />                            // for your source ↓
```

| your stack | spans are… | adapter |
|---|---|---|
| **Arize Phoenix**, LlamaIndex | OpenInference | `fromOpenInference` · `fromOpenInferenceMulti` |
| **OpenTelemetry** / **OpenLLMetry** (Traceloop) | OTel GenAI (OTLP) | `fromOTLP` · `fromOTLPMulti` |
| **Langfuse** (OTLP export) | OTel GenAI | `fromOTLP` |
| **LangSmith / LangGraph** (OTel export) | OTel GenAI | `fromOTLP` · `fromOTLPMulti` |

> Single agent → `from…` → `<AgentThinkingUI>`. A team (a span **tree** with
> nested `invoke_agent` spans) → `from…Multi` → `<MultiAgentFlow>`.

## Arize Phoenix (OpenInference)

Phoenix stores OpenInference spans. Query the spans for a run on your server
(e.g. the Phoenix Python client / its API), return them as JSON, and render:

```jsx
// server: fetch the run's OpenInference spans → JSON  (Phoenix is OpenInference-native)
// client:
const spans = await fetch(`/api/phoenix/runs/${id}/spans`).then((r) => r.json());

const trace = fromOpenInference(spans, { asker: "customer" });
<AgentThinkingUI trace={trace} brand={<b>Acme&nbsp;Support</b>} />

// multi-agent run? the same spans, as a tree → a flow graph:
const flow = fromOpenInferenceMulti(spans, { asker: "customer" });
<MultiAgentFlow trace={flow} />
```

## OpenTelemetry / OpenLLMetry

Anything exporting OpenTelemetry GenAI spans (Traceloop/OpenLLMetry, the OTel
Collector, Bedrock AgentCore, OpenAI Agents SDK, Google ADK, Pydantic AI, Strands…)
feeds `fromOTLP` directly — pass the OTLP/JSON payload or a flat span array:

```jsx
const trace = fromOTLP(otlpJson, { asker: "you" });
<AgentThinkingUI trace={trace} />
```

## Langfuse / LangSmith / LangGraph

These keep their own data model but can emit/export **OpenTelemetry** spans. Point
their OTLP export at your store, then render with `fromOTLP` (single) or
`fromOTLPMulti` (a multi-agent span tree → `<MultiAgentFlow>`).

## Backfill what OTel drops (compose your Trace)

OTel/OpenInference reliably capture *structure* (tools, timing, tokens, status)
but often **not the reasoning** — "the thinking" — or surrounding context; that
isn't always in the protocol. The library renders a **`Trace`**, not spans, so the
adapter is just *one* source. Compose the Trace from the OTel skeleton **plus**
whatever your app kept elsewhere, joined by `spanId` (the adapters stamp it):

```js
const trace = fromOpenInference(spans);            // structure (may lack the reasoning)
for (const step of trace.steps) {
  const extra = yourStore.get(step.spanId);        // the reasoning/context you stored
  if (extra) { step.brain = extra.reasoning; step.output = { ...step.output, ...extra.context }; }
}
<AgentThinkingUI trace={trace} />                  // renders the full thinking, backfilled
```

For content that doesn't fit the schema (a raw log blob, your own widget), render
it per step with the **`renderDetail`** slot — it appears in the inspector body:

```jsx
<AgentThinkingUI trace={trace} renderDetail={(step) => <RawLog spanId={step.spanId} />} />
// <MultiAgentFlow renderDetail={…} /> forwards it to the drilled-in agent's inspector
```

## Live monitoring

For a run in progress, accumulate spans as they arrive and tail the newest beat
with `createMonitor` + the `live` player:

```jsx
import { createMonitor } from "agentthinkingui";

const mon = createMonitor({ format: "openinference", asker: "you" }); // or "otel"; { multi:true } → FlowGraph
stream.on("spans", (batch) => setTrace(mon.push(batch)));             // batch = OTLP or array

<AgentThinkingUI live trace={trace} />
```

## Deep-link back to your dashboard

The adapters stamp each step/node with its source `spanId` (and `traceId`), so you
can wire the replay *back* to the platform — click a beat → open that span in
Langfuse / Phoenix. The library stays platform-neutral: **you** supply the URL.

```jsx
const url = (s) => s.spanId && `${LANGFUSE_HOST}/trace/${s.traceId}?observation=${s.spanId}`;

// render an "open ↗" affordance per step / per agent:
<AgentThinkingUI trace={trace} linkResolver={url} />
<MultiAgentFlow  trace={flow}  linkResolver={(node) => url(node)} onNodeOpen={(n) => /* … */} />

// or handle selection yourself (analytics, two-way highlight, custom routing):
<AgentThinkingUI trace={trace} onSelect={(step, i) => openInDashboard(step.spanId)} />
```

Non-React host? The player also dispatches a DOM event on its root:

```js
el.addEventListener("agentthinkingui:select", (e) => {
  const { spanId, traceId, index } = e.detail;   // jump to the span in your tool
});
```

## Notes

- **Reply type.** The **data / instruction / both** distinction (and the
  skill/steering doc) is AgentThinkingUI's own lens — it isn't in the standards.
  By default tools are `data`; pass `opts.classify(toolName, attrs)` (or set the
  opt-in `agentthinkingui.reply_type` / `.skill` span attributes) to mark a tool
  reply as an `instruction`. See the [API reference](./API.md#adapteroptions).
- **Errors** are universal: a span with status `ERROR` (or an `exception` event)
  renders as a red beat / red agent node — for both conventions.
- **Custom conventions.** A vendor with different attribute keys can plug a
  `reader` into `createMonitor` (same shape as the built-in OTel/OpenInference
  reader maps) — no fork needed.
