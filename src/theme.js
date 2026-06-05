/* ============================================================
   AgentFootprint — THEME engine
   Turns a loose theme config into resolved tokens + CSS variables.

   Preferred (reactive, scoped, multi-instance):
     <AgentFootprint theme={...} labels={...} icons={...} />
   The container normalizes the config and applies the variables to its
   OWN element, so two players can wear different brands on one page and
   nothing leaks into the host app.

   Back-compat (zero-build script-tag embeds): define any of these globals
   BEFORE this script and they become the page-level defaults, applied to
   :root at load — exactly as before.
     window.AGENT_THEME        = { colors, fonts }   // visual tokens
     window.AGENT_DISPLAY_NAME = { agent, toolbox }  // display names
     window.AGENT_ICONS        = { brain, toolbox }  // {kind:'default'|'emoji'|'image', value}

   Public API (window.AgentTheme):
     normalize(opts) -> resolved { colors, fonts, displayName, icons }
     toVars(resolved) -> { '--data': '#…', … }   (a CSS-custom-property map)
     apply(targetEl, opts) -> resolved            (normalizes + writes the vars)

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
      scale:   1,   // multiplies every text size so the player matches the host's density
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

  // Resolve a loose config into concrete tokens. Each input falls back to the
  // matching window.AGENT_* global, then to the built-in defaults — so passing
  // nothing reproduces the original load-time behaviour exactly.
  function normalize(opts) {
    opts = opts || {};
    const T = opts.theme || window.AGENT_THEME || {};
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
    const fonts = Object.assign({}, DEFAULTS.fonts, T.fonts, opts.fonts);
    // display names + icons are SEPARATE configs from the visual theme
    const displayName = Object.assign({}, DEFAULTS.displayName, T.displayName, T.labels, window.AGENT_DISPLAY_NAME, window.AGENT_LABELS, opts.labels);
    const AI = opts.icons || window.AGENT_ICONS || {}, TI = T.icons || {};
    const icons = {
      brain:   Object.assign({}, DEFAULTS.icons.brain,   T.brain, TI.brain, AI.brain),     // T.brain = back-compat
      toolbox: Object.assign({}, DEFAULTS.icons.toolbox, TI.toolbox, AI.toolbox),
    };
    return { colors, fonts, displayName, icons };
  }

  // Resolved tokens -> the CSS custom properties the stylesheet reads.
  function toVars(R) {
    const c = R.colors, f = R.fonts;
    return {
      "--paper": c.paper, "--ink": c.ink,
      "--rust": c.brand.base, "--rust-deep": c.brand.deep, "--rust-tint": c.brand.tint,
      "--data": c.data.base, "--data-deep": c.data.deep, "--data-tint": c.data.tint,
      "--instr": c.instruction.base, "--instr-deep": c.instruction.deep, "--instr-tint": c.instruction.tint,
      "--answer": c.answer.base, "--answer-deep": c.answer.deep, "--answer-tint": c.answer.tint,
      "--call": c.call.base, "--call-deep": c.call.deep, "--call-tint": c.call.tint,
      "--brain-from": c.brainFrom, "--brain-to": c.brainTo,
      "--font-display": f.display, "--font-body": f.body, "--font-mono": f.mono, "--font-hand": f.hand,
      "--af-text-scale": f.scale,
    };
  }

  // Normalize + write the variables onto an element (defaults to :root).
  function apply(target, opts) {
    const R = normalize(opts);
    const el = target || document.documentElement;
    const vars = toVars(R);
    for (const k in vars) el.style.setProperty(k, vars[k]);
    return R;
  }

  window.AgentTheme = { normalize, toVars, apply, DEFAULTS };

  // Back-compat: seed :root from the globals at load and expose the resolved
  // config, so existing embeds keep working untouched.
  window.AGENT_THEME_RESOLVED = apply(document.documentElement);
})();
