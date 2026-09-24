const f = (v, d = 1) => (Number.isFinite(v) ? v.toFixed(d) : '—');

export default function ReadoutPanel({ r, valveOpening }) {
  const rows = [
    ['Flow Rate (actual)', `${f(r.Q * 60000)} L/min`],
    ['Velocity — main pipe (V1)', `${f(r.V1, 2)} m/s`],
    ['Velocity — small pipe (V3)', `${f(r.V3, 2)} m/s`],
    ['Velocity — large pipe (V4)', `${f(r.V4, 2)} m/s`],
    ['Pressure P1 — before valve', `${f(r.P1 / 1000)} kPa`],
    ['Pressure P2 — after valve', `${f(r.P2 / 1000)} kPa`],
    ['Pressure P3 — small pipe', `${f(r.P3 / 1000)} kPa`],
    ['Valve Opening', `${valveOpening} %`],
    ['Valve K / head loss hL', Number.isFinite(r.K) ? `${f(r.K, 2)} / ${f(r.hL, 2)} m` : 'closed'],
    ['Pressure Drop (P1 − P2)', `${f(r.dP / 1000)} kPa`],
  ];
  const energy = [['P1', 'P1'], ['P2', 'P2'], ['P3', 'P3'], ['Outlet', 'P4']];

  return (
    <div className="panel readout">
      <h2>Measured Values</h2>
      <div className="grid">
        {rows.map(([k, v]) => [<div className="k" key={k}>{k}</div>, <div className="v" key={k + 'v'}>{v}</div>])}
      </div>
      <div className="sep" />
      <h2>Energy Balance (H = P/ρg + V²/2g + z)</h2>
      <table>
        <thead><tr><th>Point</th><th>P/ρg [m]</th><th>V²/2g [m]</th><th>z [m]</th><th>H [m]</th></tr></thead>
        <tbody>
          {energy.map(([name, key]) => {
            const e = r.energy[key];
            return (
              <tr key={name}>
                <td>{name}</td><td>{f(e.pHead, 2)}</td><td>{f(e.vHead, 3)}</td><td>{f(e.z, 2)}</td><td>{f(e.H, 2)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="hint">H ลดลงเฉพาะที่วาล์ว (hL) — ส่วนอื่นคงที่ตาม Bernoulli (ไม่คิด friction ท่อ)</div>
    </div>
  );
}
