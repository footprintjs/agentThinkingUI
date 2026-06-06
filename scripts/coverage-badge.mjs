/* Token-free coverage badge: read coverage/coverage-summary.json and write a
   self-contained flat-square SVG to docs/assets/coverage.svg. No Codecov, no
   secrets — `npm run coverage` regenerates it; CI commits it back. */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = resolve(root, "docs/assets/coverage.svg");

let pct;
try {
  const total = JSON.parse(readFileSync(resolve(root, "coverage/coverage-summary.json"), "utf8")).total;
  pct = Math.round(total.lines.pct); // lines coverage, matching the old badge's intent
} catch {
  console.error("coverage-badge: run `npm run coverage` first (coverage-summary.json missing)");
  process.exit(1);
}

// shields-style colour ramp
const color =
  pct >= 95 ? "#3E9B4F" : pct >= 90 ? "#97CA00" : pct >= 80 ? "#A4A61D" :
  pct >= 70 ? "#DFB317" : pct >= 60 ? "#FE7D37" : "#E05D44";

const label = "coverage";
const msg = pct + "%";
// rough text widths (Verdana 11px); generous padding so nothing clips
const w = (s) => Math.round(s.length * 7) + 14;
const lw = w(label), mw = w(msg), W = lw + mw;

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="20" role="img" aria-label="${label}: ${msg}">
  <title>${label}: ${msg}</title>
  <g shape-rendering="crispEdges">
    <rect width="${lw}" height="20" fill="#555"/>
    <rect x="${lw}" width="${mw}" height="20" fill="${color}"/>
  </g>
  <g fill="#fff" text-anchor="middle" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" font-size="11">
    <text x="${lw / 2}" y="14">${label}</text>
    <text x="${lw + mw / 2}" y="14">${msg}</text>
  </g>
</svg>
`;

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, svg);
console.log(`coverage-badge: wrote ${msg} → docs/assets/coverage.svg`);
