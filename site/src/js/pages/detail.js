import "../../css/base.css";
import "../../css/detail.css";
import { initChrome, initReveals, gsap, ScrollTrigger, toast, splitChars, magnetic } from "../core/chrome.js";
import { bySlug, img } from "../core/data.js";
import { store } from "../core/store.js";
import { reduced, webglOK, coarse, qs, qsa, h } from "../core/env.js";
import { tilt } from "../ui/tilt.js";

initChrome();
const moment = bySlug(document.body.dataset.slug);
store.markSeen(moment.slug);
const glAllowed = webglOK() && !reduced && !new URLSearchParams(location.search).has("nogl");

/* ---------------- hero: Navier–Stokes ink over the photo ---------------- */
let hero = null;
const heroEl = qs(".d-hero");
function startHero() {
  if (!glAllowed || hero) return;
  import("../gl/detail/fluidHero.js").then(({ FluidHero }) => {
    if (hero) return;
    try {
      hero = new FluidHero(qs(".d-canvas"), { src: img(moment.image), accent: moment.accent, volume: moment.volume, gap: moment.gap });
      heroEl.classList.add("has-fluid");
    } catch (e) {
      console.warn("[detail] fluid hero unavailable, falling back to photo", e);
      hero = null;
    }
  });
}
startHero();
// BUG #49: tear the renderer down on pagehide and re-create it if the page is restored from bfcache.
addEventListener("pagehide", () => { hero?.dispose(); hero = null; heroEl.classList.remove("has-fluid"); qs(".d-canvas")?.classList.remove("is-on"); });
addEventListener("pageshow", (e) => { if (e.persisted) startHero(); });

const intro = () => {
  if (reduced) return;
  const chars = splitChars(qs("[data-hero-quote]"));
  const tl = gsap.timeline({ delay: .1 });
  tl.from(chars, { yPercent: 120, rotateX: -70, rotate: 8, opacity: 0, filter: "blur(12px)", transformOrigin: "50% 100%", duration: 1.5, stagger: .055, ease: "expo.out", clearProps: "filter" })
    .from([".d-hero-main .eyebrow", ".d-en", ".d-lead", ".d-actions > *"], { opacity: 0, y: 30, duration: 1.2, stagger: .06, ease: "expo.out" }, .45)
    .from(".d-aside", { opacity: 0, y: 40, rotateX: 18, transformOrigin: "50% 100%", duration: 1.4, ease: "expo.out" }, .6)
    .from(".d-crumb > *", { opacity: 0, x: -10, duration: .8, stagger: .05, ease: "expo.out" }, .3)
    .from(".d-ghost", { opacity: 0, xPercent: 18, duration: 2.2, ease: "expo.out" }, 0)
    .from(".d-hero-hint", { opacity: 0, duration: 1.2 }, 1.2);
  gsap.to(".d-hero-img", { yPercent: 12, scale: 1.14, ease: "none", scrollTrigger: { trigger: ".d-hero", start: "top top", end: "bottom top", scrub: true } });
  gsap.to(".d-ghost", { yPercent: 40, ease: "none", scrollTrigger: { trigger: ".d-hero", start: "top top", end: "bottom top", scrub: true } });
  gsap.to(".d-hero-main", { yPercent: -10, opacity: .2, ease: "none", scrollTrigger: { trigger: ".d-hero", start: "30% top", end: "bottom top", scrub: true } });
  ScrollTrigger.create({ trigger: ".d-hero", start: "top top", end: "bottom top", onUpdate: (st) => hero?.setScroll(st.progress) });
};
document.documentElement.classList.contains("is-loaded") ? intro() : document.addEventListener("omoro:ready", intro, { once: true });

/* ---------------- ghost number follows the pointer a little (depth) ---------------- */
if (!coarse && !reduced) {
  const ghost = qs(".d-ghost");
  const gx = gsap.quickTo(ghost, "x", { duration: 1.6, ease: "expo.out" }), gy = gsap.quickTo(ghost, "y", { duration: 1.6, ease: "expo.out" });
  heroEl.addEventListener("pointermove", (e) => { gx((e.clientX / innerWidth - .5) * -40); gy((e.clientY / innerHeight - .5) * -24); });
}

/* ---------------- beats: activate on scroll + voice print ---------------- */
const beats = qsa(".beat"), dots = qsa(".d-beat-dots i"), wave = qs(".d-wave");
const bars = qsa(".d-wave-bars i");
const setBeat = (i) => {
  beats.forEach((x, k) => { x.classList.toggle("is-active", k === i); x.classList.toggle("is-past", k < i); });
  dots.forEach((d, k) => d.classList.toggle("is-on", k <= i));
  if (wave) wave.dataset.beat = String(i);
};
beats.forEach((b, i) => ScrollTrigger.create({ trigger: b, start: "top 60%", end: "bottom 40%", onToggle: (st) => { if (st.isActive) setBeat(i); } }));
setBeat(0);
if (!reduced && wave) {
  // the playhead sweeps the waveform as the reader scrolls through the beats
  ScrollTrigger.create({
    trigger: ".d-beats-list", start: "top 70%", end: "bottom 60%", scrub: true,
    onUpdate: (st) => {
      wave.style.setProperty("--play", (st.progress * 100).toFixed(2) + "%");
      const lit = Math.round(st.progress * bars.length);
      bars.forEach((b, k) => b.classList.toggle("is-lit", k < lit));
    }
  });
  gsap.from(bars, { scaleY: 0, duration: 1, stagger: { each: .008, from: "start" }, ease: "expo.out", scrollTrigger: { trigger: wave, start: "top 85%" } });
  qsa(".beat").forEach((b) => {
    const t = qs(".beat-title", b);
    const chars = splitChars(t);
    gsap.from(chars, { yPercent: 100, opacity: 0, duration: 1, stagger: .03, ease: "expo.out", scrollTrigger: { trigger: b, start: "top 70%" } });
  });
}

/* ---------------- save & share ---------------- */
const saveBtn = qs(".d-save");
const refreshSave = () => { const s = store.isSaved(moment.slug); saveBtn.setAttribute("aria-pressed", String(s)); saveBtn.textContent = s ? "★ 保存済み" : "☆ あとで見る"; };
saveBtn.addEventListener("click", (e) => {
  const r = store.toggleSaved(moment.slug);
  if (r === null) return toast("このブラウザでは保存できませんでした");
  refreshSave(); toast(r ? "あとで見るに保存しました" : "保存を解除しました");
  if (r && !reduced) fx(e, { count: 70, kinds: { spark: .8, dust: .2 }, power: .6 });
});
refreshSave();
qs(".d-share").addEventListener("click", async () => {
  const data = { title: `${moment.title} | OMORO`, text: `「${moment.title}」— ${moment.lead}`, url: location.href.split("#")[0] };
  try {
    if (navigator.share && coarse) await navigator.share(data);
    else { await navigator.clipboard.writeText(data.url); toast("リンクをコピーしました"); }
  } catch (e) { if (e?.name !== "AbortError") toast("共有できませんでした"); }
});

/* ---------------- reactions: WebGL burst (DOM fallback) ---------------- */
let burstMod = null;
const loadBurst = () => (burstMod ||= glAllowed ? import("../gl/detail/burstLayer.js").catch(() => null) : Promise.resolve(null));
async function fx(e, opts) {
  const b = e.currentTarget?.getBoundingClientRect?.() || { left: e.clientX, top: e.clientY, width: 0, height: 0 };
  const x = e.clientX || b.left + b.width / 2, y = e.clientY || b.top + b.height / 2; // keyboard: centre of the button
  const mod = await loadBurst();
  const palette = [moment.accent, "#eef0e8", moment.accent, "#ffd979"];
  return !!mod?.burst(x, y, { colors: palette, ...opts });
}
const refreshReacts = () => { const r = store.reactions(moment.slug); qsa("[data-react]").forEach((b) => { qs("b", b).textContent = r[b.dataset.react] || 0; }); };
qsa("[data-react]").forEach((b) => b.addEventListener("click", async (e) => {
  store.react(moment.slug, b.dataset.react); refreshReacts();
  if (reduced) return;
  const glyph = qs("span", b).textContent;
  gsap.fromTo(qs("b", b), { scale: 1.8, color: "#fff" }, { scale: 1, color: moment.accent, duration: .8, ease: "elastic.out(1,.35)", clearProps: "color" });
  gsap.fromTo(qs("span", b), { scale: .6, rotate: -14 }, { scale: 1, rotate: 0, duration: .9, ease: "elastic.out(1,.3)" });
  b.classList.remove("is-pop"); void b.offsetWidth; b.classList.add("is-pop");
  const kinds = b.dataset.react === "ma" ? { dust: .7, spark: .3 } : b.dataset.react === "wow" ? { spark: .7, confetti: .3 } : { confetti: .65, spark: .35 };
  const ok = await fx(e, { count: b.dataset.react === "ma" ? 90 : 190, kinds, power: b.dataset.react === "ma" ? .45 : 1 });
  // a few big glyphs always fly in DOM (they read as the emoji itself)
  for (let i = 0; i < (ok ? 5 : 12); i++) {
    const el = h("span", { class: "react-burst", style: { left: (e.clientX || innerWidth / 2) + "px", top: (e.clientY || innerHeight / 2) + "px", color: moment.accent } }, glyph);
    document.body.append(el);
    const a = Math.random() * Math.PI * 2, d = 70 + Math.random() * 130;
    gsap.to(el, { x: Math.cos(a) * d, y: Math.sin(a) * d - 60, rotate: (Math.random() - .5) * 140, opacity: 0, scale: .6 + Math.random() * 1.4, duration: 1.3 + Math.random() * .6, ease: "expo.out", onComplete: () => el.remove() });
  }
}));
refreshReacts();

/* ---------------- insight cards: tilt on the inner wrapper (BUG #48) + foil follows pointer ---------------- */
qsa(".insight-in[data-tilt]").forEach((el) => tilt(el, { max: 8 }));

/* ---------------- sequence + neighbours ---------------- */
if (!reduced) {
  gsap.from(qsa(".seq"), { y: 80, rotateX: -30, opacity: 0, transformOrigin: "50% 100%", duration: 1.2, stagger: .07, ease: "expo.out", scrollTrigger: { trigger: ".seq-grid", start: "top 85%" } });
  qsa(".seq").forEach((s) => tilt(s, { max: 10 }));
  // neighbour cards: image drifts toward the pointer
  qsa(".d-neighbors a").forEach((a) => {
    const im = qs("img", a);
    const qx = gsap.quickTo(im, "xPercent", { duration: 1.2, ease: "expo.out" }), qy = gsap.quickTo(im, "yPercent", { duration: 1.2, ease: "expo.out" });
    a.addEventListener("pointermove", (e) => { const r = a.getBoundingClientRect(); qx(((e.clientX - r.left) / r.width - .5) * -6); qy(((e.clientY - r.top) / r.height - .5) * -6); });
    a.addEventListener("pointerleave", () => { qx(0); qy(0); });
  });
}
initReveals();
magnetic();
