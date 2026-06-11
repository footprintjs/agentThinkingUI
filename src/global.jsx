/* ============================================================
   AgentThinkingUI — UMD/IIFE entry (for <script> / CDN drop-in).
   Built to dist/agentthinkingui.umd.js, it attaches the same symbols to
   window that the old script-tag build did, so existing embeds keep
   working unchanged. React/ReactDOM are read from the page globals.
   ============================================================ */
import { AgentThinkingUI } from "./footprint.jsx";
import { MultiAgentFlow } from "./multi-agent-flow.jsx";
import { BacktrackView, BacktrackOverlay } from "./backtrack.jsx";
import { Stage, ToolIcon } from "./stage.jsx";
import { Inspector, Notepad } from "./inspector.jsx";
import { Timeline } from "./timeline.jsx";
import { usePlayback, AF_DWELL } from "./playback.js";
import { arcLayout, AF_LAYOUT } from "./layout.js";
import { AgentThemeContext } from "./context.js";
import * as AgentTheme from "./theme.js";
import { fromOTLP, fromOpenInference, fromOTLPMulti, fromOpenInferenceMulti, createMonitor } from "./adapters/otlp.js";

const w = typeof window !== "undefined" ? window : {};
Object.assign(w, {
  AgentThinkingUI,
  AgentFootprint: AgentThinkingUI, // deprecated alias
  MultiAgentFlow,
  BacktrackView,
  BacktrackOverlay,
  Stage, ToolIcon, Inspector, Notepad, Timeline,
  usePlayback, AF_DWELL, arcLayout, AF_LAYOUT,
  AgentTheme, AgentThemeContext,
  AgentAdapters: { fromOTLP, fromOpenInference, fromOTLPMulti, fromOpenInferenceMulti, createMonitor },
});

// back-compat: seed :root from page-level globals at load, as the old build did
try {
  if (typeof document !== "undefined") w.AGENT_THEME_RESOLVED = AgentTheme.apply(document.documentElement);
} catch { /* non-browser */ }
