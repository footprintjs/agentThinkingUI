# Changelog

All notable changes to **AgentThinkingUI** are documented here. The format
follows [Keep a Changelog](https://keepachangelog.com/), and the project adheres
to [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Docs
- Essay — **[Who debugs the agent?](docs/blog/who-debugs-the-agent.md)**: developers
  triage infra/logic, but the semantic/content failures only a domain expert can
  catch — and they shouldn't have to read JSON.
- Essay — **[Data, or instruction?](docs/blog/data-or-instruction.md)**: the design
  rationale — model an agent as a brain + a tool, and label every reply data (reason)
  or instruction (act); that's where content drives the decision.

## [0.8.0] - 2026-06-06

### Added
- **`renderDetail(step)` slot** on `<AgentThinkingUI>` (forwarded to the drilled-in
  agent by `<MultiAgentFlow>`) — render arbitrary per-step content in the inspector
  (raw logs / custom widgets / data OTel didn't capture).

### Docs
- README **FAQ**; `docs/integrations.md` "Backfill what OTel drops (compose your
  Trace)" — assemble a Trace from the OTel skeleton + your own store, joined by
  `spanId`, so the reasoning OTel doesn't capture still renders.

## [0.7.0] - 2026-06-06

### Added
- **Host integration hooks** — `onSelect(step, index)` on `<AgentThinkingUI>` and
  `<MultiAgentFlow>` (plus `onNodeOpen(node)` on the latter), a DOM
  `agentthinkingui:select` CustomEvent for non-React hosts, and a `linkResolver`
  prop that renders an "open ↗" deep-link. The adapters now stamp `spanId` /
  `traceId` onto steps and nodes, so you can link a beat back to its span in
  Langfuse / Phoenix / your trace store. See [docs/integrations.md](docs/integrations.md).

## [0.6.0] - 2026-06-06

### Changed
- **Renamed `AgentSwarm` → `MultiAgentFlow` (breaking).** The component renders a
  multi-agent *control-flow graph* — "swarm" was just one of the patterns it draws
  (and clashed with OpenAI Swarm / agency-swarm), while "flow" matches the
  `FlowGraph` type. No alias is kept (pre-adoption clean break). The `onRender`
  metric `id` is now `"multiagentflow"`.

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
  notepad · timeline · playback), `<AgentSwarm>` multi-agent control-flow map (renamed in 0.6.0),
  prop-first scoped theming, and the `fromOTLP` / `fromOpenInference` /
  `fromOTLPMulti` adapters. Scoped ES modules with an ESM + UMD dual build.

[Unreleased]: https://github.com/footprintjs/agentThinkingUI/compare/v0.8.0...HEAD
[0.8.0]: https://github.com/footprintjs/agentThinkingUI/releases/tag/v0.8.0
[0.7.0]: https://github.com/footprintjs/agentThinkingUI/releases/tag/v0.7.0
[0.6.0]: https://github.com/footprintjs/agentThinkingUI/releases/tag/v0.6.0
[0.5.0]: https://github.com/footprintjs/agentThinkingUI/releases/tag/v0.5.0
[0.4.0]: https://github.com/footprintjs/agentThinkingUI/releases/tag/v0.4.0
[0.3.0]: https://github.com/footprintjs/agentThinkingUI/releases/tag/v0.3.0
[0.2.1]: https://github.com/footprintjs/agentThinkingUI/releases/tag/v0.2.1
[0.2.0]: https://github.com/footprintjs/agentThinkingUI/releases/tag/v0.2.0
[0.1.0]: https://github.com/footprintjs/agentThinkingUI/releases/tag/v0.1.0
