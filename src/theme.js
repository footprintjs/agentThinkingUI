/* ============================================================
   AgentThinkingUI — THEME engine
   Turns a loose theme config into resolved tokens + CSS variables.

   Preferred (reactive, scoped, multi-instance):
     <AgentThinkingUI theme={...} labels={...} icons={...} />
   The container normalizes the config and applies the variables to its
   OWN element, so two players can wear different brands on one page and
   nothing leaks into the host app.

   Back-compat (script-tag embeds via the UMD bundle): page-level globals
   window.AGENT_THEME / AGENT_DISPLAY_NAME / AGENT_ICONS still seed the
   defaults — the UMD entry applies them to :root at load.

   Public API: normalize(opts) · toVars(resolved) · apply(targetEl, opts).
   A colour may be a single hex (deep/tint derived) or a full
   { base, deep, tint } triad for exact control. The theme covers the full
   surface: accents, neutrals (surface/line/text), error, contrast-aware
   on-accent foregrounds, radii, shadows, fonts — plus a dark `mode`.
   ============================================================ */

// page-level globals are optional and only exist in a browser
const G = typeof window !== "undefined" ? window : {};

// neutral palettes per mode — surfaces, lines, text. Accents are mode-agnostic
// (the hue stays; only the derived `tint` background changes per mode).
const NEUTRALS = {
  light: {
    paper: "#FBF6EC", surface: "#FFFFFF", surface2: "#F4EBDB", surface3: "#ECE0CB",
    ink: "#2C1F15", inkSoft: "#6E5C49", inkFaint: "#A2917C",
    line: "#E6D8C2", lineSoft: "#EFE5D4",
  },
  dark: {
    paper: "#16110B", surface: "#211A12", surface2: "#2A2117", surface3: "#352A1C",
    ink: "#F3E7D4", inkSoft: "#C3B197", inkFaint: "#8B7A64",
    line: "#3A2D1F", lineSoft: "#2C2218",
  },
};

const ACCENTS = {
  brand:       { base: "#C0531F", deep: "#95380F" }, // the brain / agent
  call:        { base: "#A8906E", deep: "#6E5942" }, // tool call (ask)
  data:        { base: "#0E8A82", deep: "#0A6660" }, // data → reason
  instruction: { base: "#C98512", deep: "#9A6306" }, // instruction → act
  answer:      { base: "#3E9B4F", deep: "#2C7339" }, // final answer
  error:       { base: "#C0392B", deep: "#922B21" }, // failed step / node
};

export const DEFAULTS = {
  mode: "light",
  colors: {
    ...NEUTRALS.light,
    brand: { ...ACCENTS.brand, tint: "#F6E4D6" },
    call: { ...ACCENTS.call, tint: "#ECE2D3" },
    data: { ...ACCENTS.data, tint: "#DCF0ED" },
    instruction: { ...ACCENTS.instruction, tint: "#F8EBCC" },
    answer: { ...ACCENTS.answer, tint: "#DEEFDD" },
    error: { ...ACCENTS.error, tint: "#F9E4E1" },
    brainFrom: "#E68A52",
    brainTo: "#C0531F",
  },
  fonts: {
    display: '"Bricolage Grotesque", system-ui, sans-serif',
    body:    '"Hanken Grotesque", system-ui, sans-serif',
    mono:    '"Space Mono", ui-monospace, monospace',
    hand:    '"Caveat", cursive',
    scale:   1,   // multiplies every text size so the player matches the host's density
  },
  radii:   { sm: "8px", md: "14px", lg: "22px", xl: "30px" },
  shadows: {}, // sm/md/lg derived from `ink` unless overridden here
  displayName: { agent: "LLM as Human Brain", toolbox: "toolbox" },
  icons: {
    brain:   { kind: "default", value: null },   // 'default' | 'emoji' | 'image'
    toolbox: { kind: "default", value: null },
  },
};

const hexToRgb = (h) => { h = String(h).replace("#", ""); if (h.length === 3) h = h.split("").map((c) => c + c).join(""); const n = parseInt(h, 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const toHex = (r, g, b) => "#" + [r, g, b].map((x) => Math.max(0, Math.min(255, Math.round(x))).toString(16).padStart(2, "0")).join("");
const isHex = (v) => typeof v === "string" && /^#[0-9a-fA-F]{3,6}$/.test(v);
const darken = (hex, a) => { const [r, g, b] = hexToRgb(hex); return toHex(r * (1 - a), g * (1 - a), b * (1 - a)); };
const mix = (hex, target, m) => { const [r, g, b] = hexToRgb(hex), [tr, tg, tb] = hexToRgb(target); return toHex(r + (tr - r) * m, g + (tg - g) * m, b + (tb - b) * m); };
const tintOf = (hex) => mix(hex, "#FFFFFF", 0.86);
// relative luminance (0..1) → pick a readable foreground over a coloured fill
const luminance = (hex) => { const [r, g, b] = hexToRgb(hex).map((c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const onColor = (hex, ink) => (luminance(hex) > 0.6 ? ink : "#FFFFFF");

// a colour triad. `tintBg` is what `tint` mixes toward (white in light mode,
// the dark surface in dark mode) so faint accent fills read correctly per mode.
function triad(v, fallback, tintBg) {
  let base, deep, tint;
  if (isHex(v)) { base = v; }
  else if (v && typeof v === "object") { base = v.base || fallback.base; deep = v.deep; tint = v.tint; }
  else { base = fallback.base; deep = fallback.deep; tint = fallback.tint; }
  deep = deep || darken(base, 0.28);
  if (tint == null) tint = tintBg === "#FFFFFF" ? tintOf(base) : mix(base, tintBg, 0.82);
  return { base, deep, tint };
}

// Resolve a loose config into concrete tokens. Each input falls back to the
// matching window.AGENT_* global, then to the built-in defaults.
export function normalize(opts) {
  opts = opts || {};
  const T = opts.theme || G.AGENT_THEME || {};
  const tc = T.colors || {};
  const mode = opts.mode || T.mode || DEFAULTS.mode;
  const N = NEUTRALS[mode] || NEUTRALS.light;

  // neutrals (flat colours): override → mode palette
  const surface  = tc.surface || tc.card || N.surface;
  const paper    = tc.paper || N.paper;
  const tintBg   = mode === "dark" ? surface : "#FFFFFF";
  const colors = {
    paper, surface,
    surface2: tc.surface2 || N.surface2,
    surface3: tc.surface3 || N.surface3,
    ink:      tc.ink || N.ink,
    inkSoft:  tc.inkSoft || N.inkSoft,
    inkFaint: tc.inkFaint || N.inkFaint,
    line:     tc.line || N.line,
    lineSoft: tc.lineSoft || N.lineSoft,
    brand:       triad(tc.brand, DEFAULTS.colors.brand, tintBg),
    call:        triad(tc.call, DEFAULTS.colors.call, tintBg),
    data:        triad(tc.data, DEFAULTS.colors.data, tintBg),
    instruction: triad(tc.instruction, DEFAULTS.colors.instruction, tintBg),
    answer:      triad(tc.answer, DEFAULTS.colors.answer, tintBg),
    error:       triad(tc.error, DEFAULTS.colors.error, tintBg),
  };
  colors.brainFrom = tc.brainFrom || (tc.brand ? colors.brand.base : DEFAULTS.colors.brainFrom);
  colors.brainTo   = tc.brainTo   || (tc.brand ? colors.brand.deep : DEFAULTS.colors.brainTo);
  // contrast-aware foreground for each accent fill (white, or the ink for light accents)
  const on = {
    brand: tc.onBrand || onColor(colors.brand.base, colors.ink),
    call:  onColor(colors.call.base, colors.ink),
    data:  onColor(colors.data.base, colors.ink),
    instruction: onColor(colors.instruction.base, colors.ink),
    answer: onColor(colors.answer.base, colors.ink),
    error: onColor(colors.error.base, colors.ink),
  };

  // non-accent surfaces (scene glow, grain, code block) — mode-aware, overridable
  const surfaces = {
    sceneGlow: tc.sceneGlow || (mode === "dark" ? mix(surface, "#FFFFFF", 0.05) : "#FFFDF9"),
    grainInk:  tc.grainInk  || (mode === "dark" ? "rgba(245,231,212,.05)" : "rgba(120,90,60,.10)"),
    codeBg:  tc.codeBg  || (mode === "dark" ? "#0F0B07" : "#2C1F15"),
    codeInk: tc.codeInk || "#F3E7D4",
    codeKey: tc.codeKey || "#E9A35C", codeStr: tc.codeStr || "#93C7A6", codeNum: tc.codeNum || "#7FB7D6",
  };

  const fonts = Object.assign({}, DEFAULTS.fonts, T.fonts, opts.fonts);
  const radii = Object.assign({}, DEFAULTS.radii, T.radii);
  // shadows derive their tint from `ink` (so they're not stuck warm-brown) unless overridden
  const [ir, ig, ib] = hexToRgb(colors.ink);
  const sc = (a) => `rgba(${ir},${ig},${ib},${a})`;
  const shadows = Object.assign({
    sm: `0 1px 2px ${sc(0.06)}, 0 2px 6px ${sc(0.05)}`,
    md: `0 4px 14px ${sc(0.10)}, 0 1px 3px ${sc(0.07)}`,
    lg: `0 18px 50px ${sc(0.16)}, 0 4px 12px ${sc(0.08)}`,
  }, T.shadows);

  // display names + icons are SEPARATE configs from the visual theme
  const displayName = Object.assign({}, DEFAULTS.displayName, T.displayName, T.labels, G.AGENT_DISPLAY_NAME, G.AGENT_LABELS, opts.labels);
  const AI = opts.icons || G.AGENT_ICONS || {}, TI = T.icons || {};
  const icons = {
    brain:   Object.assign({}, DEFAULTS.icons.brain,   T.brain, TI.brain, AI.brain),     // T.brain = back-compat
    toolbox: Object.assign({}, DEFAULTS.icons.toolbox, TI.toolbox, AI.toolbox),
  };
  return { mode, colors, on, surfaces, fonts, radii, shadows, displayName, icons };
}

// Resolved tokens -> the CSS custom properties the stylesheet reads.
export function toVars(R) {
  const c = R.colors, f = R.fonts, on = R.on || {}, rad = R.radii || {}, sh = R.shadows || {}, s = R.surfaces || {};
  const triadVars = (name, t, onc) => ({
    ["--" + name]: t.base, ["--" + name + "-deep"]: t.deep, ["--" + name + "-tint"]: t.tint,
    ...(onc ? { ["--on-" + name]: onc } : {}),
  });
  return {
    "--paper": c.paper, "--paper-2": c.surface2, "--paper-3": c.surface3, "--card": c.surface,
    "--ink": c.ink, "--ink-soft": c.inkSoft, "--ink-faint": c.inkFaint,
    "--line": c.line, "--line-soft": c.lineSoft,
    ...triadVars("rust", c.brand, on.brand),   // brand → --rust (domain name kept)
    ...triadVars("data", c.data, on.data),
    ...triadVars("instr", c.instruction, on.instruction),
    ...triadVars("answer", c.answer, on.answer),
    ...triadVars("call", c.call, on.call),
    ...triadVars("error", c.error, on.error),
    "--brain-from": c.brainFrom, "--brain-to": c.brainTo,
    "--font-display": f.display, "--font-body": f.body, "--font-mono": f.mono, "--font-hand": f.hand,
    "--af-text-scale": f.scale,
    "--r-sm": rad.sm, "--r-md": rad.md, "--r-lg": rad.lg, "--r-xl": rad.xl,
    "--shadow-sm": sh.sm, "--shadow-md": sh.md, "--shadow-lg": sh.lg,
    "--scene-glow": s.sceneGlow, "--grain-ink": s.grainInk,
    "--code-bg": s.codeBg, "--code-ink": s.codeInk, "--code-key": s.codeKey, "--code-str": s.codeStr, "--code-num": s.codeNum,
  };
}

// Normalize + write the variables onto an element (defaults to :root).
export function apply(target, opts) {
  const R = normalize(opts);
  const el = target || (typeof document !== "undefined" ? document.documentElement : null);
  if (el) { const vars = toVars(R); for (const k in vars) if (vars[k] != null) el.style.setProperty(k, vars[k]); }
  return R;
}
