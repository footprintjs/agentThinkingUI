# AgentFootprint

**▶️ [Live demo](https://footprintjs.github.io/agentThinkingUI/)**

A **player for an agent's runtime footprint**. Feed it a recorded trace and it
renders the agent loop as an animated, scrubbable story — the LLM *brain* calls
**tools**, and the reply is either **data** (the brain reasons) or an
**instruction** (the brain follows a skill / steering doc). Time-travel through
every beat.

It's built to drop into any app: **everything visual flows through a theme**,
and the logic is split into independent modules.

## Layout

```
src/                 # the library (drop into any app)
  theme.js           Theming — colors, fonts, icons, display names (reads window.AGENT_*)
  layout.js          Pure geometry (window.arcLayout): anchors + arc paths. No React.
  playback.js        Time-travel — usePlayback(trace): step, play/pause, speed, persistence
  stage.jsx          <Stage>     — the runtime "thinking" scene (brain, toolbox, arcs, bubbles)
  inspector.jsx      <Inspector> per-step detail + <Notepad> chronological journal
  timeline.jsx       <Timeline>  — time-travel scrubber + transport + legend
  footprint.jsx      <AgentFootprint> — ready-made shell wiring all four together
  styles.css         Design tokens + component styles (all keyed off theme variables)

demo/                # a runnable example
  index.html         Loads the library from ../src + this demo's data/theme
  trace.js           Sample recorded run (swap for your own)
  app.jsx            Composition — <AgentFootprint> + Tweaks + the gear settings
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
| `<AgentFootprint trace>` | **default container** — wires the four + playback + a resizable split |

Use `<AgentFootprint trace={trace} />` to get the whole experience, or drop the
four pieces into your own layout (each takes `trace` + the playback state from
`usePlayback`).

The **library** is `src/` — framework-light (React UMD + global exports, no build
step). The **demo** in `demo/` shows it working: it injects a sample trace, an
optional theme, and a Tweaks panel so you can see what's configurable. To embed,
copy `src/`, point a `trace.js` at your run, and load it the way `demo/index.html`
does.

Animation **ordering** lives as one block of staged `animation-delay`s in
`src/styles.css` (search "choreography"): per beat the cloud → arc → packet →
tool/bubble fire in sequence.

## Theming

**Preferred — pass props.** Theme flows in through `<AgentFootprint>`'s
`theme` / `labels` / `icons` props. The container normalizes them and applies
the resulting CSS variables to its **own element** (not `:root`), so themes are
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

<AgentFootprint
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

```ts
type Trace = {
  task: string; agent: string; model: string; asker: string;
  steps: Step[];
};

type Step =
  | { kind: "prompt";  brain: string; cost: Cost }
  | { kind: "ask";     tool: string; toolName?: string; input: object; brain: string; cost: Cost }
  | { kind: "return";  tool: string; toolName?: string; replyType: "data" | "instruction" | "both";
      output: object; brain: string; cost: Cost;
      brainMode?: "reason" | "act";        // data → reason, instruction → act
      skill?: string; actChecklist?: { text: string }[];   // for instruction / both
      actNote?: string }                    // the "acts on the instruction" note (both)
  | { kind: "answer";  to: string; brain: string; answer: Answer; cost: Cost };

type Cost = { ms: number; tokens: number };
```

`replyType: "both"` is the mixed case — the reply carried data **and** an
instruction, so the brain reasons on one half and acts on the other (two bubbles).

## Embedding

Load order (see `demo/index.html`): your `AGENT_THEME` → `src/theme.js` →
React/Babel → your `trace.js` → `src/layout.js` → `src/playback.js` → views →
your composition. Copy `src/`, point a `trace.js` at your own recorded run, and
load it the way `demo/index.html` does.
