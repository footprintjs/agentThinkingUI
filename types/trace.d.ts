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
  ms: number;
  tokens: number;
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
}

/** The brain reaches for a tool. */
export interface AskStep {
  kind: "ask";
  tool: string;
  toolName?: string;
  input: Record<string, unknown>;
  brain: string;
  cost: Cost;
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
}

/** The loop ends in the answer (or a failure). */
export interface AnswerStep {
  kind: "answer";
  to: string;
  brain: string;
  answer: Answer;
  cost: Cost;
  /** set when the agent run errored */
  error?: string;
}

export type Step = PromptStep | AskStep | ReturnStep | AnswerStep;
