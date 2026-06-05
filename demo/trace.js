/* AgentFootprint — example recorded trace.
 * Each tool interaction is TWO beats:
 *   ask    → the LLM brain CALLS a tool (request out to the toolbox)
 *   return → the tool GIVES BACK a reply. The reply is either:
 *              data        → the brain REASONS about what to do next
 *              instruction → the brain ACTS, following a skill / steering doc
 * Scrub the loop like time-travel; every beat is its own step.
 */
window.AGENT_TRACE = {
  agent: "offsite-planner",
  model: "claude-loop",
  task: "Plan a 3-day team offsite in Lisbon for 8 people. Keep it under $5,000.",
  asker: "Priya, Ops",
  steps: [
    {
      kind: "prompt",
      title: "Task received",
      brain:
        "Okay — 8 people, Lisbon, 3 days, hard cap of $5,000. I need flights, lodging, and a budget I can defend. Start with the biggest cost: flights.",
      cost: { ms: 420, tokens: 318 },
    },

    // ---- flights (1st try) ----
    {
      kind: "ask", tool: "search_flights", toolName: "Flight search",
      input: { from: "SFO", to: "LIS", pax: 8, dates: "Sep 12–15" },
      brain: "Calling search_flights to price the weekend dates.",
      cost: { ms: 280, tokens: 124 },
    },
    {
      kind: "return", tool: "search_flights", toolName: "Flight search", replyType: "data",
      output: { best: { airline: "TAP Air", price_pp: 418, stops: 1 }, cheapest_window: "midweek" },
      brainMode: "reason",
      brain:
        "Best weekend fare is $418pp → $3,344 for 8. That eats 67% of the whole budget and leaves only $1,656 for lodging + food. Too tight. I shouldn't freestyle this — load the budget rules.",
      cost: { ms: 1010, tokens: 522 },
    },

    // ---- budget guardrail skill ----
    {
      kind: "ask", tool: "load_skill",
      input: { name: "budget_guardrail" },
      brain: "Loading the budget_guardrail policy before I spend anything.",
      cost: { ms: 240, tokens: 92 },
    },
    {
      kind: "return", tool: "load_skill", replyType: "instruction", skill: "budget_guardrail",
      output: { steps: [
        "Cap travel at 55% of total budget.",
        "Cap lodging at 30%.",
        "Reserve 15% for food + activities.",
        "If over: adjust dates → airline → hotel star, in that order.",
      ] },
      brainMode: "act",
      actChecklist: [
        { text: "Travel cap = 55% × $5,000 = $2,750" },
        { text: "Current flights $3,344 > cap" },
        { text: "Rule 4 → adjust DATES first" },
      ],
      brain:
        "Following budget_guardrail. No judgment call here — the policy is explicit. Travel cap is $2,750, flights are over, so the rule says re-search with cheaper dates.",
      cost: { ms: 360, tokens: 214 },
    },

    // ---- flights (retry, midweek) ----
    {
      kind: "ask", tool: "search_flights", toolName: "Flight search",
      input: { from: "SFO", to: "LIS", pax: 8, dates: "Sep 16–19 (Tue–Fri)" },
      brain: "Re-calling search_flights with midweek dates.",
      cost: { ms: 280, tokens: 120 },
    },
    {
      kind: "return", tool: "search_flights", toolName: "Flight search", replyType: "data",
      output: { best: { airline: "TAP Air", price_pp: 286, stops: 1 } },
      brainMode: "reason",
      brain:
        "Midweek drops the fare to $286pp → $2,288 for 8. Under the $2,750 cap with room to spare. Lock it. Next: lodging, with a $1,500 cap (30%).",
      cost: { ms: 940, tokens: 476 },
    },

    // ---- hotels ----
    {
      kind: "ask", tool: "search_hotels", toolName: "Hotel search",
      input: { city: "Lisbon", checkin: "Sep 16", nights: 3, rooms: 4, max_per_night: 125 },
      brain: "Calling search_hotels — 4-star or better, under $125/night.",
      cost: { ms: 300, tokens: 126 },
    },
    {
      kind: "return", tool: "search_hotels", toolName: "Hotel search", replyType: "data",
      output: { pick: { name: "Hotel Baixa", stars: 4, per_night: 118, rooms: 4 } },
      brainMode: "reason",
      brain:
        "Hotel Baixa: 4-star, central, $118/night. 4 rooms × 3 nights = $1,416 — just under the $1,500 cap. Good pick. Book a hold before the rate moves.",
      cost: { ms: 980, tokens: 488 },
    },

    // ---- hold ----
    {
      kind: "ask", tool: "book_hold", toolName: "Booking hold",
      input: { flights: "TAP Sep16–19", hotel: "Hotel Baixa ×4" },
      brain: "Placing a 24-hour hold on flights + rooms.",
      cost: { ms: 300, tokens: 118 },
    },
    {
      kind: "return", tool: "book_hold", toolName: "Booking hold", replyType: "both",
      output: { hold_id: "LX-9F2", expires_in: "24h", total: 3704, flag: "over_approval_limit" },
      skill: "approval_policy",
      actChecklist: [
        { text: "$3,704 > $3,000 → needs sign-off" },
        { text: "Attach 24h expiry to request" },
        { text: "CC finance on the hold" },
      ],
      brain:
        "Held everything for 24h — $3,704 of $5,000, so $1,296 of headroom. Comfortable.",
      actNote:
        "The reply ALSO carried a policy. No deliberation on that half — approval_policy says anything over $3,000 needs sign-off, so I just follow it.",
      cost: { ms: 720, tokens: 360 },
    },

    // ---- itinerary format skill ----
    {
      kind: "ask", tool: "load_skill",
      input: { name: "itinerary_format" },
      brain: "Loading itinerary_format so the answer matches the house style.",
      cost: { ms: 240, tokens: 90 },
    },
    {
      kind: "return", tool: "load_skill", replyType: "instruction", skill: "itinerary_format",
      output: { steps: [
        "Lead with a day-by-day plan.",
        "Then a budget breakdown table.",
        "End with one clear Approve action.",
        "Tone: concise + friendly.",
      ] },
      brainMode: "act",
      actChecklist: [
        { text: "Build day-by-day (Sep 16–19)" },
        { text: "Assemble budget table" },
        { text: "Add single Approve CTA" },
      ],
      brain:
        "Applying itinerary_format. Nothing to decide — just shaping the answer to the house style: plan, then budget, then one Approve button.",
      cost: { ms: 340, tokens: 182 },
    },

    // ---- answer ----
    {
      kind: "answer", to: "Priya, Ops",
      brain:
        "Done. Plan fits the cap with $1,296 of headroom and a 24h hold so Priya can approve before anything expires.",
      answer: {
        headline: "Lisbon offsite — Sep 16–19, 8 people, $3,704 of $5,000",
        plan: [
          "Tue · Arrive, check in at Hotel Baixa, welcome dinner in Alfama",
          "Wed · Morning workshop, afternoon at the coast (Cascais)",
          "Thu · Build day + team dinner, river-view rooftop",
          "Fri · Wrap-up brunch, depart",
        ],
        budget: [
          ["Flights (TAP, midweek)", "$2,288"],
          ["Hotel Baixa — 4 rooms × 3 nts", "$1,416"],
          ["Food + activities (held back)", "$1,296"],
          ["Total committed", "$3,704 / $5,000"],
        ],
        cta: "Approve & confirm hold LX-9F2",
      },
      cost: { ms: 510, tokens: 358 },
    },
  ],
};
