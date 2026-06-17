/* AgentThinkingUI — example recorded traces.
 * Each tool interaction is TWO beats:
 *   ask    → the LLM brain CALLS a tool (request out to the toolbox)
 *   return → the tool GIVES BACK a reply. The reply is either:
 *              data        → the brain REASONS about what to do next
 *              instruction → the brain ACTS, following a skill / steering doc
 *              both        → data AND an instruction at once
 * Scrub the loop like time-travel; every beat is its own step.
 *
 * window.AGENT_TRACES holds a few relatable scenarios; the gear in the demo
 * switches between them. window.AGENT_TRACE stays as the default (back-compat).
 */
// the tool menu this agent had on every call (name + description) — surfaces as
// the "saw N, picked 1" row under each tool card. The picked tool differs per
// step; the menu stays the same set the model chose from.
const SAW = [
  { name: "search_flights", description: "Find flights between two cities for a set of dates" },
  { name: "search_hotels", description: "Find hotels in a city for a date range" },
  { name: "book_hold", description: "Place a 24h hold on a flight or room" },
  { name: "load_skill", description: "Load a steering doc (e.g. budget rules) before committing" },
];

window.AGENT_TRACES = {
  // ───────────────────────── 1 · plan a team offsite ─────────────────────────
  offsite: {
    agent: "offsite-planner",
    model: "claude-loop",
    title: "Lisbon offsite",
    task: "Plan a 3-day team offsite in Lisbon for 8 people. Keep it under $5,000.",
    asker: "John",
    steps: [
      { kind: "prompt", title: "Task received",
        brain: "Okay — 8 people, Lisbon, 3 days, and I can't go over $5,000. I need flights, a hotel, and a budget I can defend. Start with the biggest cost: flights.",
        cost: { ms: 420, tokens: 318 } },

      { kind: "ask", tool: "search_flights", toolName: "Flight search",
        input: { from: "SFO", to: "LIS", pax: 8, dates: "Sep 12–15" },
        brain: "Pricing the weekend dates with the flight search.",
        toolsSeen: SAW,
        cost: { ms: 280, tokens: 124 } },
      { kind: "return", tool: "search_flights", toolName: "Flight search", replyType: "data",
        output: { best: { airline: "TAP Air", price_pp: 418, stops: 1 }, cheapest_window: "midweek" },
        brainMode: "reason",
        brain: "Best weekend fare is $418 per person → $3,344 for eight. That's two-thirds of the whole budget and leaves only $1,656 for the hotel and food. Too tight. I shouldn't wing this — let me load the budget rules.",
        cost: { ms: 1010, tokens: 522 } },

      { kind: "ask", tool: "load_skill", input: { name: "budget_guardrail" },
        brain: "Loading the budget rules before I commit to anything.",
        toolsSeen: SAW,
        cost: { ms: 240, tokens: 92 } },
      { kind: "return", tool: "load_skill", replyType: "instruction", skill: "budget_guardrail (stay under budget)",
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
        brain: "Following the budget rules — no judgment call here, the policy is explicit. The travel cap is $2,750, the flights are over it, so the rule says re-search with cheaper dates.",
        cost: { ms: 360, tokens: 214 } },

      { kind: "ask", tool: "search_flights", toolName: "Flight search",
        input: { from: "SFO", to: "LIS", pax: 8, dates: "Sep 16–19 (Tue–Fri)" },
        brain: "Searching again with midweek dates.",
        toolsSeen: SAW,
        cost: { ms: 280, tokens: 120 } },
      { kind: "return", tool: "search_flights", toolName: "Flight search", replyType: "data",
        output: { best: { airline: "TAP Air", price_pp: 286, stops: 1 } },
        brainMode: "reason",
        brain: "Midweek drops the fare to $286 per person → $2,288 for eight. Comfortably under the $2,750 cap. Lock it in. Next: the hotel, capped at $1,500 (30%).",
        cost: { ms: 940, tokens: 476 } },

      { kind: "ask", tool: "search_hotels", toolName: "Hotel search",
        input: { city: "Lisbon", checkin: "Sep 16", nights: 3, rooms: 4, max_per_night: 125 },
        brain: "Looking for a 4-star hotel under $125 a night.",
        toolsSeen: SAW,
        cost: { ms: 300, tokens: 126 } },
      { kind: "return", tool: "search_hotels", toolName: "Hotel search", replyType: "data",
        output: { pick: { name: "Hotel Baixa", stars: 4, per_night: 118, rooms: 4 } },
        brainMode: "reason",
        brain: "Hotel Baixa — 4-star, central, $118 a night. 4 rooms × 3 nights = $1,416, just under the $1,500 cap. Good pick. Hold it before the rate moves.",
        cost: { ms: 980, tokens: 488 } },

      { kind: "ask", tool: "book_hold", toolName: "Booking hold",
        input: { flights: "TAP Sep16–19", hotel: "Hotel Baixa ×4" },
        brain: "Placing a 24-hour hold on the flights and rooms.",
        toolsSeen: SAW,
        cost: { ms: 300, tokens: 118 } },
      { kind: "return", tool: "book_hold", toolName: "Booking hold", replyType: "both",
        output: { hold_id: "LX-9F2", expires_in: "24h", total: 3704, flag: "over_approval_limit" },
        skill: "approval_policy (who signs off)",
        actChecklist: [
          { text: "$3,704 > $3,000 → needs sign-off" },
          { text: "Attach 24h expiry to request" },
          { text: "CC finance on the hold" },
        ],
        brain: "Held everything for 24 hours — $3,704 of $5,000, so $1,296 to spare. Comfortable.",
        actNote: "The reply ALSO carried a policy. Nothing to weigh on that half — the approval rules say anything over $3,000 needs sign-off, so I just follow it.",
        cost: { ms: 720, tokens: 360 } },

      { kind: "ask", tool: "load_skill", input: { name: "itinerary_format" },
        brain: "Loading the write-up style so the answer looks right.",
        cost: { ms: 240, tokens: 90 } },
      { kind: "return", tool: "load_skill", replyType: "instruction", skill: "itinerary_format (how to write it up)",
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
        brain: "Applying the write-up style — nothing to decide, just shaping the answer: the plan, then the budget, then one Approve button.",
        cost: { ms: 340, tokens: 182 } },

      { kind: "answer", to: "John",
        brain: "Done. The plan fits with $1,296 to spare, and there's a 24-hour hold so John can approve before anything expires.",
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
        cost: { ms: 510, tokens: 358 } },
    ],
  },

  // ───────────────────────── 2 · customer support triage ─────────────────────
  support: {
    agent: "support-agent",
    model: "claude-loop",
    title: "Refund request",
    task: "A customer wants a refund on order #8842. Decide what to do.",
    asker: "Sam",
    steps: [
      { kind: "prompt", title: "Ticket opened",
        brain: "A refund request came in for order #8842. Before I promise anything, I need the order details and the refund rules.",
        cost: { ms: 360, tokens: 240 } },

      { kind: "ask", tool: "lookup_order", toolName: "Order lookup",
        input: { order: "#8842" },
        brain: "Pulling up the order.",
        cost: { ms: 260, tokens: 110 } },
      { kind: "return", tool: "lookup_order", toolName: "Order lookup", replyType: "data",
        output: { item: "Wireless headphones", price: 79, delivered: true, days_since: 12 },
        brainMode: "reason",
        brain: "Order #8842 — $79 headphones, delivered 12 days ago. That feels refundable, but I don't decide refunds by gut. Load the refund policy.",
        cost: { ms: 820, tokens: 430 } },

      { kind: "ask", tool: "load_skill", input: { name: "refund_policy" },
        brain: "Loading the refund rules.",
        cost: { ms: 220, tokens: 88 } },
      { kind: "return", tool: "load_skill", replyType: "instruction", skill: "refund_policy (when refunds are allowed)",
        output: { steps: [
          "Full refund within 14 days of delivery.",
          "15–30 days: store credit only.",
          "Opened & damaged: deduct 10%.",
          "Always apologize first.",
        ] },
        brainMode: "act",
        actChecklist: [
          { text: "Delivered 12 days ago → within 14" },
          { text: "Full refund is allowed" },
          { text: "Confirm item condition first" },
        ],
        brain: "Following the refund rules — they're explicit. 12 days is inside the 14-day window, so a full refund is allowed once I confirm the item's condition.",
        cost: { ms: 320, tokens: 190 } },

      { kind: "ask", tool: "check_return", toolName: "Return check",
        input: { order: "#8842" },
        brain: "Checking the condition of the returned item.",
        cost: { ms: 240, tokens: 96 } },
      { kind: "return", tool: "check_return", toolName: "Return check", replyType: "data",
        output: { received: true, opened: false, damaged: false },
        brainMode: "reason",
        brain: "Item's back, unopened, undamaged — so no deduction. A clean full refund. Issue it and log why.",
        cost: { ms: 700, tokens: 360 } },

      { kind: "ask", tool: "issue_refund", toolName: "Refund",
        input: { order: "#8842", amount: 79, to: "original card" },
        brain: "Issuing the $79 refund to the original card.",
        cost: { ms: 280, tokens: 120 } },
      { kind: "return", tool: "issue_refund", toolName: "Refund", replyType: "both",
        output: { refund_id: "RF-2231", amount: 79, status: "settled" },
        skill: "closeout_policy (wrap up the ticket)",
        actChecklist: [
          { text: "Email Sam the confirmation" },
          { text: "Close ticket #8842" },
          { text: "Tag: refund-approved" },
        ],
        brain: "Refund RF-2231 issued — $79 back to the original card.",
        actNote: "The reply ALSO carried the close-out policy — nothing to weigh, just follow it: email the customer, close the ticket, tag it.",
        cost: { ms: 560, tokens: 300 } },

      { kind: "answer", to: "Sam",
        brain: "Done. Full refund issued within policy, customer notified, ticket closed.",
        answer: {
          headline: "Refund approved — $79 back to the original card",
          plan: [
            "Confirmed the item was returned, unopened",
            "Issued a full refund (within the 14-day window)",
            "Emailed Sam the confirmation",
            "Closed ticket #8842",
          ],
          budget: [
            ["Item", "$79 headphones"],
            ["Refund", "Full — $79"],
            ["Days since delivery", "12 (within 14)"],
            ["Refund id", "RF-2231"],
          ],
          cta: "Send confirmation & close ticket",
        },
        cost: { ms: 460, tokens: 300 } },
    ],
  },

  // ───────────────────────── 3 · book event tickets ──────────────────────────
  tickets: {
    agent: "ticket-agent",
    model: "claude-loop",
    title: "Concert tickets",
    task: "Get 2 tickets to the Coldplay show in Lisbon on Friday, under €200 total.",
    asker: "Alex",
    steps: [
      { kind: "prompt", title: "Task received",
        brain: "Two tickets, Coldplay, Lisbon, Friday, under €200 all-in. Start by seeing what's available.",
        cost: { ms: 380, tokens: 250 } },

      { kind: "ask", tool: "search_tickets", toolName: "Ticket search",
        input: { event: "Coldplay — Lisbon", date: "Fri", qty: 2 },
        brain: "Checking sections and prices.",
        cost: { ms: 270, tokens: 118 } },
      { kind: "return", tool: "search_tickets", toolName: "Ticket search", replyType: "data",
        output: { sections: [{ name: "Floor", price: 140 }, { name: "Tier 2", price: 85 }], available: true },
        brainMode: "reason",
        brain: "Floor is €140 each → €280 for two, over budget. Tier 2 is €85 each → €170. That fits. But before buying, I should check the rules on fees.",
        cost: { ms: 880, tokens: 440 } },

      { kind: "ask", tool: "load_skill", input: { name: "purchase_rules" },
        brain: "Loading the purchase rules.",
        cost: { ms: 220, tokens: 90 } },
      { kind: "return", tool: "load_skill", replyType: "instruction", skill: "purchase_rules (avoid surprise fees)",
        output: { steps: [
          "Always include service fees in the total.",
          "Never exceed the stated budget.",
          "Prefer mobile tickets.",
          "Hold, don't buy, until confirmed.",
        ] },
        brainMode: "act",
        actChecklist: [
          { text: "€170 + fees must stay under €200" },
          { text: "Choose mobile delivery" },
          { text: "Place a hold, not a purchase" },
        ],
        brain: "Following the purchase rules — add the fees to the total and place a hold, not a buy.",
        cost: { ms: 320, tokens: 188 } },

      { kind: "ask", tool: "price_quote", toolName: "Price quote",
        input: { section: "Tier 2", qty: 2 },
        brain: "Getting the all-in price with fees.",
        cost: { ms: 250, tokens: 104 } },
      { kind: "return", tool: "price_quote", toolName: "Price quote", replyType: "data",
        output: { tickets: 170, fees: 18, total: 188 },
        brainMode: "reason",
        brain: "With €18 in fees the total is €188 — still under €200. Good. Place a 10-minute hold.",
        cost: { ms: 700, tokens: 360 } },

      { kind: "ask", tool: "hold_tickets", toolName: "Ticket hold",
        input: { section: "Tier 2", qty: 2 },
        brain: "Holding 2 Tier-2 tickets for 10 minutes.",
        cost: { ms: 280, tokens: 118 } },
      { kind: "return", tool: "hold_tickets", toolName: "Ticket hold", replyType: "both",
        output: { hold_id: "TKT-77C", expires_in: "10 min", total: 188 },
        skill: "mobile_delivery (send to the phone)",
        actChecklist: [
          { text: "Send tickets to the phone wallet" },
          { text: "Text the QR code" },
          { text: "Confirm before the hold expires" },
        ],
        brain: "Held 2 Tier-2 tickets for 10 minutes — €188 total.",
        actNote: "The reply ALSO carried the delivery policy — just follow it: mobile wallet, QR by text, confirm before the hold expires.",
        cost: { ms: 540, tokens: 300 } },

      { kind: "answer", to: "Alex",
        brain: "Done. Two seats together, under budget, held and ready to send to your phone.",
        answer: {
          headline: "2× Coldplay (Tier 2) — €188 of €200",
          plan: [
            "Fri · Doors 7pm, show 8pm",
            "Tier 2, two seats together",
            "Mobile tickets to your wallet",
            "QR code by text before the hold expires",
          ],
          budget: [
            ["2 × Tier 2", "€170"],
            ["Service fees", "€18"],
            ["Total", "€188 / €200"],
            ["Hold id", "TKT-77C (10 min)"],
          ],
          cta: "Confirm & send to phone",
        },
        cost: { ms: 470, tokens: 300 } },
    ],
  },
};

// default scenario (back-compat for anything reading window.AGENT_TRACE)
window.AGENT_TRACE = window.AGENT_TRACES.offsite;
