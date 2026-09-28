import "../../css/base.css";
import "../../css/gallery.css";
import { initChrome, gsap } from "../core/chrome.js";
import { moments, momentUrl, img } from "../core/data.js";
import { webglOK, qs, qsa, h } from "../core/env.js";

initChrome();
const info = qs(".g-info"), dots = qs(".g-dots");
const I = { num: qs(".g-info-num"), quote: qs(".g-info-quote"), speaker: qs(".g-info-speaker"), context: qs(".g-info-context"), actions: qs(".g-info-actions"), open: qs(".g-open") };
moments.forEach((m, i) => {
  dots.append(h("button", { type: "button", "--c": m.accent, "aria-pressed": "false", "aria-label": `${m.number} ${m.title}`, "data-i": i }, m.number));
  qs(".g-list").append(h("li", {}, h("a", { href: momentUrl(m) }, `${m.number} ${m.title}`)));
});

function showInfo(i, focused) {
  const m = moments[i];
  if (!m) {
    info.classList.remove("is-active");
    I.num.textContent = "— / 06"; I.quote.textContent = "カードを選んでください"; I.speaker.textContent = ""; I.context.textContent = ""; I.actions.hidden = true;
    return;
  }
  info.style.setProperty("--c", m.accent);
  info.classList.toggle("is-active", focused);
  I.num.textContent = `MOMENT ${m.number} / 06${focused ? "" : " — CLICK TO FOCUS"}`;
  I.quote.textContent = m.title;
  I.speaker.textContent = m.speaker;
  I.context.textContent = focused ? m.context : "";
  I.actions.hidden = !focused;
  I.open.href = momentUrl(m);
  gsap.fromTo(I.quote, { y: 14, opacity: 0 }, { y: 0, opacity: 1, duration: .6, ease: "expo.out" });
}
const setDots = (i) => qsa("button", dots).forEach((b, k) => b.setAttribute("aria-pressed", String(k === i)));

if (!webglOK() || new URLSearchParams(location.search).has("nogl")) {
  qs(".g-canvas").remove();
  const fb = qs(".g-fallback"); fb.hidden = false;
  fb.append(h("div", { class: "g-fallback-grid" }, ...moments.map((m) => h("a", { href: momentUrl(m) }, h("img", { src: img(m.image, true), alt: "" }), h("strong", {}, m.title)))));
  qsa(".g-hud, .g-info").forEach((e) => e.hidden = true);
} else {
  const { GalleryScene } = await import("../gl/galleryScene.js");
  let focused = -1;
  const scene = new GalleryScene(qs(".g-canvas"), moments, {
    onHover: (i) => { if (focused < 0) showInfo(i, false); },
    onFocus: (i) => { focused = i; setDots(i); showInfo(i, i >= 0); },
    onLayout: (k) => qsa("[data-layout]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.layout === k)))
  });
  scene.onOpen = (i) => location.assign(momentUrl(moments[i]));
  qsa("[data-layout]").forEach((b) => b.addEventListener("click", () => scene.applyLayout(b.dataset.layout)));
  dots.addEventListener("click", (e) => { const b = e.target.closest("button"); if (b) scene.focus(Number(b.dataset.i)); });
  qs(".g-prev").addEventListener("click", () => scene.next(-1));
  qs(".g-next").addEventListener("click", () => scene.next(1));
  qs(".g-close").addEventListener("click", () => scene.unfocus());
  addEventListener("keydown", (e) => {
    if (["INPUT", "TEXTAREA"].includes(document.activeElement?.tagName)) return;
    if (e.key === "ArrowRight") scene.next(1);
    if (e.key === "ArrowLeft") scene.next(-1);
    if (e.key === "Escape") scene.unfocus();
    if (e.key === "Enter" && focused >= 0) location.assign(momentUrl(moments[focused]));
    if (e.key === "1") scene.applyLayout("ring");
    if (e.key === "2") scene.applyLayout("helix");
    if (e.key === "3") scene.applyLayout("wall");
  });
}
