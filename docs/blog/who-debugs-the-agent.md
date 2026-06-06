# Who debugs the agent?

*The developer ships it — but some failures only a domain expert can see, and they
shouldn't have to read JSON to find them. That's the gap this library is for.*

## Three kinds of failure

In enterprise app development, **developers build the agents.** And for two of the
three ways an agent goes wrong, the developer is exactly the right person, with the
right tools:

- **Infra** — a timeout, an auth error, a rate limit, a `500`. Logs and traces.
  Developer territory.
- **Business logic** — the wrong tool wired up, a bad branch, a malformed
  argument, a broken handoff. Code and JSON spans. Developer territory.
- **Semantic / content** — the run is *clean*. Every span is green, no error, no
  stack trace — and the answer is still **wrong for the domain**: it cited the
  wrong clause, misread the policy, reasoned plausibly but incorrectly about *your*
  content. Nothing in the trace looks broken. **Only the person who knows the
  domain can tell it's wrong.**

This isn't hand-waving — there's now a research taxonomy of agentic fault types and
root causes ([arXiv 2603.06847](https://arxiv.org/pdf/2603.06847)), and a recurring
finding in the debugging literature: *"domain experts who define correct often
aren't doing engineering evaluations"*
([Latitude](https://latitude.so/blog/complete-guide-debugging-ai-agents-production)).

## The mismatch

The semantic failure is the one your developer **can't** catch — they don't know
whether clause 7(b) was the right one to cite, or whether "approve" was the correct
call for this customer. And the domain expert who *does* know is handed… a JSON
trace, a span waterfall, a debugger. Tooling built for the two failure classes that
*weren't* the problem. So the one person who can find the real bug is locked out by
the interface.

Observability platforms (LangSmith, Langfuse, Arize Phoenix) are excellent at the
developer's two classes — and unapologetically developer-facing. They're not the
place a compliance officer or a clinician or a claims lead reviews *meaning*.

## The claim

AgentThinkingUI gives the domain expert a way to **engage with the run at the
semantic level** — watch the agent think, see which **data** it reasoned over,
which **instruction / skill** it followed, where it branched, what it concluded —
and point at the beat and say *"there: that's the wrong reading."* It's the same run
the developer has, rendered legible to the person who owns the definition of
*correct*. The domain expert triages the **content**; the developer keeps the JSON
for infra and logic.

And the two roles share one artifact. When a semantic miss turns out to be a logic
or infra bug after all, `linkResolver` jumps from a beat straight to its span in
your observability tool, and `renderDetail` shows the raw payload inline — handing
it back to the developer. The domain expert finds *what's wrong in meaning*; the
developer fixes *what's wrong in the plumbing*.

## Honest boundaries

A complement, not a replacement — keep your traces and evals; this doesn't monitor
production or grade outputs at scale. It needs a recorded run, and the reasoning it
can show is only as rich as what you captured (OTel frequently omits the thinking,
so you [compose the trace](../integrations.md#backfill-what-otel-drops-compose-your-trace)
from your own store, joined by `spanId`). A visual replay helps a human *spot* a
wrong reading; turning that judgment into regression tests is still evals' job, and
explainability tooling is an active research direction
([XAgen](https://arxiv.org/pdf/2512.17896)).

## The bet

Developers can already triage what they can see. The failures that hurt are the
ones that look perfectly fine in JSON and are only wrong in *meaning* — and the
person who can see the meaning shouldn't have to read JSON to find it. That's the
seam AgentThinkingUI is built for.
