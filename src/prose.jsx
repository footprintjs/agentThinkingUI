import React from "react";
import { parseProse, plainTextOf } from "./markdown.js";

/* <Prose> — the ONE way the player renders a model-written body.
 *
 * Beat prose (`step.brain`, act notes, extended thinking, a team-journal line)
 * is markdown in practice, so it renders as markdown here: headings, bold,
 * italic, inline + fenced code, lists, tables, quotes, rules.
 *
 * Two rules it must never break:
 *   • The body is UNTRUSTED. It becomes React ELEMENTS, never an HTML string —
 *     so `<script>…</script>` in a beat stays visible literal text, exactly
 *     like the JSON highlighter's treatment of tool I/O. There is no
 *     dangerous-HTML escape hatch to audit, in this file or in markdown.js.
 *   • Links and images are INERT: a link renders as its label (the destination
 *     only as a hover title), an image as its alt text. Model text must not be
 *     clickable, and must not fetch anything.
 *
 * A plain sentence renders as the bare string it always was — same DOM, no
 * wrapper, no layout shift next to markdown-bearing beats.
 */

const MAX_HREF = 200; // a destination is a tooltip, not a document

function inlines(nodes, kp) {
  return nodes.map((n, i) => {
    const k = kp + i;
    switch (n.t) {
      case "text": return n.v;
      case "br": return <br key={k} />;
      case "code": return <code key={k} className="md-code">{n.v}</code>;
      case "strong": return <strong key={k}>{inlines(n.kids, k + ".")}</strong>;
      case "em": return <em key={k}>{inlines(n.kids, k + ".")}</em>;
      case "del": return <del key={k}>{inlines(n.kids, k + ".")}</del>;
      case "link": return (
        // deliberately a <span>, not an <a>: shown, explained on hover, not clickable
        <span key={k} className="md-link" title={n.href ? "inert link → " + n.href.slice(0, MAX_HREF) : undefined}>
          {inlines(n.kids, k + ".")}
        </span>
      );
      default: return null;
    }
  });
}

function block(b, i) {
  const k = "b" + i;
  switch (b.t) {
    case "p": return <p key={k}>{inlines(b.inline, k + ":")}</p>;
    case "h": {
      const H = "h" + Math.min(6, Math.max(1, b.level));
      return <H key={k} className={"md-h md-h" + b.level}>{inlines(b.inline, k + ":")}</H>;
    }
    case "code": return (
      <pre key={k} className="md-pre"><code className={b.lang ? "lang-" + b.lang : undefined}>{b.text}</code></pre>
    );
    case "hr": return <hr key={k} />;
    case "quote": return <blockquote key={k}>{b.blocks.map(block)}</blockquote>;
    case "list": {
      const L = b.ordered ? "ol" : "ul";
      return (
        <L key={k} className="md-list" start={b.ordered && b.start !== 1 ? b.start : undefined}>
          {b.items.map((it, j) => (
            <li key={j}>{inlines(it.inline, k + ":" + j + ":")}{it.blocks.map(block)}</li>
          ))}
        </L>
      );
    }
    case "table": return (
      // wide tables scroll INSIDE the beat (focusable so a keyboard can scroll them)
      <div key={k} className="md-tablewrap" tabIndex={0} role="group" aria-label="table">
        <table className="md-table">
          <thead>
            <tr>{b.head.map((c, j) => <th key={j} style={b.align[j] ? { textAlign: b.align[j] } : undefined}>{inlines(c, k + ":h" + j + ":")}</th>)}</tr>
          </thead>
          <tbody>
            {b.rows.map((r, ri) => (
              <tr key={ri}>{r.map((c, j) => <td key={j} style={b.align[j] ? { textAlign: b.align[j] } : undefined}>{inlines(c, k + ":" + ri + "." + j + ":")}</td>)}</tr>
            ))}
          </tbody>
        </table>
      </div>
    );
    case "trunc": return <div key={k} className="md-trunc">{"… " + b.n.toLocaleString() + " more characters truncated"}</div>;
    default: return null;
  }
}

export function Prose({ text }) {
  if (text == null || text === "") return null;
  const src = String(text);
  if (!src.trim()) return src;
  const blocks = parseProse(src);
  const plain = plainTextOf(blocks);
  if (plain !== null && plain === src.trim()) return src; // an ordinary sentence: unchanged
  return <div className="md">{blocks.map(block)}</div>;
}
