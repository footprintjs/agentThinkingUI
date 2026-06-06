# Multi-agent & control-flow — design (DRAFT, for review)

Status: **proposal — not yet built.** Phase 1 (`<AgentSwarm>`: agents + handoffs +
drill-down) already shipped. This doc specifies the evolution into a general
**control-flow graph** so the map can render *any* multi-agent topology.

## Why
Real agent systems aren't a flat list of agents — they have control flow. The
[footprintjs/agentfootprint] framework reduces all of it to **four composable
primitives**, and every famous pattern is a composition of them. If `<AgentSwarm>`
can draw the four primitives, it can draw **any** flow — it becomes a flowchart of
the run where each agent node drills into its single-agent `<AgentThinkingUI>`.

The four primitives:
1. **Sequence** — linear chain `A → B → C`
2. **Parallel** — fan-out then fan-in across N agents
3. **Conditional** — a diamond gate routes to one of N branches by predicate
4. **Loop** — body cycles back from end to start until a condition

## The model: `FlowGraph` (nodes + typed edges)
A superset of today's `{ agents, handoffs }`; that shape stays valid (it's the
seq/parallel subset).

```ts
type FlowGraph = {
  task: string;
  asker?: string;
  nodes: FlowNode[];
  edges: FlowEdge[];
};

type FlowNode =
  | { id: string; kind: "agent"; name: string; role?: string; status?: Status; trace: Trace }
  | { id: string; kind: "decision"; label: string; predicate?: string; status?: Status } // diamond
  | { id: string; kind: "merge"; label?: string }      // fan-in / join
  | { id: string; kind: "start" | "end"; label?: string };

type FlowEdge = {
  from: string; to: string;
  kind: "seq" | "parallel" | "conditional" | "loop";
  label?: string;     // predicate branch ("intent == billing"), or loop "until satisfied / ×3"
  taken?: boolean;    // for conditional: which branch actually fired (highlight)
};

type Status = "idle" | "running" | "done" | "error";
```

- **agent** nodes carry a full `Trace` → click to drill into the single-agent player
  (unchanged). **decision/merge/start/end** are control nodes (no `Trace`).
- Backward-compat: a `{ agents:[{id,name,role,parent,trace}], handoffs:[{from,to,label}] }`
  is mapped to `nodes` (all `kind:"agent"`) + `edges` (`kind:"seq"`).

## The four primitives → how each renders

```
Sequence            Parallel                 Conditional               Loop
                              ┌▶[B]┐                    ┌▶[B] (taken)
[A]─▶[B]─▶[C]        [A]─▶<>──┼▶[C]┼─▶(merge)   [A]─▶◇──┤                 [A]─▶[B]
                              └▶[D]┘            decision └▶[C]            ▲      │
                            fan-out  fan-in       (predicate)            └──────┘
                                                                      loop "until done / ×N"
```

- **Sequence** — agent cards left→right, single `seq` edges. *(works today)*
- **Parallel** — one `parallel` fan-out to N agents, then converging edges into a
  **merge** node. *(fan-out works today; needs the merge node)*
- **Conditional** — a **decision** diamond with N `conditional` out-edges, each
  labeled by its predicate; the `taken` branch is highlighted, others dimmed.
- **Loop** — a `loop` edge drawn as a **curved back-arrow** (dashed) from the body's
  end to its start, labeled with the until-condition / iteration count. Back-edges
  are excluded from the forward layout so they never tangle it.

## The six named patterns (all compositions)
| Pattern | Composition | New pieces it exercises |
|---|---|---|
| Hierarchical | `planner → Sequence(worker×N) → synth` | seq + merge |
| Debate | `Parallel(pro, con) → judge` | parallel + merge |
| Router | `Conditional → A \| B \| C` | decision |
| Reflexion | `Loop( Agent → Conditional(critique) → Agent )` | loop + decision |
| Swarm | `Loop( Parallel(Agent×N) → merge )` | loop + parallel + merge |
| Tree-of-Thoughts | `Loop( Parallel(Agent×N) → Conditional(score) )` | all four |

If the four primitives render, these six (and arbitrary nestings) fall out for free.

## Layout
- **Forward DAG, left→right.** Assign each node a column = longest path from a
  start; stack nodes within a column; route `seq`/`parallel`/`conditional` edges as
  curves between card centers (as Phase 1 already does).
- **Loops are back-edges:** any edge whose `to` sits at an equal/earlier column is
  drawn as a curved arc *outside* the column flow (dashed, labeled), so the forward
  layout stays a clean DAG.
- Decision = diamond; merge = small join pill; agents = the Phase-1 cards.

## Drill-down, live, theming (unchanged from Phase 1)
- Click an **agent** node → its `<AgentThinkingUI>` (breadcrumb back to the map).
- **Live:** the host grows `nodes`/`edges` as the run unfolds; `taken` flips on
  conditionals; status dots animate; the open drill-down tails its agent.
- Theme normalized + scoped on the swarm element, shared via context.

## Mapping in
- **OTel / OpenInference span tree** (`fromOTLPMulti`, Phase 2): each `invoke_agent`
  span → an agent node; parent/child → `seq`/`parallel` edges; a tool that returns a
  routing decision → a `decision` node (heuristic / `agentthinkingui.*` annotation).
- **agentfootprint** runs map 1:1 — its `Sequence`/`Parallel`/`Conditional`/`Loop`
  primitives are these edge kinds; its named patterns are the compositions above.

## Open questions
1. Do we need explicit `start`/`end` nodes, or infer them (roots / leaves)?
2. Conditional: show **all** branches dimmed with the `taken` one lit (recommended),
   or only the taken branch?
3. Loops: show **iteration count** (`×3`) and/or let the drill-down step through
   each iteration?
4. How much auto-layout vs. accepting author-provided positions for complex graphs?

## Phasing
- **2a** — `FlowGraph` model + decision/merge nodes + conditional/loop edges + DAG
  layout; a demo rendering all six named patterns. (backward-compatible)
- **2b** — `fromOTLPMulti`: build a `FlowGraph` from a real OTel span tree.
- **2c** — live flow (nodes/edges/`taken` update as the run streams).

[footprintjs/agentfootprint]: https://github.com/footprintjs/agentfootprint
