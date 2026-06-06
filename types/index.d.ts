import type { FC, ReactNode } from "react";
import type { Trace } from "./trace";

export * from "./trace";

export interface IconConfig {
  kind: "default" | "emoji" | "image";
  value?: string | null;
}

export interface ThemeConfig {
  colors?: Record<string, string | { base: string; deep?: string; tint?: string }>;
  fonts?: { display?: string; body?: string; mono?: string; hand?: string; scale?: number };
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
}

/** The ready-made container: scene + inspector + notepad + timeline + playback. */
export const AgentThinkingUI: FC<AgentThinkingUIProps>;
/** @deprecated alias of AgentThinkingUI */
export const AgentFootprint: FC<AgentThinkingUIProps>;

export interface SwarmAgent {
  id: string;
  name: string;
  role?: string;
  parent?: string;
  status?: "running" | "done" | "error";
  trace: Trace;
}
export interface MultiTrace {
  task: string;
  asker?: string;
  agents: SwarmAgent[];
  handoffs?: { from: string; to: string; label?: string }[];
}
export interface AgentSwarmProps {
  trace: MultiTrace;
  theme?: ThemeConfig;
  labels?: { agent?: string; toolbox?: string };
  icons?: { brain?: IconConfig; toolbox?: IconConfig };
  brand?: ReactNode;
}
/** Multi-agent overview: agent graph that drills into each agent's AgentThinkingUI. */
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
