import "../../css/base.css";
import "../../css/gallery.css";
import { initChrome, gsap } from "../core/chrome.js";
import { moments, momentUrl, img } from "../core/data.js";
import { webglOK, reduced, qs, qsa, h } from "../core/env.js";

initChrome();
const info = qs(".g-info"), dots = qs(".g-dots");
const I = { num: qs(".g-info-num"), quote: qs(".g-info-quote"), speaker: qs(".g-info-speaker"), context: qs(".g-info-context"), actions: qs(".g-info-actions"), open: qs(".g-open"), bar: qs(".g-info-bar i") };
moments.forEach((m, i) => {
  dots.append(h("button", { type: "button", "--c": m.accent, "aria-pressed": "false", "aria-label": `${m.number} ${m.title}`, "data-i": i }, h("span", {}, m.number)));
  qs(".g-list").append(h("li", {}, h("a", { href: momentUrl(m) }, `${m.number} ${m.title}`)));
});

// BUG #46: only re-animate the title when the shown card actually changes
let shown = { i: -2, focused: null };
function showInfo(i, focused) {
  if (shown.i === i && shown.focused === focused) return;
  const changed = shown.i !== i;
  shown = { i, focused };
  const m = moments[i];
  document.body.classList.toggle("is-focused", !!(m && focused));
  if (!m) {
    info.classList.remove("is-active", "is-hover");
    info.style.removeProperty("--c");
    I.num.textContent = "— / 06"; I.quote.textContent = "額縁を選んでください"; I.speaker.textContent = ""; I.context.textContent = ""; I.actions.hidden = true;
    I.bar && gsap.to(I.bar, { scaleX: 0, duration: .6, ease: "expo.out" });
    if (changed) gsap.fromTo(I.quote, { y: 10, opacity: 0 }, { y: 0, opacity: 1, duration: .5, ease: "expo.out" });
    return;
  }
  info.style.setProperty("--c", m.accent);
  info.classList.toggle("is-active", focused);
  info.classList.toggle("is-hover", !focused);
  I.num.textContent = `MOMENT ${m.number} / 06${focused ? "" : " — CLICK TO FOCUS"}`;
  I.quote.textContent = m.title;
  I.speaker.textContent = m.speaker;
  I.context.textContent = focused ? m.context : "";
  I.actions.hidden = !focused;
  I.open.href = momentUrl(m);
  I.bar && gsap.to(I.bar, { scaleX: (i + 1) / moments.length, duration: .8, ease: "expo.out" });
  if (changed) {
    gsap.fromTo(I.quote, { y: 16, opacity: 0, filter: "blur(6px)" }, { y: 0, opacity: 1, filter: "blur(0px)", duration: .7, ease: "expo.out" });
    gsap.fromTo([I.speaker, I.num], { opacity: 0 }, { opacity: 1, duration: .5, stagger: .05 });
  }
  if (focused && I.context.textContent) gsap.fromTo(I.context, { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: .6, delay: .1, ease: "expo.out" });
}
const setDots = (i) => qsa("button", dots).forEach((b, k) => b.setAttribute("aria-pressed", String(k === i)));

function fallback() {
  // BUG #45: the fallback list must scroll and show the footer
  document.body.classList.add("is-fallback");
  qs(".g-canvas")?.remove();
  const fb = qs(".g-fallback"); fb.hidden = false;
  fb.append(h("div", { class: "g-fallback-grid" }, ...moments.map((m) => h("a", { href: momentUrl(m), "--c": m.accent },
    h("span", { class: "g-fb-frame" }, h("img", { src: img(m.image, true), alt: "", loading: "lazy", width: 800, height: 560 })),
    h("span", { class: "mono g-fb-num" }, `MOMENT ${m.number} / 06`),
    h("strong", {}, m.title),
    h("small", {}, m.speaker)))));
  qsa(".g-hud, .g-info, .g-loading").forEach((e) => e.hidden = true);
}

if (!webglOK() || new URLSearchParams(location.search).has("nogl")) {
  fallback();
} else {
  const loading = qs(".g-loading");
  let scene;
  try {
    const { GalleryScene } = await import("../gl/galleryScene.js");
    let focused = -1;
    scene = new GalleryScene(qs(".g-canvas"), moments, {
      reduced,
      onHover: (i) => { if (focused < 0) showInfo(i, false); },
      onFocus: (i) => { focused = i; setDots(i); showInfo(i, i >= 0); },
      onLayout: (k) => qsa("[data-layout]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.layout === k)))
    });
    scene.onOpen = (i) => location.assign(momentUrl(moments[i]));
    window.__gallery = scene; // debug / screenshot harness hook
    qsa("[data-layout]").forEach((b) => b.addEventListener("click", () => scene.applyLayout(b.dataset.layout)));
    dots.addEventListener("click", (e) => { const b = e.target.closest("button"); if (b) scene.focus(Number(b.dataset.i)); });
    qs(".g-prev").addEventListener("click", () => scene.next(-1));
    qs(".g-next").addEventListener("click", () => scene.next(1));
    qs(".g-close").addEventListener("click", () => scene.unfocus());
    addEventListener("keydown", (e) => {
      if (["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement?.tagName) || document.documentElement.classList.contains("palette-open")) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "ArrowRight") scene.next(1);
      if (e.key === "ArrowLeft") scene.next(-1);
      if (e.key === "Escape") scene.unfocus();
      if (e.key === "Enter" && focused >= 0 && !document.activeElement?.closest("a, button")) location.assign(momentUrl(moments[focused]));
      if (e.key === "1") scene.applyLayout("ring");
      if (e.key === "2") scene.applyLayout("helix");
      if (e.key === "3") scene.applyLayout("wall");
    });
    await scene.ready;
    document.body.classList.add("is-scene-ready");
    loading && gsap.to(loading, { opacity: 0, duration: .8, delay: .3, onComplete: () => loading.remove() });
  } catch (err) {
    console.error("[gallery] WebGL scene failed, falling back", err);
    scene?.dispose?.();
    fallback();
  }
}
