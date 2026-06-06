# Data, or instruction?

*Why AgentThinkingUI models an agent as a **brain and a tool**, and labels every
reply as **data** or **instruction**. The design bet behind the picture.*

## Strip it down: a brain and a tool

Behind every framework's vocabulary — chains, nodes, graphs, handoffs — the loop
is the same shape a person uses to solve a problem: you **think**, you realize
you're missing something, you **reach for a tool** (a search, a lookup, an API
call), and you keep going until you can answer. AgentThinkingUI models exactly
that and nothing more: an **LLM brain** and the **tools** it reaches for, drawn as
a brain that reaches across to a toolbox and gets a reply back.

The minimalism is the point. It maps onto how people already reason, so a
non-engineer can follow it — and it's the smallest model that still tells the
whole story. Everything richer (multi-agent, branches, loops) is built from this
one beat.

## The non-obvious part: not every reply is the same *kind* of thing

Here's the distinction the entire UI is built around. When a tool replies, what
comes back is one of:

- **data** — facts the brain has to *reason over*: a search hit, a DB row, an API
  payload. The brain has to interpret it and decide what it means.
- **instruction** — a rule / skill / policy / steering doc that tells the brain
  *how to act*. The brain doesn't deliberate; it follows.
- **both** — a reply that carries data *and* an instruction at once.

It's the same human move: sometimes you look something up and have to *think* about
it; sometimes you're handed the rule and just *do* it.

## Why label it — that's where content drives the decision

This is the bet. The failures that matter are semantic
(see [Who debugs the agent?](who-debugs-the-agent.md)), and **which kind of reply
it was changes what "wrong" even means:**

- if it was **data** → *did the brain reason over it correctly?*
- if it was an **instruction** → *did it apply the right rule, and follow it?*

Collapse both into "tool output" and you hide exactly the thing a reviewer needs to
judge. So AgentThinkingUI gives them a different colour and a different posture —
**data → reason**, **instruction → act** — so you can see at a glance *which
content steered the decision, and how.* That's the UX choice in one sentence:
**surface the moment a reply's content turns into a decision.**

## It's our layer, not the protocol's

This distinction isn't in OpenTelemetry or OpenInference — they record "a tool
returned X." So it's a semantic layer the library adds: each tool reply is
classified — by a `classify(toolName, attrs)` hook, opt-in
`agentthinkingui.reply_type` span attributes, or a heuristic
(skill/steering/policy/guardrail → instruction). You decide; the picture follows.
If your system already knows which tools are policy/skill calls vs data fetches,
that's the cleanest source — wire it through `classify`.

## The bet

An agent is a brain and a tool, and the moment that decides the outcome is usually
*what a tool handed back and how the brain took it.* Name that — **data to reason
over, or an instruction to follow** — and an opaque transcript becomes a story a
person can read.
