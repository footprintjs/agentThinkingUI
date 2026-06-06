/* global React */
/* ============================================================
   AgentFootprint — PLAYBACK (time-travel)
   All replay/scrubbing logic lives here, separate from rendering:
   current step, play/pause, speed, auto-advance dwell, keyboard
   nav, and position persistence. The view layer just consumes the
   returned state + setters.
   ============================================================ */
const AF_DWELL = { prompt: 2600, ask: 1500, return: 3300, answer: 3600, _default: 2800 };

function usePlayback(trace, opts) {
  const { useState, useEffect, useRef } = React;
  opts = opts || {};
  const storageKey = opts.storageKey || "agentfootprint.index";
  const loop = !!opts.loop;
  const live = !!opts.live; // live monitoring: tail the latest step as the trace grows
  const n = trace.steps.length;

  const [index, setIndexRaw] = useState(() => {
    if (live) return Math.max(0, n - 1);
    const v = parseInt(localStorage.getItem(storageKey), 10);
    return Number.isFinite(v) && v >= 0 && v < n ? v : 0;
  });
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);

  const setIndex = (i) => { setIndexRaw(i); if (!live) localStorage.setItem(storageKey, String(i)); };

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
  }, [playing, index, speed, loop]);

  // keyboard: ←/→ step, space play/pause
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "ArrowRight") { setPlaying(false); setIndex(Math.min(n - 1, index + 1)); }
      if (e.key === "ArrowLeft") { setPlaying(false); setIndex(Math.max(0, index - 1)); }
      if (e.key === " ") { e.preventDefault(); if (index === n - 1 && !playing) setIndex(0); setPlaying((p) => !p); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index, playing]);

  // jump that also halts playback (used by the scrubber)
  const seek = (i) => { setPlaying(false); setIndex(i); };

  return { index, setIndex, seek, playing, setPlaying, speed, setSpeed };
}

window.usePlayback = usePlayback;
window.AF_DWELL = AF_DWELL; // exposed so the dwell schedule is inspectable/testable
