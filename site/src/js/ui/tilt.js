// Pointer-driven 3D tilt with holographic foil variables (--rx --ry --mx --my).
import { coarse, reduced } from "../core/env.js";

export function tilt(el, { max = 12, perspective = true } = {}) {
  if (coarse || reduced || el.dataset.tiltBound) return;
  el.dataset.tiltBound = "1";
  let raf = 0;
  const move = (e) => {
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => {
      el.style.setProperty("--ry", `${(px - .5) * max * 2}deg`);
      el.style.setProperty("--rx", `${(.5 - py) * max * 2}deg`);
      el.style.setProperty("--mx", `${px * 100}%`);
      el.style.setProperty("--my", `${py * 100}%`);
      el.style.transition = "transform .12s linear";
    });
  };
  const leave = () => {
    cancelAnimationFrame(raf);
    el.style.transition = "";
    el.style.setProperty("--rx", "0deg");
    el.style.setProperty("--ry", "0deg");
    el.style.setProperty("--mx", "50%");
    el.style.setProperty("--my", "50%");
  };
  el.addEventListener("pointermove", move);
  el.addEventListener("pointerleave", leave);
  if (perspective && el.parentElement) el.parentElement.style.perspective ||= "1400px";
}
export function tiltAll(selector, opts) { document.querySelectorAll(selector).forEach((el) => tilt(el, opts)); }
