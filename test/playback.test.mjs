import { describe, it, expect } from "vitest";
import "../src/playback.js"; // attaches window.usePlayback + window.AF_DWELL

const { AF_DWELL, usePlayback } = window;

describe("AF_DWELL schedule", () => {
  it("has a dwell time per step kind plus a default fallback", () => {
    expect(AF_DWELL.prompt).toBe(2600);
    expect(AF_DWELL.ask).toBe(1500);
    expect(AF_DWELL.return).toBe(3300);
    expect(AF_DWELL.answer).toBe(3600);
    expect(AF_DWELL._default).toBe(2800);
  });

  it("dwells longest on returns (the brain needs read time) and shortest on asks", () => {
    expect(AF_DWELL.return).toBeGreaterThan(AF_DWELL.ask);
    expect(AF_DWELL.ask).toBe(Math.min(AF_DWELL.prompt, AF_DWELL.ask, AF_DWELL.return, AF_DWELL.answer));
  });

  it("exposes usePlayback as a hook function", () => {
    expect(typeof usePlayback).toBe("function");
  });
});
