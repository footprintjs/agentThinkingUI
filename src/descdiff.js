// descdiff — a small word-level diff for the Description Doctor.
//
// diffWords(old, new) → [{ type: 'same' | 'del' | 'ins', text }] segments
// (whitespace preserved), via a standard LCS. The Doctor renders `del` as a
// red strikethrough and `ins` as a green addition.

export function diffWords(oldText, newText) {
  // split on whitespace but KEEP it (the capture group), so spacing round-trips in
  // the render; drop empty tokens so an empty side doesn't yield a spurious segment
  const a = String(oldText || "").split(/(\s+)/).filter(Boolean);
  const b = String(newText || "").split(/(\s+)/).filter(Boolean);
  const m = a.length;
  const n = b.length;
  // LCS length table (suffixes)
  const lcs = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = m - 1; i >= 0; i--) {
    for (let j = n - 1; j >= 0; j--) {
      lcs[i][j] = a[i] === b[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
    }
  }
  const out = [];
  let i = 0;
  let j = 0;
  while (i < m && j < n) {
    if (a[i] === b[j]) {
      out.push({ type: "same", text: a[i] });
      i++;
      j++;
    } else if (lcs[i + 1][j] >= lcs[i][j + 1]) {
      out.push({ type: "del", text: a[i] });
      i++;
    } else {
      out.push({ type: "ins", text: b[j] });
      j++;
    }
  }
  while (i < m) out.push({ type: "del", text: a[i++] });
  while (j < n) out.push({ type: "ins", text: b[j++] });
  // coalesce adjacent same-type segments for a tidier render
  const merged = [];
  for (const seg of out) {
    const last = merged[merged.length - 1];
    if (last && last.type === seg.type) last.text += seg.text;
    else merged.push({ ...seg });
  }
  return merged;
}
