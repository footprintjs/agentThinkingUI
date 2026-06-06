/* ============================================================
   AgentThinkingUI — FLOW LAYOUT (pure)
   Layered ("Sugiyama-style") graph layout for <AgentSwarm>. No React, no DOM —
   given nodes + edges it returns positions, so the algorithm can be tested and
   benchmarked in isolation (see scripts/perf.mjs). Kept separate from the React
   component exactly like layout.js is for the single-agent scene.
   ============================================================ */

// node box sizes per kind (used for anchors + column width)
export const DIM = { agent: { w: 204, h: 112 }, decision: { w: 108, h: 108 }, merge: { w: 132, h: 46 }, start: { w: 96, h: 40 }, end: { w: 96, h: 40 } };
export const dimOf = (n) => DIM[n.kind] || DIM.agent;

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
