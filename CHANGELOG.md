# Changelog

All notable changes to **AgentThinkingUI** are documented here. The format
follows [Keep a Changelog](https://keepachangelog.com/), and the project adheres
to [Semantic Versioning](https://semver.org/).

## [Unreleased]

## [0.5.0] - 2026-06-06

### Added
- **Live monitoring interface** — `createMonitor({ format, multi, reader })`: a
  push-based handle (`push`/`result`/`spans`/`reset`) that re-derives the
  Trace/FlowGraph as spans arrive, for `<AgentThinkingUI live>` / `<AgentSwarm live>`.
- **UI render metrics** — opt-in `onRender` prop on `<AgentThinkingUI>` and
  `<AgentSwarm>`; wraps the tree in React's `<Profiler>` and reports
  `{ phase, actualMs, baseMs, step, steps, … }`.
- **Component explorer** — `demo/explorer.html`, a no-build Storybook-style props
  playground (controls + live preview + generated JSX + prop table).
- **Performance benchmark** — `npm run perf` (load test over the pure cores); a
  Performance section in the README.
- `layoutFlow` / `countCrossings` extracted to `src/flow-layout.js` (pure,
  exported) and **barycenter crossing reduction** added to the graph layout.
- **API reference** (`docs/API.md`) and this changelog.

### Changed / Fixed
- Graph layout is now **O(V+E)** (adjacency list + index-pointer queue); adapter
  tool↔chat pairing is **O(T+C)** (two-pointer).
- **Bounded rendering at scale**: the timeline switches to a single gradient
  track past ~240 steps; the inspector caps oversized tool I/O; `buildMulti`
  parses attributes / resolves nearest-agent once.
- **Dev tooling**: pinned Vite 8 (transitive via the test runner only — the
  library builds with esbuild and ships no Vite).

## [0.4.0]

### Added
- **Full theming**: neutral/surface tokens (`surface`, `surface2/3`, `inkSoft`,
  `inkFaint`, `line`, `lineSoft`), an `error` accent, contrast-aware `on-*`
  foregrounds, `theme.radii` / `theme.shadows` (shadow tint derives from `ink`),
  and **`theme.mode: "light" | "dark"`**.

### Changed
- **Stylesheet scoped + de-leaked**: all rules are scoped under `.atui` /
  `.atui-swarm` via `:where(...)` (specificity-preserving) and the library no
  longer styles `body`/`html` or resets globals — clean Tailwind / CSS-Modules /
  CSS-in-JS interop. Page chrome moved to `demo/demo.css`.
  - **Breaking (CSS only):** the root classes changed (`.app` → `.atui`,
    `.app-swarm` → `.atui-swarm`). The prop/JS API is unchanged; only update any
    CSS that targeted the library's internal classes.

## [0.3.0]

### Added
- **Token attribution**: `cost.tokensIn` / `tokensOut` / `tokensCached`
  (input/output/cache split) on the trace, populated by the adapters and shown
  in the inspector.

## [0.2.1]

### Added
- **Full keyboard + screen-reader accessibility**: `role="slider"` timeline,
  ARIA labels/state, focus-visible outlines, `prefers-reduced-motion`.

### Fixed
- Keyboard handling is scoped to the player (no host-page hijack); per-instance
  scrub persistence; guarded `localStorage`; zero-latency / missing-cost traces.

## [0.2.0]

### Added
- **One unified demo**: single ⟷ multi-agent switched in-app (no separate page).
- `fromOpenInferenceMulti` (OpenInference span tree → FlowGraph); shared
  OpenTelemetry/OpenInference import across the demo.
- Token-free self-hosted coverage badge.

## [0.1.0]

### Added
- Initial release: `<AgentThinkingUI>` single-agent player (scene · inspector ·
  notepad · timeline · playback), `<AgentSwarm>` multi-agent control-flow map,
  prop-first scoped theming, and the `fromOTLP` / `fromOpenInference` /
  `fromOTLPMulti` adapters. Scoped ES modules with an ESM + UMD dual build.

[Unreleased]: https://github.com/footprintjs/agentThinkingUI/compare/v0.5.0...HEAD
[0.5.0]: https://github.com/footprintjs/agentThinkingUI/releases/tag/v0.5.0
[0.4.0]: https://github.com/footprintjs/agentThinkingUI/releases/tag/v0.4.0
[0.3.0]: https://github.com/footprintjs/agentThinkingUI/releases/tag/v0.3.0
[0.2.1]: https://github.com/footprintjs/agentThinkingUI/releases/tag/v0.2.1
[0.2.0]: https://github.com/footprintjs/agentThinkingUI/releases/tag/v0.2.0
[0.1.0]: https://github.com/footprintjs/agentThinkingUI/releases/tag/v0.1.0
