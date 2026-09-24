// Pure calculation logic — Bernoulli + Continuity + valve loss. No rendering dependency.

export const RHO = 998.2;          // kg/m³ water @ 20 °C
export const G = 9.81;             // m/s²
export const P_ATM = 101325;       // Pa
export const P_VAPOR = 2339;       // Pa, water @ 20 °C
export const K_FULL_OPEN = 0.25;   // valve loss coefficient when 100 % open
export const D_MAIN = 50;          // mm
export const D_LARGE = 80;         // mm
export const Z = 1.2;              // m, pipe centreline elevation above datum (horizontal system)

export const area = dmm => Math.PI * (dmm / 1000) ** 2 / 4;

// Simple characteristic: K grows with the inverse square of the opening fraction.
export const valveK = opening => (opening <= 0 ? Infinity : K_FULL_OPEN / (opening * opening));

/**
 * @param {{flowRate:number, smallDiameter:number, valveOpening:number, inletPressure:number}} p
 *   flowRate [L/min], smallDiameter [mm], valveOpening [%], inletPressure [kPa gauge]
 */
export function computeHydraulics(p) {
  const A1 = area(D_MAIN), A3 = area(p.smallDiameter), A4 = area(D_LARGE);
  const o = p.valveOpening / 100;
  const K = valveK(o);
  const P0 = p.inletPressure * 1000;
  const Qset = p.flowRate / 60000;

  // Max flow the inlet pressure can push with outlet open to atmosphere (P4 = 0):
  // P0 = ½ρ [ V4² − V1² + K·V1² ]  →  P0 = ½ρ Q² [ 1/A4² + (K−1)/A1² ]
  let Qmax;
  if (o <= 0) Qmax = 0;
  else {
    const c = 1 / (A4 * A4) + (K - 1) / (A1 * A1);
    Qmax = c > 0 ? Math.sqrt(P0 / (0.5 * RHO * c)) : Infinity;
  }
  const Q = Math.min(Qset, Qmax);
  const limited = Qset > Qmax + 1e-9;

  const V1 = Q / A1, V3 = Q / A3, V4 = Q / A4;
  const hL = Number.isFinite(K) ? K * V1 * V1 / (2 * G) : 0;

  const P1 = P0;
  let P2, P3, P4;
  if (o <= 0) { P2 = P3 = P4 = 0; }                      // closed valve, downstream vented to outlet
  else {
    P2 = P1 - RHO * G * hL;                               // valve loss
    P3 = P2 + 0.5 * RHO * (V1 * V1 - V3 * V3);            // Bernoulli, same z
    P4 = P2 + 0.5 * RHO * (V1 * V1 - V4 * V4);
  }

  const head = (P, V) => ({ pHead: P / (RHO * G), vHead: V * V / (2 * G), z: Z, H: P / (RHO * G) + V * V / (2 * G) + Z });
  const pMin = Math.min(P1, P2, P3, P4);

  return {
    Q, Qset, Qmax, limited, K, hL, opening: o,
    D1: D_MAIN, D3: p.smallDiameter, D4: D_LARGE,
    V1, V3, V4, P1, P2, P3, P4,
    dP: P1 - P2,
    cavitation: pMin + P_ATM < P_VAPOR,
    energy: { P1: head(P1, V1), P2: head(P2, V1), P3: head(P3, V3), P4: head(P4, V4) },
  };
}

/** Reading at a measurement tapping — straight from the computed result. */
export const MEASUREMENT_POINTS = {
  P1: { title: 'P1 — Before valve', pressure: 'P1', velocity: 'V1', diameter: 'D1' },
  P2: { title: 'P2 — After valve', pressure: 'P2', velocity: 'V1', diameter: 'D1' },
  P3: { title: 'P3 — Small pipe', pressure: 'P3', velocity: 'V3', diameter: 'D3' },
};

export function pointReading(r, name) {
  const m = MEASUREMENT_POINTS[name];
  return {
    title: m.title,
    pressureKPa: r[m.pressure] / 1000,
    velocity: r[m.velocity],
    flowLmin: r.Q * 60000,
    diameter: r[m.diameter],
  };
}

export function statusMessages(r) {
  const fmt = v => v.toFixed(1);
  const msgs = [];
  if (r.opening <= 0) msgs.push('Valve closed — no flow.');
  else if (r.limited) msgs.push(`Flow limited to ${fmt(r.Qmax * 60000)} L/min by inlet pressure + valve loss.`);
  else if (r.Q > 0 && r.P4 > 500) msgs.push(`Residual outlet pressure ${fmt(r.P4 / 1000)} kPa (assumed throttled at outlet).`);
  if (r.cavitation) msgs.push('P3 below vapour pressure — cavitation risk (model not valid).');
  return msgs;
}
