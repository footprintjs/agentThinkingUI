/* Generates the animated README hero (light + dark) from one source, so the two
   themes never drift. Same technique as the app: CSS @keyframes inside an inline
   SVG (no JS/GIF) — opacity pulses staggered by animation-delay, stroke-dashoffset
   "flow" along the connectors, and a gentle float on the brain.
   Run:  node docs/assets/gen-hero.mjs   */
import { writeFileSync } from "node:fs";

const LIGHT = {
  paper: "#FBF6EC", paper2: "#F4EBDB", card: "#FFFFFF",
  ink: "#2C1F15", inkSoft: "#6E5C49", line: "#E6D8C2",
  rustFrom: "#E68A52", rustTo: "#C0531F", rustDeep: "#95380F", call: "#A8906E",
  data: "#0E8A82", dataTint: "#DCF0ED", dataDeep: "#0A6660",
  instr: "#C98512", instrTint: "#F8EBCC", instrDeep: "#9A6306",
  answer: "#3E9B4F", answerTint: "#DEEFDD", answerDeep: "#2C7339",
};
const DARK = {
  paper: "#221A12", paper2: "#2B2118", card: "#2B2118",
  ink: "#F3E7D4", inkSoft: "#C9B8A2", line: "#3A2E22",
  rustFrom: "#E68A52", rustTo: "#C0531F", rustDeep: "#7E2F0D", call: "#B79B78",
  data: "#2BB3A8", dataTint: "#163C38", dataDeep: "#7FD8CF",
  instr: "#E2A53A", instrTint: "#43350F", instrDeep: "#F2CE7E",
  answer: "#5BB96B", answerTint: "#1D3B23", answerDeep: "#A7E0AF",
};

// the brain blob path from the app (viewBox 0 0 112 98)
const BRAIN_D =
  "M56 9 C64 3 77 5 81 14 C92 11 101 20 97 31 C105 36 106 48 97 54 C103 63 98 74 88 75 " +
  "C85 85 73 89 65 82 C61 88 51 88 47 82 C39 89 27 85 24 75 C14 74 9 63 15 54 C6 48 7 36 15 31 " +
  "C11 20 20 11 31 14 C35 5 48 3 56 9 Z";

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function pill(x, y, w, h, bg, stroke, sw, label, cls, sub) {
  return `
    <g class="${cls}">
      <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${h / 2}" fill="${bg}" stroke="${stroke}" stroke-width="1.5"/>
      <circle cx="${x + h / 2}" cy="${y + h / 2}" r="${h / 2 - 11}" fill="${sw}"/>
      <text x="${x + h + 4}" y="${y + h / 2 + 1}" class="lbl" dominant-baseline="middle">${esc(label)}</text>
      ${sub ? `<text x="${x + w - 16}" y="${y + h / 2 + 1}" class="sub" text-anchor="end" dominant-baseline="middle">${esc(sub)}</text>` : ""}
    </g>`;
}

function build(P) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1160 380" role="img" font-family="ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif">
  <title>AgentThinkingUI — the brain thinks, asks a tool, and gets back data (reason), an instruction (act), or both, looping to the answer.</title>
  <defs>
    <linearGradient id="brain" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${P.rustFrom}"/><stop offset="1" stop-color="${P.rustTo}"/>
    </linearGradient>
  </defs>
  <style>
    @keyframes p   { 0%,100%{opacity:1} 50%{opacity:.42} }
    @keyframes flow{ to{ stroke-dashoffset:-28 } }
    @keyframes bob { 0%,100%{ transform:translateY(0) } 50%{ transform:translateY(-5px) } }
    .flow  { stroke-dasharray:6 7; animation:flow 1.3s linear infinite; }
    .brain { animation:bob 5s ease-in-out infinite; }
    .r1 { animation:p 2.6s ease-in-out infinite 0s; }
    .r2 { animation:p 2.6s ease-in-out infinite .5s; }
    .r3 { animation:p 2.6s ease-in-out infinite 1s; }
    .ans{ animation:p 2.6s ease-in-out infinite 1.5s; }
    .lbl { fill:${P.ink}; font-size:19px; font-weight:700; }
    .sub { fill:${P.inkSoft}; font-size:13px; font-weight:600; font-style:italic; }
    .cap { fill:${P.inkSoft}; font-size:15px; }
    .tag { fill:${P.inkSoft}; font-size:13px; font-style:italic; }
    .name{ fill:${P.inkSoft}; font-size:14px; font-weight:700; }
    @media (prefers-reduced-motion: reduce){ .flow,.brain,.r1,.r2,.r3,.ans{ animation:none } }
  </style>

  <rect x="1" y="1" width="1158" height="378" rx="26" fill="${P.paper}" stroke="${P.line}"/>

  <!-- connectors brain ⇄ tools -->
  <g fill="none" stroke-linecap="round">
    <path class="flow" d="M232 196 Q305 256 376 200" stroke="${P.call}" stroke-width="2.4"/>
    <path d="M372 205 l8 -7 l-2 10 Z" fill="${P.call}" stroke="none"/>
    <path class="flow" d="M376 142 Q305 84 234 146" stroke="${P.inkSoft}" stroke-width="2.4"/>
    <path d="M238 142 l-8 7 l2 -10 Z" fill="${P.inkSoft}" stroke="none"/>
  </g>
  <text x="305" y="250" class="tag" text-anchor="middle">asks for what it's missing</text>
  <text x="305" y="100" class="tag" text-anchor="middle">tool replies</text>

  <!-- brain (outer g positions via attribute; inner g animates so CSS transform
       doesn't clobber the placement) -->
  <g transform="translate(111 118) scale(1.05)">
    <g class="brain">
      <path d="${BRAIN_D}" fill="url(#brain)" stroke="${P.paper}" stroke-width="3" stroke-linejoin="round"/>
      <g fill="${P.ink}"><circle cx="47" cy="46" r="5.5"/><circle cx="65" cy="46" r="5.5"/></g>
      <path d="M50 60 q6 6 12 0" fill="none" stroke="${P.ink}" stroke-width="3" stroke-linecap="round"/>
    </g>
  </g>
  <text x="170" y="262" class="name" text-anchor="middle">LLM brain</text>

  <!-- toolbox -->
  <g>
    <rect x="382" y="132" width="96" height="74" rx="13" fill="${P.paper2}" stroke="${P.line}" stroke-width="1.5"/>
    <rect x="382" y="132" width="96" height="22" rx="11" fill="${P.line}"/>
    <rect x="420" y="126" width="20" height="9" rx="4" fill="${P.inkSoft}"/>
    <g fill="${P.call}"><rect x="402" y="170" width="9" height="22" rx="2"/><rect x="425" y="170" width="9" height="22" rx="2"/><rect x="448" y="170" width="9" height="22" rx="2"/></g>
  </g>
  <text x="430" y="262" class="name" text-anchor="middle">tools</text>

  <!-- a tool reply is ONE OF three shapes — a brace, not a fan (a fan implied the
       toolbox emits all three at once, which is misleading) -->
  <g fill="none" stroke="${P.inkSoft}" stroke-linecap="round">
    <path class="flow" d="M486 190 H534" stroke-width="2.2"/>
    <path d="M540 118 V262" stroke-width="2" opacity=".5"/>
    <path d="M534 190 H540 M540 116 H558 M540 190 H558 M540 264 H558" stroke-width="2" opacity=".5"/>
  </g>
  <text x="560" y="74" class="tag">a tool reply is one of —</text>

  <!-- the three reply shapes (the mental model) -->
  ${pill(560, 88, 360, 56, P.dataTint, P.line, P.data, "data", "r1", "→ reason")}
  ${pill(560, 162, 360, 56, P.instrTint, P.line, P.instr, "instruction", "r2", "→ act · skill / steering")}
  <g class="r3">
    <rect x="560" y="236" width="360" height="56" rx="28" fill="${P.paper2}" stroke="${P.line}" stroke-width="1.5"/>
    <circle cx="588" cy="264" r="17" fill="${P.data}"/><path d="M571 264 a17 17 0 0 1 34 0 Z" fill="${P.instr}"/>
    <text x="624" y="265" class="lbl" dominant-baseline="middle">data + instruction</text>
    <text x="904" y="265" class="sub" text-anchor="end" dominant-baseline="middle">→ both</text>
  </g>

  <!-- …the brain reasons / acts, and the loop ends in the answer -->
  <g fill="none" stroke-linecap="round">
    <path class="flow" d="M924 190 H986" stroke="${P.answer}" stroke-width="2.4"/>
    <path d="M982 185 l8 5 l-8 5 Z" fill="${P.answer}" stroke="none"/>
  </g>
  <g class="ans">
    <circle cx="1044" cy="190" r="36" fill="${P.answer}"/>
    <path d="M1029 191 l10 10 l20 -22" fill="none" stroke="${P.card}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
  </g>
  <text x="1044" y="250" class="name" text-anchor="middle" fill="${P.answerDeep}">answer</text>

  <text x="580" y="336" class="cap" text-anchor="middle">The brain thinks · asks a tool · gets <tspan fill="${P.dataDeep}" font-weight="700">data</tspan> (reason), an <tspan fill="${P.instrDeep}" font-weight="700">instruction</tspan> (act), or both · loops to the answer.</text>
</svg>
`;
}

writeFileSync(new URL("./hero-light.svg", import.meta.url), build(LIGHT));
writeFileSync(new URL("./hero-dark.svg", import.meta.url), build(DARK));
console.log("wrote hero-light.svg + hero-dark.svg");
