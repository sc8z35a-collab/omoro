// Turns a string into N target points (xyz + edge weight) for the GPGPU particle text.
//  - glyphs are rasterised on a 2D canvas, then a 2-pass chamfer distance transform gives the distance to the outline
//  - particles are biased toward outlines (crisp silhouette) and "inflated" in z by the interior distance,
//    so letters read as rounded 3D volumes instead of a flat stencil
//  - output is in normalised units: x ∈ [-1, 1], y ∈ [-aspect/2, aspect/2]
const FAMILY = `"Dela Gothic One", "Zen Kaku Gothic New", sans-serif`;

function rasterise(lines, W, H) {
  const c = document.createElement("canvas");
  c.width = W; c.height = H;
  const ctx = c.getContext("2d", { willReadFrequently: true });
  ctx.fillStyle = "#000"; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = "#fff"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  let size = Math.round(H * .5);
  do { ctx.font = `400 ${size}px ${FAMILY}`; size -= 4; }
  while (Math.max(...lines.map((l) => ctx.measureText(l).width)) > W * .94 || size * 1.12 * lines.length > H * .9);
  const lh = size * 1.16;
  lines.forEach((l, i) => ctx.fillText(l, W / 2, H / 2 + (i - (lines.length - 1) / 2) * lh + size * .04));
  const rgba = ctx.getImageData(0, 0, W, H).data;
  const mask = new Uint8Array(W * H);
  for (let i = 0; i < mask.length; i++) mask[i] = rgba[i * 4] > 110 ? 1 : 0;
  return { mask, glyph: size };
}

// 3-4 chamfer distance (≈ euclidean × 3) from every inside pixel to the nearest outside pixel
function chamfer(mask, W, H) {
  const INF = 1 << 20, d = new Int32Array(W * H);
  for (let i = 0; i < d.length; i++) d[i] = mask[i] ? INF : 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x; if (!d[i]) continue;
    let v = d[i];
    if (x > 0) v = Math.min(v, d[i - 1] + 3);
    if (y > 0) { v = Math.min(v, d[i - W] + 3); if (x > 0) v = Math.min(v, d[i - W - 1] + 4); if (x < W - 1) v = Math.min(v, d[i - W + 1] + 4); }
    d[i] = v;
  }
  for (let y = H - 1; y >= 0; y--) for (let x = W - 1; x >= 0; x--) {
    const i = y * W + x; if (!d[i]) continue;
    let v = d[i];
    if (x < W - 1) v = Math.min(v, d[i + 1] + 3);
    if (y < H - 1) { v = Math.min(v, d[i + W] + 3); if (x < W - 1) v = Math.min(v, d[i + W + 1] + 4); if (x > 0) v = Math.min(v, d[i + W - 1] + 4); }
    d[i] = v;
  }
  return d;
}

let seed = 1234567;
const rnd = () => { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; return (seed >>> 0) / 4294967296; };

export function sampleText(lines, count, { W = 1600, H = 800, depth = .085 } = {}) {
  const { mask, glyph } = rasterise(lines, W, H);
  const dist = chamfer(mask, W, H);
  const stroke = glyph * .09 * 3; // approx. half stroke width in chamfer units
  // candidate pixels (every pixel inside), weighted toward the outline
  const cand = [], weight = [];
  let total = 0;
  for (let i = 0; i < mask.length; i++) if (mask[i]) {
    const e = Math.exp(-dist[i] / 6);         // 1 on the outline → 0 inside
    const w = .45 + e * 1.8;
    cand.push(i); total += w; weight.push(total);
  }
  const out = new Float32Array(count * 4);
  const n = cand.length;
  const aspect = H / W;
  for (let k = 0; k < count; k++) {
    let i;
    if (!n) { out.set([(rnd() - .5) * 2, (rnd() - .5) * aspect, 0, 0], k * 4); continue; }
    // binary search the cumulative weights
    const r = rnd() * total; let lo = 0, hi = n - 1;
    while (lo < hi) { const m = (lo + hi) >> 1; if (weight[m] < r) lo = m + 1; else hi = m; }
    i = cand[lo];
    const x = i % W, y = (i / W) | 0;
    const dd = dist[i];
    const inner = Math.min(dd / stroke, 1);                     // 0 at edge → 1 at stroke centre
    const puff = Math.sqrt(Math.max(0, 1 - (1 - inner) * (1 - inner))); // circular profile
    const side = rnd() < .5 ? -1 : 1;
    out[k * 4] = ((x + rnd()) / W - .5) * 2;
    out[k * 4 + 1] = -((y + rnd()) / H - .5) * 2 * aspect;
    out[k * 4 + 2] = side * puff * depth * (.6 + rnd() * .4) + (rnd() - .5) * .006;
    out[k * 4 + 3] = Math.exp(-dd / 5);                          // edge weight (shading)
  }
  return out;
}

// Scatter cloud used before the first morph (a slow nebula around the stage)
export function cloudTargets(count, spread = 7) {
  const out = new Float32Array(count * 4);
  for (let k = 0; k < count; k++) {
    const a = rnd() * Math.PI * 2, r = Math.pow(rnd(), .6) * spread;
    out.set([Math.cos(a) * r, (rnd() - .5) * spread * .7, Math.sin(a) * r * .5 - 1, 0], k * 4);
  }
  return out;
}
