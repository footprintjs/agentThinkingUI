/* ============================================================
   AgentThinkingUI — PLAYBACK (time-travel)
   All replay/scrubbing logic lives here, separate from rendering:
   current step, play/pause, speed, auto-advance dwell, keyboard
   nav, position persistence, and a live "tail the stream" mode.
   ============================================================ */
import React from "react";

export const AF_DWELL = { prompt: 2600, ask: 1500, return: 3300, answer: 3600, _default: 2800 };

export function usePlayback(trace, opts) {
  const { useState, useEffect, useRef } = React;
  opts = opts || {};
  // persistence is opt-in via a stable key; pass null/undefined to disable so
  // multiple players on one page never clobber each other's scrub position.
  const storageKey = opts.storageKey;
  const loop = !!opts.loop;
  const live = !!opts.live; // live monitoring: tail the latest step as the trace grows
  const persist = !live && !!storageKey;
  const n = trace.steps.length;

  // localStorage can throw (privacy mode, sandboxed iframe) — never crash render
  const readStored = () => {
    if (!persist) return 0;
    try {
      const v = parseInt(localStorage.getItem(storageKey), 10);
      return Number.isFinite(v) && v >= 0 && v < n ? v : 0;
    } catch { return 0; }
  };

  const [index, setIndexRaw] = useState(() => (live ? Math.max(0, n - 1) : readStored()));
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);

  const setIndex = (i) => {
    setIndexRaw(i);
    if (persist) { try { localStorage.setItem(storageKey, String(i)); } catch { /* ignore */ } }
  };

  // live: jump to the newest beat whenever the trace grows (and don't persist)
  useEffect(() => { if (live) setIndexRaw(Math.max(0, n - 1)); }, [live, n]);

  // auto-advance, dwell scaled by step kind + speed
  const timer = useRef(null);
  useEffect(() => {
    if (!playing) return;
    if (index >= n - 1) {
      if (loop) { timer.current = setTimeout(() => setIndex(0), 2600 / speed); return () => clearTimeout(timer.current); }
      setPlaying(false); return;
    }
    const dwell = AF_DWELL[trace.steps[index].kind] || AF_DWELL._default;
    timer.current = setTimeout(() => setIndex(index + 1), dwell / speed);
    return () => clearTimeout(timer.current);
  }, [playing, index, speed, loop, n]);

  // keyboard: ←/→ step, space play/pause. Returned as an onKeyDown the container
  // puts on its OWN root element — so keys only act when focus is inside the
  // player (never hijacks the host page) and it shares React's propagation with
  // the timeline slider (a child slider's stopPropagation suppresses this).
  const onKeyDown = (e) => {
    if (e.key === "ArrowRight") { setPlaying(false); setIndex(Math.min(n - 1, index + 1)); }
    else if (e.key === "ArrowLeft") { setPlaying(false); setIndex(Math.max(0, index - 1)); }
    else if (e.key === " ") {
      const el = e.target;
      if (el && (el.tagName === "BUTTON" || (el.closest && el.closest("button")))) return; // let the button's own space click it
      e.preventDefault();
      if (index === n - 1 && !playing) setIndex(0);
      setPlaying((p) => !p);
    }
  };

  // jump that also halts playback (used by the scrubber)
  const seek = (i) => { setPlaying(false); setIndex(i); };

  return { index, setIndex, seek, playing, setPlaying, speed, setSpeed, onKeyDown };
}
