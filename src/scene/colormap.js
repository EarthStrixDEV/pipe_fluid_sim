import * as THREE from 'three';

// Engineering ramp (low → high): blue → green → yellow → orange → red
export const RAMP_HEX = ['#2f5ea8', '#3a9a8c', '#86b84c', '#e2c341', '#e2862f', '#c63d2f'];
const RAMP = RAMP_HEX.map(h => new THREE.Color(h));

export function rampColor(t, out) {
  t = Math.min(1, Math.max(0, t)) * (RAMP.length - 1);
  const i = Math.min(RAMP.length - 2, Math.floor(t));
  return out.copy(RAMP[i]).lerp(RAMP[i + 1], t - i);
}

export const rampGradientCss = () => `linear-gradient(90deg, ${RAMP_HEX.join(',')})`;
