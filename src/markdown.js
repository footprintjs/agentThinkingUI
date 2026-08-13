/* Markdown for BEAT PROSE — a small, safe subset.
 *
 * The bodies the player renders (`step.brain`, act notes, extended thinking)
 * are MODEL text, and models write markdown: until now the notepad printed the
 * `##`, the `**` and the table pipes raw. This module tokenizes that text into
 * a plain data tree; `prose.jsx` turns the tree into React elements.
 *
 * Safety is STRUCTURAL, not a sanitizer pass: nothing here ever produces an
 * HTML string, so `<script>` / `<img onerror=…>` in a body survives as a TEXT
 * node — the same no-`dangerouslySetInnerHTML` rule the JSON highlighter
 * follows. Links and images are parsed but carry no navigation and no fetch:
 * the view renders the label/alt text inert, so model text can never become a
 * clickable (or auto-loading) exfiltration channel.
 *
 * Understood: ATX headings, **bold**, *italic*, ~~strike~~, `code`, fenced
 * code, bullet + ordered lists (nested), GFM tables, blockquotes, `---` rules,
 * backslash escapes. Everything else — raw HTML included — stays literal text.
 */

// Bound the work + the DOM: a model can emit a megabyte of prose.
export const MAX_PROSE = 20000;

const RE_HEADING = /^ {0,3}(#{1,6})[ \t]+(.*?)[ \t]*#*[ \t]*$/;
const RE_HR = /^ {0,3}([-*_])[ \t]*(?:\1[ \t]*){2,}$/;
const RE_FENCE = /^ {0,3}(`{3,}|~{3,})[ \t]*(\S*)/;
const RE_BULLET = /^([ \t]*)([-*+]|\d{1,9}[.)])[ \t]+(.*)$/;
const RE_QUOTE = /^ {0,3}>[ \t]?(.*)$/;
const RE_TABLE_DIV = /^[ \t]*\|?[ \t]*:?-+:?[ \t]*(\|[ \t]*:?-+:?[ \t]*)*\|?[ \t]*$/;
const ESCAPABLE = /[\\`*_{}[\]()#+\-.!|~>]/;

/* ---------------------------------------------------------------- inline --- */

// `[label](dest)` starting at `s[i] === "["`. Returns the label, the
// destination and where the link ends — or null when it isn't one.
function matchLink(s, i) {
  let depth = 0, j = i;
  for (; j < s.length; j++) {
    const ch = s[j];
    if (ch === "\\") { j++; continue; }
    if (ch === "[") depth++;
    else if (ch === "]") { depth--; if (depth === 0) break; }
  }
  if (j >= s.length || s[j + 1] !== "(") return null;
  let k = j + 2, open = 1;
  for (; k < s.length; k++) {
    const ch = s[k];
    if (ch === "\\") { k++; continue; }
    if (ch === "(") open++;
    else if (ch === ")") { open--; if (open === 0) break; }
  }
  if (open !== 0) return null;
  const dest = s.slice(j + 2, k).trim();
  return { label: s.slice(i + 1, j), href: (dest.split(/\s+/)[0] || "").replace(/^<|>$/g, ""), end: k + 1 };
}

// `**bold**` / `*em*` / `_em_` / `~~strike~~` starting at s[i], or null.
function matchEmphasis(s, i) {
  const c = s[i];
  const two = s.slice(i, i + 2);
  if (two === "~~") {
    const j = s.indexOf("~~", i + 2);
    if (j < 0 || j === i + 2) return null;
    return { node: { t: "del", kids: parseInline(s.slice(i + 2, j)) }, end: j + 2 };
  }
  if (c !== "*" && c !== "_") return null;
  // `_` inside a word is a name (snake_case), not emphasis
  if (c === "_" && i > 0 && /\w/.test(s[i - 1])) return null;
  let run = 0;
  while (s[i + run] === c) run++;
  if (run >= 3) { // ***both at once***
    const j3 = s.indexOf(c.repeat(3), i + 3);
    const inner3 = j3 < 0 ? "" : s.slice(i + 3, j3);
    if (inner3.trim() && !/^\s/.test(inner3) && !/\s$/.test(inner3)) {
      return { node: { t: "strong", kids: [{ t: "em", kids: parseInline(inner3) }] }, end: j3 + 3 };
    }
  }
  const strong = two === c + c;
  const d = strong ? two : c;
  const j = s.indexOf(d, i + d.length);
  if (j < 0) return null;
  const inner = s.slice(i + d.length, j);
  if (!inner.trim() || /^\s/.test(inner) || /\s$/.test(inner)) return null;
  if (c === "_" && /\w/.test(s[j + d.length] || "")) return null;
  return { node: { t: strong ? "strong" : "em", kids: parseInline(inner) }, end: j + d.length };
}

// One line (or paragraph) of text → inline nodes. Recursion always runs on a
// strictly shorter slice, so it terminates on any input.
export function parseInline(src) {
  const s = String(src);
  const out = [];
  let buf = "";
  const flush = () => { if (buf) { out.push({ t: "text", v: buf }); buf = ""; } };
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (c === "\\" && ESCAPABLE.test(s[i + 1] || "")) { buf += s[i + 1]; i += 2; continue; }
    if (c === "\n") { flush(); out.push({ t: "br" }); i++; continue; }
    if (c === "`") {
      const run = /^`+/.exec(s.slice(i))[0];
      const end = s.indexOf(run, i + run.length);
      if (end > 0) {
        flush();
        out.push({ t: "code", v: s.slice(i + run.length, end).replace(/\n/g, " ").trim() });
        i = end + run.length;
        continue;
      }
    }
    if (c === "!" && s[i + 1] === "[") {
      // an image would be a NETWORK BEACON — keep the alt text, drop the src
      const L = matchLink(s, i + 1);
      if (L) { buf += L.label; i = L.end; continue; }
    }
    if (c === "[") {
      const L = matchLink(s, i);
      if (L) { flush(); out.push({ t: "link", href: L.href, kids: parseInline(L.label) }); i = L.end; continue; }
    }
    if (c === "*" || c === "_" || c === "~") {
      const em = matchEmphasis(s, i);
      if (em) { flush(); out.push(em.node); i = em.end; continue; }
    }
    buf += c;
    i++;
  }
  flush();
  return out;
}

/* ----------------------------------------------------------------- blocks --- */

function splitRow(line) {
  let s = line.trim();
  if (s.startsWith("|")) s = s.slice(1);
  if (s.endsWith("|") && !s.endsWith("\\|")) s = s.slice(0, -1);
  const cells = [];
  let cur = "";
  for (let i = 0; i < s.length; i++) {
    if (s[i] === "\\" && s[i + 1] === "|") { cur += "|"; i++; continue; }
    if (s[i] === "|") { cells.push(cur.trim()); cur = ""; continue; }
    cur += s[i];
  }
  cells.push(cur.trim());
  return cells;
}

const isTableAt = (lines, i) =>
  lines[i].includes("|") && i + 1 < lines.length &&
  RE_TABLE_DIV.test(lines[i + 1]) && lines[i + 1].includes("-") &&
  (lines[i + 1].includes("|") || splitRow(lines[i]).length === 1);

const isBlockStart = (lines, i) => {
  const line = lines[i];
  return RE_HEADING.test(line) || RE_HR.test(line) || RE_FENCE.test(line) ||
    RE_BULLET.test(line) || RE_QUOTE.test(line) || isTableAt(lines, i);
};

const indentOf = (s) => /^[ \t]*/.exec(s)[0].length;

// A list and everything nested under it. Returns [block, nextLineIndex].
function parseList(lines, start) {
  const first = RE_BULLET.exec(lines[start]);
  const base = first[1].length;
  const ordered = /\d/.test(first[2]);
  const startNo = ordered ? parseInt(first[2], 10) : 1;
  const items = [];
  let i = start;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) {
      // a blank line only continues the list if a sibling bullet follows
      const next = lines[i + 1];
      if (next && RE_BULLET.test(next) && indentOf(next) >= base) { i++; continue; }
      break;
    }
    const m = RE_BULLET.exec(line);
    if (m) {
      if (m[1].length > base && items.length) {
        const [child, next] = parseList(lines, i);
        items[items.length - 1].blocks.push(child);
        i = next;
        continue;
      }
      if (m[1].length < base || /\d/.test(m[2]) !== ordered) break; // a different list
      items.push({ text: m[3], blocks: [] });
      i++;
      continue;
    }
    if (!items.length) break;
    if (indentOf(line) > base || !isBlockStart(lines, i)) {
      // lazy continuation: a wrapped item is ONE line of prose, not a break
      items[items.length - 1].text += " " + line.trim();
      i++;
      continue;
    }
    break;
  }
  return [{
    t: "list",
    ordered,
    start: startNo,
    items: items.map((it) => ({ inline: parseInline(it.text), blocks: it.blocks })),
  }, i];
}

function parseBlocks(lines) {
  const out = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }

    const fence = RE_FENCE.exec(line);
    if (fence) {
      const mark = fence[1][0];
      const body = [];
      i++;
      while (i < lines.length && !new RegExp("^ {0,3}" + (mark === "`" ? "`{3,}" : "~{3,}") + "[ \t]*$").test(lines[i])) body.push(lines[i++]);
      if (i < lines.length) i++; // the closing fence
      out.push({ t: "code", lang: fence[2] || "", text: body.join("\n") });
      continue;
    }
    if (RE_HR.test(line)) { out.push({ t: "hr" }); i++; continue; }

    const head = RE_HEADING.exec(line);
    if (head) { out.push({ t: "h", level: head[1].length, inline: parseInline(head[2]) }); i++; continue; }

    if (RE_QUOTE.test(line)) {
      const inner = [];
      while (i < lines.length && RE_QUOTE.test(lines[i])) inner.push(RE_QUOTE.exec(lines[i++])[1]);
      out.push({ t: "quote", blocks: parseBlocks(inner) });
      continue;
    }

    if (isTableAt(lines, i)) {
      const cells = splitRow(lines[i]);
      const align = splitRow(lines[i + 1]).map((c) =>
        (c.startsWith(":") && c.endsWith(":") ? "center" : c.endsWith(":") ? "right" : c.startsWith(":") ? "left" : ""));
      i += 2;
      const rows = [];
      while (i < lines.length && lines[i].trim() && lines[i].includes("|")) rows.push(splitRow(lines[i++]));
      out.push({
        t: "table",
        align,
        head: cells.map(parseInline),
        rows: rows.map((r) => r.map(parseInline)),
      });
      continue;
    }

    if (RE_BULLET.test(line)) {
      const [list, next] = parseList(lines, i);
      out.push(list);
      i = next;
      continue;
    }

    const para = [];
    while (i < lines.length && lines[i].trim() && !isBlockStart(lines, i)) para.push(lines[i++]);
    out.push({ t: "p", inline: parseInline(para.join("\n")) });
  }
  return out;
}

/* ------------------------------------------------------------------ entry --- */

// Repeated renders of the same beat (playback re-renders the notepad on every
// step) reparse nothing — bounded so a long live run can't grow it forever.
const CACHE_MAX = 300;
const cache = new Map();

export function parseProse(src) {
  const key = String(src == null ? "" : src);
  const hit = cache.get(key);
  if (hit) return hit;

  let text = key.replace(/\r\n?/g, "\n").replace(/\t/g, "    ");
  let cut = 0;
  if (text.length > MAX_PROSE) { cut = text.length - MAX_PROSE; text = text.slice(0, MAX_PROSE); }
  const blocks = parseBlocks(text.split("\n"));
  if (cut) blocks.push({ t: "trunc", n: cut });

  if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value);
  cache.set(key, blocks);
  return blocks;
}

// The text when the whole tree is ONE plain paragraph, else null. Lets the view
// render an ordinary sentence exactly as it did before markdown existed — no
// wrapper element, so a plain beat can't shift by a pixel.
export function plainTextOf(blocks) {
  if (blocks.length !== 1 || blocks[0].t !== "p") return null;
  const inline = blocks[0].inline;
  if (inline.length !== 1 || inline[0].t !== "text") return null;
  return inline[0].v;
}
