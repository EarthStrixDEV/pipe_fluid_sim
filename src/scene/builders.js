// Mesh factories for the lab equipment. Each returns a THREE.Object3D (plus handles where animated).
import * as THREE from 'three';
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { Layout } from '../physics/layout.js';
import { D_MAIN } from '../physics/hydraulics.js';

export function tag(text, x, y, z = 0, className = 'tag minor') {
  const el = document.createElement('div');
  el.className = className; el.textContent = text;
  const o = new CSS2DObject(el); o.position.set(x, y, z);
  return o;
}

export function buildLab(M) {
  const g = new THREE.Group();
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(60, 40), M.floor);
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true;
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(60, 14), M.wall);
  wall.position.set(0, 7, -5); wall.receiveShadow = true;
  g.add(floor, wall);
  for (let i = -6; i <= 12; i += 3) {
    const l = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.002, 20), M.floorLine);
    l.position.set(i, 0.001, 3); g.add(l);
  }
  return g;
}

export function buildTank(M) {
  const tank = new THREE.Group();
  const R = 1.1, H = 2.6, baseY = 0.55;
  const shell = new THREE.Mesh(new THREE.CylinderGeometry(R, R, H, 64, 1, true), M.brushed);
  shell.position.y = baseY + H / 2; shell.castShadow = shell.receiveShadow = true;
  const top = new THREE.Mesh(new THREE.CylinderGeometry(R * 1.02, R * 1.02, 0.06, 64), M.steel);
  top.position.y = baseY + H;
  const bottom = new THREE.Mesh(new THREE.SphereGeometry(R, 48, 16, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), M.brushed);
  bottom.scale.y = 0.25; bottom.position.y = baseY; bottom.castShadow = true;
  tank.add(shell, top, bottom);
  for (const y of [0.9, 1.9, 2.8]) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(R + 0.015, 0.025, 12, 64), M.steel);
    ring.rotation.x = Math.PI / 2; ring.position.y = y; tank.add(ring);
  }
  for (let i = 0; i < 4; i++) {
    const a = i * Math.PI / 2 + Math.PI / 4;
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, baseY + 0.3, 16), M.steel);
    leg.position.set(Math.cos(a) * R * 0.85, (baseY + 0.3) / 2, Math.sin(a) * R * 0.85); leg.castShadow = true;
    tank.add(leg);
  }
  // sight glass showing the water level
  const q = Math.PI / 4;
  const sgX = Math.cos(q) * (R + 0.12), sgZ = Math.sin(q) * (R + 0.12);
  const sgGlass = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 2.1, 24), M.glass);
  sgGlass.position.set(sgX, baseY + 1.3, sgZ);
  const sgWater = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 1.55, 24), M.water);
  sgWater.position.set(sgX, baseY + 0.25 + 1.55 / 2, sgZ);
  for (const y of [baseY + 0.25, baseY + 2.35]) {
    const nip = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.14, 12), M.steel);
    nip.rotation.z = Math.PI / 2; nip.rotation.y = -q;
    nip.position.set(Math.cos(q) * (R + 0.06), y, Math.sin(q) * (R + 0.06));
    tank.add(nip);
  }
  tank.add(sgGlass, sgWater, tag('Water Tank (pressurised supply)', 0, baseY + H + 0.35));
  tank.position.set(-6.1, 0, 0);
  return tank;
}

/** Gate valve with rising stem. `moving` = stem + handwheel group to animate. */
export function buildValve(M) {
  const valve = new THREE.Group();
  const moving = new THREE.Group();
  const r = D_MAIN * Layout.radiusScale;
  const body = new THREE.Mesh(new THREE.SphereGeometry(r + 0.14, 48, 32), M.valveBody);
  body.scale.set(1.25, 1.1, 1); body.castShadow = true;
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.17, 0.35, 32), M.valveBody);
  neck.position.y = r + 0.25; neck.castShadow = true;
  const bonnet = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.19, 0.06, 32), M.valveBody);
  bonnet.position.y = r + 0.45;
  const yoke = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.42, 0.05), M.valveBody);
  const yoke2 = yoke.clone();
  yoke.position.set(0.13, r + 0.66, 0); yoke2.position.set(-0.13, r + 0.66, 0);
  const yokeTop = new THREE.Mesh(new THREE.BoxGeometry(0.31, 0.05, 0.08), M.valveBody);
  yokeTop.position.y = r + 0.88;
  valve.add(body, neck, bonnet, yoke, yoke2, yokeTop);
  for (const s of [-1, 1]) {
    const fl = new THREE.Mesh(new THREE.CylinderGeometry(r + 0.1, r + 0.1, 0.07, 40), M.valveBody);
    fl.rotation.z = Math.PI / 2; fl.position.x = s * 0.42; fl.castShadow = true; valve.add(fl);
  }
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.7, 16), M.steel);
  stem.position.y = r + 0.62;
  const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.26, 0.028, 16, 64), M.handwheel);
  wheel.rotation.x = Math.PI / 2; wheel.position.y = r + 0.98; wheel.castShadow = true;
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.06, 24), M.handwheel);
  hub.position.y = r + 0.98;
  moving.add(stem, wheel, hub);
  for (let i = 0; i < 5; i++) {
    const spoke = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.25, 8), M.handwheel);
    spoke.rotation.z = Math.PI / 2; spoke.position.set(0.13, r + 0.98, 0);
    const pivot = new THREE.Group(); pivot.rotation.y = i * Math.PI * 2 / 5;
    pivot.add(spoke); moving.add(pivot);
  }
  const knob = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.1, 12), M.painted);
  knob.position.set(0.26, r + 1.03, 0); moving.add(knob);
  valve.add(moving);
  valve.position.set(Layout.valveX, Layout.pipeY, 0);
  return { valve, moving };
}

export function latheAlongX(x0, x1, radiusFn, material, segs = 48) {
  const pts = [];
  const n = Math.max(2, Math.ceil((x1 - x0) / 0.04));
  for (let i = 0; i <= n; i++) { const x = x0 + (x1 - x0) * i / n; pts.push(new THREE.Vector2(radiusFn(x), x)); }
  const mesh = new THREE.Mesh(new THREE.LatheGeometry(pts, segs), material);
  mesh.rotation.z = -Math.PI / 2;  // lathe Y axis → world +X
  mesh.position.y = Layout.pipeY;
  return mesh;
}

export function buildFlange(M, x, r) {
  const g = new THREE.Group();
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(r + 0.075, r + 0.075, 0.05, 40), M.steel);
  disc.rotation.z = Math.PI / 2; disc.castShadow = true; g.add(disc);
  for (let i = 0; i < 6; i++) {
    const a = i / 6 * Math.PI * 2;
    const bolt = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.09, 8), M.brushed);
    bolt.rotation.z = Math.PI / 2; bolt.position.set(0, Math.cos(a) * (r + 0.045), Math.sin(a) * (r + 0.045));
    g.add(bolt);
  }
  g.position.set(x, Layout.pipeY, 0);
  return g;
}

export function buildSupport(M, x, r) {
  const g = new THREE.Group();
  const h = Layout.pipeY - r - 0.02;
  const post = new THREE.Mesh(new THREE.BoxGeometry(0.08, h, 0.08), M.painted);
  post.position.y = h / 2; post.castShadow = true;
  const base = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.03, 0.3), M.painted); base.position.y = 0.015;
  const saddle = new THREE.Mesh(new THREE.TorusGeometry(r + 0.012, 0.012, 8, 32, Math.PI), M.steel);
  saddle.rotation.y = Math.PI / 2; saddle.rotation.z = Math.PI; saddle.position.y = Layout.pipeY;
  g.add(post, base, saddle);
  g.position.x = x;
  return g;
}

/** Pressure gauge on a tapping. Returns the group, the needle pivot and the label element. */
export function buildGauge(M, x, r) {
  const g = new THREE.Group();
  const stemH = 0.45;
  const tap = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, stemH, 12), M.steel);
  tap.position.y = r + stemH / 2;
  const boss = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.05, 16), M.steel);
  boss.position.y = r;
  const caseY = r + stemH + 0.13;
  const casing = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.06, 40), M.steel);
  casing.rotation.x = Math.PI / 2; casing.position.y = caseY; casing.castShadow = true;
  const face = new THREE.Mesh(new THREE.CircleGeometry(0.125, 40), M.gaugeFace);
  face.position.set(0, caseY, 0.031);
  const lens = new THREE.Mesh(new THREE.CircleGeometry(0.13, 40), M.glass);
  lens.position.set(0, caseY, 0.036);
  const needle = new THREE.Group(); needle.position.set(0, caseY, 0.034);
  const blade = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.1, 0.003), M.needle);
  blade.position.y = 0.04;
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.006, 12), M.painted);
  cap.rotation.x = Math.PI / 2;
  needle.add(blade, cap);
  const label = tag('', 0, caseY + 0.27, 0, 'tag');
  g.add(tap, boss, casing, face, lens, needle, label);
  g.position.set(x, Layout.pipeY, 0);
  return { group: g, needle, labelEl: label.element };
}

export function buildBasin(M) {
  const basin = new THREE.Group();
  const bw = 2.6, bd = 1.6, bh = 0.35;
  const bottom = new THREE.Mesh(new THREE.BoxGeometry(bw, 0.03, bd), M.brushed); bottom.position.y = 0.015;
  basin.add(bottom);
  for (const [w, d, x, z] of [[bw, 0.03, 0, bd / 2], [bw, 0.03, 0, -bd / 2], [0.03, bd, bw / 2, 0], [0.03, bd, -bw / 2, 0]]) {
    const side = new THREE.Mesh(new THREE.BoxGeometry(w, bh, d), M.brushed);
    side.position.set(x, bh / 2, z); side.castShadow = true; basin.add(side);
  }
  // Water volume (smooth) + free surface on top (animated ripple normals)
  const depth = 0.19;
  const pool = new THREE.Mesh(new THREE.BoxGeometry(bw - 0.04, depth, bd - 0.04), M.water);
  pool.position.y = 0.03 + depth / 2; basin.add(pool);
  const surface = new THREE.Mesh(new THREE.PlaneGeometry(bw - 0.04, bd - 0.04), M.waterSurface);
  surface.rotation.x = -Math.PI / 2; surface.position.y = 0.03 + depth + 0.004;
  basin.add(surface);
  basin.position.set(Layout.xEnd + 1.3, 0, 0);
  return basin;
}
