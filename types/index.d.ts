import type { FC, ReactNode } from "react";
import type { Trace } from "./trace";

export * from "./trace";

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
  /** agent count (AgentSwarm only) */
  agents?: number;
}

/** The ready-made container: scene + inspector + notepad + timeline + playback. */
export const AgentThinkingUI: FC<AgentThinkingUIProps>;
/** @deprecated alias of AgentThinkingUI */
export const AgentFootprint: FC<AgentThinkingUIProps>;

export type FlowStatus = "idle" | "running" | "done" | "error";
export type FlowNode =
  | { id: string; kind?: "agent"; name: string; role?: string; status?: FlowStatus; icon?: IconConfig; trace: Trace }
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
export interface AgentSwarmProps {
  trace: FlowGraph;
  theme?: ThemeConfig;
  labels?: { agent?: string; toolbox?: string };
  icons?: { brain?: IconConfig; toolbox?: IconConfig };
  brand?: ReactNode;
  /** tail the team timeline to the newest beat as the graph grows */
  live?: boolean;
  /** opt-in UI render metrics (wraps the tree in React's <Profiler>) */
  onRender?: (metric: RenderMetric) => void;
}
/** Multi-agent control-flow map; agent nodes drill into their AgentThinkingUI. */
export const AgentSwarm: FC<AgentSwarmProps>;

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
/** OpenTelemetry span tree → a multi-agent FlowGraph (for <AgentSwarm>). */
export function fromOTLPMulti(otlp: unknown, opts?: AdapterOptions): FlowGraph;
/** OpenInference span tree → a multi-agent FlowGraph (for <AgentSwarm>). */
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
