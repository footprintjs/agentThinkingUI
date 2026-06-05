/* global React, ReactDOM, AgentThinkingUI, DemoSettings, useTweaks, TweaksPanel, TweakSection, TweakRadio, TweakToggle */
const { useState, useMemo, useEffect } = React;
const TRACES = window.AGENT_TRACES || { offsite: window.AGENT_TRACE };
const SCENARIOS = Object.keys(TRACES).map(k => ({ key: k, label: TRACES[k].title || k }));

// responsive: below the breakpoint the demo renders the player's mobile layout
// (stacked tabs + footer transport) — so index.html adapts on its own.
function useIsMobile(bp = 760) {
  const q = "(max-width: " + bp + "px)";
  const [m, setM] = useState(() => window.matchMedia(q).matches);
  useEffect(() => {
    const mq = window.matchMedia(q);
    const on = (e) => setM(e.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, [q]);
  return m;
}

const ACCENTS = {
  "teal-amber":   { data: ["#0E8A82", "#0A6660", "#DCF0ED"], instr: ["#C98512", "#9A6306", "#F8EBCC"] },
  "blue-violet":  { data: ["#2563EB", "#1D4FBF", "#DCE6FB"], instr: ["#7C53D6", "#5B37AB", "#EBE3FA"] },
  "forest-coral": { data: ["#2E8B57", "#1F6B41", "#DCEFE3"], instr: ["#E2663A", "#B4451E", "#FBE3DA"] },
};

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "accent": "teal-amber",
  "metaphor": true,
  "loop": false
}/*EDITMODE-END*/;

// the demo just composes the library's <AgentFootprint> + demo-only chrome
// (tweaks + gear), passing all branding through its theme/labels/icons props.
const GhIcon = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
    <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0016 8c0-4.42-3.58-8-8-8z"/>
  </svg>
);

// demo-only credit — two link-buttons: the library repo + the author (kept out
// of the library itself)
function DemoCredit() {
  const btn = { display: "flex", alignItems: "center", gap: 6, padding: "5px 11px", borderRadius: 999,
    border: "1px solid #E6D8C2", background: "#fff", textDecoration: "none", color: "#2C1F15",
    fontSize: 12.5, fontWeight: 600, whiteSpace: "nowrap" };
  return (
    <div style={{ position: "fixed", bottom: 14, left: "50%", transform: "translateX(-50%)", zIndex: 55,
      display: "flex", alignItems: "center", gap: 8, padding: "6px 8px", borderRadius: 999,
      background: "rgba(255,253,248,.92)", border: "1px solid #E6D8C2", boxShadow: "0 2px 12px rgba(70,45,25,.12)",
      backdropFilter: "blur(4px)", fontSize: 12.5, color: "#6E5C49" }}>
      <span style={{ paddingLeft: 6, color: "#6E5C49" }}>Built with <b style={{ color: "#2C1F15" }}>AgentThinkingUI</b></span>
      <a href="https://github.com/footprintjs/agentThinkingUI" target="_blank" rel="noopener noreferrer" title="Library on GitHub" style={btn}>
        <GhIcon /> GitHub
      </a>
      <a href="https://github.com/sanjay1909" target="_blank" rel="noopener noreferrer" title="Author on GitHub" style={{ ...btn, fontWeight: 500, color: "#6E5C49" }}>
        <GhIcon /> Sanjay Krishna Anbalagan
      </a>
    </div>
  );
}

function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [brand, setBrand] = useState(null);
  const [labels, setLabels] = useState({});
  const [icons, setIcons] = useState({});
  const [font, setFont] = useState(null);
  const [sceneKey, setSceneKey] = useState(SCENARIOS[0].key);
  const isMobile = useIsMobile(760);
  const trace = TRACES[sceneKey] || TRACES[SCENARIOS[0].key];

  const acc = ACCENTS[t.accent] || ACCENTS["teal-amber"];
  const theme = useMemo(() => ({
    colors: {
      data: { base: acc.data[0], deep: acc.data[1], tint: acc.data[2] },
      instruction: { base: acc.instr[0], deep: acc.instr[1], tint: acc.instr[2] },
      ...(brand ? { brand } : {}),
    },
    ...(font ? { fonts: font } : {}),
  }), [t.accent, brand, font]);

  return (
    <>
      <AgentThinkingUI key={sceneKey} trace={trace} mobile={isMobile} metaphor={t.metaphor} loop={t.loop}
        theme={theme} labels={labels} icons={icons} />
      <DemoSettings brand={brand} setBrand={setBrand}
        labels={labels} setLabels={setLabels} icons={icons} setIcons={setIcons}
        scenarios={SCENARIOS} sceneKey={sceneKey} setSceneKey={setSceneKey} setFont={setFont} />
      {!isMobile && <DemoCredit />}
      {/* the accent/storytelling side panel is desktop-only chrome; the gear
          modal covers branding on small screens */}
      {!isMobile && (
        <TweaksPanel>
          <TweakSection label="Color language" />
          <TweakRadio label="Accent set" value={t.accent}
            options={["teal-amber", "blue-violet", "forest-coral"]}
            onChange={(v) => setTweak("accent", v)} />
          <TweakSection label="Storytelling" />
          <TweakToggle label="Metaphor labels" value={t.metaphor}
            onChange={(v) => setTweak("metaphor", v)} />
          <TweakToggle label="Auto-loop replay" value={t.loop}
            onChange={(v) => setTweak("loop", v)} />
        </TweaksPanel>
      )}
    </>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
