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
