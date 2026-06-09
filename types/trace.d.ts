/**
 * AgentThinkingUI — the trace contract.
 *
 * A trace describes the *shape* of an agent loop, not any one framework. Record
 * your run into this and the player replays it. The mental model: the LLM brain
 * thinks, asks a tool, and the reply is one of three shapes — `data` (reason),
 * an `instruction` (a skill / steering doc that says how to act), or `both` —
 * looping until the `answer`.
 */

export interface Trace {
  /** the task the agent was given */
  task: string;
  /** optional short label shown in the "replay" pill (falls back to `task`) */
  title?: string;
  /** the agent's id/name */
  agent: string;
  /** the model driving the loop */
  model: string;
  /** who asked (shown on the answer) */
  asker: string;
  steps: Step[];
}

export interface Cost {
  /** wall-clock latency for the step, in milliseconds */
  ms: number;
  /** total tokens (input + output); kept as the headline number */
  tokens: number;
  /** prompt / input tokens (for cost attribution) */
  tokensIn?: number;
  /** completion / output tokens */
  tokensOut?: number;
  /** cache-read (cached prompt) tokens — for cache-hit visibility */
  tokensCached?: number;
}

/** What a tool reply carries — the heart of the model. */
export type ReplyType = "data" | "instruction" | "both";

/** data → reason over facts; instruction → act on a skill/steering doc. */
export type BrainMode = "reason" | "act";

export interface ChecklistItem {
  text: string;
}

/** The final answer payload. Free-form beyond `headline`; the demo uses plan/budget/cta. */
export interface Answer {
  headline: string;
  plan?: string[];
  /** rows of [label, value] */
  budget?: [string, string][];
  /** call-to-action label */
  cta?: string;
  [key: string]: unknown;
}

/** The task comes in. */
export interface PromptStep {
  kind: "prompt";
  brain: string;
  cost: Cost;
  /** source span id / trace id (set by the adapters — for deep-linking back to your trace store) */
  spanId?: string;
  traceId?: string;
}

/** A tool the model had at its disposal for a call — the menu it chose from. */
export interface ToolSeen {
  name: string;
  description?: string;
}

/** The brain reaches for a tool. */
export interface AskStep {
  kind: "ask";
  tool: string;
  toolName?: string;
  input: Record<string, unknown>;
  brain: string;
  cost: Cost;
  /** Model's extended-thinking chain-of-thought for this iteration. */
  thinking?: string;
  /** The tools the model saw (name + description) for this call — expandable in
   *  the inspector to debug tool selection. On the iteration's first ask. */
  toolsSeen?: ToolSeen[];
  spanId?: string;
  traceId?: string;
}

/** The tool replies — `data`, `instruction` (skill/steering), or `both`. */
export interface ReturnStep {
  kind: "return";
  tool: string;
  toolName?: string;
  replyType: ReplyType;
  output: Record<string, unknown>;
  brain: string;
  cost: Cost;
  /** data → "reason", instruction → "act" */
  brainMode?: BrainMode;
  /** the skill / steering doc name (for instruction / both) */
  skill?: string;
  /** the steps the brain will act on (for instruction / both) */
  actChecklist?: ChecklistItem[];
  /** the "acts on the instruction" note (mixed `both` case) */
  actNote?: string;
  /** set when the tool span errored (status ERROR / exception event) */
  error?: string;
  spanId?: string;
  traceId?: string;
}

/** The loop ends in the answer (or a failure). */
export interface AnswerStep {
  kind: "answer";
  to: string;
  brain: string;
  answer: Answer;
  spanId?: string;
  traceId?: string;
  cost: Cost;
  /** set when the agent run errored */
  error?: string;
  /** Model's extended-thinking chain-of-thought before the final answer. */
  thinking?: string;
  /** The tools the model saw (name + description) for the final call. */
  toolsSeen?: ToolSeen[];
}

export type Step = PromptStep | AskStep | ReturnStep | AnswerStep;
