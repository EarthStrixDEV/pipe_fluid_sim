// Procedural water motion injected into MeshPhysicalMaterial (refraction/Fresnel untouched).
// Only the shading normal is perturbed:
//   'surface' — free-surface micro ripples + bubble-burst rings (partial fill)
//   'body'    — faint internal flow distortion on the wetted wall (any fill)
// Advection uses a two-phase flow-map so ripples travel at the local computed velocity
// (per-vertex aVel) without the pattern stretching over time.
import * as THREE from 'three';

export const MAX_RINGS = 8;
const FLOW_PERIOD = 0.8; // s, flow-map cycle

export function createFlowUniforms() {
  return {
    uFlowTime: { value: 0 },
    uEvo: { value: 0 },
    uRings: { value: Array.from({ length: MAX_RINGS }, () => new THREE.Vector4(0, 0, -100, 0)) },
  };
}

// Simplex 3D noise — Ashima Arts / Stefan Gustavson (MIT)
const NOISE = /* glsl */ `
vec3 fmMod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 fmMod289(vec4 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 fmPermute(vec4 x){return fmMod289(((x*34.0)+1.0)*x);}
vec4 fmTaylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}
float fmNoise(vec3 v){
  const vec2 C=vec2(1.0/6.0,1.0/3.0); const vec4 D=vec4(0.0,0.5,1.0,2.0);
  vec3 i=floor(v+dot(v,C.yyy)); vec3 x0=v-i+dot(i,C.xxx);
  vec3 g=step(x0.yzx,x0.xyz); vec3 l=1.0-g; vec3 i1=min(g.xyz,l.zxy); vec3 i2=max(g.xyz,l.zxy);
  vec3 x1=x0-i1+C.xxx; vec3 x2=x0-i2+C.yyy; vec3 x3=x0-D.yyy;
  i=fmMod289(i);
  vec4 p=fmPermute(fmPermute(fmPermute(i.z+vec4(0.0,i1.z,i2.z,1.0))+i.y+vec4(0.0,i1.y,i2.y,1.0))+i.x+vec4(0.0,i1.x,i2.x,1.0));
  float n_=0.142857142857; vec3 ns=n_*D.wyz-D.xzx;
  vec4 j=p-49.0*floor(p*ns.z*ns.z); vec4 x_=floor(j*ns.z); vec4 y_=floor(j-7.0*x_);
  vec4 x=x_*ns.x+ns.yyyy; vec4 y=y_*ns.x+ns.yyyy; vec4 h=1.0-abs(x)-abs(y);
  vec4 b0=vec4(x.xy,y.xy); vec4 b1=vec4(x.zw,y.zw);
  vec4 s0=floor(b0)*2.0+1.0; vec4 s1=floor(b1)*2.0+1.0; vec4 sh=-step(h,vec4(0.0));
  vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy; vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
  vec3 p0=vec3(a0.xy,h.x); vec3 p1=vec3(a0.zw,h.y); vec3 p2=vec3(a1.xy,h.z); vec3 p3=vec3(a1.zw,h.w);
  vec4 norm=fmTaylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
  p0*=norm.x; p1*=norm.y; p2*=norm.z; p3*=norm.w;
  vec4 m=max(0.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0); m=m*m;
  return 42.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
}`;

const FRAG_COMMON = /* glsl */ `
uniform float uFlowTime;
uniform float uEvo;
uniform vec4 uRings[${MAX_RINGS}];
varying vec3 vWPos;
varying float vVel;
varying float vAmp;
${NOISE}

#ifdef FM_SURFACE
// Micro ripples: two octaves, slightly elongated across the flow, evolving with uEvo.
float fmLayer(vec3 p, float offX, vec2 seed) {
  vec2 q = vec2(p.x - offX, p.z) + seed;
  return 0.65 * fmNoise(vec3(q * vec2(26.0, 34.0), uEvo))
       + 0.35 * fmNoise(vec3(q * vec2(58.0, 66.0), uEvo * 1.6 + 3.1));
}
float fmRings(vec3 p) {
  float h = 0.0;
  for (int i = 0; i < ${MAX_RINGS}; i++) {
    vec4 r = uRings[i];
    float age = uFlowTime - r.z;
    if (age < 0.0 || age > 1.2) continue;
    float d = length(p.xz - r.xy) - age * 0.22;               // expanding ring front
    h += r.w * sin(d * 140.0) * exp(-d * d * 900.0) * exp(-age * 3.0);
  }
  return h;
}
#else
// Internal distortion: coarse 3D noise advected with the flow.
float fmLayer(vec3 p, float offX, vec2 seed) {
  return fmNoise(vec3((p.x - offX) * 9.0 + seed.x, p.y * 14.0 + seed.y, p.z * 14.0 + uEvo * 0.35));
}
#endif

float fmHeight(vec3 p) {
  float ph0 = fract(uFlowTime / ${FLOW_PERIOD.toFixed(2)});
  float ph1 = fract(uFlowTime / ${FLOW_PERIOD.toFixed(2)} + 0.5);
  float w0 = 1.0 - abs(1.0 - 2.0 * ph0);
  float h = w0 * fmLayer(p, vVel * ph0 * ${FLOW_PERIOD.toFixed(2)}, vec2(0.0))
          + (1.0 - w0) * fmLayer(p, vVel * ph1 * ${FLOW_PERIOD.toFixed(2)}, vec2(0.43, 0.71));
#ifdef FM_SURFACE
  h += fmRings(p);
#endif
  return h;
}
`;

const FRAG_NORMAL = /* glsl */ `
{
  const float e = 0.004;
  float h0 = fmHeight(vWPos);
  vec3 g = vec3(fmHeight(vWPos + vec3(e, 0.0, 0.0)) - h0, 0.0, fmHeight(vWPos + vec3(0.0, 0.0, e)) - h0);
#ifndef FM_SURFACE
  g.y = fmHeight(vWPos + vec3(0.0, e, 0.0)) - h0;
#endif
  g /= e;
  vec3 nW = normalize((vec4(normal, 0.0) * viewMatrix).xyz);   // view → world
  vec3 t = g - dot(g, nW) * nW;                                 // tangential slope only
  normal = normalize(normal - (viewMatrix * vec4(t * vAmp, 0.0)).xyz);
}
`;

/**
 * @param {THREE.MeshPhysicalMaterial} material
 * @param {'surface'|'body'} kind
 * @param {ReturnType<typeof createFlowUniforms>} shared
 * @param {number} strength slope scale at full velocity response
 */
export function applyFlowShader(material, kind, shared, strength) {
  material.onBeforeCompile = shader => {
    shader.uniforms.uFlowTime = shared.uFlowTime;
    shader.uniforms.uEvo = shared.uEvo;
    shader.uniforms.uRings = shared.uRings;
    shader.uniforms.uStrength = { value: strength };
    const def = kind === 'surface' ? '#define FM_SURFACE\n' : '';
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>
attribute float aVel;
attribute float aTurb;
uniform float uStrength;
varying vec3 vWPos;
varying float vVel;
varying float vAmp;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
vWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
vVel = aVel;
vAmp = uStrength * (0.15 + 0.85 * aVel / (aVel + 1.5)) * (1.0 + 1.5 * aTurb);`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${def}${FRAG_COMMON}`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>\n${FRAG_NORMAL}`);
  };
  material.customProgramCacheKey = () => `flow-${kind}`;
  material.needsUpdate = true;
}
