import { CAMERA_PRESETS } from '../scene/PipeFlowScene.js';

const MODES = [['water', 'Water'], ['pressure', 'Pressure'], ['velocity', 'Velocity']];

export default function ModePanel({ mode, onChange, onCamera, showTracers, onToggleTracers }) {
  return (
    <div className="panel modes">
      <h2>Display Mode</h2>
      <div className="btns">
        {MODES.map(([id, label]) => (
          <button key={id} className={mode === id ? 'active' : ''} onClick={() => onChange(id)}>{label}</button>
        ))}
      </div>
      <label className="toggle">
        <input type="checkbox" checked={showTracers} onChange={e => onToggleTracers(e.target.checked)} />
        Flow tracers <span>(visualization layer)</span>
      </label>
      <h2 className="sub">Camera</h2>
      <div className="btns wrap">
        {Object.entries(CAMERA_PRESETS).map(([id, p]) => (
          <button key={id} onClick={() => onCamera(id)}>{p.label}</button>
        ))}
      </div>
      <div className="hint">Click a gauge (P1–P3) for readings · Left-drag: rotate · Right-drag: pan · Wheel: zoom</div>
    </div>
  );
}
