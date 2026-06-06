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

## Live monitoring

For a run in progress, accumulate spans as they arrive and tail the newest beat
with `createMonitor` + the `live` player:

```jsx
import { createMonitor } from "agentthinkingui";

const mon = createMonitor({ format: "openinference", asker: "you" }); // or "otel"; { multi:true } → FlowGraph
stream.on("spans", (batch) => setTrace(mon.push(batch)));             // batch = OTLP or array

<AgentThinkingUI live trace={trace} />
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
