# API reference

The full, typed surface of **AgentThinkingUI**. Everything here is declared in
[`types/index.d.ts`](../types/index.d.ts) and [`types/trace.d.ts`](../types/trace.d.ts)
(shipped with the package), so your editor gets the same information via
autocomplete. React 18+ is a peer dependency.

```js
import {
  AgentThinkingUI, MultiAgentFlow,                 // components
  usePlayback,                                 // hook
  fromOTLP, fromOpenInference,                 // single-agent adapters
  fromOTLPMulti, fromOpenInferenceMulti,       // multi-agent adapters
  createMonitor,                               // live ingestion
  layoutFlow, countCrossings,                  // graph layout (pure)
  AgentTheme,                                  // theme engine (normalize/toVars/apply)
} from "agentthinkingui";
import "agentthinkingui/styles.css";
```

> Prefer to see it rather than read it? The **[live demo](https://footprintjs.github.io/agentThinkingUI/)**
> is an interactive playground — the gear edits theme, names, icons, type scale,
> light/dark, scenarios, OTel/OpenInference import, and the multi-agent patterns.

---

## `<AgentThinkingUI>`

The ready-made single-agent player: scene + inspector + notepad + timeline +
playback in a resizable split.

| prop | type | default | description |
|---|---|---|---|
| `trace` | [`Trace`](#trace) | — (required) | the recorded run; `steps` may grow over time when `live` |
| `theme` | [`ThemeConfig`](#themeconfig) | built-in | scoped, reactive theming (applied as CSS vars on the player's own element) |
| `labels` | `{ agent?, toolbox? }` | built-in | display names for the brain / toolbox |
| `icons` | `{ brain?, toolbox?: `[`IconConfig`](#iconconfig)` }` | drawn | swap the brain/toolbox glyphs (emoji / image / drawn) |
| `brand` | `ReactNode` | none | optional wordmark/logo in the top bar |
| `metaphor` | `boolean` | `true` | show the storytelling tags ("calling", "data comes back", …) |
| `loop` | `boolean` | `false` | auto-loop playback |
| `live` | `boolean` | `false` | tail the newest step as the trace grows (live monitoring) |
| `mobile` | `boolean` | `false` | stacked mobile layout (tabs + footer transport) |
| `storageKey` | `string \| null` | derived from the trace | persist scrub position; `null` disables persistence |
| `style` | `object` | — | inline style on the root (wins over theme vars) |
| `onRender` | `(m: `[`RenderMetric`](#rendermetric)`) => void` | — | opt-in UI render metrics (wraps the tree in React's `<Profiler>`) |
| `onSelect` | `(step: Step, index: number) => void` | — | fires on every beat; the step carries `spanId`/`traceId` (analytics / deep-link / sync) |
| `linkResolver` | `(step: Step) => string \| null` | — | return a URL → renders an "open ↗" deep-link for the current step |

`AgentFootprint` is a **deprecated alias** of `AgentThinkingUI`. The player also
dispatches a DOM `CustomEvent("agentthinkingui:select", { detail: { step, index,
spanId, traceId } })` on its root — for non-React/script-tag hosts.

## `<MultiAgentFlow>`

The multi-agent control-flow map; click an agent node to drill into its own
`<AgentThinkingUI>`.

| prop | type | default | description |
|---|---|---|---|
| `trace` | [`FlowGraph`](#flowgraph) | — (required) | the team as a control-flow graph |
| `theme` · `labels` · `icons` · `brand` | _as above_ | | carried into the drill-down player too |
| `live` | `boolean` | `false` | tail the team timeline to the newest beat as the graph grows |
| `onRender` | `(m: `[`RenderMetric`](#rendermetric)`) => void` | — | UI render metrics (adds `agents` to the metric) |
| `onSelect` | `(step, index) => void` | — | fires on every team beat (the step carries `_agent` + `spanId`) |
| `onNodeOpen` | `(node: FlowNode) => void` | — | fires when an agent node is drilled into |
| `linkResolver` | `(node: FlowNode) => string \| null` | — | return a URL → renders an "↗" deep-link on the agent card |

---

## `usePlayback(trace, opts?)`

The time-travel engine, if you compose your own layout instead of using the
container.

```ts
usePlayback(trace: Trace, opts?: {
  loop?: boolean; live?: boolean; storageKey?: string | null;
}): {
  index: number; setIndex(i): void; seek(i): void;     // position
  playing: boolean; setPlaying(p): void;                // transport
  speed: number; setSpeed(s): void;                     // 0.5 | 1 | 2
  onKeyDown(e): void;                                    // put on your root for ←/→/space
}
```

Other view pieces are exported for custom layouts: `Stage`, `Inspector`,
`Notepad`, `Timeline`, `ToolIcon`, and `AgentThemeContext`.

---

## Adapters — telemetry → trace/graph

All take an optional [`AdapterOptions`](#adapteroptions).

| function | input | output |
|---|---|---|
| `fromOTLP(otlp, opts?)` | OpenTelemetry GenAI spans (OTLP/JSON or flat array) | [`Trace`](#trace) |
| `fromOpenInference(otlp, opts?)` | OpenInference spans | [`Trace`](#trace) |
| `fromOTLPMulti(otlp, opts?)` | OpenTelemetry span **tree** | [`FlowGraph`](#flowgraph) |
| `fromOpenInferenceMulti(otlp, opts?)` | OpenInference span **tree** | [`FlowGraph`](#flowgraph) |

### `createMonitor(opts?)` — live ingestion

```ts
createMonitor(opts?: AdapterOptions & {
  format?: "otel" | "openinference";   // default "otel"
  reader?: ReaderMap;                   // plug a custom vendor convention
  multi?: boolean;                      // true → FlowGraph for <MultiAgentFlow>
}): {
  push(input): Trace | FlowGraph;       // append spans (OTLP or array), return updated result
  readonly result: Trace | FlowGraph;
  readonly spans: unknown[];
  reset(): Trace | FlowGraph;
}
```

### `AdapterOptions`

| field | type | description |
|---|---|---|
| `asker` | `string` | who asked (shown on the answer) |
| `title` | `string` | short label for the replay pill |
| `task` | `string` | override the task text |
| `cta` | `string` | answer call-to-action label |
| `classify` | `(toolName, attrs) => { replyType, skill?, actChecklist?, actNote? }` | decide a tool reply's shape (overrides the built-in heuristic) — the **data / instruction / both** distinction isn't in the standards |

---

## `ThemeConfig`

Theming flows in as props and is applied as CSS variables **scoped to the
player's element** (not `:root`), so two instances can wear different brands.

| field | type | notes |
|---|---|---|
| `mode` | `"light" \| "dark"` | swaps the neutral surface/text palette |
| `colors.brand` `.call` `.data` `.instruction` `.answer` `.error` | `string \| { base, deep?, tint? }` | accents — a hex (deep/tint derived) or a full triad |
| `colors.paper` `.surface` `.surface2` `.surface3` `.ink` `.inkSoft` `.inkFaint` `.line` `.lineSoft` | `string` | neutrals (flat hex) |
| `colors.brainFrom` `.brainTo` `.onBrand` | `string` | brain gradient + a foreground override |
| `fonts` | `{ display?, body?, mono?, hand?, scale? }` | families + a `scale` multiplier to match host density |
| `radii` | `{ sm?, md?, lg?, xl? }` | corner-radius scale (CSS lengths) |
| `shadows` | `{ sm?, md?, lg? }` | elevation (default tint derives from `ink`) |

Foregrounds on coloured fills are contrast-aware (white or ink, by luminance).
The theme engine is also exported as `AgentTheme` (`normalize` / `toVars` /
`apply`).

### `IconConfig`

`{ kind: "default" | "emoji" | "image"; value?: string | null }` — e.g.
`{ kind: "emoji", value: "🤖" }` or `{ kind: "image", value: "/bot.png" }`.

### `RenderMetric`

`{ id, phase: "mount"|"update"|"nested-update", actualMs, baseMs, startTime, commitTime, step, steps, agents? }`
— React Profiler timing enriched with player context.

---

## Trace & graph types

See the **[Trace schema](../README.md#trace-schema-the-contract)** in the README
for the narrative; the precise types are in
[`types/trace.d.ts`](../types/trace.d.ts).

### `Trace`
`{ task, title?, agent, model, asker, steps: Step[] }` — a `Step` is one of
`prompt` · `ask` · `return` (`replyType: "data"|"instruction"|"both"`) · `answer`,
each with a [`Cost`](#cost), an optional `error`, and optional `spanId`/`traceId`
(stamped by the adapters — for `linkResolver`/`onSelect` deep-linking).

### `Cost`
`{ ms, tokens, tokensIn?, tokensOut?, tokensCached? }`.

### `FlowGraph`
`{ task, asker?, nodes: FlowNode[], edges: FlowEdge[] }`.
- **`FlowNode`**: `agent` (has a `trace` to drill into) · `decision` · `merge` ·
  `start` / `end`.
- **`FlowEdge`**: `{ from, to, kind: "seq"|"parallel"|"conditional"|"loop", label?, taken? }`.

### Graph layout (pure)
- `layoutFlow(nodes, edges) → { pos, W, H, bottomY }` — layered longest-path +
  barycenter crossing reduction.
- `countCrossings(nodes, edges, pos) → number`.
