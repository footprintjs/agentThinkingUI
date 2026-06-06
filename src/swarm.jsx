import React from "react";
import { AgentThinkingUI } from "./footprint.jsx";
import { BrainGlyph } from "./stage.jsx";
import { Timeline } from "./timeline.jsx";
import { usePlayback } from "./playback.js";
import { AgentThemeContext } from "./context.js";
import * as AgentTheme from "./theme.js";

const { useState, useMemo } = React;

// one team-journal line per beat (agent-prefixed), reusing the notepad styles
function SwarmNote({ s, n, active }) {
  const k = s.kind === "return" ? s.replyType : s.kind;
  const accent = k === "data" ? "k-data" : k === "instruction" ? "k-instr" : k === "both" ? "k-both" : k === "ask" ? "k-call" : k === "answer" ? "k-answer" : "k-prompt";
  const note = s.kind === "answer" ? (s.answer && s.answer.headline) : s.brain;
  return (
    <div className={"note " + accent + (active ? " active" : "")}>
      <span className="note-dot" />
      <div className="note-nb">
        <div className="note-head"><span className="note-n">{String(n + 1).padStart(2, "0")}</span><span className="note-title">{s._name} · {s.kind}</span></div>
        <div className="note-text">{note}</div>
      </div>
    </div>
  );
}

/* ============================================================
   AgentThinkingUI — <AgentSwarm> (multi-agent control-flow map)
   Renders a team as a control-flow graph and drills into each agent's
   single-agent <AgentThinkingUI>. Takes a FlowGraph:
     nodes: { id, kind:"agent"|"decision"|"merge"|"start"|"end", name?, role?,
              status?, predicate?/label?, trace? }
     edges: { from, to, kind:"seq"|"parallel"|"conditional"|"loop", label?, taken? }
   The four edge kinds compose into any pattern: Sequence/Parallel/Conditional/Loop.
   See docs/multi-agent-flow.md.
   ============================================================ */

const DIM = { agent: { w: 204, h: 112 }, decision: { w: 108, h: 108 }, merge: { w: 132, h: 46 }, start: { w: 96, h: 40 }, end: { w: 96, h: 40 } };
const dimOf = (n) => DIM[n.kind] || DIM.agent;

// Count edge crossings within a positioned graph: two edges cross when their
// endpoints share the same source column and same target column but flip
// vertical order between the two. Pure + exported for tests.
export function countCrossings(nodes, edges, pos) {
  const es = edges.filter((e) => e.kind !== "loop" && pos[e.from] && pos[e.to]);
  let total = 0;
  for (let i = 0; i < es.length; i++) {
    for (let j = i + 1; j < es.length; j++) {
      const f1 = pos[es[i].from], t1 = pos[es[i].to], f2 = pos[es[j].from], t2 = pos[es[j].to];
      if (f1.cx === f2.cx && t1.cx === t2.cx && f1.cx !== t1.cx && (f1.cy - f2.cy) * (t1.cy - t2.cy) < 0) total += 1;
    }
  }
  return total;
}

// Layered ("Sugiyama-style") layout in three classic phases:
//   1. LAYER — column = longest path from a source (Kahn topological sweep over
//      the forward DAG; loop edges are excluded, drawn later as back-arcs).
//   2. ORDER — reduce edge crossings by the barycenter heuristic: repeatedly
//      reorder each layer by the mean position of its neighbours in the adjacent
//      layer (down-sweep by predecessors, up-sweep by successors), keeping the
//      best-scoring ordering.
//   3. PLACE — assign x by column, y by row (each column centred vertically).
// Layering is O(V + E) (adjacency list + index-pointer queue, no O(n) shift);
// ordering is a small constant number of sweeps.
export function layoutFlow(nodes, edges) {
  const COLW = 248, ROWH = 132, PADX = 44, PADY = 40;
  const id2 = Object.fromEntries(nodes.map((n) => [n.id, n]));
  const fwd = edges.filter((e) => e.kind !== "loop" && id2[e.from] && id2[e.to]);

  // adjacency (successors + predecessors) + in-degrees, built once
  const out = {}, inn = {}, indeg = {};
  nodes.forEach((n) => { out[n.id] = []; inn[n.id] = []; indeg[n.id] = 0; });
  fwd.forEach((e) => { out[e.from].push(e.to); inn[e.to].push(e.from); indeg[e.to] += 1; });

  // 1) LAYER — longest-path columns. Kahn yields a topological order, so when a
  // node is dequeued every predecessor's column is final → max() is exact.
  const col = {}; nodes.forEach((n) => (col[n.id] = 0));
  const deg = { ...indeg };
  const q = nodes.filter((n) => !indeg[n.id]).map((n) => n.id); // sources
  for (let h = 0; h < q.length; h++) {        // pointer, not shift() → O(V)
    const u = q[h];
    for (const v of out[u]) {
      if (col[u] + 1 > col[v]) col[v] = col[u] + 1;
      if (--deg[v] === 0) q.push(v);
    }
  }
  // (a node trapped in a forward cycle is never dequeued and keeps column 0 — no
  // crash; well-formed graphs tag cycles as `loop` edges so `fwd` stays acyclic.)
  const nCols = nodes.reduce((m, n) => Math.max(m, col[n.id] + 1), 1);
  let layers = Array.from({ length: nCols }, () => []);
  nodes.forEach((n) => layers[col[n.id]].push(n.id)); // initial = insertion order

  // 2) ORDER — barycenter crossing reduction
  const indexOf = (layer) => { const m = {}; layer.forEach((id, i) => (m[id] = i)); return m; };
  const order = (layer, ref, neigh) => {                 // sort by mean neighbour row
    const cur = indexOf(layer), key = {};
    layer.forEach((id) => {
      const ns = neigh[id].filter((x) => x in ref);
      key[id] = ns.length ? ns.reduce((s, x) => s + ref[x], 0) / ns.length : cur[id]; // no neighbours → stay put
    });
    return [...layer].sort((a, b) => (key[a] - key[b]) || (cur[a] - cur[b]));
  };
  const crossings = (ls) => {
    let total = 0;
    for (let c = 0; c < ls.length - 1; c++) {
      const ri = indexOf(ls[c]), rj = indexOf(ls[c + 1]);
      const es = fwd.filter((e) => col[e.from] === c && col[e.to] === c + 1).map((e) => [ri[e.from], rj[e.to]]);
      for (let i = 0; i < es.length; i++) for (let k = i + 1; k < es.length; k++) {
        if ((es[i][0] - es[k][0]) * (es[i][1] - es[k][1]) < 0) total += 1;
      }
    }
    return total;
  };
  let best = layers.map((l) => l.slice()), bestX = crossings(layers);
  for (let sweep = 0; sweep < 4 && bestX > 0; sweep++) {
    for (let c = 1; c < nCols; c++) layers[c] = order(layers[c], indexOf(layers[c - 1]), inn);     // down
    for (let c = nCols - 2; c >= 0; c--) layers[c] = order(layers[c], indexOf(layers[c + 1]), out); // up
    const x = crossings(layers);
    if (x < bestX) { bestX = x; best = layers.map((l) => l.slice()); }
  }
  layers = best;

  // 3) PLACE
  const maxRows = Math.max(1, ...layers.map((l) => l.length));
  const pos = {};
  layers.forEach((list, c) => {
    const off = ((maxRows - list.length) * ROWH) / 2;
    list.forEach((id, i) => { pos[id] = { cx: PADX + c * COLW + DIM.agent.w / 2, cy: PADY + off + i * ROWH + ROWH / 2 }; });
  });
  return { pos, W: PADX * 2 + (nCols - 1) * COLW + DIM.agent.w, H: PADY * 2 + maxRows * ROWH, bottomY: PADY * 2 + maxRows * ROWH - 18 };
}

export function AgentSwarm({ trace, theme, labels, icons, brand, live }) {
  const [sel, setSel] = useState(null);
  const resolved = useMemo(() => AgentTheme.normalize({ theme, labels, icons }), [theme, labels, icons]);
  const vars = useMemo(() => AgentTheme.toVars(resolved), [resolved]);
  const nodes = useMemo(() => (trace.nodes || []).map((n) => ({ kind: "agent", ...n })), [trace]);
  const edges = trace.edges || [];
  const task = trace.task;
  const byId = useMemo(() => Object.fromEntries(nodes.map((n) => [n.id, n])), [nodes]);
  const { pos, W, H, bottomY } = useMemo(() => layoutFlow(nodes, edges), [nodes, edges]);

  // which conditional groups have a taken branch (so the rest dim)
  const groupHasTaken = useMemo(() => {
    const g = {}; edges.forEach((e) => { if (e.kind === "conditional" && e.taken) g[e.from] = true; }); return g;
  }, [edges]);

  const [npOpen, setNpOpen] = useState(true);
  // a TEAM trace: every agent's beats interleaved in flow order (column, then row),
  // so the swarm map is itself scrubbable — time-travel + commentary across the team.
  const { teamSteps, ranges } = useMemo(() => {
    const ags = nodes.filter((n) => (!n.kind || n.kind === "agent") && n.trace && pos[n.id])
      .sort((a, b) => (pos[a.id].cx - pos[b.id].cx) || (pos[a.id].cy - pos[b.id].cy));
    const steps = []; const r = {};
    ags.forEach((a) => { r[a.id] = { start: steps.length }; (a.trace.steps || []).forEach((s) => steps.push({ ...s, _agent: a.id, _name: a.name })); r[a.id].end = steps.length - 1; });
    return { teamSteps: steps, ranges: r };
  }, [nodes, pos]);
  const teamTrace = useMemo(() => ({ task, agent: "team", model: "", asker: "", steps: teamSteps.length ? teamSteps : [{ kind: "prompt", brain: "", cost: { ms: 0, tokens: 0 } }] }), [teamSteps, task]);
  const play = usePlayback(teamTrace, { storageKey: "agentthinkingui.swarm:" + (task || "default"), live });
  const idx = Math.min(play.index, teamTrace.steps.length - 1);
  const cur = teamSteps[idx];
  const phaseOf = (id) => { const rr = ranges[id]; if (!rr) return "done"; if (idx < rr.start) return "future"; if (idx > rr.end) return "done"; return "current"; };

  if (sel && byId[sel] && byId[sel].trace) {
    const a = byId[sel];
    return (
      <div className="atui-swarm" style={vars}>
        <div className="swarm-bar swarm-detailbar">
          <button className="swarm-back" onClick={() => setSel(null)}>‹ Back to team</button>
          <span className="swarm-bc">
            <button className="swarm-bc-team" onClick={() => setSel(null)}>Team</button>
            <span className="swarm-sep">›</span>
            <b className="swarm-here">{a.name}</b>
            {a.role && <span className="swarm-role">{a.role}</span>}
          </span>
          <span className="swarm-bc-task">{task}</span>
        </div>
        <div className="swarm-detail"><AgentThinkingUI trace={a.trace} theme={theme} labels={labels} icons={icons} /></div>
      </div>
    );
  }

  const anchor = (n, side) => {
    const p = pos[n.id], d = dimOf(n);
    if (side === "r") return { x: p.cx + d.w / 2, y: p.cy };
    if (side === "l") return { x: p.cx - d.w / 2, y: p.cy };
    return { x: p.cx, y: p.cy + d.h / 2 }; // bottom
  };

  return (
    <AgentThemeContext.Provider value={resolved}>
      <div className="atui-swarm" style={vars} onKeyDown={play.onKeyDown}>
        <div className="swarm-bar">
          {brand && <div className="brand-name swarm-brand">{brand}</div>}
          <span className="swarm-task"><span className="rec" /><span className="lbl">flow</span> {task}</span>
          <span className="swarm-spacer" />
          <button className="swarm-np-toggle" onClick={() => setNpOpen((o) => !o)}>{npOpen ? "Hide notepad" : "Notepad"}</button>
        </div>
        <div className="swarm-body">
        <div className="swarm-main">
        <div className="swarm-wrap">
          <div className="swarm-canvas" style={{ width: W, height: H }}>
            <svg className="swarm-edges" width={W} height={H} aria-hidden="true">
              {edges.map((e, i) => {
                if (!pos[e.from] || !pos[e.to]) return null;
                const loop = e.kind === "loop" || pos[e.to].cx <= pos[e.from].cx;
                const dim = e.kind === "conditional" && groupHasTaken[e.from] && !e.taken;
                let d, hx, hy, hang;
                if (loop) {
                  const a = anchor(byId[e.from], "b"), b = anchor(byId[e.to], "b");
                  d = `M ${a.x} ${a.y} C ${a.x} ${bottomY} ${b.x} ${bottomY} ${b.x} ${b.y}`;
                  hx = b.x; hy = b.y; hang = -90; // arrow comes up into the target's bottom
                } else {
                  const a = anchor(byId[e.from], "r"), b = anchor(byId[e.to], "l");
                  const mx = (a.x + b.x) / 2;
                  d = `M ${a.x} ${a.y} C ${mx} ${a.y} ${mx} ${b.y} ${b.x - 9} ${b.y}`;
                  hx = b.x - 7; hy = b.y; hang = Math.atan2(b.y - a.y, b.x - mx) * 180 / Math.PI;
                }
                const cls = "swarm-edge" + (e.kind === "loop" || loop ? " loop" : " flow") + (e.taken ? " taken" : "") + (dim ? " dim" : "");
                const lx = loop ? (anchor(byId[e.from], "b").x + anchor(byId[e.to], "b").x) / 2 : (pos[e.from].cx + pos[e.to].cx) / 2;
                const ly = loop ? bottomY - 6 : (pos[e.from].cy + pos[e.to].cy) / 2 - 7;
                return (
                  <g key={i} className={dim ? "is-dim" : ""}>
                    <path className={cls} d={d} fill="none" />
                    <polygon className={"swarm-edge-head" + (e.taken ? " taken" : "") + (dim ? " dim" : "")} points="-9,-5 2,0 -9,5" transform={`translate(${hx} ${hy}) rotate(${hang})`} />
                    {e.label && <text className="swarm-edge-label" x={lx} y={ly} textAnchor="middle">{e.label}</text>}
                  </g>
                );
              })}
            </svg>

            {nodes.map((n) => {
              const p = pos[n.id], d = dimOf(n);
              if (!p) return null; // defensive: a malformed/duplicate id never crashes the map
              const st = { left: p.cx - d.w / 2, top: p.cy - d.h / 2, width: d.w, height: d.h };
              if (n.kind === "decision") return (
                <div key={n.id} className="flow-decision" style={st}><span>{n.label || n.predicate || "?"}</span></div>
              );
              if (n.kind === "merge") return (<div key={n.id} className="flow-merge" style={st}>{n.label || "merge"}</div>);
              if (n.kind === "start" || n.kind === "end") return (<div key={n.id} className={"flow-cap " + n.kind} style={st}>{n.label || n.kind}</div>);
              const steps = (n.trace && n.trace.steps || []).length;
              const tok = (n.trace && n.trace.steps || []).reduce((s, x) => s + ((x.cost && x.cost.tokens) || 0), 0);
              const ph = phaseOf(n.id);
              const k = ph === "current" ? "k-call current" : ph === "future" ? "k-answer future" : "k-answer";
              return (
                <button key={n.id} className={"agent-card " + k} style={st} onClick={() => n.trace && setSel(n.id)} title={n.trace ? "Open " + n.name : n.name}>
                  <span className="ac-status" />
                  <div className="ac-head2">
                    <div className="ac-avatar"><BrainGlyph icon={n.icon} mode={n.status === "running" ? "act" : "reason"} /></div>
                    <div className="ac-id">
                      <div className="ac-name">{n.name}</div>
                      {n.role && <div className="ac-role">{n.role}</div>}
                    </div>
                  </div>
                  <div className="ac-meta">{steps} steps · {tok.toLocaleString()} tok</div>
                  {n.trace && <span className="ac-drill">open ›</span>}
                </button>
              );
            })}
          </div>
        </div>
        {cur && (
          <div className="swarm-commentary"><b>{cur._name || "—"}</b><span className="sc-sep">·</span><span>{cur.kind === "answer" ? (cur.answer && cur.answer.headline) : cur.brain}</span></div>
        )}
        <Timeline trace={teamTrace} index={idx} setIndex={play.seek} playing={play.playing} setPlaying={play.setPlaying} speed={play.speed} setSpeed={play.setSpeed} />
        </div>
        {npOpen && (
          <div className="swarm-notepad">
            <div className="swarm-np-head">Team notepad</div>
            <div className="insp-body note-list">{teamSteps.slice(0, idx + 1).map((s, i) => <SwarmNote key={i} s={s} n={i} active={i === idx} />)}</div>
          </div>
        )}
        </div>
      </div>
    </AgentThemeContext.Provider>
  );
}
