// Continuous water volume inside the pipe with a variable fill level.
// Cross-section = circular segment below the free surface (h/D = level):
//   body    — wetted arc of the pipe wall (open when partially filled)
//   surface — flat free surface (chord) between water and air; hidden when full
// Vertex X is world X, so visualisation colouring by x stays valid for any level.
import * as THREE from 'three';

const FULL = 0.999;

export class WaterColumn {
  /**
   * @param {{x0:number, x1:number, radiusFn:(x:number)=>number, bodyMaterial:THREE.Material,
   *          surfaceMaterial:THREE.Material, arcSegments?:number, step?:number}} o
   */
  constructor({ x0, x1, radiusFn, bodyMaterial, surfaceMaterial, arcSegments = 64, step = 0.04 }) {
    const n = Math.max(2, Math.ceil((x1 - x0) / step));
    this.xs = Float32Array.from({ length: n + 1 }, (_, i) => x0 + (x1 - x0) * i / n);
    this.radii = Float32Array.from(this.xs, radiusFn);
    this.S = arcSegments;
    this.K = 8; // across the free surface

    this.body = new THREE.Mesh(this.#grid(n, this.S, (i, j) => [i / n * 12, j / this.S]), bodyMaterial);
    this.surface = new THREE.Mesh(this.#grid(n, this.K, null, true), surfaceMaterial);
    this.meshes = [this.body, this.surface];
    this.level = -1;
  }

  // Structured grid (n+1) × (m+1) with position/normal/uv/color attributes.
  #grid(n, m, uvFn, flip = false) {
    const count = (n + 1) * (m + 1);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
    g.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
    g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(count * 2), 2));
    g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
    g.setAttribute('aVel', new THREE.BufferAttribute(new Float32Array(count), 1));   // local velocity (m/s)
    g.setAttribute('aTurb', new THREE.BufferAttribute(new Float32Array(count), 1));  // visual turbulence 0–1.2
    g.userData.m = m;
    const idx = [];
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < m; j++) {
        const a = i * (m + 1) + j, b = a + (m + 1), c = a + 1, d = b + 1;
        // body: X × φ-direction faces outward; surface: flipped so the normal points up
        if (flip) idx.push(a, c, b, b, c, d); else idx.push(a, b, c, b, d, c);
      }
    }
    g.setIndex(idx);
    if (uvFn) {
      const uv = g.attributes.uv;
      for (let i = 0; i <= n; i++) for (let j = 0; j <= m; j++) uv.setXY(i * (m + 1) + j, ...uvFn(i, j));
    }
    return g;
  }

  /** Per-station flow fields for the motion shader (constant across the section). */
  setFlowFields(velocityFn, turbulenceFn) {
    const vel = Float32Array.from(this.xs, velocityFn);
    const turb = Float32Array.from(this.xs, turbulenceFn);
    for (const mesh of this.meshes) {
      const g = mesh.geometry, m = g.userData.m;
      const av = g.attributes.aVel, at = g.attributes.aTurb;
      for (let i = 0; i < this.xs.length; i++) {
        for (let j = 0; j <= m; j++) { av.setX(i * (m + 1) + j, vel[i]); at.setX(i * (m + 1) + j, turb[i]); }
      }
      av.needsUpdate = at.needsUpdate = true;
    }
  }

  /** @param {number} level fill fraction h/D in [0.1, 1] */
  setLevel(level) {
    if (Math.abs(level - this.level) < 1e-5) return;
    this.level = level;
    const full = level >= FULL;
    const yl = 2 * Math.min(level, 1) - 1;                // free-surface height in units of R
    const phiMax = full ? Math.PI : Math.acos(-yl);      // wetted half-angle from the bottom
    const halfChord = Math.sin(phiMax);
    const { xs, radii, S, K } = this;

    const bp = this.body.geometry.attributes.position;
    const bn = this.body.geometry.attributes.normal;
    for (let i = 0; i < xs.length; i++) {
      const R = radii[i];
      for (let j = 0; j <= S; j++) {
        const phi = -phiMax + 2 * phiMax * j / S;
        const y = -Math.cos(phi), z = Math.sin(phi);
        const k = i * (S + 1) + j;
        bp.setXYZ(k, xs[i], y * R, z * R);
        bn.setXYZ(k, 0, y, z);                           // radial normal (reducer slope is negligible)
      }
    }
    bp.needsUpdate = bn.needsUpdate = true;
    this.body.geometry.computeBoundingSphere();

    this.surface.visible = !full;
    if (full) return;
    const sp = this.surface.geometry.attributes.position;
    const sn = this.surface.geometry.attributes.normal;
    const su = this.surface.geometry.attributes.uv;
    for (let i = 0; i < xs.length; i++) {
      const R = radii[i];
      for (let j = 0; j <= K; j++) {
        const z = (-halfChord + 2 * halfChord * j / K) * R;
        const k = i * (K + 1) + j;
        sp.setXYZ(k, xs[i], yl * R, z);
        sn.setXYZ(k, 0, 1, 0);
        su.setXY(k, xs[i] * 1.5, z * 1.5 + 0.5);         // world-scaled so ripples keep their size
      }
    }
    sp.needsUpdate = sn.needsUpdate = su.needsUpdate = true;
    this.surface.geometry.computeBoundingSphere();
  }

  /** Wetted region in units of R for placing tracers/arrows: top of water (−1…1). */
  get surfaceY() { return 2 * Math.min(this.level, 1) - 1; }
}
