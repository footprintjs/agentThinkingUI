/* A sample MULTI-AGENT run for <AgentSwarm>: a Planner orchestrates three
   workers. Each agent carries its own single-agent Trace (reused verbatim by
   the drill-down view). Swap for your own, or build one with fromOTLPMulti. */
(function () {
  const cost = (ms, t) => ({ ms, tokens: t });
  const ans = (headline) => ({ headline, plan: [], budget: [], cta: "" });

  const planner = {
    id: "planner", name: "Planner", role: "orchestrator", status: "done",
    trace: {
      task: "Plan a 3-day Lisbon offsite for 8, under $5,000", agent: "planner", model: "claude-loop", asker: "John",
      steps: [
        { kind: "prompt", brain: "Break this into flights, lodging, and a budget check — delegate each to a specialist.", cost: cost(420, 300) },
        { kind: "answer", to: "John", brain: "Workers came back under cap. Assembling the plan.", answer: ans("Lisbon offsite — $3,704 of $5,000"), cost: cost(510, 360) },
      ],
    },
  };
  const flights = {
    id: "flights", name: "Flights agent", role: "travel", parent: "planner", status: "done",
    trace: {
      task: "Find 8 round-trip flights SFO→LIS under the travel cap", agent: "flights", model: "claude-loop", asker: "Planner",
      steps: [
        { kind: "prompt", brain: "Need 8 seats SFO→LIS; price weekend vs midweek.", cost: cost(300, 180) },
        { kind: "ask", tool: "search_flights", toolName: "Flight search", input: { from: "SFO", to: "LIS", pax: 8 }, brain: "Pricing options.", cost: cost(280, 120) },
        { kind: "return", tool: "search_flights", toolName: "Flight search", replyType: "data", output: { best: 286, window: "midweek" }, brainMode: "reason", brain: "Midweek $286pp → $2,288 for 8. Under cap.", cost: cost(940, 470) },
        { kind: "answer", to: "Planner", brain: "Locked midweek flights, $2,288.", answer: ans("Flights — TAP midweek, $2,288"), cost: cost(300, 200) },
      ],
    },
  };
  const hotels = {
    id: "hotels", name: "Hotels agent", role: "lodging", parent: "planner", status: "done",
    trace: {
      task: "Find a 4-star hotel, 4 rooms × 3 nights, under $1,500", agent: "hotels", model: "claude-loop", asker: "Planner",
      steps: [
        { kind: "prompt", brain: "4 rooms, 3 nights, central, ≤ $125/night.", cost: cost(280, 160) },
        { kind: "ask", tool: "search_hotels", toolName: "Hotel search", input: { city: "Lisbon", rooms: 4, nights: 3 }, brain: "Searching central 4-star.", cost: cost(300, 126) },
        { kind: "return", tool: "search_hotels", toolName: "Hotel search", replyType: "data", output: { pick: "Hotel Baixa", per_night: 118 }, brainMode: "reason", brain: "Hotel Baixa $118/nt → $1,416. Under cap.", cost: cost(980, 480) },
        { kind: "answer", to: "Planner", brain: "Held Hotel Baixa, $1,416.", answer: ans("Hotel — Baixa, $1,416"), cost: cost(300, 190) },
      ],
    },
  };
  const approvals = {
    id: "approvals", name: "Approvals agent", role: "policy", parent: "planner", status: "done",
    trace: {
      task: "Confirm the spend respects the approval policy", agent: "approvals", model: "claude-loop", asker: "Planner",
      steps: [
        { kind: "prompt", brain: "Total is $3,704 — check sign-off rules.", cost: cost(240, 120) },
        { kind: "ask", tool: "load_skill", toolName: "Approval policy", input: { name: "approval_policy" }, brain: "Loading the approval rules.", cost: cost(220, 90) },
        { kind: "return", tool: "load_skill", toolName: "Approval policy", replyType: "instruction", skill: "approval_policy (who signs off)", actChecklist: [{ text: "$3,704 > $3,000 → needs sign-off" }, { text: "CC finance" }], brainMode: "act", brain: "Over $3,000 → route for sign-off.", cost: cost(320, 190) },
        { kind: "answer", to: "Planner", brain: "Needs one approval; attached a 24h hold.", answer: ans("Policy — sign-off required"), cost: cost(300, 180) },
      ],
    },
  };

  window.AGENT_SWARM = {
    task: "Plan a 3-day team offsite in Lisbon for 8 people, under $5,000",
    asker: "John",
    agents: [planner, flights, hotels, approvals],
    handoffs: [
      { from: "planner", to: "flights", label: "find flights" },
      { from: "planner", to: "hotels", label: "book hotel" },
      { from: "planner", to: "approvals", label: "check budget" },
    ],
  };
})();
