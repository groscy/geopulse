/*
 * GPU volumetric cloud renderer — capability: meteorological-overlay
 * (change add-raymarched-clouds). A WebGL2 fragment shader raymarches a thin cloud
 * shell (r ∈ [1.0, 1.05]) over the near hemisphere of the D3-orthographic globe.
 * Coverage (where/how much) comes from the weather field uploaded as an equirectangular
 * sampler2D; volume (the form) comes from baked worley-perlin 3D noise (sampler3D).
 * The shell is sun-lit (Beer-Powder + Henyey-Greenstein). Rendered to a half-res
 * OffscreenCanvas and returned as an ImageBitmap for the 2D globe to composite at its
 * cloud-draw point — preserving paint order (labels + forecast tracks stay on top).
 *
 * Active cyclones (setStorms) are injected into the same shell as a baked hurricane
 * template (sampler2D, polar): each storm stamps spiral bands + a dense eyewall + a clear
 * eye into cloud coverage, which the base/detail noise then carves into volumetric cloud —
 * category-scaled, hemisphere-chiral, rotating (frozen when animate=false). The abstract
 * 2D line spiral is retained by the caller only as the no-WebGL2 fallback.
 *
 * The camera is reproduced EXACTLY from d3.geoRotation([λ, φ]): the view→world matrix
 * uInvRot is built on the CPU with d3's Euler convention (Ry(φ)·Rz(λ)), so clouds hug
 * the coastlines without a second source of camera truth. See camMatrix() below.
 *
 * Feature-detected: create() returns null when WebGL2 is unavailable; the caller then
 * falls back to the retained canvas-2D cloud render. Context loss flips `lost` so the
 * caller degrades to canvas until restore.
 */
import type { WeatherField } from '../../data/types';
import baseNoiseUrl from './cloud-noise-base.bin?url';
import detailNoiseUrl from './cloud-noise-detail.bin?url';
import hurricaneUrl from './hurricane-cloud.bin?url';

const BASE_SIZE = 64;
const DETAIL_SIZE = 32;
const HURRICANE_SIZE = 256;         // polar hurricane template (angle x radius)
const MAX_STORMS = 8;               // uniform-array cap; storms beyond this are dropped
const STORM_OMEGA = 0.5;            // band rotation rate (rad/s), zeroed when frozen
const SHELL_INNER = 1.0;
const SHELL_OUTER = 1.05;
const RES_SCALE = 0.5; // half device-res buffer, upscaled on composite

/** One cyclone injected into the shell as baked coverage (from GET /api/storms or the curated set). */
export interface StormInput {
  lon: number; lat: number;   // center, degrees
  category: number;           // Saffir-Simpson 0..5 (scales radius + density)
  spin: number;               // +1 cyclonic north, -1 south (chirality + rotation sense)
}

export interface CloudRenderParams {
  w: number; h: number; dpr: number;   // 2D canvas CSS size + device-pixel ratio
  cx: number; cy: number;              // globe center, CSS px
  R: number;                           // globe radius (= projection scale), CSS px
  lambda: number; phi: number;         // rotation, degrees (as passed to projection.rotate)
  sunLon: number; sunLat: number;      // sub-solar point, degrees
  time: number;                        // seconds; hold constant to freeze motion
  animate: boolean;                    // false => static noise (reduceMotion / idle)
}

const VERT = `#version 300 es
void main() {
  // fullscreen triangle from gl_VertexID (no vertex buffers)
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

const FRAG = `#version 300 es
precision highp float;
precision highp sampler3D;
out vec4 outColor;

uniform vec2 uGlRes;      // gl drawing-buffer size (px)
uniform vec2 uCssRes;     // 2D canvas CSS size (px)
uniform vec2 uCenter;     // globe center, CSS px
uniform float uR;         // globe radius, CSS px
uniform mat3 uInvRot;     // view -> world (inverse of d3.geoRotation)
uniform vec3 uSun;        // world direction toward the sub-solar point
uniform float uTime;
uniform vec3 uWind;       // world-space noise drift (zero when frozen)
uniform int uHasField;
uniform int uSolid;       // 1 = uniform shell (camera-match spike), 0 = volumetric
uniform float uLatMin;    // field coverage: min latitude, radians
uniform float uLatRange;  // field coverage: latitude span, radians
uniform sampler2D uCoverage;
uniform sampler3D uBase;
uniform sampler3D uDetail;
uniform sampler2D uHurricane;   // polar hurricane template: R band/eyewall, G height, B eye-mask
uniform int uStormCount;
uniform vec3 uStormCenter[${MAX_STORMS}];   // world unit vectors
uniform float uStormCosRad[${MAX_STORMS}];  // cos(outer angular radius) — early-out test
uniform float uStormInvRad[${MAX_STORMS}];  // 1 / outer angular radius — normalizes r
uniform float uStormDensity[${MAX_STORMS}];
uniform float uStormSpin[${MAX_STORMS}];    // +1 / -1
uniform float uStormPhase0[${MAX_STORMS}];  // per-storm rotation offset
uniform float uStormOmega;                  // rotation rate (0 when frozen)

const float PI = 3.14159265359;
const float SHELL_INNER = ${SHELL_INNER.toFixed(3)};
const float SHELL_OUTER = ${SHELL_OUTER.toFixed(3)};
const int STEPS = 32;
const int MAX_STORMS = ${MAX_STORMS};
const int LIGHT_STEPS = 4;
const float BASE_FREQ = 3.5;
const float DETAIL_FREQ = 14.0;
const float ABSORB = 22.0;
const float LIGHT_ABSORB = 16.0;
const float LIGHT_STEP = 0.012;
const float DENSITY = 1.35;

float remap(float v, float lo, float hi, float nlo, float nhi) {
  return nlo + (v - lo) / (hi - lo) * (nhi - nlo);
}
// Henyey-Greenstein phase (forward scatter -> silver lining toward the sun)
float hg(float mu, float g) {
  float g2 = g * g;
  return (1.0 - g2) / (4.0 * PI * pow(1.0 + g2 - 2.0 * g * mu, 1.5));
}
// dense middle, rounded base, wispy top; a higher gain (eyewall) keeps density taller up the shell
float heightProfile(float h, float gain) {
  float base = clamp(remap(h, 0.0, 0.12, 0.0, 1.0), 0.0, 1.0);
  float top = clamp(remap(h, mix(0.45, 0.85, gain), 1.0, 1.0, 0.0), 0.0, 1.0);
  return base * top;
}
// weather-field cloud cover as coverage (0 when no field uploaded)
float fieldCoverage(float lon, float lat) {
  if (uHasField == 0) return 0.0;
  float v = (lat - uLatMin) / uLatRange;
  if (v < 0.0 || v > 1.0) return 0.0;
  float u = lon / (2.0 * PI) + 0.5;       // wraps via REPEAT
  return texture(uCoverage, vec2(u, v)).r; // stored 0..1
}
// baked hurricane contribution at a world direction: x = coverage add, y = eye mask, z = height gain
vec3 stormField(vec3 dir) {
  float add = 0.0, eyeMask = 1.0, heightGain = 0.0;
  for (int i = 0; i < MAX_STORMS; i++) {
    if (i >= uStormCount) break;
    vec3 c = uStormCenter[i];
    float cd = dot(dir, c);
    if (cd < uStormCosRad[i]) continue;                 // outside the system's outer radius
    float r = acos(clamp(cd, -1.0, 1.0)) * uStormInvRad[i];  // 0 at eye .. 1 at edge
    if (r > 1.0) continue;
    vec3 e = normalize(cross(vec3(0.0, 0.0, 1.0), c));  // east at the storm center
    vec3 n = cross(c, e);                               // north
    float th = atan(dot(dir, e), dot(dir, n));          // bearing around the eye
    float a = uStormSpin[i] * (th + uStormOmega * uTime) + uStormPhase0[i];
    vec4 t = texture(uHurricane, vec2(a / (2.0 * PI), r));   // R band/eyewall, G height, B eye-mask
    add += t.r * uStormDensity[i];
    eyeMask = min(eyeMask, t.b);                        // carve the calm eye out of field cloud
    heightGain = max(heightGain, t.g);
  }
  return vec3(add, eyeMask, heightGain);
}
float sampleDensity(vec3 wp, float lon, float lat, float hf, vec3 windOff) {
  vec3 sf = stormField(normalize(wp));
  float cov = clamp(fieldCoverage(lon, lat) * sf.y + sf.x, 0.0, 1.0);
  if (cov <= 0.02) return 0.0;
  vec4 bn = texture(uBase, wp * BASE_FREQ + windOff);
  float wfbm = bn.g * 0.625 + bn.b * 0.25 + bn.a * 0.125;
  float base = remap(bn.r, wfbm - 1.0, 1.0, 0.0, 1.0);
  float d = remap(base * heightProfile(hf, sf.z), 1.0 - cov, 1.0, 0.0, 1.0);
  if (d <= 0.0) return 0.0;
  vec3 dn = texture(uDetail, wp * DETAIL_FREQ + windOff * 2.0).rgb;
  float dfbm = dn.r * 0.625 + dn.g * 0.25 + dn.b * 0.125;
  d = remap(d, dfbm * 0.55, 1.0, 0.0, 1.0);   // erode edges into wisps
  return clamp(d, 0.0, 1.0) * cov * DENSITY;
}

void main() {
  // gl fragment -> CSS-space screen coords (gl y is bottom-up)
  vec2 css = vec2(gl_FragCoord.x / uGlRes.x * uCssRes.x,
                  uCssRes.y - gl_FragCoord.y / uGlRes.y * uCssRes.y);
  float rvec = (css.x - uCenter.x) / uR;    // view "right"  (= projected X)
  float uvec = -(css.y - uCenter.y) / uR;   // view "up"     (= projected Y)
  float rho2 = rvec * rvec + uvec * uvec;
  float ro2 = SHELL_OUTER * SHELL_OUTER;
  if (rho2 >= ro2) { outColor = vec4(0.0); return; }

  float tTop = sqrt(ro2 - rho2);
  bool disc = rho2 < 1.0;
  float tBot = disc ? sqrt(1.0 - rho2) : -tTop;   // planet cap, or straight through at the limb
  float dt = (tTop - tBot) / float(STEPS);
  vec3 fwd = uInvRot * vec3(1.0, 0.0, 0.0);       // world eye direction
  vec3 windOff = uWind * uTime;

  float T = 1.0;                 // transmittance
  vec3 acc = vec3(0.0);          // premultiplied color
  for (int i = 0; i < STEPS; i++) {
    float t = tTop - (float(i) + 0.5) * dt;
    vec3 P = vec3(t, rvec, uvec);              // view frame: (forward, right, up)
    float rad = length(P);
    if (rad < SHELL_INNER || rad > SHELL_OUTER) continue;
    vec3 wp = uInvRot * P;                      // world position (noise attaches to the globe)
    vec3 dir = wp / rad;
    float lon = atan(dir.y, dir.x);
    float lat = asin(clamp(dir.z, -1.0, 1.0));
    float hf = clamp((rad - SHELL_INNER) / (SHELL_OUTER - SHELL_INNER), 0.0, 1.0);

    float dens = (uSolid == 1) ? heightProfile(hf, 0.0) : sampleDensity(wp, lon, lat, hf, windOff);
    if (dens <= 0.001) continue;

    // self-shadow: short march toward the sun
    float lightDens = 0.0;
    for (int s = 1; s <= LIGHT_STEPS; s++) {
      vec3 lp = wp + uSun * (float(s) * LIGHT_STEP);
      float lrad = length(lp);
      if (lrad > SHELL_OUTER) break;
      vec3 ld = lp / lrad;
      float lhf = clamp((lrad - SHELL_INNER) / (SHELL_OUTER - SHELL_INNER), 0.0, 1.0);
      lightDens += (uSolid == 1) ? heightProfile(lhf, 0.0)
        : sampleDensity(lp, atan(ld.y, ld.x), asin(clamp(ld.z, -1.0, 1.0)), lhf, windOff);
    }
    float sunT = exp(-lightDens * LIGHT_STEP * LIGHT_ABSORB);
    float powder = 1.0 - exp(-dens * dt * 2.0);
    float ph = hg(dot(fwd, uSun), 0.35);
    vec3 sunCol = vec3(1.0, 0.95, 0.86);
    vec3 ambient = mix(vec3(0.26, 0.32, 0.42), vec3(0.72, 0.80, 0.90), hf); // dark base -> bright top
    vec3 lit = sunCol * (sunT * (0.35 + 1.1 * ph) * powder) * 2.2 + ambient;

    float a = 1.0 - exp(-dens * dt * ABSORB);
    acc += T * a * lit;
    T *= (1.0 - a);
    if (T < 0.02) break;
  }

  float alpha = 1.0 - T;
  if (!disc) {                                   // soften the limb annulus edge
    float e = (SHELL_OUTER - sqrt(rho2)) / (SHELL_OUTER - 1.0);
    alpha *= clamp(e * 1.6, 0.0, 1.0);
  }
  outColor = vec4(acc, alpha);                   // premultiplied (context premultipliedAlpha:true)
}`;

/** view→world matrix (inverse of d3.geoRotation([λ,φ])), column-major for uniformMatrix3fv. */
function camMatrix(lambdaDeg: number, phiDeg: number): Float32Array {
  const l = (lambdaDeg * Math.PI) / 180, p = (phiDeg * Math.PI) / 180;
  const cl = Math.cos(l), sl = Math.sin(l), cp = Math.cos(p), sp = Math.sin(p);
  // Rinv = Rz(-λ)·Ry(-φ); columns below (see module header derivation)
  return new Float32Array([
    cl * cp, -sl * cp, -sp,   // col0
    sl, cl, 0,               // col1
    cl * sp, -sl * sp, cp,    // col2
  ]);
}

function lonLatToVec(lonDeg: number, latDeg: number): [number, number, number] {
  const lo = (lonDeg * Math.PI) / 180, la = (latDeg * Math.PI) / 180;
  return [Math.cos(la) * Math.cos(lo), Math.cos(la) * Math.sin(lo), Math.sin(la)];
}

function compile(gl: WebGL2RenderingContext, type: number, src: string): WebGLShader {
  const sh = gl.createShader(type)!;
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(sh);
    gl.deleteShader(sh);
    throw new Error(`cloud shader compile failed: ${log}`);
  }
  return sh;
}

export class CloudGL {
  private gl: WebGL2RenderingContext;
  private canvas: OffscreenCanvas;
  private prog: WebGLProgram;
  private u: Record<string, WebGLUniformLocation | null> = {};
  private coverageTex: WebGLTexture;
  private baseTex: WebGLTexture | null = null;
  private detailTex: WebGLTexture | null = null;
  private hurricaneTex: WebGLTexture | null = null;
  private glW = 0;
  private glH = 0;
  private fieldKey: string | null = null;
  private latMin = 0;
  private latRange = 1;
  private lastBitmap: ImageBitmap | null = null;
  // packed active-storm uniforms (see setStorms)
  private stormCount = 0;
  private stormCenter = new Float32Array(MAX_STORMS * 3);
  private stormCosRad = new Float32Array(MAX_STORMS);
  private stormInvRad = new Float32Array(MAX_STORMS);
  private stormDensity = new Float32Array(MAX_STORMS);
  private stormSpin = new Float32Array(MAX_STORMS);
  private stormPhase0 = new Float32Array(MAX_STORMS);
  /** true once both noise volumes are uploaded — until then render() returns null. */
  ready = false;
  /** flipped on context loss so the caller degrades to the canvas-2D path. */
  lost = false;

  private constructor(gl: WebGL2RenderingContext, canvas: OffscreenCanvas) {
    this.gl = gl;
    this.canvas = canvas;
    const vs = compile(gl, gl.VERTEX_SHADER, VERT);
    const fs = compile(gl, gl.FRAGMENT_SHADER, FRAG);
    const prog = gl.createProgram()!;
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      throw new Error(`cloud program link failed: ${gl.getProgramInfoLog(prog)}`);
    }
    this.prog = prog;
    gl.useProgram(prog);
    for (const name of ['uGlRes', 'uCssRes', 'uCenter', 'uR', 'uInvRot', 'uSun', 'uTime', 'uWind',
      'uHasField', 'uSolid', 'uLatMin', 'uLatRange', 'uCoverage', 'uBase', 'uDetail',
      'uHurricane', 'uStormCount', 'uStormCenter', 'uStormCosRad', 'uStormInvRad',
      'uStormDensity', 'uStormSpin', 'uStormPhase0', 'uStormOmega']) {
      this.u[name] = gl.getUniformLocation(prog, name);
    }
    gl.uniform1i(this.u.uCoverage, 0);
    gl.uniform1i(this.u.uBase, 1);
    gl.uniform1i(this.u.uDetail, 2);
    gl.uniform1i(this.u.uHurricane, 3);
    this.coverageTex = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, this.coverageTex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);      // longitude wraps
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  }

  /** Create the renderer, or null if WebGL2 is unavailable. Kicks off async noise upload. */
  static create(): CloudGL | null {
    let canvas: OffscreenCanvas;
    try {
      canvas = new OffscreenCanvas(2, 2);
    } catch {
      return null; // OffscreenCanvas unsupported
    }
    const gl = canvas.getContext('webgl2', {
      premultipliedAlpha: true, alpha: true, antialias: false, depth: false, stencil: false,
    }) as WebGL2RenderingContext | null;
    if (!gl) return null;
    let inst: CloudGL;
    try {
      inst = new CloudGL(gl, canvas);
    } catch (e) {
      console.warn('[clouds-gl]', e);
      return null;
    }
    canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); inst.lost = true; });
    inst.loadNoise();
    return inst;
  }

  private async loadNoise() {
    try {
      const [baseBuf, detailBuf, hurBuf] = await Promise.all([
        fetch(baseNoiseUrl).then((r) => r.arrayBuffer()),
        fetch(detailNoiseUrl).then((r) => r.arrayBuffer()),
        fetch(hurricaneUrl).then((r) => r.arrayBuffer()),
      ]);
      this.baseTex = this.upload3D(new Uint8Array(baseBuf), BASE_SIZE, 1);
      this.detailTex = this.upload3D(new Uint8Array(detailBuf), DETAIL_SIZE, 2);
      this.hurricaneTex = this.upload2D(new Uint8Array(hurBuf), HURRICANE_SIZE, 3);
      this.ready = true;
    } catch (e) {
      console.warn('[clouds-gl] noise load failed', e);
      this.lost = true; // caller falls back to canvas
    }
  }

  /** Upload an RGBA8 2D texture (angle-wrap S, clamp T) on the given unit. */
  private upload2D(data: Uint8Array, size: number, unit: number): WebGLTexture {
    const gl = this.gl;
    const tex = gl.createTexture()!;
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);       // angle wraps at 2π
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE); // radius clamps
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, size, size, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);
    return tex;
  }

  private upload3D(data: Uint8Array, size: number, unit: number): WebGLTexture {
    const gl = this.gl;
    const tex = gl.createTexture()!;
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_3D, tex);
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_T, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_R, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texImage3D(gl.TEXTURE_3D, 0, gl.RGBA8, size, size, size, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);
    return tex;
  }

  /** Upload the weather field's cloud channel as an equirectangular coverage texture. */
  setField(f: WeatherField | null) {
    const gl = this.gl;
    if (!f || f.nlon <= 0 || f.nlat <= 0) { this.fieldKey = null; return; }
    const key = `${f.ts ?? ''}:${f.nlon}x${f.nlat}:${f.latMin}:${f.step}`;
    if (key === this.fieldKey) return; // unchanged — skip re-upload
    this.fieldKey = key;
    const px = new Uint8Array(f.nlon * f.nlat);
    for (let i = 0; i < px.length; i++) {
      const c = f.cloud[i];
      px[i] = c == null ? 0 : Math.max(0, Math.min(255, Math.round((c / 100) * 255)));
    }
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.coverageTex);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, f.nlon, f.nlat, 0, gl.RED, gl.UNSIGNED_BYTE, px);
    this.latMin = (f.latMin * Math.PI) / 180;
    this.latRange = ((f.nlat - 1) * f.step * Math.PI) / 180;
  }

  /** Pack the active cyclones (up to MAX_STORMS) into the per-storm uniform arrays. */
  setStorms(storms: StormInput[]) {
    const n = Math.min(storms.length, MAX_STORMS);
    if (storms.length > MAX_STORMS) {
      console.warn(`[clouds-gl] ${storms.length} storms; rendering the first ${MAX_STORMS}`);
    }
    this.stormCount = n;
    for (let i = 0; i < n; i++) {
      const s = storms[i];
      const c = lonLatToVec(s.lon, s.lat);
      this.stormCenter[i * 3] = c[0];
      this.stormCenter[i * 3 + 1] = c[1];
      this.stormCenter[i * 3 + 2] = c[2];
      const cat = Math.max(0, Math.min(5, s.category));
      const rhoMax = 0.09 + 0.025 * cat;          // outer angular radius, rad (Cat0 ~0.09 .. Cat5 ~0.215)
      this.stormCosRad[i] = Math.cos(rhoMax);
      this.stormInvRad[i] = 1 / rhoMax;
      this.stormDensity[i] = 0.75 + 0.12 * cat;   // denser for stronger systems
      this.stormSpin[i] = s.spin >= 0 ? 1 : -1;
      this.stormPhase0[i] = i * 1.7;              // desync rotation across storms
    }
  }

  private resize(glW: number, glH: number) {
    if (glW === this.glW && glH === this.glH) return;
    this.glW = this.canvas.width = glW;
    this.glH = this.canvas.height = glH;
    this.gl.viewport(0, 0, glW, glH);
  }

  /**
   * Render the cloud shell and return an ImageBitmap (null if not ready / lost).
   * `solid` renders a uniform shell (camera-match spike) instead of volumetric cloud.
   */
  render(p: CloudRenderParams, solid = false): ImageBitmap | null {
    if (!this.ready || this.lost) return null;
    const gl = this.gl;
    const glW = Math.max(2, Math.round(p.w * p.dpr * RES_SCALE));
    const glH = Math.max(2, Math.round(p.h * p.dpr * RES_SCALE));
    this.resize(glW, glH);
    gl.useProgram(this.prog);

    gl.uniform2f(this.u.uGlRes, glW, glH);
    gl.uniform2f(this.u.uCssRes, p.w, p.h);
    gl.uniform2f(this.u.uCenter, p.cx, p.cy);
    gl.uniform1f(this.u.uR, p.R);
    gl.uniformMatrix3fv(this.u.uInvRot, false, camMatrix(p.lambda, p.phi));
    const sun = lonLatToVec(p.sunLon, p.sunLat);
    gl.uniform3f(this.u.uSun, sun[0], sun[1], sun[2]);
    gl.uniform1f(this.u.uTime, p.time);
    // slow world-space drift; zero when frozen so clouds hold still
    const drift = p.animate ? 0.006 : 0;
    gl.uniform3f(this.u.uWind, drift, drift * 0.6, 0);
    gl.uniform1i(this.u.uHasField, this.fieldKey ? 1 : 0);
    gl.uniform1i(this.u.uSolid, solid ? 1 : 0);
    gl.uniform1f(this.u.uLatMin, this.latMin);
    gl.uniform1f(this.u.uLatRange, this.latRange);

    gl.uniform1i(this.u.uStormCount, this.stormCount);
    gl.uniform1f(this.u.uStormOmega, p.animate ? STORM_OMEGA : 0);
    if (this.stormCount > 0) {
      gl.uniform3fv(this.u.uStormCenter, this.stormCenter);
      gl.uniform1fv(this.u.uStormCosRad, this.stormCosRad);
      gl.uniform1fv(this.u.uStormInvRad, this.stormInvRad);
      gl.uniform1fv(this.u.uStormDensity, this.stormDensity);
      gl.uniform1fv(this.u.uStormSpin, this.stormSpin);
      gl.uniform1fv(this.u.uStormPhase0, this.stormPhase0);
    }

    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.coverageTex);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_3D, this.baseTex);
    gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_3D, this.detailTex);
    gl.activeTexture(gl.TEXTURE3); gl.bindTexture(gl.TEXTURE_2D, this.hurricaneTex);

    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.disable(gl.BLEND);            // single pass computes final premultiplied RGBA
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    if (this.lastBitmap) this.lastBitmap.close();
    this.lastBitmap = this.canvas.transferToImageBitmap();
    return this.lastBitmap;
  }

  dispose() {
    const gl = this.gl;
    if (this.lastBitmap) { this.lastBitmap.close(); this.lastBitmap = null; }
    gl.deleteProgram(this.prog);
    gl.deleteTexture(this.coverageTex);
    if (this.baseTex) gl.deleteTexture(this.baseTex);
    if (this.detailTex) gl.deleteTexture(this.detailTex);
    if (this.hurricaneTex) gl.deleteTexture(this.hurricaneTex);
  }
}
