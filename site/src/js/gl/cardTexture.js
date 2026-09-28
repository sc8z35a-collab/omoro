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
