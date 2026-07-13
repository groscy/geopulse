/*
 * Offline bake of a hurricane cloud template for the volumetric storm render
 * (capability: meteorological-overlay — change baked-hurricane-clouds).
 *
 * Emits ONE polar RGBA8 texture next to the GL renderer, loaded once at init and
 * uploaded as a sampler2D indexed by (angle θ on X, normalized radius r on Y):
 *   hurricane-cloud.bin   256x256 RGBA  R = band + eyewall density (0 in the eye)
 *                                       G = height gain (tall eyewall -> raised shell top)
 *                                       B = eye mask (0 in the eye .. 1 outside) — carves
 *                                           the calm eye out of the field cloud beneath
 *                                       A = 255 (reserved)
 *
 * The template is sampled with GL_REPEAT on X (angle wraps at θ = 2π) and
 * GL_CLAMP_TO_EDGE on Y (radius). Every angular generator is PERIODIC modulo the
 * angle frequency so the wrap is seamless, and the bake is fully DETERMINISTIC
 * (integer hash, no Math.random), so re-runs reproduce byte-for-byte.
 *
 * Re-run after changing any parameter:  node scripts/bake-hurricane-cloud.mjs
 */
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'globe', 'clouds-gl');

const SIZE = 256;         // angle (X) x radius (Y)
const ARMS = 2;           // principal spiral bands
const K = 5.0;            // spiral tightness (winding of the log-spiral)
const R_EYE = 0.085;      // clear calm eye radius (normalized)
const R_EYEWALL = 0.15;   // eyewall ring peak radius
const EYEWALL_W = 0.045;  // eyewall ring width (gaussian sigma)
const TWO_PI = Math.PI * 2;

// --- deterministic integer hash -> [0,1) (shared with bake-cloud-noise.mjs) ---
function hash(x, y) {
  let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263)) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
  h = (h ^ (h >>> 16)) >>> 0;
  return h / 4294967296;
}
const wrap = (n, p) => ((n % p) + p) % p;
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);
const lerp = (a, b, t) => a + (b - a) * t;
function smoothstep(a, b, x) {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
}

// value noise periodic in X (angle) only; Y (radius) is clamped, no wrap needed
function pvnoise(x, y, periodX) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const u = fade(xf), v = fade(yf);
  const h = (X, Y) => hash(wrap(X, periodX), Y);
  const a = lerp(h(xi, yi), h(xi + 1, yi), u);
  const b = lerp(h(xi, yi + 1), h(xi + 1, yi + 1), u);
  return lerp(a, b, v);
}
// 2-octave angle-periodic fbm for band jitter (periods must stay integer + wrap)
function fbmAngle(theta, r) {
  const a = pvnoise((theta / TWO_PI) * 6, r * 4, 6) * 0.65;
  const b = pvnoise((theta / TWO_PI) * 12, r * 8, 12) * 0.35;
  return a + b;
}

console.log('Baking hurricane cloud template ->', OUT_DIR);
const buf = new Uint8Array(SIZE * SIZE * 4);
for (let iy = 0; iy < SIZE; iy++) {
  const r = (iy + 0.5) / SIZE;                 // normalized radius 0..1 (Y)
  const outerFade = 1 - smoothstep(0.78, 1.0, r);
  const bandEnv = smoothstep(R_EYEWALL, R_EYEWALL + 0.07, r) * outerFade;
  const eyewall = Math.exp(-Math.pow((r - R_EYEWALL) / EYEWALL_W, 2));
  const eyeMask = smoothstep(R_EYE * 0.7, R_EYEWALL, r); // 0 in eye -> 1 by eyewall
  for (let ix = 0; ix < SIZE; ix++) {
    const theta = ((ix + 0.5) / SIZE) * TWO_PI; // angle 0..2π (X)
    // log-spiral bands, sharpened into discrete arms
    const s = 0.5 + 0.5 * Math.sin(ARMS * theta - K * Math.log(Math.max(r, 1e-3)));
    const band = smoothstep(0.28, 0.95, s);
    const jit = 0.55 + 0.45 * fbmAngle(theta, r);
    let density = eyewall + bandEnv * band * 0.72 * jit;
    if (r < R_EYE) density = 0;                 // hard-clear the eye
    density *= outerFade;
    const height = clamp01(eyewall + bandEnv * band * 0.35) * (r < R_EYE ? 0 : 1);
    const idx = (iy * SIZE + ix) * 4;
    buf[idx] = Math.round(clamp01(density) * 255);
    buf[idx + 1] = Math.round(height * 255);
    buf[idx + 2] = Math.round(clamp01(eyeMask) * 255);
    buf[idx + 3] = 255;
  }
}
const out = join(OUT_DIR, 'hurricane-cloud.bin');
writeFileSync(out, buf);
console.log(`  hurricane-cloud.bin  ${SIZE}x${SIZE} RGBA  ${(buf.length / 1024).toFixed(0)} KB`);
console.log('Done.');
