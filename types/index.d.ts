import type { FC, ReactNode } from "react";
import type { Step, Trace, WhyAttribution } from "./trace.js";

export * from "./trace.js";

export interface IconConfig {
  kind: "default" | "emoji" | "image";
  value?: string | null;
}

/**
 * The built-in agent glyphs for the `agentIcon` prop. `"brain"` is the animated
 * mascot (the default); the rest are stroke icons drawn in the same style as the
 * tool icons, tinted by the theme's brain gradient.
 */
export type AgentIconName = "brain" | "robot" | "sparkle" | "footsteps";

/** the built-in names, in order — e.g. to build a picker */
export const AGENT_ICON_NAMES: AgentIconName[];

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
  /**
   * Who the agent looks like, on stage. A STRING is a built-in name
   * (`"brain"` — the default animated mascot — `"robot"`, `"sparkle"`,
   * `"footsteps"`); anything else is YOUR node, drawn in the agent's place
   * (`agentIcon={<MyLogo/>}`). It wins over `icons.brain` when both are given,
   * and an unrecognised name falls back to the mascot. The thought bubble's
   * tail keeps pointing at whatever stands there. Also accepted by `<Stage>`.
   */
  agentIcon?: AgentIconName | ReactNode;
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
   * Powers the "What drove it" strategy — per-pick attribution: which context
   * (system-prompt rules / the user's request / earlier tool data) best explains
   * a step's pick. OPTIONAL and lazy: if a step already carries `attribution`
   * (stamped upstream, e.g. from agentfootprint's `explainChoice`), the panel
   * renders it for free — leading with the multi-channel verdict card when
   * `channels` is stamped — and never calls this. Wire it only to compute
   * attribution on demand. Return ranked context units by similarity to the
   * chosen tool (optionally with `channels` for the verdict card). A similarity
   * PROXY, not a causal claim.
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

/* ── InfluenceMap — "what influenced this answer, and what happens without it?"
   A product-grade, non-technical surface: the answer at the centre, every
   removable source orbiting it (sized + metered by its influence score), a
   plain-language honesty layer, ignore toggles, and an honest re-run seam.
   Pure UI: the DATA arrives as one plain `map` prop shaped structurally like
   agentfootprint's `removableSources(report)`; atui never imports af. */

/** One hop in a source's evidence path (mirrors af `EdgePathStep`). */
export interface InfluencePathStep {
  fromName: string;
  toName: string;
  kind: "data" | "control";
  /** state key (data hop) or decide() rule label (control hop) */
  key?: string;
}

/** One removable source — a node on the map (mirrors af `RemovableSource`
 *  plus optional evidence pulled from its suspect). */
export interface InfluenceSource {
  /** the id `onRerun` echoes back — the ONLY ids af's rerunWithoutSources accepts */
  id: string;
  kind: "tool" | "injection" | "memory";
  /** the node caption (af `suspectLabel`) */
  label: string;
  /** runtimeStageId — shown small/mono in the detail card */
  source: string;
  stageName: string;
  /** 0..1 proxy score — SIZES + meters the node, never convicts (clamped) */
  score: number;
  /** the recorded content (host pre-truncates) */
  snippet?: string;
  /** the evidence path, rendered in plain words */
  path?: InfluencePathStep[];
}

/** A plain-language honesty flag (mirrors af `HonestyFlag`). */
export interface InfluenceHonestyFlag {
  /** af `HonestyFlagKind` — an open string so future af kinds don't break atui */
  flag: string;
  /** af's own sentence — the fallback copy for an unknown kind */
  note: string;
}

/** The `map` prop — the whole influence map, serialized. */
export interface InfluenceMapData {
  /** the original run's answer (af rerun option `originalAnswer`) */
  answer: string;
  /** the centre-node caption (default "Answer") */
  answerLabel?: string;
  /** an optional header context line */
  question?: string;
  /** af `removableSources(report)` output, ranked order (2–10 typical) */
  sources: InfluenceSource[];
  /** af `ContextBugReport.rankedBy` — lights its tab in the selector */
  rankedBy?: string;
  /** af `ContextBugReport.honestyFlags` → plain chips */
  honestyFlags?: InfluenceHonestyFlag[];
}

/** What `onRerun`'s promise resolves to (af `RerunWithoutSourcesResult`,
 *  serialized). Extra af fields (`removed`/`runs`/`baseline`) may ride along
 *  and are ignored. */
export interface InfluenceRerunResult {
  /** the re-run's answer (seed 0) */
  answer: string;
  /** every seeded re-run's answer — optional in atui (only the count is surfaced) */
  answers?: string[];
  whatChanged: {
    answerFlipped: boolean;
    flips: number;
    samples: number;
    similarityToOriginal: { mean: number; min: number; max: number; stdev: number };
    baselineChecked: boolean;
    /** PRESENTATION ONLY — rendered verbatim, never parsed */
    summary: string;
  };
  /** the causal-tier claim — present ONLY when the host ran `checkBaseline: true` */
  verdict?: {
    verdict: "confirmed" | "not-confirmed" | "inconclusive";
    claim: string;
  };
}

/** A strategy selector item — af `InfluenceStrategy` minus `scorer`, plus a
 *  host-declared `available` flag. */
export interface InfluenceStrategyOption {
  /** kebab id, echoed on `rankedBy` */
  name: string;
  /** tooltip + sub-line */
  description: string;
  /** shown in the unavailable tooltip */
  requirements?: string[];
  /** HOST-DECLARED — the host knows if it has (e.g.) an embedder */
  available: boolean;
}

/** The overridable honesty-copy map (keys = af HonestyFlagKind + atui chips). */
export interface InfluenceCopy {
  "slice-truncated": string;
  "untracked-sources": string;
  "no-control-deps": string;
  "no-read-tracking": string;
  "no-llm-call-ids": string;
  "baseline-unstable": string;
  proxies: string;
  rerunCta: string;
  observedOnly: string;
  verdictConfirmed: string;
  verdictNotConfirmed: string;
  verdictInconclusive: string;
  [key: string]: string;
}

export interface InfluenceMapProps {
  /** the whole map — ONE plain serialized object, like `trace` */
  map: InfluenceMapData;
  /** presentation of the sources (default `"map"`, fully non-breaking):
   *  `"map"` is the radial graph; `"bars"` is a vertical list sorted by score
   *  DESC — each row a labelled score bar with the kind chip, provenance dot,
   *  and inline ignore toggle; the answer becomes a plain header card. Tapping a
   *  row opens the same detail; honesty chips and the re-run seam are identical. */
  view?: "map" | "bars";
  /** how the strategy selector renders (default `"tabs"`): `"tabs"` is the
   *  button row; `"dropdown"` is a native `<select>` with the same greyed +
   *  🔒 + tooltip handling and the chosen strategy's description underneath. */
  strategyControl?: "tabs" | "dropdown";
  /** fired ONLY on the explicit Re-run click (never on mount); the host runs
   *  af's `rerunWithoutSources` and resolves the serialized result. Returning
   *  `undefined` simply shows no result panel. */
  onRerun?: (ignoredSourceIds: string[]) => Promise<InfluenceRerunResult | void> | InfluenceRerunResult | void;
  /** selector items — renders only when non-empty */
  strategies?: InfluenceStrategyOption[];
  /** fired when a strategy tab is clicked; the host re-ranks and swaps `map` */
  onStrategyChange?: (name: string) => void;
  /** which strategy ranked `map`; defaults to `map.rankedBy` */
  activeStrategy?: string;
  /** partial overrides merged over `INFLUENCE_COPY` */
  honestyCopy?: Partial<InfluenceCopy>;
  /** fires alongside the built-in detail card when a source node is tapped */
  onSelectSource?: (source: InfluenceSource) => void;
  theme?: ThemeConfig;
  labels?: { agent?: string; toolbox?: string };
  icons?: { brain?: IconConfig; toolbox?: IconConfig };
  brand?: ReactNode;
}
/** The influence map — the answer, its sources sized by influence, plain-
 *  language honesty, ignore toggles, and an honest re-run seam. */
export const InfluenceMap: FC<InfluenceMapProps>;

export interface InfluenceMapOverlayProps extends InfluenceMapProps {
  /** controlled visibility — the host owns it */
  open: boolean;
  /** fires on Escape, the scrim, and the back button */
  onClose?: () => void;
  /** back-button label (default "back") */
  backLabel?: string;
}
/** InfluenceMap as a host overlay: centered modal on desktop, full-screen
 *  under 640px. */
export const InfluenceMapOverlay: FC<InfluenceMapOverlayProps>;

/** The default honesty-copy map — frozen; override per-instance via `honestyCopy`. */
export const INFLUENCE_COPY: InfluenceCopy;

/** One laid-out node on the influence map. */
export interface InfluenceLayoutNode {
  id: string;
  x: number;
  y: number;
  /** node radius (scales with the clamped score) */
  r: number;
  /** angle in radians (rank 1 at 12 o'clock, clockwise) */
  angle: number;
  /** clamped 0..1 score */
  score: number;
  /** the answer-rim → node-rim edge endpoints */
  edge: { x1: number; y1: number; x2: number; y2: number };
}
export interface InfluenceLayout {
  size: number;
  center: { x: number; y: number };
  nodes: InfluenceLayoutNode[];
}
/** Pure radial layout for the influence map (no React, no DOM). */
export function influenceLayout(
  sources: { id?: string; score?: number }[],
  opts?: Partial<{ size: number; answerR: number; orbit: number; rMin: number; rMax: number }>,
): InfluenceLayout;
/** The default radial-layout constants (frozen). */
export const INFLUENCE_LAYOUT: {
  readonly size: number;
  readonly answerR: number;
  readonly orbit: number;
  readonly rMin: number;
  readonly rMax: number;
};

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

/**
 * Options for {@link fromRecording} — the adapter options plus the two identity
 * facts a recording may not carry (an agent that never named itself, a run with
 * no LLM call to read a model off).
 */
export interface RecordingAdapterOptions extends AdapterOptions {
  /** Override the agent name (default: the run's own `agentId`, else "agent"). */
  agent?: string;
  /** Override the model (default: the first recorded LLM call's, else "unknown"). */
  model?: string;
}

/**
 * An agentfootprint RECORDING → Trace. Accepts the versioned envelope
 * (`format` beginning `agentfootprint.recording.`) or the bare
 * `{ snapshot, events, structure }` inside it; anything else throws a
 * `TypeError` naming what it received and where to go instead.
 *
 * Post-hoc by nature: every sentence it writes is stamped
 * `brainSource: "framework"`, and only the model's own recorded words are
 * `"model"`. Facts the recording does not carry stay ABSENT (no `cost`, no
 * `tokens`) rather than becoming zeroes. For a live run prefer the producer's
 * own `agentThinkingTrace()` recorder, whose narration is the run's own voice.
 */
export function fromRecording(recording: unknown, opts?: RecordingAdapterOptions): Trace;

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
