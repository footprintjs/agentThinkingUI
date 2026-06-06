# Who debugs the agent?

*A note on why agent UIs matter now — and the narrow, honest claim AgentThinkingUI makes.*

## The builder changed

Until recently, the person who built an agent and the person who could debug it
were the same person: an engineer. That's no longer true. No-/low-code builders —
Lindy, Airtable, Make, Stack AI, MindStudio — now let people in support, ops,
sales, finance and product assemble real agents with branching logic and tool
calls, **without writing code** ([Lindy](https://www.lindy.ai/blog/no-code-ai-agent-builder),
[Airtable](https://www.airtable.com/articles/best-ai-agent-builders)). The domain
expert builds the agent. Good — they're the one who actually knows what "correct"
means for a refund, a triage, a quote.

## The failure changed too

When a hand-written program breaks, you get a stack trace and an engineer reads
it. When an *agent* misbehaves, there usually is no crash — it did something,
just the *wrong* something. The real question is **"which step, which decision,
which tool reply sent it off course?"** That's a judgment failure, not an
exception. A classic example: a tool returns `500`, you blame the database, but
the real culprit was the agent passing a nonsensical argument — *its reasoning*
([Latitude](https://latitude.so/blog/complete-guide-debugging-ai-agents-production)).
There's now even a research taxonomy of agent fault types and root causes
([arXiv 2603.06847](https://arxiv.org/pdf/2603.06847)).

And here's the bind: **the person who can tell whether a decision was right is the
domain expert — but the tools that show the decisions are built for engineers.**
"Domain experts who define correct often aren't doing engineering evaluations," and
without tracing, understanding *why* an agent decided something is hard
([Latitude](https://latitude.so/blog/complete-guide-debugging-ai-agents-production)).

## Why today's tooling doesn't close it

Observability platforms (LangSmith, Langfuse, Arize Phoenix) are excellent — and
unapologetically **developer-facing**: span waterfalls, token meters, eval
dashboards. That's the right altitude for an engineer optimizing latency or cost.
It's the wrong altitude for the support lead asking *"why did it issue the
refund?"* They don't need bytes and spans; they need to **watch the agent think**.

## The claim

AgentThinkingUI makes the agent loop **legible at the altitude of decisions**: a
scrubbable replay where the brain thinks, reaches for a tool, gets back **data**
(reason) or an **instruction / skill** (act), branches, and lands an answer —
errors lit red, the multi-agent hand-offs drawn as a flow. The domain expert can
scrub to the exact beat where the judgment went wrong and *see* it, without
reading a debugger. That's the whole point: **put the "what happened" at a level
the person with the domain understanding can act on.**

When an engineer *is* needed, the same artifact carries them there: a
`linkResolver` deep-links a beat to its span in your observability tool, and
`renderDetail` surfaces the raw log inline. One replay, two audiences — the domain
expert finds *where*, the engineer opens *why*.

## The honest boundaries

This is a **complement** to observability, not a replacement — keep your
dashboards for evals and production monitoring. It needs a **recorded trace**, and
the reasoning it can show is only as rich as what you captured (OTel often drops
the "thinking" — so you [compose the trace](../integrations.md#backfill-what-otel-drops-compose-your-trace)
from your own store, joined by `spanId`). And a visual replay helps a human *spot*
a bad decision; it doesn't *evaluate* correctness at scale — that's still
graded evals and the emerging explainability tooling
([XAgen](https://arxiv.org/pdf/2512.17896)).

## The bet

The people building agents are no longer the people who can read a debugger. The
shortest path from *"the agent did something weird"* to *"there — that step's
reasoning was wrong"* is to **see it think**. That's the gap this library aims at.
