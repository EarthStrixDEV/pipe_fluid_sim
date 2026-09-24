import { useMemo } from 'react';
import { fieldRange } from '../physics/layout.js';
import { rampGradientCss } from '../scene/colormap.js';

const TICKS = 5;

export default function Legend({ mode, result }) {
  const range = useMemo(() => (mode === 'water' ? null : fieldRange(mode, result)), [mode, result]);
  if (!range) return null;

  const isPressure = mode === 'pressure';
  const unit = isPressure ? 'kPa' : 'm/s';
  const dec = isPressure ? 1 : 2;
  const ticks = Array.from({ length: TICKS }, (_, i) => range.lo + (range.hi - range.lo) * i / (TICKS - 1));

  return (
    <div className="panel legend">
      <h2>{isPressure ? 'Pressure (gauge)' : 'Velocity'} — Color Scale [{unit}]</h2>
      <div className="bar" style={{ background: rampGradientCss() }} />
      <div className="legend-scale">
        {ticks.map((t, i) => <span key={i}>{t.toFixed(dec)}</span>)}
      </div>
      <div className="legend-ends"><span>Low</span><span>High</span></div>
      {!isPressure && <div className="hint">Arrow length & speed ∝ local velocity V = Q / A</div>}
      <div className="note">⚠ สีเป็น Visualization เพื่อแสดงค่าเท่านั้น — ไม่ใช่สีจริงของน้ำ</div>
    </div>
  );
}
