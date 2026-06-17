# Changelog

All notable changes to **AgentThinkingUI** are documented here. The format
follows [Keep a Changelog](https://keepachangelog.com/), and the project adheres
to [Semantic Versioning](https://semver.org/).

## [Unreleased]

## [0.13.0] - 2026-06-17

### Added
- **`toolMenu="rack"` — the model's tool menu as a vertical rack.** A second
  tool-menu layout, opt-in via `toolMenu="rack"` (default stays `"card"`).
  Instead of one tool popping out, the toolbox becomes a vertical rack of every
  tool the model can use (icon + name beneath), the picked one lit and the rest
  dimmed. The brain's **"ask" connector is a STRAIGHT line that lands on the
  picked row** (it visibly points at the chosen tool); the "reply" stays curved.
  Stable across the run (union of all `toolsSeen`); **height-capped** ("+N more"
  past `RACK_CAP`, always keeping the picked tool visible); skills get the doc
  glyph. New exports: `ToolRack`, `rackView`, `RACK_CAP`; layout helpers
  `rackPickedY`, `RACK_ITEM_H`, and `arcLayout`'s `toolY` + `straightLine` params.

## [0.12.0] - 2026-06-17

### Added
- **"Saw N, picked 1" tool menu.** Under the picked-tool card, a compact menu of
  every tool the model saw for that call (from `step.toolsSeen`) — the picked one
  lit, the rest dimmed; skills get the steering-doc glyph. Surfaces the prompt's
  tool menu at a glance ("the model chose this out of N"). Reuses existing trace
  data — no recorder change. New exports: `ToolMenu`, `isSkillName`.

### Changed
- **Calmer scene.** The brain mascot now scales down — container-responsive and
  capped (`iconScaleFor`) — *without* shrinking the tool card, so the new menu
  stays readable; only the brain end of the connector arc tracks the shrink. New
  `--af-icon-scale` CSS variable (defaults to 1; unchanged for swarm/backtrack).
- **Clearer transport.** Back/Next are the prominent filled pair, Play/Restart are
  calm ghost buttons, and hovering no longer lifts the buttons (the vertical jump
  read as a confusing height change).
- **Legend on demand.** The colour key is now a compact "key" chip that reveals the
  full legend on hover/focus, reclaiming toolbar width.

## [0.11.0] - 2026-06-11

### Added
- **`<BacktrackView>` — the "why?" board.** A decision walked backwards to the
  piece of context (or code) that caused it, fed by a new framework-agnostic
  `BacktrackTrace` contract (agentfootprint's `localizeContextBug` report maps
  1:1). Works at ANY decision point: final answer, mid-loop tool choice, or a
  deterministic rule (`decide()`) — the rule variant swaps the brain for a
  decision diamond and shows the exact recorded trail. Scrubbable beats with a
  sticky stepper + auto-scroll: the bug → who answered → what it was given →
  the scores (per-card influence meters: 100% track, colored fill + value
  overlay; hatched + starred for path-only upper bounds) → the test (ablation
  stamps; ranking-only traces show none, honestly) → the culprit (chain of
  custody that doubles as a REWIND player — click a hop to replay the recorded
  state: the assembled prompt the model saw, the mutating commit, the rule
  operands, culprit span highlighted). Suspects paginate past three.
- **`<BacktrackOverlay>`** — the host entry point: centered modal on desktop,
  full-screen view with a back button under 640px; Esc / scrim / back close it.
  Trigger it from any decision point in a main UI.

## [0.10.0] - 2026-06-09

### Added
- **"Tools the model saw" inspector section.** An `ask` / `answer` beat may now
  carry `toolsSeen` — the tool menu (`{ name, description }[]`) the model had at
  its disposal for that call. The step inspector renders it as a **collapsed
  "🔧 Tools the model saw (N)" section**; expand it to read the descriptions a
  domain expert needs to debug WHY the model chose (or skipped) a tool, right next
  to its reasoning. Beats without `toolsSeen` show no section. Fed by
  agentfootprint ≥ 6.6.0's `agentThinkingTrace` (which reads `stream.llm_start`'s
  new tool catalog). Types: `ToolSeen` + `toolsSeen` on `AskStep`/`AnswerStep`
  (also back-filled the previously-undocumented `thinking` field on those types).

## [0.9.0] - 2026-06-08

### Added
- **Extended-thinking callout.** A beat may now carry an optional `thinking`
  field (the model's chain-of-thought). When present, the scene renders it as a
  **collapsible "💭 thinking" callout above the action** (preview collapsed, full
  reasoning on expand), and the inspector shows an "Extended thinking" section.
  Beats without `thinking` are unchanged. Populated by agentfootprint's
  `agentThinkingTrace` (≥ 6.3.0) from Claude's reasoning blocks; render-only here
  (the trace contract gains one optional field). Test: `test/thinking-callout`.

## [0.8.2] - 2026-06-08

### Fixed
- **Timeline playhead now stays on its step's segment.** Segment widths lean on
  latency but every beat keeps a visible slice; the playhead's `start` was
  latency-cumulative while segments rendered by width, so on 0ms beats (every
  tool-return beat) the cursor drifted left of its step — and could even run past
  100% (off the track). Widths are now normalized to sum to 100 and `start` is
  cumulative width, so the playhead, the click hit-testing, and the rendered
  segments share one axis. Regression test: `test/timeline-cursor.test.mjs`.

## [0.8.1] - 2026-06-08

### Fixed
- **Optional trace fields no longer crash the player.** `SkillDoc` and the
  Inspector mapped over `actChecklist`, `answer.plan`, and `answer.budget`
  without guards — all OPTIONAL per the trace contract — so a valid, minimal
  trace (only required fields) threw `Cannot read properties of undefined
  (reading 'map')`. They now default / render conditionally. (Surfaced by the
  agentfootprint `agentThinkingTrace` adapter, which emits exactly such minimal
  traces.) Regression test: `test/optional-fields.test.mjs`.

### Docs
- Essay — **[Who debugs the agent?](docs/blog/who-debugs-the-agent.md)**: developers
  triage infra/logic, but the semantic/content failures only a domain expert can
  catch — and they shouldn't have to read JSON.
- Essay — **[Data, or instruction?](docs/blog/data-or-instruction.md)**: the design
  rationale — model an agent as a brain + a tool, and label every reply data (reason)
  or instruction (act); that's where content drives the decision.
- Essay — **[The protocol is the floor, not the ceiling](docs/blog/protocol-is-the-floor.md)**:
  why OTel/OpenInference can't carry all the domain content, and the seam (compose by
  `spanId` · `classify` · `renderDetail`) that fills it.
- Essay — **[Everything is a prop](docs/blog/everything-is-a-prop.md)**: every seam
  (look, data, semantic layer, debug context) is a React prop — a component you own,
  not a platform you configure.

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

[Unreleased]: https://github.com/footprintjs/agentThinkingUI/compare/v0.8.2...HEAD
[0.8.2]: https://github.com/footprintjs/agentThinkingUI/releases/tag/v0.8.2
[0.8.1]: https://github.com/footprintjs/agentThinkingUI/releases/tag/v0.8.1
[0.8.0]: https://github.com/footprintjs/agentThinkingUI/releases/tag/v0.8.0
[0.7.0]: https://github.com/footprintjs/agentThinkingUI/releases/tag/v0.7.0
[0.6.0]: https://github.com/footprintjs/agentThinkingUI/releases/tag/v0.6.0
[0.5.0]: https://github.com/footprintjs/agentThinkingUI/releases/tag/v0.5.0
[0.4.0]: https://github.com/footprintjs/agentThinkingUI/releases/tag/v0.4.0
[0.3.0]: https://github.com/footprintjs/agentThinkingUI/releases/tag/v0.3.0
[0.2.1]: https://github.com/footprintjs/agentThinkingUI/releases/tag/v0.2.1
[0.2.0]: https://github.com/footprintjs/agentThinkingUI/releases/tag/v0.2.0
[0.1.0]: https://github.com/footprintjs/agentThinkingUI/releases/tag/v0.1.0
