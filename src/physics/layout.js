// Geometry layout along the pipe axis (scene units = metres; radii visually exaggerated)
// and field sampling of the hydraulic result along x.
import { area, RHO } from './hydraulics.js';

const clamp01 = t => Math.min(1, Math.max(0, t));
const lerp = (a, b, t) => a + (b - a) * clamp01(t);

export const Layout = {
  pipeY: 1.4,
  xStart: -5.0, xEnd: 7.6,
  valveStart: -1.95, valveEnd: -1.05, valveX: -1.5,
  reducerA: 0.3, reducerB: 0.9,       // main → small
  expanderA: 3.4, expanderB: 4.2,     // small → large
  gauges: { P1: -3.1, P2: -0.45, P3: 2.15 },
  radiusScale: 0.004,                 // scene radius per mm of diameter
};

export function diameterAt(x, r) {
  const L = Layout;
  if (x < L.reducerA) return r.D1;
  if (x < L.reducerB) return lerp(r.D1, r.D3, (x - L.reducerA) / (L.reducerB - L.reducerA));
  if (x < L.expanderA) return r.D3;
  if (x < L.expanderB) return lerp(r.D3, r.D4, (x - L.expanderA) / (L.expanderB - L.expanderA));
  return r.D4;
}

export const radiusAt = (x, r) => diameterAt(x, r) * Layout.radiusScale;
export const velocityAt = (x, r) => r.Q / area(diameterAt(x, r));

export function pressureAt(x, r) {
  const L = Layout;
  if (x < L.valveStart) return r.P1;
  if (x < L.valveEnd) return r.P1 + (r.P2 - r.P1) * (x - L.valveStart) / (L.valveEnd - L.valveStart);
  if (r.opening <= 0) return 0;
  const v = velocityAt(x, r);
  return r.P2 + 0.5 * RHO * (r.V1 * r.V1 - v * v);
}

/** Field used by the visualisation modes: pressure in kPa, velocity in m/s. */
export function fieldSampler(mode, r) {
  return mode === 'pressure' ? x => pressureAt(x, r) / 1000 : x => velocityAt(x, r);
}

/** Min/max of a field along the water column — shared by the 3D colouring and the legend. */
export function fieldRange(mode, r, samples = 400) {
  const f = fieldSampler(mode, r);
  let lo = Infinity, hi = -Infinity;
  for (let i = 0; i <= samples; i++) {
    const v = f(Layout.xStart + (Layout.xEnd - Layout.xStart) * i / samples);
    lo = Math.min(lo, v); hi = Math.max(hi, v);
  }
  return { lo, hi };
}
