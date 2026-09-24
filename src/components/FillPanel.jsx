const MODES = [['full', 'Full Pipe', '100%'], ['half', 'Half Pipe', '50%'], ['custom', 'Custom', '10–100%']];

export default function FillPanel({ fillMode, customLevel, onModeChange, onLevelChange }) {
  return (
    <div className="panel fill">
      <h2>Water Fill Mode</h2>
      <div className="btns">
        {MODES.map(([id, label, hint]) => (
          <button key={id} className={fillMode === id ? 'active' : ''} onClick={() => onModeChange(id)} title={hint}>
            {label}
          </button>
        ))}
      </div>
      {fillMode === 'custom' && (
        <div className="ctrl fill-level">
          <label>Water Level (h/D) <span>{customLevel} %</span></label>
          <input type="range" min="10" max="100" step="1" value={customLevel}
            onChange={e => onLevelChange(parseInt(e.target.value, 10))} />
        </div>
      )}
      <div className="hint">
        {fillMode === 'full'
          ? 'Pressurised full-pipe flow — no free surface.'
          : 'Partial fill (free surface) is a visual mode; readings use the full-pipe calculation.'}
      </div>
    </div>
  );
}
