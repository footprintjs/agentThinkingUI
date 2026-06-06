# Data, or instruction?

*AgentThinkingUI mimics how a person actually thinks — in a **loop**, over **facts**
and **rules** — because that's what makes an agent's run relatable. The data /
instruction model falls straight out of it.*

## How a person solves a hard problem

You don't solve it in one shot. You **think** with what you have, hit a gap, go
**get** something, fold it in, and **loop** — each pass getting a little closer to
an answer. And the thing you reach for is one of two kinds:

- a **fact** — you have to *reason* about what it means and what to do next, or
- a **rule** — you don't deliberate, you just *follow* it.

A claims adjuster pulls the policy *facts*, then applies the *rule* for this case.
A doctor reads the labs (facts) and follows the protocol (rule). That loop —
think → fetch a fact or a rule → fold it in → loop → answer — is what human
problem-solving actually feels like.

## We mimic that on purpose

AgentThinkingUI models an agent as nothing more than that: an **LLM brain** that
loops, **reaching for tools**, until it can answer. The minimalism isn't
laziness — it's **relatability.** Mapped onto how people already think, the run
reads like watching someone work a problem, so the person who owns the domain (not
just the engineer) can follow it. That's why it's a brain and a toolbox, and why
the beats are *got the task → reach → a reply comes back → loop → answer*.

## So a reply is a fact, or a rule

Carry the human loop into the model and the key distinction is obvious — when a
tool replies, what comes back is:

- **data** — a *fact* to reason over (a search hit, a DB row, an API payload), or
- **instruction** — a *rule* / skill / policy that says how to act, or
- **both** — a reply carrying a fact *and* a rule at once.

Same two kinds the human reaches for; same two postures — **data → reason**,
**instruction → act**.

## Why label it — that's where content drives the decision

This is the design bet. The failures that matter are semantic
(see [Who debugs the agent?](who-debugs-the-agent.md)), and *which kind of reply it
was* changes what "wrong" means:

- if it was **data** → *did the brain reason over the fact correctly?*
- if it was an **instruction** → *did it apply the right rule, and follow it?*

Collapse both into "tool output" and you hide the exact thing a reviewer must judge.
So the UI gives each a distinct colour and posture, so you can see at a glance
*which content steered the decision, and how* — the moment a reply turns into a
choice.

## It's our layer, not the protocol's

This distinction isn't in OpenTelemetry or OpenInference — they record "a tool
returned X." So it's a semantic layer the library adds: each reply is classified —
a `classify(toolName, attrs)` hook, opt-in `agentthinkingui.reply_type` span
attributes, or a heuristic (skill/steering/policy/guardrail → instruction). If your
system already knows which tools are policy/skill calls vs data fetches, wire that
through `classify` — it's the cleanest source.

## The bet

People solve problems by looping over facts and rules until they can answer. Model
an agent the same way — a brain, a tool, and every reply named **data to reason
over or an instruction to follow** — and an opaque transcript becomes a story a
person can read.
