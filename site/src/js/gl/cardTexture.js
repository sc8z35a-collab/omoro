// Composites a photo + typography into a canvas used as a WebGL texture (or a 2D card).
import { img } from "../core/data.js";

const cache = new Map();
export function loadImage(src) {
  if (cache.has(src)) return cache.get(src);
  const p = new Promise((resolve) => {
    const im = new Image();
    im.crossOrigin = "anonymous";
    im.decoding = "async";
    im.onload = () => resolve(im);
    im.onerror = () => resolve(null);
    im.src = src;
  });
  cache.set(src, p);
  return p;
}

export async function ensureFonts(text = "") {
  if (!document.fonts?.load) return;
  const sample = text || "お祭り男ォ！ｵﾏﾂﾘｵﾄｺｶ…兄さん、アカーン！そこはアカン良かったこの距離でぇバチコーンストライクOMORO0123456789";
  try {
    await Promise.race([
      Promise.all([
        document.fonts.load(`400 80px "Dela Gothic One"`, sample),
        document.fonts.load(`700 40px "Zen Kaku Gothic New"`, sample),
        document.fonts.load(`500 30px "JetBrains Mono"`, "MOMENT 01"),
        document.fonts.load(`700 60px "Space Grotesk"`, "OMORO.")
      ]),
      new Promise((r) => setTimeout(r, 2500))
    ]);
  } catch { /* fonts optional */ }
}

export function coverDraw(ctx, image, x, y, w, h, zoom = 1) {
  if (!image) return;
  const ratio = Math.max(w / image.width, h / image.height) * zoom;
  const iw = image.width * ratio, ih = image.height * ratio;
  ctx.drawImage(image, x + (w - iw) / 2, y + (h - ih) / 2, iw, ih);
}

function fitFont(ctx, lines, family, weight, maxWidth, start, min) {
  let size = start;
  do {
    ctx.font = `${weight} ${size}px ${family}`;
    if (Math.max(...lines.map((l) => ctx.measureText(l).width)) <= maxWidth) break;
    size -= 4;
  } while (size > min);
  return size;
}

// Portrait moment card used across the 3D scenes.
export async function momentCanvas(moment, { width = 1024, height = 1400, small = false } = {}) {
  await ensureFonts(moment.title + moment.lines.join(""));
  const photo = await loadImage(img(moment.image, small));
  const c = document.createElement("canvas");
  c.width = width; c.height = height;
  const ctx = c.getContext("2d");
  const s = width / 1024;
  ctx.fillStyle = "#0b0c0d";
  ctx.fillRect(0, 0, width, height);
  ctx.save();
  ctx.filter = "saturate(1.05) contrast(1.08) brightness(.82)";
  coverDraw(ctx, photo, 0, 0, width, height, 1.02);
  ctx.restore();
  // duotone wash in accent
  ctx.globalCompositeOperation = "soft-light";
  ctx.fillStyle = moment.accent;
  ctx.globalAlpha = .38;
  ctx.fillRect(0, 0, width, height);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "source-over";
  const g = ctx.createLinearGradient(0, 0, 0, height);
  g.addColorStop(0, "rgba(11,12,13,.72)");
  g.addColorStop(.28, "rgba(11,12,13,.05)");
  g.addColorStop(.55, "rgba(11,12,13,.35)");
  g.addColorStop(1, "rgba(11,12,13,.96)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, width, height);

  const m = 64 * s;
  // top row
  ctx.fillStyle = moment.accent;
  ctx.fillRect(m, m, 64 * s, 8 * s);
  ctx.font = `500 ${26 * s}px "JetBrains Mono", monospace`;
  ctx.fillStyle = "rgba(238,240,232,.85)";
  ctx.textBaseline = "top";
  ctx.fillText(`MOMENT ${moment.number} / 06`, m, m + 30 * s);
  ctx.textAlign = "right";
  ctx.fillText(moment.short, width - m, m + 30 * s);
  ctx.textAlign = "left";
  // giant ghost number
  ctx.font = `700 ${420 * s}px "Space Grotesk", sans-serif`;
  ctx.fillStyle = "rgba(238,240,232,.07)";
  ctx.textBaseline = "alphabetic";
  ctx.fillText(moment.number, width - 520 * s, 520 * s);
  // quote
  const maxW = width - m * 2;
  const size = fitFont(ctx, moment.lines, `"Dela Gothic One", "Zen Kaku Gothic New", sans-serif`, 400, maxW, 168 * s, 60 * s);
  const lh = size * 1.12;
  const baseY = height - m - 150 * s - lh * (moment.lines.length - 1);
  ctx.fillStyle = "#eef0e8";
  ctx.shadowColor = "rgba(0,0,0,.45)";
  ctx.shadowBlur = 30 * s;
  moment.lines.forEach((line, i) => ctx.fillText(line, m, baseY + lh * i));
  ctx.shadowBlur = 0;
  // speaker + rule
  ctx.fillStyle = moment.accent;
  ctx.font = `700 ${32 * s}px "Zen Kaku Gothic New", sans-serif`;
  ctx.fillText(moment.speaker, m, height - m - 70 * s);
  ctx.fillStyle = "rgba(238,240,232,.25)";
  ctx.fillRect(m, height - m - 40 * s, maxW, 2 * s);
  ctx.font = `500 ${22 * s}px "JetBrains Mono", monospace`;
  ctx.fillStyle = "rgba(238,240,232,.6)";
  ctx.fillText("OMORO / THE DAUSO FILE", m, height - m);
  ctx.textAlign = "right";
  ctx.fillText(moment.en.toUpperCase(), width - m, height - m);
  ctx.textAlign = "left";
  // frame
  ctx.strokeStyle = "rgba(238,240,232,.18)";
  ctx.lineWidth = 2 * s;
  ctx.strokeRect(m / 2, m / 2, width - m, height - m);
  return c;
}

/* ------------------------------------------------------------------------------------------------
 * momentLayers(): the same card split into separate layers so a shader can do real depth/parallax
 * and foil effects instead of sampling one flat image.
 *   photo : photo + duotone + gradients (drawn 8% oversize so parallax never shows the edge)
 *   ink   : transparent typography / rules / labels (sits on the glass plane)
 *   mask  : R = foil (quote, accent bar, frame line)  G = ghost number (mid depth)  B = glitter area
 * ---------------------------------------------------------------------------------------------- */
export async function momentLayers(moment, { width = 1280, height = 1750, small = false } = {}) {
  await ensureFonts(moment.title + moment.lines.join(""));
  const photoImg = await loadImage(img(moment.image, small));
  const mk = () => { const c = document.createElement("canvas"); c.width = width; c.height = height; return c; };
  const s = width / 1024, m = 64 * s, maxW = width - m * 2;

  // ---- photo layer
  const photo = mk(), p = photo.getContext("2d");
  p.fillStyle = "#0b0c0d"; p.fillRect(0, 0, width, height);
  p.save(); p.filter = "saturate(1.08) contrast(1.1) brightness(.84)"; coverDraw(p, photoImg, 0, 0, width, height, 1.1); p.restore();
  p.globalCompositeOperation = "soft-light"; p.fillStyle = moment.accent; p.globalAlpha = .4; p.fillRect(0, 0, width, height);
  p.globalAlpha = 1; p.globalCompositeOperation = "source-over";
  const g = p.createLinearGradient(0, 0, 0, height);
  g.addColorStop(0, "rgba(11,12,13,.7)"); g.addColorStop(.26, "rgba(11,12,13,.04)"); g.addColorStop(.52, "rgba(11,12,13,.3)"); g.addColorStop(1, "rgba(11,12,13,.97)");
  p.fillStyle = g; p.fillRect(0, 0, width, height);
  // soft vignette inside the print
  const vg = p.createRadialGradient(width / 2, height * .42, width * .2, width / 2, height * .5, width * .95);
  vg.addColorStop(0, "rgba(0,0,0,0)"); vg.addColorStop(1, "rgba(0,0,0,.55)");
  p.fillStyle = vg; p.fillRect(0, 0, width, height);
  // halftone dot screen (print texture) — very faint
  p.globalAlpha = .05; p.fillStyle = "#000";
  const step = 7 * s;
  for (let y = 0; y < height; y += step) for (let x = (y / step) % 2 ? step / 2 : 0; x < width; x += step) { p.beginPath(); p.arc(x, y, step * .28, 0, 6.283); p.fill(); }
  p.globalAlpha = 1;

  // ---- ink layer (transparent)
  const ink = mk(), k = ink.getContext("2d");
  k.textBaseline = "top";
  k.fillStyle = moment.accent; k.fillRect(m, m, 64 * s, 8 * s);
  k.font = `500 ${26 * s}px "JetBrains Mono", monospace`; k.fillStyle = "rgba(238,240,232,.88)";
  k.fillText(`MOMENT ${moment.number} / 06`, m, m + 30 * s);
  k.textAlign = "right"; k.fillText(moment.short, width - m, m + 30 * s); k.textAlign = "left";
  const quoteFont = `"Dela Gothic One", "Zen Kaku Gothic New", sans-serif`;
  const size = fitFont(k, moment.lines, quoteFont, 400, maxW, 168 * s, 60 * s);
  const lh = size * 1.12, baseY = height - m - 150 * s - lh * (moment.lines.length - 1);
  k.textBaseline = "alphabetic";
  k.font = `400 ${size}px ${quoteFont}`;
  k.fillStyle = "#f4f5ee"; k.shadowColor = "rgba(0,0,0,.55)"; k.shadowBlur = 26 * s; k.shadowOffsetY = 6 * s;
  moment.lines.forEach((line, i) => k.fillText(line, m, baseY + lh * i));
  k.shadowBlur = 0; k.shadowOffsetY = 0;
  k.fillStyle = moment.accent; k.font = `700 ${32 * s}px "Zen Kaku Gothic New", sans-serif`;
  k.fillText(moment.speaker, m, height - m - 70 * s);
  k.fillStyle = "rgba(238,240,232,.3)"; k.fillRect(m, height - m - 40 * s, maxW, 2 * s);
  k.font = `500 ${22 * s}px "JetBrains Mono", monospace`; k.fillStyle = "rgba(238,240,232,.62)";
  k.fillText("OMORO / THE DAUSO FILE", m, height - m);
  k.textAlign = "right"; k.fillText(moment.en.toUpperCase(), width - m, height - m); k.textAlign = "left";
  // tiny registration marks + edition stamp (print-shop details)
  k.strokeStyle = "rgba(238,240,232,.4)"; k.lineWidth = 1.5 * s;
  for (const [x, y] of [[m / 2, m / 2], [width - m / 2, m / 2], [m / 2, height - m / 2], [width - m / 2, height - m / 2]]) {
    k.beginPath(); k.moveTo(x - 12 * s, y); k.lineTo(x + 12 * s, y); k.moveTo(x, y - 12 * s); k.lineTo(x, y + 12 * s); k.stroke();
    k.beginPath(); k.arc(x, y, 6 * s, 0, 6.283); k.stroke();
  }
  k.save(); k.translate(width - m - 8 * s, height * .47); k.rotate(Math.PI / 2);
  k.font = `500 ${17 * s}px "JetBrains Mono", monospace`; k.fillStyle = "rgba(238,240,232,.45)"; k.textAlign = "center";
  k.fillText(`ED. ${moment.number}/06 — ${moment.tags.map((t) => t.toUpperCase()).join(" · ")}`, 0, 0); k.restore();

  // ---- masks (three grey canvases packed into RGB)
  const one = (draw) => { const c = mk(), x = c.getContext("2d"); x.fillStyle = "#000"; x.fillRect(0, 0, width, height); x.fillStyle = "#fff"; x.strokeStyle = "#fff"; draw(x); return x.getImageData(0, 0, width, height).data; };
  const foil = one((x) => {
    x.textBaseline = "alphabetic"; x.font = `400 ${size}px ${quoteFont}`;
    moment.lines.forEach((line, i) => x.fillText(line, m, baseY + lh * i));
    x.fillRect(m, m, 64 * s, 8 * s);
    x.lineWidth = 3 * s; x.strokeRect(m / 2, m / 2, width - m, height - m);
    x.fillRect(m, height - m - 40 * s, maxW, 2 * s);
  });
  const ghost = one((x) => { x.font = `700 ${420 * s}px "Space Grotesk", sans-serif`; x.textBaseline = "alphabetic"; x.fillText(moment.number, width - 520 * s, 520 * s); });
  const glit = one((x) => {
    x.textBaseline = "alphabetic"; x.font = `700 ${32 * s}px "Zen Kaku Gothic New", sans-serif`; x.fillText(moment.speaker, m, height - m - 70 * s);
    x.fillRect(m, m, 64 * s, 8 * s);
    const gg = x.createLinearGradient(0, 0, width, height); gg.addColorStop(0, "rgba(255,255,255,.18)"); gg.addColorStop(.5, "rgba(255,255,255,0)"); gg.addColorStop(1, "rgba(255,255,255,.12)");
    x.fillStyle = gg; x.fillRect(0, 0, width, height);
  });
  const mask = mk(), mx = mask.getContext("2d"), id = mx.createImageData(width, height);
  for (let i = 0; i < id.data.length; i += 4) { id.data[i] = foil[i]; id.data[i + 1] = ghost[i]; id.data[i + 2] = glit[i]; id.data[i + 3] = 255; }
  mx.putImageData(id, 0, 0);
  return { photo, ink, mask };
}
