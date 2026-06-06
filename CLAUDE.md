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
- **No host leakage.** Every library rule is scoped under the root classes
  `.atui` / `.atui-swarm` via `:where(...)` (specificity-preserving), so generic
  inner names (`.panel`, `.note`, `.code`) never style a host's elements. The
  library does **not** style `body`/`html`/`.grain` — that page chrome lives in
  `demo/demo.css`. Keep new rules scoped; don't add bare/global selectors.

## Layout

```
src/        theme.js · layout.js · playback.js · context.js · stage.jsx ·
            inspector.jsx · timeline.jsx · footprint.jsx ·
            index.jsx (ESM entry) · global.jsx (UMD entry) · styles.css
build.mjs   esbuild → dist/ (ESM + UMD + css)
demo/       index.html (responsive; single ⟷ multi switched in-app via the gear) ·
            demo.css (page chrome — body/grain, NOT the library) ·
            mobile.html · trace.js · flow-trace.js · app.jsx · demo-settings.jsx ·
            tweaks-panel.jsx   (loads the prebuilt ../dist; swarm.html → redirects to index)
docs/assets gen-hero.mjs → hero-light.svg / hero-dark.svg    (animated README art)
```

- Geometry (brain/tool anchors, arc paths) is pure and lives in `layout.js`
  (`arcLayout`, `AF_LAYOUT`). The brain/toolbox use a **fixed** anchor per layout
  so they never jump between steps.
- Animation **choreography** is one block of staged `animation-delay`s in
  `styles.css` (search "choreography").

## Naming

`<AgentThinkingUI>` is the primary component. `AgentFootprint` is a **deprecated
alias**. "footprint" is the domain concept ("an agent's runtime footprint"), not a
second product name.

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
