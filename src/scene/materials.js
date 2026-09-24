import * as THREE from 'three';

export const GAUGE_MAX = 600; // kPa, full-scale of the dial

function createGaugeFaceMaterial() {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#ecebe6'; g.beginPath(); g.arc(128, 128, 124, 0, Math.PI * 2); g.fill();
  g.strokeStyle = '#222'; g.fillStyle = '#222'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = '600 20px Segoe UI, sans-serif';
  for (let v = 0; v <= GAUGE_MAX; v += 20) {
    const t = (-135 + v / GAUGE_MAX * 270) * Math.PI / 180;
    const major = v % 100 === 0;
    const r0 = major ? 92 : 100, r1 = 110;
    g.lineWidth = major ? 3 : 1.5;
    g.beginPath(); g.moveTo(128 + r0 * Math.sin(t), 128 - r0 * Math.cos(t));
    g.lineTo(128 + r1 * Math.sin(t), 128 - r1 * Math.cos(t)); g.stroke();
    if (major) g.fillText(v, 128 + 74 * Math.sin(t), 128 - 74 * Math.cos(t));
  }
  g.font = '500 18px Segoe UI, sans-serif'; g.fillText('kPa', 128, 175);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  return new THREE.MeshStandardMaterial({ map: tex, roughness: 0.4 });
}

/**
 * Tileable ripple normal map: sum of sine waves with integer frequencies (seamless on wrap),
 * normals from central differences of the height field.
 */
function createRippleNormalMap(size = 256) {
  const waves = [[3, 1, 0.0, 1.0], [-2, 4, 1.7, 0.6], [5, -3, 3.1, 0.35], [7, 6, 0.4, 0.2], [-9, 2, 2.2, 0.12]];
  const h = new Float32Array(size * size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size * Math.PI * 2, v = y / size * Math.PI * 2;
      let s = 0;
      for (const [fx, fy, ph, amp] of waves) s += amp * Math.sin(fx * u + fy * v + ph);
      h[y * size + x] = s;
    }
  }
  const c = document.createElement('canvas'); c.width = c.height = size;
  const g = c.getContext('2d');
  const img = g.createImageData(size, size);
  const at = (x, y) => h[((y + size) % size) * size + ((x + size) % size)];
  const strength = 2.5;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (at(x + 1, y) - at(x - 1, y)) * strength / 8;
      const dy = (at(x, y + 1) - at(x, y - 1)) * strength / 8;
      const len = Math.hypot(dx, dy, 1);
      const i = (y * size + x) * 4;
      img.data[i] = (-dx / len * 0.5 + 0.5) * 255;
      img.data[i + 1] = (-dy / len * 0.5 + 0.5) * 255;
      img.data[i + 2] = (1 / len * 0.5 + 0.5) * 255;
      img.data[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.NoColorSpace;
  return tex;
}

/**
 * Clear water: full transmission, IOR 1.333 (Fresnel F0 ≈ 2 %), near-zero roughness,
 * and a very weak blue-green absorption that only shows through long optical paths.
 */
function createWaterMaterial({ thickness, ripple = null }) {
  const m = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    metalness: 0,
    roughness: 0.015,
    transmission: 1,
    ior: 1.333,
    thickness,
    attenuationColor: new THREE.Color(0xe3f1ee),
    attenuationDistance: 3.5,
    specularIntensity: 1,
    specularColor: new THREE.Color(0xffffff),
    envMapIntensity: 1,
  });
  if (ripple) {
    m.normalMap = createRippleNormalMap();
    m.normalMap.repeat.set(ripple.repeat, ripple.repeat);
    m.normalScale.set(ripple.scale, ripple.scale);
  }
  return m;
}

export function createMaterials() {
  return {
    steel: new THREE.MeshStandardMaterial({ color: 0xc3c7cb, metalness: 1, roughness: 0.26 }),
    brushed: new THREE.MeshStandardMaterial({ color: 0x9da2a8, metalness: 1, roughness: 0.42 }),
    painted: new THREE.MeshStandardMaterial({ color: 0x44505c, metalness: 0.35, roughness: 0.55 }),
    valveBody: new THREE.MeshStandardMaterial({ color: 0x3b4652, metalness: 0.5, roughness: 0.45 }),
    handwheel: new THREE.MeshStandardMaterial({ color: 0x7d2b27, metalness: 0.3, roughness: 0.5 }),
    needle: new THREE.MeshStandardMaterial({ color: 0x9b1f1a, roughness: 0.4 }),
    floor: new THREE.MeshStandardMaterial({ color: 0x3a3c3f, metalness: 0, roughness: 0.85 }),
    floorLine: new THREE.MeshStandardMaterial({ color: 0x323437, roughness: 1 }),
    wall: new THREE.MeshStandardMaterial({ color: 0x2c2e31, metalness: 0, roughness: 0.95 }),
    glass: new THREE.MeshPhysicalMaterial({
      color: 0xffffff, metalness: 0, roughness: 0.03, transparent: true, opacity: 0.16,
      clearcoat: 1, clearcoatRoughness: 0.03, side: THREE.DoubleSide, depthWrite: false, envMapIntensity: 1.4,
    }),
    // Pressurised pipe water: optically smooth (no free surface → no normal map).
    water: createWaterMaterial({ thickness: 0.22 }),
    // Free surfaces (basin) and the free jet carry a faint animated ripple normal map.
    waterSurface: createWaterMaterial({ thickness: 0.2, ripple: { repeat: 3, scale: 0.07 } }),
    // Free surface inside a partially filled pipe (air above, water below)
    // (procedural ripples injected by waterMotion.applyFlowShader)
    waterFreeSurface: createWaterMaterial({ thickness: 0.15 }),
    // In-pipe water body: same optics, with faint internal flow distortion injected
    waterFlowBody: createWaterMaterial({ thickness: 0.22 }),
    waterJet:createWaterMaterial({ thickness: 0.12, ripple: { repeat: 1.5, scale: 0.12 } }),
    waterViz: new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0, roughness: 0.35, transparent: true, opacity: 0.72 }),
    tracer: new THREE.MeshStandardMaterial({ color: 0xefeae0, roughness: 0.55 }),
    gaugeFace: createGaugeFaceMaterial(),
  };
}

export function disposeMaterials(M) {
  for (const m of Object.values(M)) { m.map?.dispose(); m.normalMap?.dispose(); m.dispose(); }
}
