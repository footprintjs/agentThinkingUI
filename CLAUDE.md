# CLAUDE.md

Project memory for agents working **on** this repo. To learn how to **use** the
library in another app, read [`AGENTS.md`](./AGENTS.md).

## What this is

AgentThinkingUI — a framework-agnostic player that replays an agent's runtime
footprint (a recorded trace) as an animated, scrubbable story. `src/` is the
library; `demo/` is a runnable example.

## Architecture (do not break)

- **Scoped ES modules + a tiny dual build.** `src/` is real ES modules
  (`import`/`export`, no `window` globals for sharing). `build.mjs` (esbuild) emits
  `dist/`: an **ESM** bundle (`agentthinkingui.js`, React externalized) for
  bundler/app users, and a **UMD/IIFE** bundle (`agentthinkingui.umd.js`) that
  re-attaches the symbols to `window` for script-tag/CDN use. React/ReactDOM are
  **peer deps** (the UMD reads them from `window.React`). `dist/` is gitignored —
  Pages builds it in CI, `prepublishOnly` builds it for npm.
- **Two entry points.** `src/index.jsx` (ESM re-exports) and `src/global.jsx` (UMD;
  sets `window.*` + seeds `:root` from page globals). Don't add `window.X =` inside
  the feature modules — export and let `global.jsx` attach.
- **Theming flows through CSS variables.** `theme.js` resolves the full surface
  (accents · neutrals `surface/line/ink*` · `error` · contrast-aware `on-*` ·
  radii · shadows · `mode:"light"|"dark"`) → `--rust`/`--data`/`--card`/… The
  container applies them **scoped to its own element** (not `:root`) and passes
  resolved icons/labels to the views via the shared `context.js` React context.
  Font sizes are `calc(px * var(--af-text-scale))`.
- **Untrusted text never becomes HTML.** Tool I/O (`highlight`) and beat prose
  (`markdown.js` → `<Prose>`) are tokenized into React **elements** — there is no
  `dangerouslySetInnerHTML` anywhere in `src/`, and no sanitizer to keep in sync.
  Markdown links/images render inert (no `href`, no `src`): model text must not
  be clickable and must not fetch. Keep it that way — render a body through
  `<Prose>`, never by building markup.
- **No host leakage.** Every library rule is scoped under the root classes
  `.atui` / `.atui-swarm` via `:where(...)` (specificity-preserving), so generic
  inner names (`.panel`, `.note`, `.code`) never style a host's elements. The
  library does **not** style `body`/`html`/`.grain` — that page chrome lives in
  `demo/demo.css`. Keep new rules scoped; don't add bare/global selectors.

## Layout

```
src/        theme.js · layout.js · flow-layout.js (pure multi-agent graph layout) ·
            markdown.js (pure beat-prose parser) · prose.jsx (<Prose> renderer) ·
            playback.js · context.js · stage.jsx · agent-icons.jsx (agentIcon glyphs) ·
            inspector.jsx · timeline.jsx ·
            footprint.jsx · multi-agent-flow.jsx · adapters/otlp.js ·
            index.jsx (ESM entry) · global.jsx (UMD entry) · styles.css
build.mjs   esbuild → dist/ (ESM + UMD + css)
scripts/    coverage-badge.mjs · perf.mjs (load benchmark → `npm run perf`)
demo/       index.html (responsive; single ⟷ multi switched in-app via the gear) ·
            explorer.html (no-build component explorer: controls + props table) ·
            demo.css (page chrome — body/grain, NOT the library) ·
            mobile.html · trace.js · flow-trace.js · app.jsx · demo-settings.jsx ·
            tweaks-panel.jsx   (loads the prebuilt ../dist; swarm.html → redirects to index)
docs/assets gen-hero.mjs → hero-light.svg / hero-dark.svg    (animated README art)
```

- Geometry (brain/tool anchors, arc paths) is pure and lives in `layout.js`
  (`arcLayout`, `AF_LAYOUT`). The brain/toolbox use a **fixed** anchor per layout
  so they never jump between steps.
- The thought bubble's size budget is pure too (`bubbleBoxFor`, `BUBBLE`): the
  scene measures its container once and publishes the caps as custom properties
  (`--af-bubble-w` / `-wc` / `-h` / `-tail`, alongside `--af-icon-scale`) which
  the CSS consumes. Widths come from `width: max-content` under those caps — the
  browser measures the TEXT, we only decide the room. Don't reintroduce a fixed
  px cap on `.cloud` / `.skilldoc` / `.thinking-callout`.
- Animation **choreography** is one block of staged `animation-delay`s in
  `styles.css` (search "choreography").

## Naming

`<AgentThinkingUI>` is the single-agent player; `AgentFootprint` is a **deprecated
alias**. "footprint" is the domain concept ("an agent's runtime footprint"), not a
second product name.

The multi-agent component is `<MultiAgentFlow>` (in `multi-agent-flow.jsx`) — it
renders a control-flow graph, so "flow" matches the `FlowGraph` type. It was named
`AgentSwarm` through 0.5.0; renamed in 0.6.0 with **no alias** ("swarm" is only one
of the patterns it draws and clashed with OpenAI Swarm). Don't reintroduce the old
name. CSS classes stay `.atui-swarm` / `swarm-*` (internal styling, not the API).

## Running / verifying a change

- **Build first**, then serve the demo: `npm run build` → `python3 -m http.server`
  → `/demo/index.html` (responsive) or `/demo/mobile.html` (phone frame). The demo
  loads `../dist/agentthinkingui.umd.js` (`npm run serve` builds then serves).
- **Tests / lint:** `npm test` (Vitest, jsdom — imports the ES modules directly),
  `npm run coverage` (~98% of `src/`), `npm run lint` (ESLint). CI runs lint +
  coverage on push/PR (`.github/workflows/ci.yml`).
- Headless browser behind a strict allowlist: vendor React/ReactDOM from npm and
  route the unpkg URLs to local copies; the demo's own UMD bundle is local (`dist`).
- Regenerate the README hero after editing it: `node docs/assets/gen-hero.mjs`.

## Conventions

- Match the surrounding code: framework-light, terse, comment density as-is.
- Keep changes scoped; verify in a real browser (the app is visual — tests alone
  don't catch layout regressions).
