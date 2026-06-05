# CLAUDE.md

Project memory for agents working **on** this repo. To learn how to **use** the
library in another app, read [`AGENTS.md`](./AGENTS.md).

## What this is

AgentThinkingUI — a framework-agnostic player that replays an agent's runtime
footprint (a recorded trace) as an animated, scrubbable story. `src/` is the
library; `demo/` is a runnable example.

## Hard constraints (do not break)

- **No build step.** The library runs as plain `<script>` tags: React + ReactDOM
  + Babel standalone (UMD, from a CDN) compile the `.jsx` in the browser. There is
  no bundler, no `package.json` build, no transpile step.
- **Globals, not modules.** Each file exposes its symbols on `window`
  (`window.Stage`, `window.AgentThinkingUI`, `window.AgentTheme`, …). Babel
  standalone runs each `<script type="text/babel">` in its own scope, so cross-file
  sharing goes through `window`, not top-level `const`/`import`.
- **Theming flows through CSS variables.** `theme.js` resolves tokens →
  `--rust`/`--data`/`--instr`/… The container applies them **scoped to its own
  element** (not `:root`) and passes resolved icons/labels to the views via a
  React context. Font sizes are `calc(px * var(--af-text-scale))`.

## Layout

```
src/        theme.js · layout.js · playback.js · stage.jsx · inspector.jsx ·
            timeline.jsx · footprint.jsx · styles.css        (the library)
demo/       index.html (responsive) · mobile.html · trace.js · app.jsx ·
            demo-settings.jsx · tweaks-panel.jsx              (runnable example)
docs/assets gen-hero.mjs → hero-light.svg / hero-dark.svg    (animated README art)
```

- Geometry (brain/tool anchors, arc paths) is pure and lives in `layout.js`
  (`window.arcLayout`, `window.AF_LAYOUT`). The brain/toolbox use a **fixed**
  anchor per layout so they never jump between steps.
- Animation **choreography** is one block of staged `animation-delay`s in
  `styles.css` (search "choreography").

## Naming

`<AgentThinkingUI>` is the primary component (`window.AgentThinkingUI`).
`window.AgentFootprint` is a **deprecated alias**. "footprint" is the domain
concept ("an agent's runtime footprint"), not a second product name.

## Running / verifying a change

- Serve the repo and open the demo: `python3 -m http.server` then
  `/demo/index.html` (responsive) or `/demo/mobile.html` (phone frame).
- The CDN `<script>`s need network access; behind a strict allowlist, vendor
  React/ReactDOM/Babel from npm and route the unpkg URLs to the local copies when
  driving a headless browser.
- Regenerate the README hero after editing it: `node docs/assets/gen-hero.mjs`
  (writes both light + dark from one source).

## Conventions

- Match the surrounding code: framework-light, terse, comment density as-is.
- Keep changes scoped; verify in a real browser (the app is visual — tests alone
  don't catch layout regressions).
