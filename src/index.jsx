/* ============================================================
   AgentThinkingUI — ESM entry.
   import { AgentThinkingUI } from "agentthinkingui";
   React is a peer dependency (not bundled).
   ============================================================ */
export { AgentThinkingUI, AgentThinkingUI as AgentFootprint } from "./footprint.jsx";
export { MultiAgentFlow } from "./multi-agent-flow.jsx";
export { BacktrackView, BacktrackOverlay } from "./backtrack.jsx";
export { InfluenceMap, InfluenceMapOverlay, INFLUENCE_COPY } from "./influence-map.jsx";
export { influenceLayout, INFLUENCE_LAYOUT } from "./influence-layout.js";
export { Stage, ToolIcon } from "./stage.jsx";
export { Inspector, Notepad } from "./inspector.jsx";
export { Timeline } from "./timeline.jsx";
export { usePlayback, AF_DWELL } from "./playback.js";
export { arcLayout, AF_LAYOUT } from "./layout.js";
export { AgentThemeContext } from "./context.js";
export * as AgentTheme from "./theme.js";
export { fromOTLP, fromOpenInference, fromOTLPMulti, fromOpenInferenceMulti, createMonitor } from "./adapters/otlp.js";
export { layoutFlow, countCrossings } from "./flow-layout.js";
