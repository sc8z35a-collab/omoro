import "../../css/base.css";
import "../../css/gallery.css";
import { initChrome, gsap } from "../core/chrome.js";
import { moments, momentUrl, img } from "../core/data.js";
import { webglOK, qs, qsa, h, reduced } from "../core/env.js";

initChrome();
const info = qs(".g-info"), dots = qs(".g-dots"), body = document.body;
const I = { num: qs(".g-info-num"), quote: qs(".g-info-quote"), speaker: qs(".g-info-speaker"), context: qs(".g-info-context"), actions: qs(".g-info-actions"), open: qs(".g-open"), bar: qs(".g-info-bar i") };
moments.forEach((m, i) => {
  dots.append(h("button", { type: "button", "--c": m.accent, "aria-pressed": "false", "aria-label": `${m.number} ${m.title}`, "data-i": i }, h("span", {}, m.number)));
  qs(".g-list").append(h("li", {}, h("a", { href: momentUrl(m) }, `${m.number} ${m.title}`)));
});

// BUG #46: only re-run the title animation when the *content* changes (no flicker on every hover event)
let shown = { i: -2, focused: null };
function showInfo(i, focused) {
  if (shown.i === i && shown.focused === focused) return;
  const changed = shown.i !== i;
  shown = { i, focused };
  const m = moments[i];
  if (!m) {
    info.classList.remove("is-active", "is-hover");
    info.style.removeProperty("--c");
    I.num.textContent = "— / 06"; I.quote.textContent = "額縁を選んでください"; I.speaker.textContent = ""; I.context.textContent = ""; I.actions.hidden = true;
    I.bar.style.transform = "scaleX(0)";
    return;
  }
  info.style.setProperty("--c", m.accent);
  info.classList.toggle("is-active", focused);
  info.classList.toggle("is-hover", !focused);
  I.num.textContent = `No.${m.number} / 06${focused ? "" : " — CLICK TO FOCUS"}`;
  I.speaker.textContent = m.speaker;
  I.context.textContent = focused ? m.context : "";
  I.actions.hidden = !focused;
  I.open.href = momentUrl(m);
  I.bar.style.transform = `scaleX(${(i + 1) / moments.length})`;
  if (changed) {
    I.quote.replaceChildren(...[...m.title].map((ch) => h("span", { class: "ch" }, ch)));
    if (!reduced) gsap.fromTo(qsa(".ch", I.quote), { yPercent: 110, opacity: 0, rotate: 6 }, { yPercent: 0, opacity: 1, rotate: 0, duration: .8, stagger: .022, ease: "expo.out" });
  }
  if (focused && !reduced) gsap.fromTo([I.context, I.actions], { y: 10, opacity: 0 }, { y: 0, opacity: 1, duration: .7, stagger: .06, ease: "expo.out", delay: .15 });
}
const setDots = (i) => qsa("button", dots).forEach((b, k) => b.setAttribute("aria-pressed", String(k === i)));

function fallback(reason) {
  // BUG #45: the fallback must scroll and must have the footer
  body.classList.add("is-fallback");
  qs(".g-canvas")?.remove();
  qs(".g-loading")?.remove();
  const fb = qs(".g-fallback"); fb.hidden = false;
  if (reason) fb.querySelector("p").textContent = reason;
  fb.append(h("div", { class: "g-fallback-grid" }, ...moments.map((m) => h("a", { href: momentUrl(m), "--c": m.accent },
    h("span", { class: "g-fb-frame" }, h("img", { src: img(m.image, true), alt: "", loading: "lazy", width: 800, height: 560 })),
    h("span", { class: "mono g-fb-num" }, `No.${m.number}`), h("strong", {}, m.title), h("small", {}, m.speaker)))));
  qsa(".g-hud, .g-info").forEach((e) => e.hidden = true);
}

if (!webglOK() || new URLSearchParams(location.search).has("nogl")) {
  fallback();
} else {
  const loading = qs(".g-loading");
  const { GalleryScene } = await import("../gl/galleryScene.js");
  let focused = -1;
  const scene = new GalleryScene(qs(".g-canvas"), moments, {
    onHover: (i) => { if (focused < 0) showInfo(i, false); body.classList.toggle("is-hovering", i >= 0); },
    onFocus: (i) => { focused = i; setDots(i); showInfo(i, i >= 0); body.classList.toggle("is-focused", i >= 0); },
    onLayout: (k) => qsa("[data-layout]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.layout === k)))
  });
  scene.ready.then(() => {
    body.classList.add("is-scene-ready");
    if (loading) gsap.to(loading, { opacity: 0, duration: .8, delay: .2, onComplete: () => loading.remove() });
  }).catch(() => fallback("3D の初期化に失敗しました。代わりに一覧をどうぞ。"));
  scene.onOpen = (i) => location.assign(momentUrl(moments[i]));
  qsa("[data-layout]").forEach((b) => b.addEventListener("click", () => scene.applyLayout(b.dataset.layout)));
  dots.addEventListener("click", (e) => { const b = e.target.closest("button"); if (b) scene.focus(Number(b.dataset.i)); });
  qs(".g-prev").addEventListener("click", () => scene.next(-1));
  qs(".g-next").addEventListener("click", () => scene.next(1));
  qs(".g-close").addEventListener("click", () => scene.unfocus());
  addEventListener("keydown", (e) => {
    if (["INPUT", "TEXTAREA"].includes(document.activeElement?.tagName) || e.metaKey || e.ctrlKey) return;
    if (document.querySelector(".palette:not([hidden])") || body.classList.contains("menu-open")) return;
    if (e.key === "ArrowRight") scene.next(1);
    if (e.key === "ArrowLeft") scene.next(-1);
    if (e.key === "Escape") scene.unfocus();
    if (e.key === "Enter" && focused >= 0 && document.activeElement === document.body) location.assign(momentUrl(moments[focused]));
    if (e.key === "1") scene.applyLayout("ring");
    if (e.key === "2") scene.applyLayout("helix");
    if (e.key === "3") scene.applyLayout("wall");
  });
}
