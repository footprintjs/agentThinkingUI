import React from "react";
import { AgentThinkingUI } from "./footprint.jsx";
import { AgentThemeContext } from "./context.js";
import * as AgentTheme from "./theme.js";

const { useState, useMemo } = React;

/* ============================================================
   AgentThinkingUI — <AgentSwarm> (multi-agent overview)
   A team of agents as a graph: each agent is a card (node), each
   handoff/call is an edge. Click a card to DRILL DOWN into that
   agent's own <AgentThinkingUI> flow — the single-agent player is
   reused unchanged as the detail view.

   trace: {
     task, asker,
     agents: [{ id, name, role?, parent?, status?, trace: Trace }],
     handoffs?: [{ from, to, label? }]   // defaults to parent links
   }
   ============================================================ */
export function AgentSwarm({ trace, theme, labels, icons, brand }) {
  const [sel, setSel] = useState(null);
  const resolved = useMemo(() => AgentTheme.normalize({ theme, labels, icons }), [theme, labels, icons]);
  const vars = useMemo(() => AgentTheme.toVars(resolved), [resolved]);
  const agents = trace.agents || [];
  const byId = useMemo(() => Object.fromEntries(agents.map((a) => [a.id, a])), [agents]);

  // depth = how far down the parent chain → column index
  const layout = useMemo(() => {
    const COLW = 250, ROWH = 128, PADX = 40, PADY = 32, CW = 196, CH = 98;
    const depthOf = (a) => { let d = 0, x = a; const seen = new Set(); while (x && x.parent && byId[x.parent] && !seen.has(x.id)) { seen.add(x.id); x = byId[x.parent]; d++; } return d; };
    const cols = {};
    agents.forEach((a) => { const d = depthOf(a); (cols[d] = cols[d] || []).push(a); });
    const nCols = Math.max(1, Object.keys(cols).length);
    const maxRows = Math.max(1, ...Object.values(cols).map((c) => c.length));
    const pos = {};
    Object.entries(cols).forEach(([d, list]) => {
      const off = ((maxRows - list.length) * ROWH) / 2;
      list.forEach((a, i) => { pos[a.id] = { x: PADX + Number(d) * COLW, y: PADY + off + i * ROWH }; });
    });
    return { pos, W: PADX * 2 + (nCols - 1) * COLW + CW, H: PADY * 2 + (maxRows - 1) * ROWH + CH, CW, CH };
  }, [agents, byId]);

  const edges = (trace.handoffs && trace.handoffs.length)
    ? trace.handoffs
    : agents.filter((a) => a.parent && byId[a.parent]).map((a) => ({ from: a.parent, to: a.id }));
  const center = (id) => ({ cx: layout.pos[id].x + layout.CW / 2, cy: layout.pos[id].y + layout.CH / 2 });
  const statusClass = (s) => (s === "error" ? "k-prompt" : s === "running" ? "k-call" : "k-answer");

  // ---- drilled-down detail: the existing single-agent player ----
  if (sel && byId[sel]) {
    const a = byId[sel];
    return (
      <div className="app-swarm" style={vars}>
        <div className="swarm-bar">
          <button className="swarm-back" onClick={() => setSel(null)}>‹ Team</button>
          <span className="swarm-crumb">{trace.task}</span>
          <span className="swarm-sep">/</span>
          <b className="swarm-here">{a.name}</b>
          {a.role && <span className="swarm-role">{a.role}</span>}
        </div>
        <div className="swarm-detail">
          <AgentThinkingUI trace={a.trace} theme={theme} labels={labels} icons={icons} />
        </div>
      </div>
    );
  }

  // ---- the team map ----
  return (
    <AgentThemeContext.Provider value={resolved}>
      <div className="app-swarm" style={vars}>
        <div className="swarm-bar">
          {brand && <div className="brand-name swarm-brand">{brand}</div>}
          <span className="swarm-task"><span className="rec" /><span className="lbl">team</span> {trace.task}</span>
        </div>
        <div className="swarm-wrap">
          <div className="swarm-canvas" style={{ width: layout.W, height: layout.H }}>
            <svg className="swarm-edges" width={layout.W} height={layout.H} aria-hidden="true">
              {edges.map((e, i) => {
                if (!layout.pos[e.from] || !layout.pos[e.to]) return null;
                const a = center(e.from), b = center(e.to), mx = (a.cx + b.cx) / 2;
                const ang = Math.atan2(b.cy - a.cy, b.cx - mx) * 180 / Math.PI;
                return (
                  <g key={i}>
                    <path className="swarm-edge flow" d={`M ${a.cx} ${a.cy} C ${mx} ${a.cy} ${mx} ${b.cy} ${b.cx - 10} ${b.cy}`} fill="none" />
                    <polygon className="swarm-edge-head" points="-9,-5 2,0 -9,5" transform={`translate(${b.cx - 8} ${b.cy}) rotate(${ang})`} />
                    {e.label && <text className="swarm-edge-label" x={mx} y={(a.cy + b.cy) / 2 - 7} textAnchor="middle">{e.label}</text>}
                  </g>
                );
              })}
            </svg>
            {agents.map((a) => {
              const p = layout.pos[a.id];
              const steps = (a.trace.steps || []).length;
              const tok = (a.trace.steps || []).reduce((s, x) => s + ((x.cost && x.cost.tokens) || 0), 0);
              return (
                <button key={a.id} className={"agent-card " + statusClass(a.status)} style={{ left: p.x, top: p.y, width: layout.CW }} onClick={() => setSel(a.id)} title={"Open " + a.name}>
                  <span className="ac-status" />
                  <div className="ac-name">{a.name}</div>
                  {a.role && <div className="ac-role">{a.role}</div>}
                  <div className="ac-meta">{steps} steps · {tok.toLocaleString()} tok</div>
                  <span className="ac-drill">open ›</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </AgentThemeContext.Provider>
  );
}
