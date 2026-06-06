/* global React, ReactDOM */
/* ============================================================
   DEMO-only live-props panel (gear). Shared by index.html (desktop +
   responsive) and mobile.html so both previews can rebrand the player
   live. It edits the SAME theme/labels/icons props the host would pass —
   pure controlled state, no DOM or global poking.
   Clicking the gear opens a centred modal over a dimmed, non-interactive
   backdrop (portaled into #root so it covers the app — including inside
   the phone frame). `containerStyle` anchors the gear trigger.
   ============================================================ */
const { useState: dsUseState } = React;

function Gear(){return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3.2"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-2.9 1.2V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-2.9-1.2l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0-1.2-2.9H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.2-2.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>;}
function GhMark(){return <svg width="17" height="17" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0016 8c0-4.42-3.58-8-8-8z"/></svg>;}

// font presets the gear can swap live (families fall back to system fonts so the
// change is visible without loading anything extra)
const FONT_PRESETS = {
  warm:   { label: "Warm",   fonts: null }, // the built-in look
  system: { label: "System", fonts: { display: "system-ui, sans-serif", body: "system-ui, sans-serif", mono: "ui-monospace, monospace", hand: "system-ui, sans-serif" } },
  serif:  { label: "Serif",  fonts: { display: 'Georgia, "Times New Roman", serif', body: "Georgia, serif", mono: "ui-monospace, monospace", hand: "Georgia, serif" } },
};

function DemoSettings({ brand, setBrand, labels, setLabels, icons, setIcons, containerStyle, scenarios, sceneKey, setSceneKey, setFont, onLive, liveOn, onImport, otlpSample }) {
  const [open, setOpen] = dsUseState(false);
  const taRef = React.useRef(null);
  const [fontKey, setFontKey] = dsUseState("warm");
  const [scale, setScale] = dsUseState(1);
  const def = window.AgentTheme.normalize({}).displayName; // built-in label defaults
  const brainCfg = icons.brain || { kind: "default" };
  const toolCfg = icons.toolbox || { kind: "default" };
  const setBrain = (cfg) => setIcons({ ...icons, brain: cfg });
  const setTool = (cfg) => setIcons({ ...icons, toolbox: cfg });
  const setName = (k, v) => setLabels({ ...labels, [k]: v });
  const applyFont = (k, s) => { setFontKey(k); setScale(s); setFont && setFont({ ...(FONT_PRESETS[k].fonts || {}), scale: s }); };
  const lbl = { fontSize: 10.5, fontWeight: 800, letterSpacing: '.1em', textTransform: 'uppercase', color: '#A2917C', margin: '13px 0 6px' };
  const inp = { width: '100%', font: 'inherit', fontSize: 13, padding: '6px 9px', border: '1px solid #E6D8C2', borderRadius: 8, background: '#fff', color: '#2C1F15', boxSizing: 'border-box' };
  const chip = (on) => ({ font: 'inherit', fontSize: 13, padding: '5px 11px', border: '1px solid ' + (on ? '#C0531F' : '#E6D8C2'), borderRadius: 8, background: on ? '#F6E4D6' : '#fff', cursor: 'pointer' });

  const modal = open && ReactDOM.createPortal(
    <div onClick={() => setOpen(false)}
      style={{ position: 'absolute', inset: 0, background: 'rgba(48,44,40,.46)', backdropFilter: 'blur(1px)', display: 'grid', placeItems: 'center', zIndex: 80, padding: 16 }}>
      <div onClick={e => e.stopPropagation()}
        style={{ width: 300, maxWidth: '88%', maxHeight: '86%', overflowY: 'auto', background: '#FFFDF8', border: '1px solid #E6D8C2', borderRadius: 18, boxShadow: '0 24px 70px rgba(70,45,25,.32)', padding: '4px 20px 20px', fontFamily: 'var(--font-body)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ ...lbl, color: '#C0531F', marginTop: 14 }}>Live props · demo</div>
          <button onClick={() => setOpen(false)} title="Close" style={{ border: 'none', background: 'transparent', fontSize: 22, color: '#A2917C', cursor: 'pointer', lineHeight: 1, padding: 0 }}>×</button>
        </div>
        {onLive && <>
          <div style={lbl}>Live monitoring (demo)</div>
          <button onClick={() => { setOpen(false); onLive(); }}
            style={{ width: '100%', font: 'inherit', fontSize: 13, fontWeight: 700, padding: '9px 12px', border: 'none', borderRadius: 10, background: '#C0531F', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#fff', boxShadow: '0 0 0 3px rgba(255,255,255,.35)' }} />
            {liveOn ? 'Restart live stream' : 'Start live stream'}
          </button>
          <div style={{ fontSize: 11.5, color: '#A2917C', marginTop: 5 }}>Streams the beats in one at a time — watch the scene + timeline fill in real time.</div>
        </>}
        {onImport && <>
          <div style={lbl}>Import an OpenTelemetry trace</div>
          <textarea ref={taRef} defaultValue={otlpSample} spellCheck={false}
            style={{ width: '100%', height: 84, fontFamily: 'ui-monospace, monospace', fontSize: 11, lineHeight: 1.4, padding: '7px 9px', border: '1px solid #E6D8C2', borderRadius: 8, background: '#fff', color: '#2C1F15', boxSizing: 'border-box', resize: 'vertical' }} />
          <button onClick={() => { setOpen(false); onImport((taRef.current && taRef.current.value) || otlpSample); }}
            style={{ width: '100%', marginTop: 6, font: 'inherit', fontSize: 13, fontWeight: 700, padding: '8px 12px', border: '1px solid #C0531F', borderRadius: 10, background: '#fff', color: '#C0531F', cursor: 'pointer' }}>
            Convert &amp; play
          </button>
          <div style={{ fontSize: 11.5, color: '#A2917C', marginTop: 5 }}>OTLP/JSON from any OpenTelemetry GenAI agent → played as a trace.</div>
        </>}
        {scenarios && scenarios.length > 1 && <>
          <div style={lbl}>Scenario</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {scenarios.map(s => <button key={s.key} style={chip(sceneKey === s.key)} onClick={() => setSceneKey(s.key)}>{s.label}</button>)}
          </div>
        </>}
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
        <div style={lbl}>Typeface</div>
        <div style={{ display: 'flex', gap: 6 }}>
          {Object.keys(FONT_PRESETS).map(k => <button key={k} style={{ ...chip(fontKey === k), fontFamily: (FONT_PRESETS[k].fonts || {}).body || 'inherit' }} onClick={() => applyFont(k, scale)}>{FONT_PRESETS[k].label}</button>)}
        </div>
        <div style={lbl}>Text size</div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {[['A', 0.9], ['A', 1], ['A', 1.1]].map(([t, s], i) => <button key={i} style={{ ...chip(Math.abs(scale - s) < 0.01), fontSize: 11 + i * 3, lineHeight: 1, padding: '4px 12px' }} onClick={() => applyFont(fontKey, s)}>{t}</button>)}
        </div>
      </div>
    </div>,
    document.getElementById('root') || document.body
  );

  const trigger = { width: 38, height: 38, borderRadius: 11, border: '1px solid #E6D8C2', background: '#fff', display: 'grid', placeItems: 'center', boxShadow: '0 2px 8px rgba(70,45,25,.1)', cursor: 'pointer' };
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, ...(containerStyle || { position: 'fixed', top: 18, right: 22, zIndex: 60 }) }}>
      <a href="https://github.com/footprintjs/agentThinkingUI" target="_blank" rel="noopener noreferrer" title="GitHub" style={{ ...trigger, color: '#2C1F15', textDecoration: 'none' }}><GhMark /></a>
      <button onClick={() => setOpen(o => !o)} title="Live props" style={{ ...trigger, color: '#6E5C49' }}><Gear /></button>
      {modal}
    </div>
  );
}

window.Gear = Gear;
window.DemoSettings = DemoSettings;
