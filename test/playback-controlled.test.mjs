import { describe, it, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { usePlayback } from "../src/playback.js";

const trace = {
  task: "t", agent: "a", model: "m", asker: "x",
  steps: [
    { kind: "prompt", brain: "hi", cost: { ms: 1, tokens: 1 } },
    { kind: "ask", tool: "x", toolName: "x", input: {}, brain: "calling", cost: { ms: 1, tokens: 1 } },
    { kind: "return", tool: "x", toolName: "x", output: {}, brain: "back", cost: { ms: 1, tokens: 1 } },
    { kind: "answer", to: "x", brain: "done", cost: { ms: 1, tokens: 1 }, answer: { headline: "H", plan: [], budget: [], cta: "" } },
  ],
};

describe("usePlayback — controlled index (0.32.0)", () => {
  it("with `index` the host owns the position: a seek reports, the index stays until the host moves it", () => {
    const onIndexChange = vi.fn();
    const { result, rerender } = renderHook(({ index }) => usePlayback(trace, { index, onIndexChange, storageKey: null }), {
      initialProps: { index: 1 },
    });
    expect(result.current.index).toBe(1);
    act(() => result.current.seek(2));
    expect(onIndexChange).toHaveBeenCalledWith(2);
    expect(result.current.index).toBe(1);
    rerender({ index: 2 });
    expect(result.current.index).toBe(2);
  });

  it("an out-of-range `index` is read at the nearest end", () => {
    const { result } = renderHook(() => usePlayback(trace, { index: 99, storageKey: null }));
    expect(result.current.index).toBe(3);
  });

  it("without `index` the hook keeps its own position and still reports every move", () => {
    const onIndexChange = vi.fn();
    const { result } = renderHook(() => usePlayback(trace, { onIndexChange, storageKey: null }));
    act(() => result.current.seek(2));
    expect(result.current.index).toBe(2);
    expect(onIndexChange).toHaveBeenCalledWith(2);
  });
});
