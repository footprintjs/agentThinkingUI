/* ============================================================
   AgentThinkingUI — ESM entry.
   import { AgentThinkingUI } from "agentthinkingui";
   React is a peer dependency (not bundled).
   ============================================================ */
export { AgentThinkingUI, AgentThinkingUI as AgentFootprint } from "./footprint.jsx";
export { Stage, ToolIcon } from "./stage.jsx";
export { Inspector, Notepad } from "./inspector.jsx";
export { Timeline } from "./timeline.jsx";
export { usePlayback, AF_DWELL } from "./playback.js";
export { arcLayout, AF_LAYOUT } from "./layout.js";
export { AgentThemeContext } from "./context.js";
export * as AgentTheme from "./theme.js";
export { fromOTLP, fromOpenInference } from "./adapters/otlp.js";
