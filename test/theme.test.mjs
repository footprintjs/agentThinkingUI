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

describe("toVars", () => {
  it("maps resolved tokens to the CSS variables the stylesheet reads", () => {
    const R = Theme.normalize({ theme: { colors: { data: "#0E8A82" }, fonts: { scale: 0.9 } } });
    const v = Theme.toVars(R);
    expect(v["--data"]).toBe("#0E8A82");
    expect(v["--rust"]).toBe(R.colors.brand.base); // brand → --rust
    expect(v["--af-text-scale"]).toBe(0.9);
    expect(v["--font-body"]).toBe(R.fonts.body);
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
