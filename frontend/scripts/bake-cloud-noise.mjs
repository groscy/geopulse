/*
 * Offline bake of tileable worley-perlin 3D noise for the volumetric cloud raymarch
 * (capability: meteorological-overlay — change add-raymarched-clouds).
 *
 * Emits two raw RGBA8 volumes next to the GL renderer, loaded once at init and
 * uploaded to `sampler3D`s:
 *   cloud-noise-base.bin    64^3 RGBA  R = perlin-worley (billowy base shape)
 *                                      G/B/A = inverted worley @ rising frequency
 *   cloud-noise-detail.bin  32^3 RGBA  R/G/B = inverted worley @ rising frequency
 *                                      A = 255 (unused)
 *
 * Every generator is PERIODIC (feature cells / gradient lattice wrap modulo the
 * frequency), so the volumes tile seamlessly when sampled with GL_REPEAT — no 3D
 * seams. The bake is fully DETERMINISTIC (integer hash, no Math.random), so re-runs
 * reproduce byte-for-byte.
 *
 * Re-run after changing any parameter:  node scripts/bake-cloud-noise.mjs
 */
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'globe', 'clouds-gl');

// --- deterministic integer hash -> [0,1) ---
function hash(x, y, z) {
  let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(z | 0, 1274126177)) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
  h = (h ^ (h >>> 16)) >>> 0;
  return h / 4294967296;
}
const wrap = (n, p) => ((n % p) + p) % p;
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const remap = (v, lo, hi, nlo, nhi) => nlo + ((v - lo) / (hi - lo)) * (nhi - nlo);

// --- periodic 3D worley (cellular), returns F1 distance in [0,1) ---
function worleyF1(x, y, z, freq) {
  const px = x * freq, py = y * freq, pz = z * freq;
  const xi = Math.floor(px), yi = Math.floor(py), zi = Math.floor(pz);
  let f1 = 1e9;
  for (let dz = -1; dz <= 1; dz++)
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++) {
        const cx = xi + dx, cy = yi + dy, cz = zi + dz;
        const wx = wrap(cx, freq), wy = wrap(cy, freq), wz = wrap(cz, freq);
        const fx = cx + hash(wx, wy, wz);
        const fy = cy + hash(wx + 131, wy + 17, wz + 71);
        const fz = cz + hash(wx + 57, wy + 191, wz + 23);
        const ex = fx - px, ey = fy - py, ez = fz - pz;
        const d = ex * ex + ey * ey + ez * ez;
        if (d < f1) f1 = d;
      }
  return Math.min(1, Math.sqrt(f1));
}
// inverted worley -> bright cells (billowy), a single frequency
const worley = (x, y, z, freq) => clamp01(1 - worleyF1(x, y, z, freq));
// 3-octave inverted-worley fbm
function worleyFbm(x, y, z, f) {
  return worley(x, y, z, f) * 0.625 + worley(x, y, z, f * 2) * 0.25 + worley(x, y, z, f * 4) * 0.125;
}

// --- periodic 3D perlin, returns [0,1] ---
const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);
const lerp = (a, b, t) => a + (b - a) * t;
function grad(ix, iy, iz, period) {
  const wx = wrap(ix, period), wy = wrap(iy, period), wz = wrap(iz, period);
  const a = hash(wx, wy, wz) * 6.28318530718;      // azimuth
  const b = Math.acos(2 * hash(wx + 97, wy + 43, wz + 11) - 1); // inclination -> uniform on sphere
  const sb = Math.sin(b);
  return [Math.cos(a) * sb, Math.sin(a) * sb, Math.cos(b)];
}
function perlin(x, y, z, period) {
  const px = x * period, py = y * period, pz = z * period;
  const xi = Math.floor(px), yi = Math.floor(py), zi = Math.floor(pz);
  const xf = px - xi, yf = py - yi, zf = pz - zi;
  const u = fade(xf), v = fade(yf), w = fade(zf);
  const dot = (cx, cy, cz) => {
    const g = grad(cx, cy, cz, period);
    return g[0] * (px - cx) + g[1] * (py - cy) + g[2] * (pz - cz);
  };
  const x00 = lerp(dot(xi, yi, zi), dot(xi + 1, yi, zi), u);
  const x10 = lerp(dot(xi, yi + 1, zi), dot(xi + 1, yi + 1, zi), u);
  const x01 = lerp(dot(xi, yi, zi + 1), dot(xi + 1, yi, zi + 1), u);
  const x11 = lerp(dot(xi, yi + 1, zi + 1), dot(xi + 1, yi + 1, zi + 1), u);
  const y0 = lerp(x00, x10, v), y1 = lerp(x01, x11, v);
  return clamp01(lerp(y0, y1, w) * 0.5 + 0.5);
}

function bake(size, channels, name) {
  const buf = new Uint8Array(size * size * size * 4);
  const inv = 1 / size;
  for (let z = 0; z < size; z++) {
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const fx = x * inv, fy = y * inv, fz = z * inv;
        const idx = (z * size * size + y * size + x) * 4;
        const c = channels(fx, fy, fz);
        buf[idx] = Math.round(clamp01(c[0]) * 255);
        buf[idx + 1] = Math.round(clamp01(c[1]) * 255);
        buf[idx + 2] = Math.round(clamp01(c[2]) * 255);
        buf[idx + 3] = Math.round(clamp01(c[3]) * 255);
      }
    }
  }
  const out = join(OUT_DIR, name);
  writeFileSync(out, buf);
  console.log(`  ${name}  ${size}^3 RGBA  ${(buf.length / 1024 / 1024).toFixed(2)} MB`);
}

console.log('Baking cloud noise volumes ->', OUT_DIR);
// BASE 64^3: R = perlin remapped by worley-fbm (Nubis perlin-worley), GBA = worley @ rising freq.
bake(64, (x, y, z) => {
  const wfbm = worleyFbm(x, y, z, 4);
  const pw = clamp01(remap(perlin(x, y, z, 4), wfbm - 1, 1, 0, 1)); // billowy base
  return [pw, worley(x, y, z, 4), worley(x, y, z, 8), worley(x, y, z, 16)];
}, 'cloud-noise-base.bin');
// DETAIL 32^3: RGB = worley @ rising freq (erodes base edges into wisps), A unused.
bake(32, (x, y, z) => [worley(x, y, z, 4), worley(x, y, z, 8), worley(x, y, z, 16), 1], 'cloud-noise-detail.bin');
console.log('Done.');
