import React from "react";
import { marksAt } from "./marks.js";

/* ============================================================
   Marks — chips a host hands the player, per beat (0.33.0).

   The player knows nothing about what a chip MEANS (a findings ledger's
   "hypothesis" / "noise" / "stood on 3" are the host's words); it draws what it
   is handed. `marks` is indexed exactly like `trace.steps`: marks[i] decorates
   step i. A hole, an empty list or an array that is too short = nothing drawn;
   extra entries are ignored. A label is TEXT — a React text node, never markup.

   Zero cost by construction: every entry point returns [] / null when there is
   nothing to draw, and the callers render NOTHING extra in that case, so a
   player without `marks` produces the same DOM and the same export as before.
   ============================================================ */

export { marksAt }; // the pure half lives in marks.js (copyForLLM reads it React-free)

const TONES = new Set(["neutral", "good", "warn", "bad", "muted"]);

// One chip row. `list` is what marksAt returned. Plain spans — nothing
// focusable, no role; the label is the text, the full text rides `title`
// (the host's own `title` when it gave one) so a clipped chip is still whole.
export function MarkRow({ list }) {
  if (!list || !list.length) return null;
  return (
    <div className="atui-marks" aria-label="marks">
      {list.map((m, i) => {
        const tone = TONES.has(m.tone) ? m.tone : "neutral";
        return (
          <span key={i} className={"atui-mark tone-" + tone} title={typeof m.title === "string" ? m.title : m.label}>
            {m.label}
          </span>
        );
      })}
    </div>
  );
}
