import { D_MAIN, D_LARGE } from '../physics/hydraulics.js';

const SLIDERS = [
  { key: 'flowRate', label: 'Flow Rate (setpoint)', unit: 'L/min', min: 0, max: 400, step: 1 },
  { key: 'smallDiameter', label: 'Small Pipe Diameter', unit: 'mm', min: 15, max: 50, step: 1,
    note: `Main pipe = ${D_MAIN} mm, Large pipe = ${D_LARGE} mm (fixed)` },
  { key: 'valveOpening', label: 'Valve Opening', unit: '%', min: 0, max: 100, step: 1 },
  { key: 'inletPressure', label: 'Inlet Pressure (gauge)', unit: 'kPa', min: 0, max: 500, step: 5 },
];

export default function ControlPanel({ params, onChange, status }) {
  return (
    <div className="panel controls">
      <h2>Input Parameters</h2>
      {SLIDERS.map(s => (
        <div className="ctrl" key={s.key}>
          <label>{s.label} <span>{params[s.key]} {s.unit}</span></label>
          <input type="range" min={s.min} max={s.max} step={s.step} value={params[s.key]}
            onChange={e => onChange(s.key, parseFloat(e.target.value))} />
          {s.note && <small>{s.note}</small>}
        </div>
      ))}
      <div className="status">{status.join(' ')}</div>
    </div>
  );
}
