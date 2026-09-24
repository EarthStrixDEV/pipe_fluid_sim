// Small entrained air bubbles. Low density, mixed sizes, carried at the computed local
// velocity, rising slowly with a turbulence-driven wobble. Entrainment is weighted toward
// fittings (turbulenceAt) and its rate scales with flow; with Q = 0 no new bubbles appear.
// Rendered as tiny mirror spheres: an air bubble in water reflects like silver (total
// internal reflection), and opaque instances stay visible through the transmissive water.
import * as THREE from 'three';
import { Layout, radiusAt, velocityAt } from '../physics/layout.js';
import { turbulenceAt, velocityResponse } from './turbulence.js';

const COUNT = 56;
const MAX_SPEED = 9;

export class Bubbles {
  constructor(scene) {
    this.mesh = new THREE.InstancedMesh(
      new THREE.SphereGeometry(1, 12, 8),
      new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 1, roughness: 0.06, envMapIntensity: 0.9 }),
      COUNT,
    );
    this.mesh.frustumCulled = false;
    scene.add(this.mesh);
    this.dummy = new THREE.Object3D();
    this.t = 0;
    this.b = Array.from({ length: COUNT }, () => ({ alive: false, wait: Math.random() * 2 }));
  }

  #spawn(b, r, yTop) {
    // Rejection-sample x: weight 0.3 at calm runs, up to 1.5 downstream of fittings
    let x;
    for (let k = 0; k < 8; k++) {
      x = Layout.xStart + 0.2 + Math.random() * (Layout.xEnd - Layout.xStart - 0.5);
      if (Math.random() * 1.5 < 0.3 + turbulenceAt(x)) break;
    }
    const s = Math.random();
    b.alive = true;
    b.x = x;
    b.size = 0.0035 + 0.0095 * s * s * s;       // mostly fine bubbles, a few larger
    b.yu = -0.85 + (yTop + 0.85) * Math.random();
    b.zu = (Math.random() * 2 - 1) * 0.8;
    b.phase = Math.random() * Math.PI * 2;
    b.rise = 0.015 + 5 * b.size;                // scene units/s, larger bubbles rise faster
  }

  /**
   * @param {number} dt
   * @param {object} r hydraulic result
   * @param {{surfaceY:number, full:boolean, onBurst:(x:number,z:number,size:number)=>void}} ctx
   */
  update(dt, r, ctx) {
    this.t += dt;
    const flowing = r.Q > 1e-7;
    const yTop = ctx.full ? 0.86 : ctx.surfaceY;
    for (let i = 0; i < COUNT; i++) {
      const b = this.b[i];
      if (!b.alive) {
        b.wait -= dt;
        if (flowing && b.wait <= 0 && yTop > -0.6) this.#spawn(b, r, yTop);
        if (!b.alive) { this.#hide(i); continue; }
      }
      const R = radiusAt(b.x, r) - 0.01;
      const v = Math.min(MAX_SPEED, velocityAt(b.x, r));
      const vN = velocityResponse(v);
      const turb = turbulenceAt(b.x);

      b.x += v * dt;
      const w = turb * vN * 1.6;                                   // wobble amplitude (unit R / s)
      b.yu += (b.rise / R + Math.sin(this.t * (3 + 9 * vN) + b.phase) * w) * dt;
      b.zu += Math.cos(this.t * (2.3 + 7 * vN) + b.phase * 1.7) * w * 0.7 * dt;
      const zMax = Math.sqrt(Math.max(0, 1 - b.yu * b.yu)) * 0.88;
      b.zu = Math.max(-zMax, Math.min(zMax, b.zu));
      b.yu = Math.max(-0.88, b.yu);

      const top = yTop - (b.size / R) * 1.2;
      if (b.yu >= top) {
        if (ctx.full) b.yu = top;                                  // glides along the crown
        else { ctx.onBurst(b.x, b.zu * R, b.size); this.#retire(b, vN); this.#hide(i); continue; }
      }
      if (b.x > Layout.xEnd - 0.1) { this.#retire(b, vN); this.#hide(i); continue; }

      const d = this.dummy;
      d.position.set(b.x, Layout.pipeY + b.yu * R, b.zu * R);
      d.scale.set(b.size * (1 + 0.3 * vN), b.size, b.size);         // slight stretch in fast flow
      d.updateMatrix();
      this.mesh.setMatrixAt(i, d.matrix);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  // Entrainment rate grows with velocity: calm flow → long waits between bubbles.
  #retire(b, vN) {
    b.alive = false;
    b.wait = Math.random() * 1.6 / (0.15 + vN);
  }

  #hide(i) {
    this.dummy.scale.setScalar(0);
    this.dummy.updateMatrix();
    this.mesh.setMatrixAt(i, this.dummy.matrix);
  }

  dispose() {
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
  }
}
