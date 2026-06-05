/* global React, ReactDOM, AgentFootprint, useTweaks, TweaksPanel, TweakSection, TweakRadio, TweakToggle */
const { useState, useMemo } = React;
const TRACE = window.AGENT_TRACE;

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

function Gear(){return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3.2"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-2.9 1.2V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-2.9-1.2l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0-1.2-2.9H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.2-2.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>;}

// DEMO-only gear. It edits the SAME theme/labels/icons props the host would
// pass — pure controlled state, no DOM or global poking — to show the player
// is fully driven (and re-themes live) through its public props.
function DemoSettings({ brand, setBrand, labels, setLabels, icons, setIcons }) {
  const [open, setOpen] = useState(false);
  const def = window.AgentTheme.normalize({}).displayName; // built-in label defaults
  const brainCfg = icons.brain || { kind: "default" };
  const toolCfg = icons.toolbox || { kind: "default" };
  const setBrain = (cfg) => setIcons({ ...icons, brain: cfg });
  const setTool = (cfg) => setIcons({ ...icons, toolbox: cfg });
  const setName = (k, v) => setLabels({ ...labels, [k]: v });
  const lbl = { fontSize: 10.5, fontWeight: 800, letterSpacing: '.1em', textTransform: 'uppercase', color: '#A2917C', margin: '13px 0 6px' };
  const inp = { width: '100%', font: 'inherit', fontSize: 13, padding: '6px 9px', border: '1px solid #E6D8C2', borderRadius: 8, background: '#fff', color: '#2C1F15', boxSizing: 'border-box' };
  const chip = (on) => ({ font: 'inherit', fontSize: 13, padding: '5px 11px', border: '1px solid ' + (on ? '#C0531F' : '#E6D8C2'), borderRadius: 8, background: on ? '#F6E4D6' : '#fff', cursor: 'pointer' });
  return (
    <div style={{ position: 'fixed', top: 18, right: 22, zIndex: 60 }}>
      <button onClick={() => setOpen(o => !o)} title="Live props" style={{ width: 38, height: 38, borderRadius: 11, border: '1px solid #E6D8C2', background: '#fff', color: '#6E5C49', display: 'grid', placeItems: 'center', boxShadow: '0 2px 8px rgba(70,45,25,.1)', cursor: 'pointer' }}><Gear /></button>
      {open && (
        <div style={{ position: 'absolute', top: 46, right: 0, width: 236, background: '#FFFDF8', border: '1px solid #E6D8C2', borderRadius: 16, boxShadow: '0 18px 50px rgba(70,45,25,.18)', padding: '6px 16px 16px', fontFamily: 'var(--font-body)' }}>
          <div style={{ ...lbl, color: '#C0531F', marginTop: 8 }}>Live props · demo</div>
          <div style={lbl}>Brand colour</div>
          <div style={{ display: 'flex', gap: 8 }}>{['#C0531F', '#2563EB', '#1F8A5B', '#7A5AE0'].map(c => <button key={c} onClick={() => setBrand(c)} style={{ width: 26, height: 26, borderRadius: 8, background: c, border: '2px solid #fff', boxShadow: '0 0 0 ' + (brand === c ? '2px' : '1px') + ' ' + (brand === c ? '#C0531F' : '#E6D8C2'), cursor: 'pointer' }} />)}</div>
          <div style={lbl}>Display names</div>
          <input style={{ ...inp, marginBottom: 7 }} defaultValue={labels.agent != null ? labels.agent : def.agent} onChange={e => setName('agent', e.target.value)} />
          <input style={inp} defaultValue={labels.toolbox != null ? labels.toolbox : def.toolbox} onChange={e => setName('toolbox', e.target.value)} />
          <div style={lbl}>Brain icon</div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button style={chip(brainCfg.kind === 'default')} onClick={() => setBrain({ kind: 'default' })}>drawn</button>
            <button style={chip(brainCfg.value === '🧠')} onClick={() => setBrain({ kind: 'emoji', value: '🧠' })}>🧠</button>
            <button style={chip(brainCfg.value === '🤖')} onClick={() => setBrain({ kind: 'emoji', value: '🤖' })}>🤖</button>
          </div>
          <div style={lbl}>Toolbox icon</div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button style={chip(toolCfg.kind === 'default')} onClick={() => setTool({ kind: 'default' })}>drawn</button>
            <button style={chip(toolCfg.value === '🧰')} onClick={() => setTool({ kind: 'emoji', value: '🧰' })}>🧰</button>
            <button style={chip(toolCfg.value === '🛠️')} onClick={() => setTool({ kind: 'emoji', value: '🛠️' })}>🛠️</button>
          </div>
        </div>
      )}
    </div>
  );
}

// the demo just composes the library's <AgentFootprint> + demo-only chrome
// (tweaks + gear), passing all branding through its theme/labels/icons props.
function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [brand, setBrand] = useState(null);
  const [labels, setLabels] = useState({});
  const [icons, setIcons] = useState({});

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
      <AgentFootprint trace={TRACE} metaphor={t.metaphor} loop={t.loop}
        theme={theme} labels={labels} icons={icons} />
      <DemoSettings brand={brand} setBrand={setBrand}
        labels={labels} setLabels={setLabels} icons={icons} setIcons={setIcons} />
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
    </>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
