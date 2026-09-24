// Visual-only turbulence intensity along the pipe (0 = calm straight run, ~1 = just downstream
// of a fitting). Used to modulate ripple strength and bubble entrainment. Not a physics input:
// the hydraulic values always come from computeHydraulics.
import { Layout } from '../physics/layout.js';

// [start x of the disturbance, peak intensity, decay length downstream (m)]
const SOURCES = [
  [Layout.valveStart, 1.0, 0.9],    // gate valve: throttling jet
  [Layout.reducerA, 0.35, 0.5],     // contraction (mild — accelerating flow is stable)
  [Layout.expanderA, 0.75, 1.0],    // sudden-ish expansion: separation downstream
  [Layout.xEnd - 0.25, 0.3, 0.3],   // outlet nozzle
];
const BASE = 0.08;

const smoothstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

export function turbulenceAt(x) {
  let t = BASE;
  for (const [x0, peak, decay] of SOURCES) {
    if (x < x0 - 0.2) continue;
    t += peak * smoothstep(x0 - 0.2, x0 + 0.1, x) * Math.exp(-Math.max(0, x - x0 - 0.1) / decay);
  }
  return Math.min(1.2, t);
}

/** Saturating velocity response used by all motion (0 at rest → ~1 at high speed). */
export const velocityResponse = v => v / (v + 1.5);
