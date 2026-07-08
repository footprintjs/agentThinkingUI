import type { FC, ReactNode } from "react";
import type { Trace } from "./trace.js";

export * from "./trace.js";

export interface IconConfig {
  kind: "default" | "emoji" | "image";
  value?: string | null;
}

export interface ThemeConfig {
  /** "light" (default) or "dark" — swaps the neutral surface/text palette */
  mode?: "light" | "dark";
  /**
   * Accents: `brand` `call` `data` `instruction` `answer` `error` — a hex
   * (deep/tint derived) or a full `{ base, deep, tint }`.
   * Neutrals (flat hex): `paper` `surface` (card) `surface2` `surface3`
   * `ink` `inkSoft` `inkFaint` `line` `lineSoft`, plus `brainFrom`/`brainTo`,
   * an `onBrand` foreground override, and `sceneGlow` / `grainInk` / `codeBg` …
   */
  colors?: Record<string, string | { base: string; deep?: string; tint?: string }>;
  fonts?: { display?: string; body?: string; mono?: string; hand?: string; scale?: number };
  /** corner-radius scale (CSS lengths) → --r-sm/md/lg/xl */
  radii?: { sm?: string; md?: string; lg?: string; xl?: string };
  /** elevation → --shadow-sm/md/lg (default tint derives from `ink`) */
  shadows?: { sm?: string; md?: string; lg?: string };
}

export interface AgentThinkingUIProps {
  /** the recorded run (steps may grow over time when `live`) */
  trace: Trace;
  /** scoped, reactive theming — applied as CSS vars on the player's own element */
  theme?: ThemeConfig;
  labels?: { agent?: string; toolbox?: string };
  icons?: { brain?: IconConfig; toolbox?: IconConfig };
  /** optional wordmark/logo for the top bar (the library ships none) */
  brand?: ReactNode;
  /** show the storytelling tags (default true) */
  metaphor?: boolean;
  /** tool-menu layout (default "card"): "card" pops the picked tool out of the
   *  toolbox with a "saw N" menu; "rack" shows a vertical rack of every tool the
   *  model saw, the picked one lit, with a "Why this tool?" inspector panel. */
  toolMenu?: "card" | "rack";
  /** rack mode: wire the Why panel's "Explain (live)" button to YOUR LLM. Given
   *  the tool-choice context + a ready-made prompt, return the explanation text
   *  (or `{ reason }`); the panel renders it in place. The library makes no LLM
   *  calls itself — you own the call and the key. */
  /**
   * Rack mode — wire the Why panel's live LLM calls to YOUR model. Called for the
   * "✨ Explain (live)" button (`kind` absent/"why") AND the Description Doctor's
   * "📝 Improve description" button (`kind: "improve-description"`, with the tool's
   * current `description`) — return the improved one-line description. The library
   * makes no LLM calls itself.
   */
  onExplain?: (ctx: { trace: Trace; step: Step; tool: string; prompt: string; kind?: "why" | "improve-description"; description?: string }) => Promise<string | { reason?: string; score?: number }>;
  /**
   * LLM-as-judge scorer — powers the "LLM" strategy's ranked bars. Given the
   * step's tools + choice context, return a 0..1 relevance/influence score per
   * tool (the model's own read of fit). Fetched lazily when the LLM tab opens.
   * Unlike lexical/embedding scores, this can rank a procedural pick correctly.
   */
  onScore?: (ctx: { trace: Trace; step: Step; tools: { name: string; description?: string }[] }) => Promise<{ scores: { name: string; score: number; rationale?: string }[] } | { name: string; score: number; rationale?: string }[]>;
  /**
   * Powers the "By the rules" strategy — per-rule attribution for a step's pick.
   * OPTIONAL and lazy: if a step already carries `attribution` (stamped upstream,
   * e.g. from agentfootprint's `attributeChoice`), the panel renders it for free
   * and never calls this. Wire it only to compute attribution on demand. Return
   * ranked context units (system-prompt rules / the task) by similarity to the
   * chosen tool. A similarity PROXY, not a causal claim.
   */
  onAttribute?: (ctx: { trace: Trace; step: Step; tools: { name: string; description?: string }[] }) => Promise<WhyAttribution | { label: string; score: number; quote?: string; picked?: boolean }[]>;
  /** auto-loop playback */
  loop?: boolean;
  /** live monitoring: tail the newest step as the trace grows */
  live?: boolean;
  /** stacked mobile layout */
  mobile?: boolean;
  style?: Record<string, string | number>;
  /** persist scrub position under this key (default: derived from the trace; null disables) */
  storageKey?: string | null;
  /** opt-in UI render metrics (wraps the tree in React's <Profiler>) */
  onRender?: (metric: RenderMetric) => void;
  /** fires on every beat with the current step (carries `spanId`/`traceId`) — for analytics / deep-linking / sync */
  onSelect?: (step: Step, index: number) => void;
  /** return a URL for a step → renders an "open ↗" affordance (host builds the link, e.g. to Langfuse/Phoenix) */
  linkResolver?: (step: Step) => string | null | undefined;
  /** render extra content for the current step in the inspector (raw logs / custom widgets / data OTel didn't capture) */
  renderDetail?: (step: Step, index: number) => ReactNode;
}

/** UI render metric — React Profiler timing, enriched with player context. */
export interface RenderMetric {
  id: string;
  phase: "mount" | "update" | "nested-update";
  /** ms spent rendering this commit (React Profiler actualDuration) */
  actualMs: number;
  /** ms without memoization (React Profiler baseDuration) */
  baseMs: number;
  startTime: number;
  commitTime: number;
  /** current step index */
  step: number;
  /** total steps in the (team) trace */
  steps: number;
  /** agent count (MultiAgentFlow only) */
  agents?: number;
}

/** The ready-made container: scene + inspector + notepad + timeline + playback. */
export const AgentThinkingUI: FC<AgentThinkingUIProps>;
/** @deprecated alias of AgentThinkingUI */
export const AgentFootprint: FC<AgentThinkingUIProps>;

export type FlowStatus = "idle" | "running" | "done" | "error";
export type FlowNode =
  | { id: string; kind?: "agent"; name: string; role?: string; status?: FlowStatus; icon?: IconConfig; trace: Trace; spanId?: string; traceId?: string }
  | { id: string; kind: "decision"; label: string; predicate?: string; status?: FlowStatus }
  | { id: string; kind: "merge"; label?: string }
  | { id: string; kind: "start" | "end"; label?: string };
export interface FlowEdge {
  from: string; to: string;
  kind: "seq" | "parallel" | "conditional" | "loop";
  label?: string;
  taken?: boolean;
}
/** A multi-agent control-flow graph (see docs/multi-agent-flow.md). */
export interface FlowGraph {
  task: string;
  asker?: string;
  nodes: FlowNode[];
  edges: FlowEdge[];
}
export interface MultiAgentFlowProps {
  trace: FlowGraph;
  theme?: ThemeConfig;
  labels?: { agent?: string; toolbox?: string };
  icons?: { brain?: IconConfig; toolbox?: IconConfig };
  brand?: ReactNode;
  /** tail the team timeline to the newest beat as the graph grows */
  live?: boolean;
  /** opt-in UI render metrics (wraps the tree in React's <Profiler>) */
  onRender?: (metric: RenderMetric) => void;
  /** fires on every team beat with the current step (carries `_agent`, `spanId`) */
  onSelect?: (step: Step, index: number) => void;
  /** fires when an agent node is drilled into */
  onNodeOpen?: (node: FlowNode) => void;
  /** return a URL for an agent node → renders an "↗" deep-link on its card */
  linkResolver?: (node: FlowNode) => string | null | undefined;
  /** render extra per-step content in the drilled-in agent's inspector */
  renderDetail?: (step: Step, index: number) => ReactNode;
}
/** Multi-agent control-flow map; agent nodes drill into their AgentThinkingUI. */
export const MultiAgentFlow: FC<MultiAgentFlowProps>;

/* ── BacktrackView — the "why?" board ─────────────────────────────────────
   One decision walked backwards to the piece of context (or code) that
   caused it. A decision point is ANY step under investigation: the final
   answer, a mid-loop tool choice, or a deterministic rule/predicate.
   Framework-agnostic like Trace: agentfootprint's localizeContextBug
   report maps 1:1, but anything that can serialize a causal slice feeds it. */

/** One hop in a suspect's chain of custody. Hops with `content` are
 *  clickable in the rewind player and replay the recorded state. */
export interface BacktrackCustodyHop {
  /** short uppercase-styled stage of the chain — "born" | "landed" | "read" | … */
  step: string;
  detail: string;
  /** runtimeStageId (or other step id) where the hop happened */
  at?: string;
  /** the variable the hop touched */
  variable?: string;
  /** the recorded state at this hop (prompt text, commit payload, code, rule operands) */
  content?: string;
  /** exact substring of `content` to highlight as the culprit span */
  highlight?: string;
}

export interface BacktrackEdge {
  key?: string;
  weight?: number;
  kind?: "data" | "control";
}

export interface BacktrackSuspect {
  kind: "injection" | "tool" | "stage" | "arg" | string;
  flavor?: string;
  name: string;
  text?: string;
  /** influence score 0..1 — a proxy, never a causal claim */
  score: number;
  /** true position in the source report, when the cards shown are a subset */
  rank?: number;
  /** the score is a path-only upper bound (no content signal) — hatched meter, starred value */
  upperBound?: boolean;
  /** the last hop that fed the decision */
  edge?: BacktrackEdge;
  /** the full hop chain back from the decision */
  path?: { key: string; kind?: "data" | "control"; via?: string }[];
  bornAt?: { id: string; label?: string; via?: string };
  custody?: BacktrackCustodyHop[];
  /** ablation outcome — the ONLY tier that makes causal claims */
  verdict?: { kind: "confirmed" | "not-confirmed" | "none"; flips?: number; samples?: number; claim?: string };
}

export interface BacktrackTrace {
  /** the headline question ("approved 47 days late — why?") */
  claim: string;
  /** "causal" = ablation-tested verdicts; "correlational" = ranking only */
  mode: "causal" | "correlational";
  /** override for the mode chip (e.g. "exact chain · proxy ranking") */
  modeLabel?: string;
  agent?: string;
  model?: string;
  answer: { text: string; label?: string; tone?: "error" | "question" };
  /** the decision point under investigation — ANY step: final answer, mid-loop call, rule stage */
  decidedAt: { id: string; label?: string; kind?: "llm" | "rule"; note?: ReactNode };
  suspects: BacktrackSuspect[];
  /** exact recorded hops for deterministic decisions with no ablation verdict */
  trail?: { title?: string; custody?: BacktrackCustodyHop[]; claim?: string };
  /** one line for slice hops not shown as cards */
  folded?: string;
  /** one line under the score meters (margins, tie warnings) */
  scoreNote?: string;
  /** the no-ablation control line */
  baseline?: string;
  /** the report's own claims-discipline lines, verbatim */
  honesty?: string[];
}

export interface BacktrackViewProps {
  trace: BacktrackTrace;
  theme?: ThemeConfig;
  labels?: { agent?: string; toolbox?: string };
  icons?: { brain?: IconConfig; toolbox?: IconConfig };
  brand?: ReactNode;
  /** auto-advance the reveal beats on mount (default true); false starts on the final beat */
  autoPlay?: boolean;
  /** fires when the active beat changes */
  onBeat?: (beat: number, label: string) => void;
}
/** The "why?" board — a decision walked backwards through suspects, scores,
 *  ablation verdicts, and a clickable chain-of-custody rewind player. */
export const BacktrackView: FC<BacktrackViewProps>;

export interface BacktrackOverlayProps extends BacktrackViewProps {
  /** controlled visibility — the host owns it */
  open: boolean;
  /** fires on Escape, the scrim, and the back button */
  onClose?: () => void;
  /** back-button label (default "back") */
  backLabel?: string;
}
/** BacktrackView as a host overlay: centered modal on desktop, full-screen
 *  view with a back button under 640px. Trigger it from any decision point. */
export const BacktrackOverlay: FC<BacktrackOverlayProps>;

export const Stage: FC<any>;
export const Inspector: FC<any>;
export const Notepad: FC<any>;
export const Timeline: FC<any>;
export const ToolIcon: FC<{ name: string }>;

export interface PlaybackState {
  index: number;
  setIndex: (i: number) => void;
  seek: (i: number) => void;
  playing: boolean;
  setPlaying: (p: boolean) => void;
  speed: number;
  setSpeed: (s: number) => void;
}
export function usePlayback(trace: Trace, opts?: { loop?: boolean; live?: boolean; storageKey?: string }): PlaybackState;

/** Options for the trace adapters. */
export interface AdapterOptions {
  asker?: string;
  title?: string;
  task?: string;
  cta?: string;
  /** decide a tool reply's shape (overrides the built-in heuristic) */
  classify?: (toolName: string, attrs: Record<string, unknown>) => {
    replyType: "data" | "instruction" | "both";
    skill?: string;
    actChecklist?: { text: string }[];
    actNote?: string;
  } | undefined;
}
/** OpenTelemetry GenAI (OTLP/JSON or a flat span array) → Trace. */
export function fromOTLP(otlp: unknown, opts?: AdapterOptions): Trace;
/** OpenInference (Arize/Phoenix/LlamaIndex) spans → Trace. */
export function fromOpenInference(otlp: unknown, opts?: AdapterOptions): Trace;
/** OpenTelemetry span tree → a multi-agent FlowGraph (for <MultiAgentFlow>). */
export function fromOTLPMulti(otlp: unknown, opts?: AdapterOptions): FlowGraph;
/** OpenInference span tree → a multi-agent FlowGraph (for <MultiAgentFlow>). */
export function fromOpenInferenceMulti(otlp: unknown, opts?: AdapterOptions): FlowGraph;

/** Push-based monitor for live sources: feed spans, read the updated Trace/FlowGraph. */
export interface Monitor<T> {
  /** append spans (OTLP object or flat array) and return the updated result */
  push(input: unknown): T;
  /** the current Trace (or FlowGraph when `multi`) */
  readonly result: T;
  /** a copy of the accumulated raw spans */
  readonly spans: unknown[];
  /** clear and start over */
  reset(): T;
}
export function createMonitor(opts?: AdapterOptions & { format?: "otel" | "openinference"; reader?: unknown; multi?: false }): Monitor<Trace>;
export function createMonitor(opts: AdapterOptions & { format?: "otel" | "openinference"; reader?: unknown; multi: true }): Monitor<FlowGraph>;

/** Pure layered graph layout (longest-path + barycenter crossing reduction). */
export function layoutFlow(nodes: FlowNode[], edges: FlowEdge[]): { pos: Record<string, { cx: number; cy: number }>; W: number; H: number; bottomY: number };
/** Count edge crossings in a positioned graph. */
export function countCrossings(nodes: FlowNode[], edges: FlowEdge[], pos: Record<string, { cx: number; cy: number }>): number;
