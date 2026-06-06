import { describe, it, expect, afterEach } from "vitest";
import * as Theme from "../src/theme.js";
const lum = (h) => {
  const n = parseInt(h.slice(1), 16);
  return ((n >> 16) & 255) + ((n >> 8) & 255) + (n & 255);
};

afterEach(() => {
  delete window.AGENT_THEME;
  delete window.AGENT_DISPLAY_NAME;
  delete window.AGENT_ICONS;
});

describe("normalize", () => {
  it("with no opts reproduces the built-in defaults", () => {
    const R = Theme.normalize({});
    expect(R.colors.data.base).toBe("#0E8A82");
    expect(R.colors.instruction.base).toBe("#C98512");
    expect(R.fonts.scale).toBe(1);
    expect(R.displayName.toolbox).toBe("toolbox");
    expect(R.icons.brain.kind).toBe("default");
  });

  it("derives a darker deep + lighter tint from a single hex", () => {
    const R = Theme.normalize({ theme: { colors: { data: "#2563EB" } } });
    expect(R.colors.data.base).toBe("#2563EB");
    expect(lum(R.colors.data.deep)).toBeLessThan(lum("#2563EB"));
    expect(lum(R.colors.data.tint)).toBeGreaterThan(lum("#2563EB"));
  });

  it("uses a full {base,deep,tint} triad verbatim", () => {
    const R = Theme.normalize({ theme: { colors: { answer: { base: "#111111", deep: "#000000", tint: "#eeeeee" } } } });
    expect(R.colors.answer).toEqual({ base: "#111111", deep: "#000000", tint: "#eeeeee" });
  });

  it("lets the brand drive the brain gradient unless brainFrom/To are set", () => {
    const R = Theme.normalize({ theme: { colors: { brand: "#2563EB" } } });
    expect(R.colors.brainFrom).toBe("#2563EB"); // brand base
    expect(R.colors.brainTo).toBe(R.colors.brand.deep); // brand deep
  });

  it("merges font families over defaults and passes scale through", () => {
    const R = Theme.normalize({ theme: { fonts: { body: "Inter", scale: 1.5 } } });
    expect(R.fonts.body).toBe("Inter");
    expect(R.fonts.scale).toBe(1.5);
    expect(R.fonts.display).toMatch(/Bricolage/); // default kept
  });

  it("labels precedence: props beat globals beat defaults", () => {
    window.AGENT_DISPLAY_NAME = { agent: "Global Agent", toolbox: "Global Tools" };
    expect(Theme.normalize({}).displayName.agent).toBe("Global Agent"); // global > default
    const R = Theme.normalize({ labels: { agent: "Prop Agent" } });
    expect(R.displayName.agent).toBe("Prop Agent"); // prop > global
    expect(R.displayName.toolbox).toBe("Global Tools"); // falls back to global
  });
});

describe("neutrals, error, radii, shadows", () => {
  it("exposes neutral surface/line/text tokens with defaults", () => {
    const R = Theme.normalize({});
    expect(R.colors.surface).toBe("#FFFFFF");
    expect(R.colors.line).toBe("#E6D8C2");
    expect(R.colors.inkSoft).toBe("#6E5C49");
    expect(R.colors.error.base).toBe("#C0392B");
  });
  it("lets a consumer override surface/line via props", () => {
    const R = Theme.normalize({ theme: { colors: { surface: "#101418", line: "#2A2F36" } } });
    expect(R.colors.surface).toBe("#101418");
    expect(R.colors.line).toBe("#2A2F36");
  });
  it("derives shadow tint from ink (not a fixed warm brown)", () => {
    const warm = Theme.normalize({}).shadows.md;
    const cool = Theme.normalize({ theme: { colors: { ink: "#0A1A2F" } } }).shadows.md;
    expect(warm).not.toBe(cool); // shadow colour tracks ink
    expect(cool).toContain("rgba(10,26,47"); // ink rgb baked into the shadow
  });
  it("passes radii/shadows overrides through", () => {
    const R = Theme.normalize({ theme: { radii: { md: "4px" }, shadows: { md: "none" } } });
    expect(R.radii.md).toBe("4px");
    expect(R.shadows.md).toBe("none");
  });
});

describe("dark mode", () => {
  it("swaps the neutral palette (dark surfaces, light ink) without touching accent hues", () => {
    const R = Theme.normalize({ theme: { mode: "dark" } });
    expect(lum(R.colors.paper)).toBeLessThan(lum("#888888")); // dark paper
    expect(lum(R.colors.ink)).toBeGreaterThan(lum("#888888")); // light ink
    expect(R.colors.data.base).toBe("#0E8A82"); // accent hue unchanged
  });
  it("recomputes accent tints toward the dark surface (not near-white)", () => {
    const light = Theme.normalize({ theme: { colors: { data: "#2563EB" } } });
    const dark = Theme.normalize({ theme: { mode: "dark", colors: { data: "#2563EB" } } });
    expect(lum(dark.colors.data.tint)).toBeLessThan(lum(light.colors.data.tint));
  });
});

describe("contrast-aware on-accent foreground", () => {
  it("picks ink over a light accent and white over a dark accent", () => {
    const R = Theme.normalize({ theme: { colors: { brand: "#FFE100", data: "#0E8A82" } } });
    expect(R.on.brand).toBe(R.colors.ink); // yellow brand → dark text
    expect(R.on.data).toBe("#FFFFFF");      // teal → white text
  });
});

describe("toVars", () => {
  it("maps resolved tokens to the CSS variables the stylesheet reads", () => {
    const R = Theme.normalize({ theme: { colors: { data: "#0E8A82" }, fonts: { scale: 0.9 } } });
    const v = Theme.toVars(R);
    expect(v["--data"]).toBe("#0E8A82");
    expect(v["--rust"]).toBe(R.colors.brand.base); // brand → --rust
    expect(v["--af-text-scale"]).toBe(0.9);
    expect(v["--font-body"]).toBe(R.fonts.body);
  });
  it("emits the full surface: neutrals, error, on-accent, radii, shadows, code", () => {
    const v = Theme.toVars(Theme.normalize({}));
    expect(v["--card"]).toBe("#FFFFFF");
    expect(v["--ink-soft"]).toBe("#6E5C49");
    expect(v["--line"]).toBe("#E6D8C2");
    expect(v["--error"]).toBe("#C0392B");
    expect(v["--on-rust"]).toBeTruthy();
    expect(v["--r-md"]).toBe("14px");
    expect(v["--shadow-md"]).toContain("rgba");
    expect(v["--code-bg"]).toBeTruthy();
  });
});

describe("apply", () => {
  it("writes the variables onto a target element (scoped, not :root)", () => {
    const el = document.createElement("div");
    Theme.apply(el, { theme: { colors: { brand: "#2563EB" } } });
    expect(el.style.getPropertyValue("--rust")).toBe("#2563EB");
  });

  it("defaults the target to documentElement when none is given", () => {
    Theme.apply(undefined, { theme: { colors: { brand: "#7A5AE0" } } });
    expect(document.documentElement.style.getPropertyValue("--rust")).toBe("#7A5AE0");
  });
});

describe("colour edge cases", () => {
  it("accepts a 3-char hex and still derives shades", () => {
    const R = Theme.normalize({ theme: { colors: { data: "#abc" } } });
    expect(R.colors.data.base).toBe("#abc");
    expect(R.colors.data.deep).toMatch(/^#[0-9a-f]{6}$/i); // derived from expanded hex
    expect(R.colors.data.tint).toMatch(/^#[0-9a-f]{6}$/i);
  });

  it("fills in missing deep/tint when only a partial triad is given", () => {
    const R = Theme.normalize({ theme: { colors: { answer: { base: "#123456" } } } });
    expect(R.colors.answer.base).toBe("#123456");
    expect(R.colors.answer.deep).not.toBe("#123456"); // derived
    expect(R.colors.answer.tint).not.toBe("#123456"); // derived
  });
});
