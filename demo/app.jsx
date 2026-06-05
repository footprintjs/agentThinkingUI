/* global React, ReactDOM, AgentFootprint, useTweaks, TweaksPanel, TweakSection, TweakRadio, TweakToggle */
const { useState } = React;
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

function dkc(h){h=h.replace('#','');const n=parseInt(h,16);return '#'+[(n>>16&255)*.72,(n>>8&255)*.72,(n&255)*.72].map(x=>Math.round(x).toString(16).padStart(2,'0')).join('');}
function tnc(h){h=h.replace('#','');const n=parseInt(h,16);const m=.86;return '#'+[(n>>16&255),(n>>8&255),(n&255)].map(c=>Math.round(c+(255-c)*m).toString(16).padStart(2,'0')).join('');}
function Gear(){return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3.2"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-2.9 1.2V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-2.9-1.2l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0-1.2-2.9H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.2-2.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>;}

// DEMO-only: a gear that live-edits the three config objects to show they're pluggable
function DemoSettings({ refresh }) {
  const [open, setOpen] = useState(false);
  const R = window.AGENT_THEME_RESOLVED;
  const sv = (k, v) => document.documentElement.style.setProperty(k, v);
  const brand = (hex) => { sv('--rust', hex); sv('--rust-deep', dkc(hex)); sv('--rust-tint', tnc(hex)); sv('--brain-from', hex); sv('--brain-to', dkc(hex)); refresh(); };
  const setBrain = (cfg) => { R.icons.brain = cfg; refresh(); };
  const setTool = (cfg) => { R.icons.toolbox = cfg; refresh(); };
  const setName = (k, v) => { R.displayName[k] = v; refresh(); };
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
          <div style={{ display: 'flex', gap: 8 }}>{['#C0531F', '#2563EB', '#1F8A5B', '#7A5AE0'].map(c => <button key={c} onClick={() => brand(c)} style={{ width: 26, height: 26, borderRadius: 8, background: c, border: '2px solid #fff', boxShadow: '0 0 0 1px #E6D8C2', cursor: 'pointer' }} />)}</div>
          <div style={lbl}>Display names</div>
          <input style={{ ...inp, marginBottom: 7 }} defaultValue={R.displayName.agent} onChange={e => setName('agent', e.target.value)} />
          <input style={inp} defaultValue={R.displayName.toolbox} onChange={e => setName('toolbox', e.target.value)} />
          <div style={lbl}>Brain icon</div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button style={chip(R.icons.brain.kind === 'default')} onClick={() => setBrain({ kind: 'default' })}>drawn</button>
            <button style={chip(R.icons.brain.value === '🧠')} onClick={() => setBrain({ kind: 'emoji', value: '🧠' })}>🧠</button>
            <button style={chip(R.icons.brain.value === '🤖')} onClick={() => setBrain({ kind: 'emoji', value: '🤖' })}>🤖</button>
          </div>
          <div style={lbl}>Toolbox icon</div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button style={chip(R.icons.toolbox.kind === 'default')} onClick={() => setTool({ kind: 'default' })}>drawn</button>
            <button style={chip(R.icons.toolbox.value === '🧰')} onClick={() => setTool({ kind: 'emoji', value: '🧰' })}>🧰</button>
            <button style={chip(R.icons.toolbox.value === '🛠️')} onClick={() => setTool({ kind: 'emoji', value: '🛠️' })}>🛠️</button>
          </div>
        </div>
      )}
    </div>
  );
}

// the demo just composes the library's <AgentFootprint> + demo-only chrome (tweaks + gear)
function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [, setTick] = useState(0);
  const refresh = () => setTick((n) => n + 1);

  const acc = ACCENTS[t.accent] || ACCENTS["teal-amber"];
  const accentVars = {
    "--data": acc.data[0], "--data-deep": acc.data[1], "--data-tint": acc.data[2],
    "--instr": acc.instr[0], "--instr-deep": acc.instr[1], "--instr-tint": acc.instr[2],
  };

  return (
    <>
      <AgentFootprint trace={TRACE} metaphor={t.metaphor} loop={t.loop} style={accentVars} />
      <DemoSettings refresh={refresh} />
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
