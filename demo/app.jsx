/* global React, ReactDOM, AgentThinkingUI, MultiAgentFlow, DemoSettings, useTweaks, TweaksPanel, TweakSection, TweakRadio, TweakToggle */
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
  "loop": false,
  "toolMenu": "rack"
}/*EDITMODE-END*/;

// a tiny real OpenTelemetry GenAI (OTLP/JSON) trace — prefilled in the gear's
// "Import an OTel trace" box so anyone can see the adapter convert + play it.
const A = (o) => Object.entries(o).map(([key, v]) => ({ key, value: typeof v === "number" ? { intValue: String(v) } : { stringValue: String(v) } }));
const sp = (attrs, events, s, ms, status) => ({ startTimeUnixNano: String(1700000000000000000n + BigInt(s) * 1000000n), endTimeUnixNano: String(1700000000000000000n + BigInt(s + ms) * 1000000n), attributes: A(attrs), events: (events || []).map((e) => ({ name: e.name, attributes: A(e.attrs) })), ...(status ? { status } : {}) });
const SAMPLE_OTLP = { resourceSpans: [{ scopeSpans: [{ spans: [
  sp({ "gen_ai.operation.name": "invoke_agent", "gen_ai.agent.name": "support-agent", "gen_ai.request.model": "claude-sonnet", "gen_ai.usage.input_tokens": 120, "gen_ai.usage.output_tokens": 180, "gen_ai.usage.cache_read_input_tokens": 96 },
     [{ name: "gen_ai.user.message", attrs: { content: "Is order #8842 refundable?" } }, { name: "gen_ai.assistant.message", attrs: { content: "Yes — issued a full refund; it's within the 14-day window." } }], 0, 1200),
  sp({ "gen_ai.operation.name": "execute_tool", "gen_ai.tool.name": "lookup_order", "gen_ai.tool.call.arguments": '{"order":"#8842"}' },
     [{ name: "gen_ai.tool.message", attrs: { content: '{"item":"headphones","days_since":12}' } }], 200, 400),
  sp({ "gen_ai.operation.name": "execute_tool", "gen_ai.tool.name": "refund_policy", "gen_ai.tool.call.arguments": "{}" },
     [{ name: "gen_ai.tool.message", attrs: { content: '{"full_refund_within_days":14}' } }], 700, 250),
  sp({ "gen_ai.operation.name": "execute_tool", "gen_ai.tool.name": "issue_refund", "gen_ai.tool.call.arguments": '{"amount":79}' },
     [], 1000, 220, { code: 2, message: "payment gateway timeout" }),
] }] }] };
// the OpenInference flavour (Arize/Phoenix/LlamaIndex) — same shape, different keys
const SAMPLE_OI = { resourceSpans: [{ scopeSpans: [{ spans: [
  sp({ "openinference.span.kind": "AGENT", "agent.name": "qa-agent", "llm.model_name": "gpt-4o-mini", "llm.input_messages.0.message.content": "What's the return policy?", "llm.output_messages.0.message.content": "Returns accepted within 30 days with a receipt." }, [], 0, 900),
  sp({ "openinference.span.kind": "TOOL", "tool.name": "search_docs", "input.value": '{"q":"returns"}', "output.value": '{"hits":3}' }, [], 200, 300),
] }] }] };

// the demo just composes the library's <AgentFootprint> + demo-only chrome
// (tweaks + gear), passing all branding through its theme/labels/icons props.
const GhIcon = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
    <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0016 8c0-4.42-3.58-8-8-8z"/>
  </svg>
);

// demo-only credit — two link-buttons: the library repo + the author (kept out
// of the library itself), plus an in-app single ⟷ multi view toggle
function DemoCredit({ view, setView }) {
  const btn = { display: "flex", alignItems: "center", gap: 6, padding: "5px 11px", borderRadius: 999,
    border: "1px solid #E6D8C2", background: "#fff", textDecoration: "none", color: "#2C1F15",
    fontSize: 12.5, fontWeight: 600, whiteSpace: "nowrap", cursor: "pointer", font: "inherit" };
  return (
    <div style={{ position: "fixed", bottom: 14, left: "50%", transform: "translateX(-50%)", zIndex: 55,
      display: "flex", alignItems: "center", gap: 8, padding: "6px 8px", borderRadius: 999,
      background: "rgba(255,253,248,.92)", border: "1px solid #E6D8C2", boxShadow: "0 2px 12px rgba(70,45,25,.12)",
      backdropFilter: "blur(4px)", fontSize: 12.5, color: "#6E5C49" }}>
      <span style={{ paddingLeft: 6, color: "#6E5C49" }}>Built with <b style={{ color: "#2C1F15" }}>AgentThinkingUI</b></span>
      <a href="https://github.com/footprintjs/agentThinkingUI" target="_blank" rel="noopener noreferrer" title="Library on GitHub" style={btn}>
        <GhIcon /> GitHub
      </a>
      <a href="https://github.com/sanjay1909" target="_blank" rel="noopener noreferrer" title="Author on GitHub" style={{ ...btn, textDecoration: "none", fontWeight: 500, color: "#6E5C49" }}>
        <GhIcon /> Sanjay Krishna Anbalagan
      </a>
      <button onClick={() => setView(view === "multi" ? "single" : "multi")} title="Switch view" style={btn}>
        {view === "multi" ? "Single agent ↗" : "Multi-agent ↗"}
      </button>
    </div>
  );
}

// the multi-agent control-flow patterns (built in flow-trace.js, loaded before us)
const FLOWS = window.AGENT_FLOWS || {};
const FLOW_LIST = Object.keys(FLOWS).map((k) => ({ key: k, label: FLOWS[k].label }));

function App() {
  const { useRef } = React;
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [view, setView] = useState(() => (typeof location !== "undefined" && location.hash === "#multi" ? "multi" : "single")); // 'single' player ⟷ 'multi' team
  const [brand, setBrand] = useState(null);
  const [labels, setLabels] = useState({});
  const [icons, setIcons] = useState({});
  const [font, setFont] = useState(null);
  const [mode, setMode] = useState("light"); // light ⟷ dark theme
  const [sceneKey, setSceneKey] = useState(SCENARIOS[0].key);
  const [live, setLive] = useState(false);
  const [liveSteps, setLiveSteps] = useState(null);
  const [imported, setImported] = useState(null); // a trace converted from OTel
  const liveTimer = useRef(null);
  // multi-agent state
  const [flowKey, setFlowKey] = useState(FLOW_LIST[0] && FLOW_LIST[0].key);
  const [reveal, setReveal] = useState(0); // 0 = whole graph; >0 = live-stream up to N nodes
  const [graphImport, setGraphImport] = useState(null); // a FlowGraph built from telemetry
  const mTimer = useRef(null);
  const isMobile = useIsMobile(760);

  const base = TRACES[sceneKey] || TRACES[SCENARIOS[0].key];
  // imported (OTel) wins; else live grows a trace one step at a time; else the scenario
  const trace = imported || (live && liveSteps ? { ...base, steps: liveSteps } : base);
  // multi: imported graph wins; else the picked pattern, sliced when live-streaming
  const fullGraph = graphImport || (FLOWS[flowKey] && FLOWS[flowKey].graph);
  const mLive = reveal > 0;
  const graph = fullGraph && mLive ? { ...fullGraph, nodes: fullGraph.nodes.slice(0, reveal) } : fullGraph;

  // convert a pasted single-agent trace (OpenTelemetry or OpenInference) and play it
  const onImport = (text, fmt) => {
    try {
      const otlp = JSON.parse(text);
      const fn = fmt === "openinference" ? window.AgentAdapters.fromOpenInference : window.AgentAdapters.fromOTLP;
      const tr = fn(otlp, { asker: "you", title: "Imported · " + (fmt === "openinference" ? "OpenInference" : "OTel") });
      if (!tr.steps || !tr.steps.length) throw new Error("no steps found");
      if (liveTimer.current) clearInterval(liveTimer.current);
      setLive(false); setLiveSteps(null); setImported(tr);
    } catch (e) { window.alert("Couldn't read that trace:\n" + e.message); }
  };

  // build a multi-agent FlowGraph from pasted telemetry, programmatically — each
  // agent's drill-down trace comes from that agent span's child spans.
  const onImportMulti = (text, fmt) => {
    try {
      const otlp = JSON.parse(text);
      const fn = fmt === "openinference" ? window.AgentAdapters.fromOpenInferenceMulti : window.AgentAdapters.fromOTLPMulti;
      const g = fn(otlp, { asker: "you" });
      if (!g.nodes || !g.nodes.length) throw new Error("no agents found");
      stopMulti(); setReveal(0); setGraphImport(g);
    } catch (e) { window.alert("Couldn't read that trace:\n" + e.message); }
  };

  // simulate a live agent: start from the first beat, append the rest on a timer
  const startLive = () => {
    if (liveTimer.current) clearInterval(liveTimer.current);
    setLive(true);
    setLiveSteps([base.steps[0]]);
    let i = 1;
    liveTimer.current = setInterval(() => {
      setLiveSteps((cur) => {
        if (!cur || i >= base.steps.length) { clearInterval(liveTimer.current); liveTimer.current = null; return cur; }
        return [...cur, base.steps[i++]];
      });
    }, 1200);
  };
  // multi: reveal the team one agent at a time
  const stopMulti = () => { if (mTimer.current) clearInterval(mTimer.current); mTimer.current = null; };
  const startLiveMulti = () => {
    stopMulti(); setReveal(1);
    let n = 1;
    mTimer.current = setInterval(() => { n += 1; setReveal(n); if (!fullGraph || n >= fullGraph.nodes.length) stopMulti(); }, 1100);
  };
  const selectScenario = (k) => { if (liveTimer.current) clearInterval(liveTimer.current); setLive(false); setLiveSteps(null); setImported(null); setSceneKey(k); };
  const pickFlow = (k) => { stopMulti(); setReveal(0); setGraphImport(null); setFlowKey(k); };
  const startLiveReset = () => { setImported(null); startLive(); };
  // the gear's one Live button routes to whichever view is on screen
  const onLive = () => (view === "multi" ? startLiveMulti() : startLiveReset());
  const liveOn = view === "multi" ? mLive : live;
  useEffect(() => () => { liveTimer.current && clearInterval(liveTimer.current); mTimer.current && clearInterval(mTimer.current); }, []);

  const acc = ACCENTS[t.accent] || ACCENTS["teal-amber"];
  const theme = useMemo(() => ({
    mode,
    colors: {
      // in dark mode let the accents derive their own tints (skip the light presets)
      data: mode === "dark" ? acc.data[0] : { base: acc.data[0], deep: acc.data[1], tint: acc.data[2] },
      instruction: mode === "dark" ? acc.instr[0] : { base: acc.instr[0], deep: acc.instr[1], tint: acc.instr[2] },
      ...(brand ? { brand } : {}),
    },
    ...(font ? { fonts: font } : {}),
  }), [t.accent, brand, font, mode]);

  const brandMark = <>Agent<b>ThinkingUI</b></>;
  return (
    <>
      {/* reserve bottom space on desktop so the player's content clears the
          fixed "Built with" credit pill (demo-only chrome) */}
      <div style={{ height: "100%", boxSizing: "border-box", paddingBottom: isMobile ? 0 : 64 }}>
        {view === "multi" && graph
          ? <MultiAgentFlow key={graphImport ? "import" : flowKey} trace={graph} live={mLive}
              theme={theme} labels={labels} icons={icons} brand={brandMark} />
          : <AgentThinkingUI key={imported ? "otel" : sceneKey} trace={trace} mobile={isMobile} metaphor={t.metaphor} loop={t.loop}
              toolMenu={t.toolMenu} live={live} theme={theme} labels={labels} icons={icons} brand={brandMark} />}
      </div>
      <DemoSettings brand={brand} setBrand={setBrand}
        labels={labels} setLabels={setLabels} icons={icons} setIcons={setIcons}
        mode={mode} setMode={setMode}
        view={view} setView={setView}
        scenarios={SCENARIOS} sceneKey={sceneKey} setSceneKey={selectScenario} setFont={setFont}
        onLive={onLive} liveOn={liveOn} onImport={onImport}
        otlpSample={JSON.stringify(SAMPLE_OTLP, null, 2)} oiSample={JSON.stringify(SAMPLE_OI, null, 2)}
        flows={FLOW_LIST.length ? FLOW_LIST : undefined} flowKey={flowKey} setFlowKey={pickFlow}
        onImportMulti={onImportMulti}
        otlpMultiSample={window.AGENT_OTLP_MULTI ? JSON.stringify(window.AGENT_OTLP_MULTI, null, 2) : ""}
        oiMultiSample={window.AGENT_OI_MULTI ? JSON.stringify(window.AGENT_OI_MULTI, null, 2) : ""} />
      {!isMobile && <DemoCredit view={view} setView={setView} />}
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
          <TweakRadio label="Tool menu" value={t.toolMenu}
            options={["card", "rack"]}
            onChange={(v) => setTweak("toolMenu", v)} />
        </TweaksPanel>
      )}
    </>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
