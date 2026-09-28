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

/* hero: WebGL ripple over photo */
if (webglOK() && !reduced && !new URLSearchParams(location.search).has("nogl")) {
  import("../gl/rippleImage.js").then(({ RippleImage }) => new RippleImage(qs(".d-canvas"), img(moment.image), moment.accent));
}
const intro = () => {
  if (reduced) return;
  const chars = splitChars(qs("[data-hero-quote]"));
  gsap.from(chars, { yPercent: 120, rotate: 10, opacity: 0, duration: 1.3, stagger: .05, ease: "expo.out", delay: .15 });
  gsap.from([".d-hero-main .eyebrow", ".d-en", ".d-lead", ".d-actions", ".d-aside"], { opacity: 0, y: 30, duration: 1.2, stagger: .08, ease: "expo.out", delay: .5 });
  gsap.from(".d-ghost", { opacity: 0, xPercent: 20, duration: 2, ease: "expo.out" });
  gsap.to(".d-hero-img", { yPercent: 12, scale: 1.14, ease: "none", scrollTrigger: { trigger: ".d-hero", start: "top top", end: "bottom top", scrub: true } });
  gsap.to(".d-ghost", { yPercent: 40, ease: "none", scrollTrigger: { trigger: ".d-hero", start: "top top", end: "bottom top", scrub: true } });
};
document.documentElement.classList.contains("is-loaded") ? intro() : document.addEventListener("omoro:ready", intro, { once: true });

/* beats: activate on scroll */
const beats = qsa(".beat"), dots = qsa(".d-beat-dots i");
beats.forEach((b, i) => ScrollTrigger.create({ trigger: b, start: "top 60%", end: "bottom 40%", onToggle: (st) => { if (st.isActive) { beats.forEach((x, k) => x.classList.toggle("is-active", k === i)); dots.forEach((d, k) => d.classList.toggle("is-on", k <= i)); } } }));
beats[0]?.classList.add("is-active");

/* save & share */
const saveBtn = qs(".d-save");
const refreshSave = () => { const s = store.isSaved(moment.slug); saveBtn.setAttribute("aria-pressed", String(s)); saveBtn.textContent = s ? "★ 保存済み" : "☆ あとで見る"; };
saveBtn.addEventListener("click", () => { const r = store.toggleSaved(moment.slug); if (r === null) return toast("このブラウザでは保存できませんでした"); refreshSave(); toast(r ? "あとで見るに保存しました" : "保存を解除しました"); });
refreshSave();
qs(".d-share").addEventListener("click", async () => {
  const data = { title: `${moment.title} | OMORO`, text: `「${moment.title}」— ${moment.lead}`, url: location.href.split("#")[0] };
  try {
    if (navigator.share && coarse) await navigator.share(data);
    else { await navigator.clipboard.writeText(data.url); toast("リンクをコピーしました"); }
  } catch (e) { if (e?.name !== "AbortError") toast("共有できませんでした"); }
});

/* reactions */
const refreshReacts = () => { const r = store.reactions(moment.slug); qsa("[data-react]").forEach((b) => { qs("b", b).textContent = r[b.dataset.react] || 0; }); };
qsa("[data-react]").forEach((b) => b.addEventListener("click", (e) => {
  store.react(moment.slug, b.dataset.react); refreshReacts();
  const glyph = qs("span", b).textContent;
  if (reduced) return;
  for (let i = 0; i < 12; i++) {
    const el = h("span", { class: "react-burst", style: { left: e.clientX + "px", top: e.clientY + "px", color: moment.accent } }, glyph);
    document.body.append(el);
    const a = Math.random() * Math.PI * 2, d = 70 + Math.random() * 110;
    gsap.to(el, { x: Math.cos(a) * d, y: Math.sin(a) * d - 50, rotate: (Math.random() - .5) * 120, opacity: 0, scale: .5 + Math.random() * 1.2, duration: 1.2 + Math.random() * .5, ease: "expo.out", onComplete: () => el.remove() });
  }
}));
refreshReacts();

qsa("[data-tilt]").forEach((el) => tilt(el, { max: 7 }));
if (!reduced) gsap.from(qsa(".seq"), { y: 60, opacity: 0, duration: 1, stagger: .06, ease: "expo.out", scrollTrigger: { trigger: ".seq-grid", start: "top 85%" } });
initReveals();
magnetic();
