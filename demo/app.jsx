/* global React, ReactDOM, AgentThinkingUI, DemoSettings, useTweaks, TweaksPanel, TweakSection, TweakRadio, TweakToggle */
const { useState, useMemo, useEffect } = React;
const TRACE = window.AGENT_TRACE;

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
// demo-only credit — links back to the repo + author (kept out of the library)
function DemoCredit() {
  return (
    <a href="https://github.com/footprintjs/agentThinkingUI" target="_blank" rel="noopener noreferrer"
      style={{ position: "fixed", bottom: 14, left: "50%", transform: "translateX(-50%)", zIndex: 55,
        display: "flex", alignItems: "center", gap: 8, padding: "6px 13px", borderRadius: 999,
        background: "rgba(255,253,248,.9)", border: "1px solid #E6D8C2", boxShadow: "0 2px 12px rgba(70,45,25,.12)",
        backdropFilter: "blur(4px)", textDecoration: "none", color: "#6E5C49", fontSize: 12.5 }}>
      <b style={{ color: "#2C1F15" }}>AgentThinkingUI</b>
      <span style={{ opacity: .45 }}>·</span>
      <span>by Sanjay Krishna Anbalagan</span>
    </a>
  );
}

function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [brand, setBrand] = useState(null);
  const [labels, setLabels] = useState({});
  const [icons, setIcons] = useState({});
  const isMobile = useIsMobile(760);

  const acc = ACCENTS[t.accent] || ACCENTS["teal-amber"];
  const theme = useMemo(() => ({
    colors: {
      data: { base: acc.data[0], deep: acc.data[1], tint: acc.data[2] },
      instruction: { base: acc.instr[0], deep: acc.instr[1], tint: acc.instr[2] },
      ...(brand ? { brand } : {}),
    },
  }), [t.accent, brand]);

  return (
    <>
      <AgentThinkingUI trace={TRACE} mobile={isMobile} metaphor={t.metaphor} loop={t.loop}
        theme={theme} labels={labels} icons={icons} />
      <DemoSettings brand={brand} setBrand={setBrand}
        labels={labels} setLabels={setLabels} icons={icons} setIcons={setIcons} />
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
