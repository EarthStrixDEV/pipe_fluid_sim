import { pointReading } from '../physics/hydraulics.js';

export default function ProbePanel({ result, point, onClose }) {
  if (!point) return null;
  const p = pointReading(result, point);
  const rows = [
    ['Pressure', p.pressureKPa.toFixed(1), 'kPa'],
    ['Velocity', p.velocity.toFixed(2), 'm/s'],
    ['Flow Rate', p.flowLmin.toFixed(1), 'L/min'],
  ];
  return (
    <div className="panel probe">
      <div className="probe-head">
        <h2>{p.title}</h2>
        <button className="close" onClick={onClose} aria-label="Close">×</button>
      </div>
      <div className="probe-sub">Pipe Ø{p.diameter} mm</div>
      <div className="probe-grid">
        {rows.map(([k, v, u]) => (
          <div key={k} className="probe-cell">
            <div className="k">{k}</div>
            <div className="v">{v}<span>{u}</span></div>
          </div>
        ))}
      </div>
    </div>
  );
}
