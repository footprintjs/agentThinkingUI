/* ============================================================
   Marks — the pure half (no React): what a beat's chips ARE and how they read
   in a text export. `marks.jsx` draws them; `copyForLLM.js` prints them.
   ============================================================ */

// the chips for beat `i`, kept to the shape the contract promises: an object
// with a string label; a bad entry is skipped, never thrown on
export function marksAt(marks, i) {
  const list = Array.isArray(marks) ? marks[i] : undefined;
  if (!Array.isArray(list)) return [];
  return list.filter((m) => m && typeof m.label === "string" && m.label.length > 0);
}

// a label on ONE line: the export is one bullet per beat, so a newline or a tab
// inside a label becomes a space (the chip on screen is unchanged)
const oneLine = (label) => label.replace(/\s+/g, " ").trim();

// the chips' labels for a text export — "[hypothesis · expect high]"; "" when
// there is nothing to say, so a line without marks is byte-identical
export function marksBracket(list) {
  return list && list.length ? " [" + list.map((m) => oneLine(m.label)).join(" · ") + "]" : "";
}
