/* ============================================================
   AgentFootprint — THEME
   Drop the player into any app's brand. Define window.AGENT_THEME
   BEFORE this script to override any token; anything you omit falls
   back to the defaults below (which are exactly the built-in look).

   Three SEPARATE object configs (define any before this script loads):
     window.AGENT_THEME       = { colors, fonts }      // visual tokens
     window.AGENT_DISPLAY_NAME = { agent, toolbox }     // display names
     window.AGENT_ICONS       = { brain, toolbox }      // each {kind:'default'|'emoji'|'image', value}
   Anything omitted falls back to the built-in defaults below.

   A color may be a single hex (deep/tint are derived) or a full
   { base, deep, tint } triad for exact control.
   ============================================================ */
(function () {
  const DEFAULTS = {
    colors: {
      paper:       "#FBF6EC",
      ink:         "#2C1F15",
      brand:       { base: "#C0531F", deep: "#95380F", tint: "#F6E4D6" }, // the brain / agent
      call:        { base: "#A8906E", deep: "#6E5942", tint: "#ECE2D3" }, // tool call (ask)
      data:        { base: "#0E8A82", deep: "#0A6660", tint: "#DCF0ED" }, // data → reason
      instruction: { base: "#C98512", deep: "#9A6306", tint: "#F8EBCC" }, // instruction → act
      answer:      { base: "#3E9B4F", deep: "#2C7339", tint: "#DEEFDD" }, // final answer
      brainFrom:   "#E68A52",
      brainTo:     "#C0531F",
    },
    fonts: {
      display: '"Bricolage Grotesque", system-ui, sans-serif',
      body:    '"Hanken Grotesque", system-ui, sans-serif',
      mono:    '"Space Mono", ui-monospace, monospace',
      hand:    '"Caveat", cursive',
    },
    displayName: { agent: "LLM as Human Brain", toolbox: "toolbox" },
    icons: {
      brain:   { kind: "default", value: null },   // 'default' | 'emoji' | 'image'
      toolbox: { kind: "default", value: null },
    },
  };

  const hexToRgb = (h) => { h = h.replace("#", ""); if (h.length === 3) h = h.split("").map((c) => c + c).join(""); const n = parseInt(h, 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
  const toHex = (r, g, b) => "#" + [r, g, b].map((x) => Math.max(0, Math.min(255, Math.round(x))).toString(16).padStart(2, "0")).join("");
  const darken = (hex, a) => { const [r, g, b] = hexToRgb(hex); return toHex(r * (1 - a), g * (1 - a), b * (1 - a)); };
  const tintOf = (hex) => { const [r, g, b] = hexToRgb(hex); const m = 0.86; return toHex(r + (255 - r) * m, g + (255 - g) * m, b + (255 - b) * m); };

  function triad(v, fallback) {
    if (v == null) return fallback;
    if (typeof v === "string") return { base: v, deep: darken(v, 0.28), tint: tintOf(v) };
    const base = v.base || fallback.base;
    return { base, deep: v.deep || darken(base, 0.28), tint: v.tint || tintOf(base) };
  }

  const T = window.AGENT_THEME || {};
  const dc = DEFAULTS.colors, tc = T.colors || {};
  const colors = {
    paper: tc.paper || dc.paper,
    ink:   tc.ink   || dc.ink,
    brand:       triad(tc.brand, dc.brand),
    call:        triad(tc.call, dc.call),
    data:        triad(tc.data, dc.data),
    instruction: triad(tc.instruction, dc.instruction),
    answer:      triad(tc.answer, dc.answer),
    brainFrom: tc.brainFrom || (tc.brand ? triad(tc.brand, dc.brand).base : dc.brainFrom),
    brainTo:   tc.brainTo   || (tc.brand ? triad(tc.brand, dc.brand).deep : dc.brainTo),
  };
  const fonts = Object.assign({}, DEFAULTS.fonts, T.fonts);
  // display names + icons are SEPARATE object configs from the visual theme
  const displayName = Object.assign({}, DEFAULTS.displayName, T.displayName, T.labels, window.AGENT_DISPLAY_NAME, window.AGENT_LABELS);
  const AI = window.AGENT_ICONS || {}, TI = T.icons || {};
  const icons = {
    brain:   Object.assign({}, DEFAULTS.icons.brain,   T.brain, TI.brain, AI.brain),     // T.brain = back-compat
    toolbox: Object.assign({}, DEFAULTS.icons.toolbox, TI.toolbox, AI.toolbox),
  };

  const root = document.documentElement;
  const S = (k, v) => root.style.setProperty(k, v);
  S("--paper", colors.paper); S("--ink", colors.ink);
  S("--rust", colors.brand.base);   S("--rust-deep", colors.brand.deep);   S("--rust-tint", colors.brand.tint);
  S("--data", colors.data.base);    S("--data-deep", colors.data.deep);    S("--data-tint", colors.data.tint);
  S("--instr", colors.instruction.base); S("--instr-deep", colors.instruction.deep); S("--instr-tint", colors.instruction.tint);
  S("--answer", colors.answer.base); S("--answer-deep", colors.answer.deep); S("--answer-tint", colors.answer.tint);
  S("--call", colors.call.base);    S("--call-deep", colors.call.deep);    S("--call-tint", colors.call.tint);
  S("--brain-from", colors.brainFrom); S("--brain-to", colors.brainTo);
  S("--font-display", fonts.display); S("--font-body", fonts.body); S("--font-mono", fonts.mono); S("--font-hand", fonts.hand);

  // resolved config, read by the renderer
  window.AGENT_THEME_RESOLVED = { colors, fonts, displayName, icons };
})();
