// Tileable 3D noise volume shared by the hero simulation and the volumetric light.
//   rgb = divergence-free curl vector field (≈[-1,1])  → GPGPU particle flow (1 fetch instead of 18 simplex evals)
//   a   = fbm smoke density [0,1]                       → volumetric spotlight haze
// Built once on the CPU from periodic value-noise lattices (≈60–120 ms for 64³), uploaded as a Float Data3DTexture.
import * as THREE from "three";

function lattice(n, seed) {
  const a = new Float32Array(n * n * n);
  let s = seed >>> 0 || 1;
  for (let i = 0; i < a.length; i++) { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; a[i] = ((s >>> 0) / 4294967296) * 2 - 1; }
  return a;
}
const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);

// periodic value noise sampled on a size³ grid, `freq` lattice cells per period
function octave(size, freq, seed, out, amp) {
  const L = lattice(freq, seed);
  const idx = (x, y, z) => ((z % freq) * freq + (y % freq)) * freq + (x % freq);
  const k = freq / size;
  let o = 0;
  for (let z = 0; z < size; z++) {
    const fz = z * k, iz = Math.floor(fz), tz = fade(fz - iz);
    for (let y = 0; y < size; y++) {
      const fy = y * k, iy = Math.floor(fy), ty = fade(fy - iy);
      for (let x = 0; x < size; x++, o++) {
        const fx = x * k, ix = Math.floor(fx), tx = fade(fx - ix);
        const c000 = L[idx(ix, iy, iz)], c100 = L[idx(ix + 1, iy, iz)], c010 = L[idx(ix, iy + 1, iz)], c110 = L[idx(ix + 1, iy + 1, iz)];
        const c001 = L[idx(ix, iy, iz + 1)], c101 = L[idx(ix + 1, iy, iz + 1)], c011 = L[idx(ix, iy + 1, iz + 1)], c111 = L[idx(ix + 1, iy + 1, iz + 1)];
        const x00 = c000 + (c100 - c000) * tx, x10 = c010 + (c110 - c010) * tx, x01 = c001 + (c101 - c001) * tx, x11 = c011 + (c111 - c011) * tx;
        const y0 = x00 + (x10 - x00) * ty, y1 = x01 + (x11 - x01) * ty;
        out[o] += (y0 + (y1 - y0) * tz) * amp;
      }
    }
  }
}
function fbm(size, seed, octaves = [[4, 1], [8, .5], [16, .25]]) {
  const out = new Float32Array(size * size * size);
  octaves.forEach(([f, a], i) => octave(size, f, seed * 7919 + i * 104729, out, a));
  return out;
}

let cached = null;
export function noiseVolume(size = 64) {
  if (cached && cached.image.width === size) return cached;
  const N = size, n3 = N * N * N;
  const px = fbm(N, 11), py = fbm(N, 23), pz = fbm(N, 37);
  const dens = fbm(N, 51, [[4, 1], [8, .5], [16, .27], [32, .12]]);
  const data = new Float32Array(n3 * 4);
  const w = (v) => (v + N) % N;
  const I = (x, y, z) => (w(z) * N + w(y)) * N + w(x);
  let maxL = 1e-6, dMin = 1e9, dMax = -1e9;
  for (let i = 0; i < n3; i++) { dMin = Math.min(dMin, dens[i]); dMax = Math.max(dMax, dens[i]); }
  for (let z = 0, o = 0; z < N; z++) for (let y = 0; y < N; y++) for (let x = 0; x < N; x++, o++) {
    // curl(P) = (dPz/dy − dPy/dz, dPx/dz − dPz/dx, dPy/dx − dPx/dy)
    const cx = (pz[I(x, y + 1, z)] - pz[I(x, y - 1, z)]) - (py[I(x, y, z + 1)] - py[I(x, y, z - 1)]);
    const cy = (px[I(x, y, z + 1)] - px[I(x, y, z - 1)]) - (pz[I(x + 1, y, z)] - pz[I(x - 1, y, z)]);
    const cz = (py[I(x + 1, y, z)] - py[I(x - 1, y, z)]) - (px[I(x, y + 1, z)] - px[I(x, y - 1, z)]);
    data[o * 4] = cx; data[o * 4 + 1] = cy; data[o * 4 + 2] = cz;
    maxL = Math.max(maxL, Math.hypot(cx, cy, cz));
    data[o * 4 + 3] = (dens[o] - dMin) / (dMax - dMin);
  }
  const k = 1.6 / maxL; // most vectors end up in [-1,1] with a few hot spots above
  for (let i = 0; i < n3; i++) { data[i * 4] *= k; data[i * 4 + 1] *= k; data[i * 4 + 2] *= k; }
  // half floats are always linearly filterable in WebGL2 (float32 needs OES_texture_float_linear)
  const half = new Uint16Array(data.length);
  for (let i = 0; i < data.length; i++) half[i] = THREE.DataUtils.toHalfFloat(data[i]);
  const tex = new THREE.Data3DTexture(half, N, N, N);
  tex.format = THREE.RGBAFormat;
  tex.type = THREE.HalfFloatType;
  tex.minFilter = tex.magFilter = THREE.LinearFilter;
  tex.wrapS = tex.wrapT = tex.wrapR = THREE.RepeatWrapping;
  tex.unpackAlignment = 1;
  tex.needsUpdate = true;
  cached = tex;
  return tex;
}
