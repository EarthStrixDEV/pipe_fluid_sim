// Imperative Three.js scene. React owns it via SceneView; it only consumes hydraulic results.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { CSS2DRenderer } from 'three/addons/renderers/CSS2DRenderer.js';
import { G } from '../physics/hydraulics.js';
import { Layout, radiusAt, velocityAt, fieldSampler, fieldRange } from '../physics/layout.js';
import { createMaterials, disposeMaterials, GAUGE_MAX } from './materials.js';
import { rampColor } from './colormap.js';
import { WaterColumn } from './WaterColumn.js';
import { Bubbles } from './Bubbles.js';
import { createFlowUniforms, applyFlowShader, MAX_RINGS } from './waterMotion.js';
import { turbulenceAt, velocityResponse } from './turbulence.js';
import {
  tag, buildLab, buildTank, buildValve, latheAlongX, buildFlange, buildSupport, buildGauge, buildBasin,
} from './builders.js';

const WALL = 0.018;
const TRACER_COUNT = 420;
const ARROW_COUNT = 44;
const MAX_VIS_SPEED = 9; // m/s clamp so particles stay readable at extreme settings
const CAMERA_TWEEN_S = 1.2;

export const CAMERA_PRESETS = {
  overview: { label: 'Overview', pos: [1.5, 4.2, 12.5], target: [1.2, 1.2, 0] },
  valve: { label: 'Valve', pos: [-0.4, 2.7, 3.3], target: [-1.5, 1.7, 0] },
  points: { label: 'Pressure Points', pos: [-0.4, 2.9, 7.0], target: [-0.4, 1.8, 0] },
  small: { label: 'Small Pipe', pos: [2.4, 2.0, 2.7], target: [2.15, 1.45, 0] },
};

const easeInOutCubic = t => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

function disposeTree(root) {
  root.traverse(o => {
    o.geometry?.dispose();
    if (o.isCSS2DObject) o.element.remove();
  });
}

export class PipeFlowScene {
  /** @param {{onSelectPoint?: (name: string) => void}} [callbacks] */
  constructor(container, callbacks = {}) {
    this.container = container;
    this.onSelectPoint = callbacks.onSelectPoint ?? (() => {});
    this.selectedPoint = null;
    this.tween = null;
    this.fillCur = this.fillTarget = 1;
    this.mode = 'water';
    this.result = null;
    this.pipework = null;
    this.stream = null;
    this.gauges = {};
    this.builtForD3 = null;
    this.valveTarget = 0;
    this.valveShown = 0;

    const w = container.clientWidth, h = container.clientHeight;

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(w, h);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.95;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(this.renderer.domElement);

    this.labelRenderer = new CSS2DRenderer();
    this.labelRenderer.setSize(w, h);
    this.labelRenderer.domElement.className = 'labels';
    container.appendChild(this.labelRenderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x1d1f22);
    this.pmrem = new THREE.PMREMGenerator(this.renderer);
    this.envMap = this.pmrem.fromScene(new RoomEnvironment(this.renderer), 0.04).texture;
    this.scene.environment = this.envMap;

    this.camera = new THREE.PerspectiveCamera(40, w / h, 0.05, 200);
    this.camera.position.set(1.5, 4.2, 12.5);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.target.set(1.2, 1.2, 0);
    this.controls.enableDamping = true;
    this.controls.maxPolarAngle = Math.PI * 0.49;
    this.controls.minDistance = 2;
    this.controls.maxDistance = 35;
    this.controls.addEventListener('start', () => { this.tween = null; }); // user input cancels a fly-to

    this.#setupLights();

    this.M = createMaterials();
    this.flowUniforms = createFlowUniforms();
    this.ringIndex = 0;
    applyFlowShader(this.M.waterFlowBody, 'body', this.flowUniforms, 0.002);
    applyFlowShader(this.M.waterFreeSurface, 'surface', this.flowUniforms, 0.003);
    this.static = new THREE.Group();
    const { valve, moving } = buildValve(this.M);
    this.valveMoving = moving;
    this.valveStemBase = moving.position.y;
    this.static.add(buildLab(this.M), buildTank(this.M), valve, buildBasin(this.M));
    this.scene.add(this.static);

    this.#setupTracers();
    this.#setupArrows();
    this.bubbles = new Bubbles(this.scene);
    this.#setupPicking();

    this.resizeObserver = new ResizeObserver(() => this.#resize());
    this.resizeObserver.observe(container);

    this.clock = new THREE.Clock();
    this.renderer.setAnimationLoop(() => this.#frame());
  }

  /** Push a new hydraulic result (from computeHydraulics). */
  update(r) {
    this.result = r;
    this.velocityRange = fieldRange('velocity', r);
    if (this.builtForD3 !== r.D3) this.#buildPipework(r);
    this.water.setFlowFields(x => Math.min(MAX_VIS_SPEED, velocityAt(x, r)), turbulenceAt);
    this.#updateStream(r);
    this.#applyMode();
    for (const name of ['P1', 'P2', 'P3']) {
      const kPa = r[name] / 1000;
      const g = this.gauges[name];
      g.target = Math.min(1, Math.max(0, kPa / GAUGE_MAX));
      g.labelEl.innerHTML = `${name} <b>${kPa.toFixed(1)}</b> kPa`;
    }
    this.valveTarget = r.opening;
  }

  /** 'water' | 'pressure' | 'velocity' */
  setMode(mode) {
    this.mode = mode;
    if (this.result) this.#applyMode();
  }

  /** Highlight a measurement point ('P1' | 'P2' | 'P3' | null). */
  setSelectedPoint(name) {
    this.selectedPoint = name;
    for (const [n, g] of Object.entries(this.gauges)) g.labelEl.classList.toggle('selected', n === name);
  }

  /** Smoothly move the camera to a preset from CAMERA_PRESETS. */
  flyTo(presetKey) {
    const p = CAMERA_PRESETS[presetKey];
    if (!p) return;
    this.tween = {
      t: 0,
      fromPos: this.camera.position.clone(), toPos: new THREE.Vector3(...p.pos),
      fromTarget: this.controls.target.clone(), toTarget: new THREE.Vector3(...p.target),
    };
  }

  dispose() {
    this.renderer.setAnimationLoop(null);
    this.renderer.domElement.removeEventListener('pointerdown', this.onPointerDown);
    this.renderer.domElement.removeEventListener('pointerup', this.onPointerUp);
    this.resizeObserver.disconnect();
    this.controls.dispose();
    disposeTree(this.scene);
    disposeMaterials(this.M);
    this.arrowMesh.material.dispose();
    this.bubbles.dispose();
    this.envMap.dispose();
    this.pmrem.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
    this.labelRenderer.domElement.remove();
  }

  #setupLights() {
    this.scene.add(new THREE.HemisphereLight(0xdfe4ea, 0x2a2b2d, 0.35));
    const key = new THREE.DirectionalLight(0xfff4e6, 1.6);
    key.position.set(-6, 12, 8);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.radius = 6;
    key.shadow.bias = -0.0004;
    Object.assign(key.shadow.camera, { left: -12, right: 14, top: 8, bottom: -8, near: 1, far: 40 });
    this.scene.add(key);
  }

  #setupTracers() {
    this.tracerMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(0.016, 10, 8), this.M.tracer, TRACER_COUNT);
    this.scene.add(this.tracerMesh);
    this.tracers = Array.from({ length: TRACER_COUNT }, () => ({
      x: Layout.xStart + Math.random() * (Layout.xEnd - Layout.xStart),
      p: Math.random(),   // across the chord
      q: Math.random(),   // bottom → free surface
    }));
    this.dummy = new THREE.Object3D();
  }

  // Velocity-mode flow arrows on the pipe centreline. Speed = computed local velocity,
  // length and colour ∝ local velocity relative to the max in the system.
  #setupArrows() {
    const geo = new THREE.ConeGeometry(0.05, 1, 12);
    geo.translate(0, 0.5, 0);           // base at origin, tip at +Y
    geo.rotateZ(-Math.PI / 2);          // tip → +X (flow direction)
    this.arrowMesh = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ roughness: 0.45, metalness: 0 }), ARROW_COUNT);
    this.arrowMesh.visible = false;
    this.arrowMesh.frustumCulled = false;
    this.scene.add(this.arrowMesh);
    const span = Layout.xEnd - Layout.xStart;
    this.arrows = Array.from({ length: ARROW_COUNT }, (_, i) => ({ x: Layout.xStart + span * i / ARROW_COUNT }));
    this.arrowColor = new THREE.Color();
  }

  #updateArrows(dt) {
    const r = this.result;
    const span = Layout.xEnd - Layout.xStart;
    const vMax = Math.max(r.V1, r.V3, r.V4);
    const { lo, hi } = this.velocityRange;
    const range = hi - lo > 1e-6 ? hi - lo : 1;
    for (let i = 0; i < ARROW_COUNT; i++) {
      const a = this.arrows[i];
      const v = velocityAt(a.x, r);
      a.x += Math.min(MAX_VIS_SPEED, v) * dt;
      if (a.x > Layout.xEnd) a.x -= span;
      const rel = vMax > 0 ? v / vMax : 0;
      const rad = radiusAt(a.x, r);
      // Centre of the wetted depth; thickness limited by pipe size and water depth
      const yl = this.water.surfaceY;
      const wetHalf = (yl + 1) / 2 * rad;
      const thick = Math.min(1, rad / 0.1, wetHalf / 0.06);
      this.dummy.position.set(a.x, Layout.pipeY + (yl - 1) / 2 * rad, 0);
      this.dummy.rotation.set(0, 0, 0);
      this.dummy.scale.set(rel > 0 ? 0.06 + 0.26 * rel : 0, thick, thick);
      this.dummy.updateMatrix();
      this.arrowMesh.setMatrixAt(i, this.dummy.matrix);
      this.arrowMesh.setColorAt(i, rampColor((v - lo) / range, this.arrowColor));
    }
    this.arrowMesh.instanceMatrix.needsUpdate = true;
    this.arrowMesh.instanceColor.needsUpdate = true;
  }

  // Click a gauge (3D) or its label to select a measurement point. Drags are ignored.
  #setupPicking() {
    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();
    let down = null;
    this.onPointerDown = e => { down = { x: e.clientX, y: e.clientY }; };
    this.onPointerUp = e => {
      if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 4) return;
      const rect = this.renderer.domElement.getBoundingClientRect();
      this.pointer.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
      this.raycaster.setFromCamera(this.pointer, this.camera);
      const groups = Object.values(this.gauges).map(g => g.group);
      const hit = this.raycaster.intersectObjects(groups, true)[0];
      let o = hit?.object;
      while (o && !o.userData.point) o = o.parent;
      if (o) this.onSelectPoint(o.userData.point);
    };
    this.renderer.domElement.addEventListener('pointerdown', this.onPointerDown);
    this.renderer.domElement.addEventListener('pointerup', this.onPointerUp);
  }

  // Free surfaces only: slow drifting ripples. Jet ripples travel along the tube with
  // the exit velocity (TubeGeometry u runs along the path). Pipe water stays static.
  #animateWaterSurfaces(dt) {
    const s = this.M.waterSurface.normalMap.offset;
    s.x = (s.x + dt * 0.012) % 1;
    s.y = (s.y + dt * 0.007) % 1;
    // In-pipe water: flow-map clock + ripple evolution rate tied to the computed V1
    const u = this.flowUniforms;
    u.uFlowTime.value += dt;
    u.uEvo.value += dt * (0.25 + 1.2 * velocityResponse(this.result?.V1 ?? 0));
    const j = this.M.waterJet.normalMap.offset;
    j.x = (j.x - dt * Math.min(MAX_VIS_SPEED, this.result?.V4 ?? 0) * 0.35) % 1;
  }

  // Bubble reaching the free surface → small decaying ring ripple (shader ring buffer)
  #addRing(x, z, size) {
    const ring = this.flowUniforms.uRings.value[this.ringIndex];
    ring.set(x, z, this.flowUniforms.uFlowTime.value, 0.25 * Math.min(1, size / 0.008));
    this.ringIndex = (this.ringIndex + 1) % MAX_RINGS;
  }

  /** Water fill level h/D (0.1–1). Animated smoothly in the frame loop. Visual only. */
  setFillLevel(level) {
    this.fillTarget = Math.min(1, Math.max(0.1, level));
  }

  #updateFill(dt) {
    const d = this.fillTarget - this.fillCur;
    if (Math.abs(d) < 1e-4) {
      if (this.fillCur !== this.fillTarget) { this.fillCur = this.fillTarget; this.water.setLevel(this.fillCur); }
      return;
    }
    this.fillCur += d * Math.min(1, dt * 3.5);
    this.water.setLevel(this.fillCur);
  }

  /** Flow tracers are a visualisation layer, independent of the water rendering. */
  setTracersVisible(visible) {
    this.tracerMesh.visible = visible;
  }

  #updateCamera(dt) {
    const tw = this.tween;
    if (!tw) return;
    tw.t = Math.min(1, tw.t + dt / CAMERA_TWEEN_S);
    const k = easeInOutCubic(tw.t);
    this.camera.position.lerpVectors(tw.fromPos, tw.toPos, k);
    this.controls.target.lerpVectors(tw.fromTarget, tw.toTarget, k);
    if (tw.t >= 1) this.tween = null;
  }

  #buildPipework(r) {
    const M = this.M;
    if (this.pipework) { this.scene.remove(this.pipework); disposeTree(this.pipework); }
    const pw = new THREE.Group();
    const rad = x => radiusAt(x, r);

    // Continuous water column from tank nozzle to outlet (variable fill level)
    this.water = new WaterColumn({
      x0: Layout.xStart, x1: Layout.xEnd, radiusFn: x => rad(x) - 0.004,
      bodyMaterial: M.waterFlowBody, surfaceMaterial: M.waterFreeSurface,
    });
    this.water.setLevel(this.fillCur);
    for (const m of this.water.meshes) { m.position.y = Layout.pipeY; pw.add(m); }

    // Transparent acrylic sections (valve body excluded)
    pw.add(latheAlongX(-4.6, Layout.valveStart - 0.1, x => rad(x) + WALL, M.glass));
    pw.add(latheAlongX(Layout.valveEnd + 0.1, Layout.xEnd - 0.2, x => rad(x) + WALL, M.glass));

    // Metal tank nozzle and outlet nozzle
    const nozzle = latheAlongX(Layout.xStart, -4.6, x => rad(x) + WALL + 0.004, M.steel);
    const outlet = latheAlongX(Layout.xEnd - 0.2, Layout.xEnd, x => rad(x) + WALL + 0.004, M.steel);
    nozzle.castShadow = outlet.castShadow = true;
    pw.add(nozzle, outlet);

    for (const x of [-4.6, Layout.valveStart - 0.1, Layout.valveEnd + 0.1, Layout.reducerA, Layout.reducerB,
      Layout.expanderA, Layout.expanderB, Layout.xEnd - 0.2]) {
      pw.add(buildFlange(M, x, rad(x) + WALL));
    }
    for (const x of [-3.9, 1.9, 5.9]) pw.add(buildSupport(M, x, rad(x) + WALL));

    // Gauges keep their needle state across rebuilds
    const prev = this.gauges;
    this.gauges = {};
    for (const [name, x] of Object.entries(Layout.gauges)) {
      const g = buildGauge(M, x, rad(x) + WALL);
      g.cur = prev[name]?.cur ?? 0;
      g.target = prev[name]?.target ?? 0;
      g.group.userData.point = name;
      g.labelEl.classList.add('clickable');
      g.labelEl.classList.toggle('selected', name === this.selectedPoint);
      g.labelEl.addEventListener('click', () => this.onSelectPoint(name));
      this.gauges[name] = g;
      pw.add(g.group);
    }

    pw.add(
      tag(`Main pipe Ø${r.D1} mm`, -4.2, Layout.pipeY - 0.45),
      tag('Gate valve', Layout.valveX, Layout.pipeY - 0.5),
      tag(`Small pipe Ø${r.D3} mm`, 2.9, Layout.pipeY - 0.4),
      tag(`Large pipe Ø${r.D4} mm`, 5.9, Layout.pipeY - 0.62),
      tag('Outlet', Layout.xEnd + 0.2, Layout.pipeY + 0.5),
    );

    this.scene.add(pw);
    this.pipework = pw;
    this.stream = null;
    this.builtForD3 = r.D3;
  }

  // Outlet jet: projectile path from the exit velocity V4
  #updateStream(r) {
    if (this.stream) { this.pipework.remove(this.stream); this.stream.geometry.dispose(); this.stream = null; }
    if (r.Q <= 1e-7) return;
    const jetR = Math.max(0.02, radiusAt(Layout.xEnd, r) * 0.85);
    const tEnd = Math.sqrt(2 * (Layout.pipeY - 0.2) / G);
    const pts = [];
    for (let i = 0; i <= 24; i++) {
      const t = tEnd * i / 24;
      pts.push(new THREE.Vector3(Layout.xEnd + r.V4 * t, Layout.pipeY - 0.5 * G * t * t, 0));
    }
    const geo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 48, jetR, 32, false);
    this.stream = new THREE.Mesh(geo, this.M.waterJet);
    this.pipework.add(this.stream);
  }

  #applyMode() {
    this.arrowMesh.visible = this.mode === 'velocity';
    const { body, surface } = this.water;
    if (this.mode === 'water') { body.material = this.M.waterFlowBody; surface.material = this.M.waterFreeSurface; return; }
    // Velocity mode: lighter tint so the centreline arrows stay readable
    this.M.waterViz.opacity = this.mode === 'velocity' ? 0.38 : 0.72;
    const r = this.result;
    const field = fieldSampler(this.mode, r);
    const { lo, hi } = fieldRange(this.mode, r);
    const range = hi - lo > 1e-6 ? hi - lo : 1;
    const c = new THREE.Color();
    for (const mesh of this.water.meshes) {
      const pos = mesh.geometry.attributes.position;
      const col = mesh.geometry.attributes.color;
      for (let i = 0; i < pos.count; i++) {
        rampColor((field(pos.getX(i)) - lo) / range, c);  // vertex X = world X (fixed per vertex)
        col.setXYZ(i, c.r, c.g, c.b);
      }
      col.needsUpdate = true;
      mesh.material = this.M.waterViz;
    }
  }

  #updateTracers(dt) {
    const r = this.result;
    const span = Layout.xEnd - Layout.xStart;
    // Tracers live only in the wetted segment: y from the bottom up to the free surface,
    // z within the local chord (unit-circle coordinates with a wall margin).
    const yTop = Math.min(this.water.surfaceY, 1) * 0.9 - 0.02;
    for (let i = 0; i < TRACER_COUNT; i++) {
      const p = this.tracers[i];
      p.x += Math.min(MAX_VIS_SPEED, velocityAt(p.x, r)) * dt;
      if (p.x > Layout.xEnd) { p.x -= span; p.p = Math.random(); p.q = Math.random(); }
      const rr = radiusAt(p.x, r) - 0.02;
      const yu = -0.9 + (yTop + 0.9) * p.q;
      const zu = (2 * p.p - 1) * Math.sqrt(Math.max(0, 1 - yu * yu)) * 0.9;
      this.dummy.position.set(p.x, Layout.pipeY + yu * rr, zu * rr);
      this.dummy.updateMatrix();
      this.tracerMesh.setMatrixAt(i, this.dummy.matrix);
    }
    this.tracerMesh.instanceMatrix.needsUpdate = true;
  }

  #frame() {
    const dt = Math.min(0.05, this.clock.getDelta());
    if (this.result) {
      // Handwheel: 3 revolutions closed → open, stem rises 0.12 m
      this.valveShown += (this.valveTarget - this.valveShown) * Math.min(1, dt * 6);
      this.valveMoving.rotation.y = -this.valveShown * Math.PI * 6;
      this.valveMoving.position.y = this.valveStemBase + this.valveShown * 0.12;

      for (const g of Object.values(this.gauges)) {
        g.cur += (g.target - g.cur) * Math.min(1, dt * 5);
        g.needle.rotation.z = -(-135 + g.cur * 270) * Math.PI / 180;
      }
      if (this.tracerMesh.visible) this.#updateTracers(dt);
      if (this.water) {
        this.bubbles.update(dt, this.result, {
          surfaceY: this.water.surfaceY,
          full: this.fillCur >= 0.999,
          onBurst: (x, z, size) => this.#addRing(x, z, size),
        });
      }
      if (this.arrowMesh.visible) this.#updateArrows(dt);
    }
    if (this.water) this.#updateFill(dt);
    this.#animateWaterSurfaces(dt);
    this.#updateCamera(dt);
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
    this.labelRenderer.render(this.scene, this.camera);
  }

  #resize() {
    const w = this.container.clientWidth, h = this.container.clientHeight;
    if (!w || !h) return;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this.labelRenderer.setSize(w, h);
  }
}
