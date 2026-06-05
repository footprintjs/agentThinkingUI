# AgentThinkingUI

**▶️ [Live demo](https://footprintjs.github.io/agentThinkingUI/)**

**Watch any agent think.** AgentThinkingUI is a drop-in, framework-agnostic player
for an agent's *runtime footprint*: feed it a recorded trace and it replays the
agent loop as an animated, scrubbable story — the LLM **brain** reaching for
**tools**, the replies coming back, the reasoning building up, beat by beat. You
can time-travel through every step.

It isn't tied to any vendor, framework, or model. If you can record a run as a
small trace — a hand-rolled loop, a RAG pipeline, LangChain/LlamaIndex, Claude or
OpenAI tool-calling — AgentThinkingUI can play it. Everything visual flows through
a theme, the logic is split into independent modules, and there's no build step.

## The idea — an agent solves a problem the way a person does

Strip away the jargon and an agent loop is just how a human works through a
problem: you **think**, you realize you're missing something, you go **get** it,
and what comes back is either **facts** or **instructions** — then you keep going.

AgentThinkingUI makes that legible. Each beat is one of a few shapes:

- **The brain thinks.** The LLM reasons about the task with what it currently has.
- **The brain reaches for a tool** to get what it's missing — a search, a RAG
  lookup, a DB query, a service/API call.
- **The tool replies**, and the reply is one of three things:
  - **data** → the brain **reasons** over new facts;
  - **instruction** → a **skill / steering doc** arrives telling the brain *how to
    act* (an instruction delivered *as* a tool result);
  - **data + instruction** → both at once — reason on one half, act on the other.
- …and it **loops** until the brain has enough to give the **answer**.

That's the whole metaphor: **a brain that sometimes needs facts and sometimes
needs to be told how to proceed** — exactly how people break down hard problems.
The colour language carries it: data → *reason*, instruction → *act*.

## Quick start

No build step — it's React UMD + in-browser Babel, loaded with plain `<script>`
tags (see [`demo/index.html`](demo/index.html)). Drop in the library, point it at
a trace, and render the ready-made container:

```jsx
<AgentThinkingUI trace={trace} />
```

That gives you the full experience — scene, inspector, notepad, timeline, and
playback, in a resizable split. Prefer your own layout? Drop the four view
components in yourself (below). To embed: copy `src/`, point a `trace.js` at your
own recorded run, and load it the way `demo/index.html` does.

## Layout

```
src/                 # the library (drop into any app)
  theme.js           Theming engine — colors, fonts, icons, labels (window.AgentTheme)
  layout.js          Pure geometry (window.arcLayout): anchors + arc paths. No React.
  playback.js        Time-travel — usePlayback(trace): step, play/pause, speed, persistence
  stage.jsx          <Stage>     — the runtime "thinking" scene (brain, toolbox, arcs, bubbles)
  inspector.jsx      <Inspector> per-step detail + <Notepad> chronological journal
  timeline.jsx       <Timeline>  — time-travel scrubber + transport + legend
  footprint.jsx      <AgentThinkingUI> — ready-made shell wiring all four together
  styles.css         Design tokens + component styles (all keyed off theme variables)

demo/                # a runnable example
  index.html         Loads the library from ../src + this demo's data/theme (responsive)
  mobile.html        The same shell in a phone frame
  trace.js           Sample recorded run (swap for your own)
  app.jsx            Composition — <AgentThinkingUI> + Tweaks + the live-props gear
  demo-settings.jsx  Demo-only live-props gear (rebrand the player at runtime)
  tweaks-panel.jsx   Demo-only live controls (palette / labels / loop)
```

## Components

Four independent view components, plus a default container that composes them:

| Export | Role |
|--------|------|
| `<Timeline>` | time-travel transport + colour-coded scrubber |
| `<Stage>` | the runtime "thinking" scene (brain ⇄ toolbox, bubbles, flow) |
| `<Inspector>` | per-step detail (tool I/O, reasoning, cost) |
| `<Notepad>` | chronological journal that builds up beat-by-beat |
| `<AgentThinkingUI trace>` | **default container** — wires the four + playback + a resizable split |

Use `<AgentThinkingUI trace={trace} />` for the whole thing, or drop the four
pieces into your own layout (each takes `trace` + the playback state from
`usePlayback`). `<AgentFootprint>` remains as a deprecated alias of the container.

The **library** is `src/` — framework-light (React UMD + global exports, no build
step). The **demo** in `demo/` shows it working: it injects a sample trace, a
theme, and live controls so you can see what's configurable.

Animation **ordering** lives as one block of staged `animation-delay`s in
`src/styles.css` (search "choreography"): per beat the cloud → arc → packet →
tool/bubble fire in sequence.

## Theming

**Preferred — pass props.** Theme flows in through `<AgentThinkingUI>`'s
`theme` / `labels` / `icons` props. The container normalizes them and applies the
resulting CSS variables to its **own element** (not `:root`), so themes are
reactive, scoped, and two players can wear different brands on one page without
leaking into the host app.

```jsx
const theme = {
  colors: {
    brand: "#2563EB",          // the brain / agent
    data: "#0EA5E9",           // data → reason   (a hex, or {base,deep,tint})
    instruction: "#F59E0B",    // instruction → act
    answer: "#16A34A",
    call: "#94A3B8",           // tool call
    paper: "#FFFFFF", ink: "#0F172A",
  },
  fonts: {
    display: "Söhne, sans-serif", body: "Inter, sans-serif",
    mono: "ui-monospace", hand: "Caveat, cursive",
    scale: 1,                  // multiplies every text size — match the host's density
  },
};

<AgentThinkingUI
  trace={trace}
  theme={theme}
  labels={{ agent: "Agent", toolbox: "tools" }}
  icons={{ brain: { kind: "emoji", value: "🤖" } }}  // or {kind:"image",value:"/bot.png"} / {kind:"default"}
/>
```

A color may be a single hex (its `deep`/`tint` shades are derived) or a full
`{ base, deep, tint }` triad for exact control. Change a prop and the player
re-themes live — no reload, no global mutation.

**Typography.** The four font *roles* — `display` / `body` / `mono` / `hand` —
are themeable so text picks up the host's families (the host loads the fonts;
unknown families fall back to `system-ui` / `cursive`). `fonts.scale` is a single
multiplier over the whole type ramp (`--af-text-scale`) so the player can match
a denser or larger host layout without restyling.

**Back-compat — page-level globals.** For zero-build script-tag embeds you can
still define `window.AGENT_THEME` (plus `window.AGENT_DISPLAY_NAME` /
`window.AGENT_ICONS`) **before** `theme.js` loads; they seed the defaults on
`:root` at load. Anything omitted falls back to the built-in look. Props always
win over globals.

The engine is reusable on its own via `window.AgentTheme`:
`normalize(opts)` → resolved tokens, `toVars(resolved)` → a CSS-variable map,
`apply(el, opts)` → write the vars onto any element.

## Trace schema

The trace is deliberately generic — it describes the *shape* of an agent loop,
not any one framework. Record your run into this and AgentThinkingUI plays it.

```ts
type Trace = {
  task: string; agent: string; model: string; asker: string;
  steps: Step[];
};

type Step =
  | { kind: "prompt";  brain: string; cost: Cost }                       // the task comes in
  | { kind: "ask";     tool: string; toolName?: string; input: object;   // brain reaches for a tool
      brain: string; cost: Cost }
  | { kind: "return";  tool: string; toolName?: string;                  // the tool replies
      replyType: "data" | "instruction" | "both";
      output: object; brain: string; cost: Cost;
      brainMode?: "reason" | "act";        // data → reason, instruction → act
      skill?: string; actChecklist?: { text: string }[];   // for instruction / both
      actNote?: string }                    // the "acts on the instruction" note (both)
  | { kind: "answer";  to: string; brain: string; answer: Answer; cost: Cost };

type Cost = { ms: number; tokens: number };
```

The three `replyType`s are the model from above: **data** (reason), **instruction**
(act on a skill), and **both** — the mixed case, where the reply carried data
**and** an instruction, so the brain reasons on one half and acts on the other
(two bubbles).

## Embedding

Load order (see `demo/index.html`): your theme globals (optional) → `src/theme.js`
→ React/Babel → your `trace.js` → `src/layout.js` → `src/playback.js` → views →
your composition. Copy `src/`, point a `trace.js` at your own recorded run, and
load it the way `demo/index.html` does.
