import "../../css/base.css";
import "../../css/home.css";
import { initChrome, initReveals, gsap, ScrollTrigger, toast, magnetic, splitChars, lenis } from "../core/chrome.js";
import { moments, momentUrl, img, search, normalize } from "../core/data.js";
import { store } from "../core/store.js";
import { reduced, webglOK, qs, qsa, h, isMobile } from "../core/env.js";
import { tilt } from "../ui/tilt.js";

initChrome();

/* ================= HERO ================= */
let hero = null;
const heroCanvas = qs(".hero-canvas");
const heroNow = qs(".hero-now");
const chips = qs(".hero-switch");
const noGL = !webglOK() || new URLSearchParams(location.search).has("nogl");
moments.forEach((m, i) => chips.append(h("button", { type: "button", class: "hero-chip", "data-morph": i, "aria-pressed": "false", "--chip": m.accent, "aria-label": `${m.number} ${m.title}` }, h("span", { class: "chip-num" }, m.number), h("span", { class: "chip-name" }, m.title))));

function setChip(key) {
  qsa(".hero-chip", chips).forEach((c) => { const on = c.dataset.morph === String(key); c.classList.toggle("is-active", on); c.setAttribute("aria-pressed", String(on)); });
  heroNow.textContent = "NOW: " + (key === "intro" ? "面白いねえ。" : moments[key].title);
  const accent = key === "intro" ? "#d8ff4f" : moments[key].accent;
  qs(".hero").style.setProperty("--hero-accent", accent);
}
let autoTimer = null, autoIndex = -1, resumeTimer = null;
function stopAuto() { clearInterval(autoTimer); autoTimer = null; }
function startAuto() {
  stopAuto();
  if (reduced) return;
  autoTimer = setInterval(() => { autoIndex = (autoIndex + 1) % moments.length; hero?.show(autoIndex); setChip(autoIndex); }, 6400);
}
chips.addEventListener("click", (e) => {
  const b = e.target.closest(".hero-chip");
  if (!b || !hero) return;
  stopAuto(); clearTimeout(resumeTimer);
  const key = b.dataset.morph;
  if (key === "intro") hero.showIntro(); else { autoIndex = Number(key); hero.show(autoIndex); }
  setChip(key);
  resumeTimer = setTimeout(startAuto, 12000);
});

async function bootHero() {
  if (noGL) { heroCanvas.remove(); chips.hidden = true; qs(".hero").classList.add("is-nogl"); return; }
  try {
    const { HeroScene } = await import("../gl/heroScene.js");
    hero = new HeroScene(heroCanvas, moments);
    await hero.ready;
    qs(".hero").classList.add("is-gl");
  } catch (err) {
    console.error("[hero] WebGL init failed, falling back", err);
    hero = null; heroCanvas.remove(); chips.hidden = true; qs(".hero").classList.add("is-nogl");
    return;
  }
  setTimeout(startAuto, 7000);
  ScrollTrigger.create({ trigger: ".hero", start: "top top", end: "bottom top", scrub: true, onUpdate: (st) => hero.setScroll(st.progress) });
}
bootHero();

function heroIntro() {
  if (reduced) return;
  const rows = qsa("[data-hero-row]");
  gsap.from(rows, { yPercent: 115, rotate: 4, duration: 1.5, stagger: .12, ease: "expo.out", delay: .1 });
  gsap.from(qsa("[data-hero-fade]"), { opacity: 0, y: 30, duration: 1.2, stagger: .1, ease: "expo.out", delay: .5 });
  gsap.from(".hero-rail", { opacity: 0, x: -30, duration: 1, delay: .3, ease: "expo.out" });
  gsap.to(".hero-title", { yPercent: -30, opacity: .2, ease: "none", scrollTrigger: { trigger: ".hero", start: "top top", end: "bottom top", scrub: true } });
}
document.documentElement.classList.contains("is-loaded") ? heroIntro() : document.addEventListener("omoro:ready", heroIntro, { once: true });

/* ================= HORIZONTAL HOLO CARDS ================= */
const track = qs(".hscroll-track");
moments.forEach((m, i) => {
  const card = h("a", { class: "holo", href: momentUrl(m), role: "listitem", "--card-accent": m.accent, "data-cursor": "OPEN", "aria-label": `${m.number} ${m.title} — 特設ページへ` },
    h("div", { class: "holo-shadow", "aria-hidden": "true" }),
    h("div", { class: "holo-inner" },
      h("img", { class: "holo-img", src: img(m.image, true), alt: "", loading: "lazy", decoding: "async" }),
      h("div", { class: "holo-tint" }),
      h("div", { class: "holo-foil" })),
    h("div", { class: "holo-num", "aria-hidden": "true" }, m.number),
    h("div", { class: "holo-glyph", "aria-hidden": "true" }, m.glyph),
    h("div", { class: "holo-content" },
      h("div", { class: "holo-top" }, h("span", {}, `MOMENT ${m.number}`), h("span", {}, m.short)),
      h("p", { class: "holo-quote" + (m.lines.join("").length > 10 ? " is-long" : "") }, ...m.lines.flatMap((l, k) => (k ? [h("br"), l] : [l]))),
      h("span", { class: "holo-speaker" }, m.speaker),
      h("div", { class: "holo-cta" }, h("span", {}, "特設ページ"), h("span", {}, "↗"))));
  track.append(card);
  tilt(card, { max: 10 });
});
track.append(h("div", { class: "hscroll-end" }, h("strong", {}, "もっと深く、", h("br"), "見てみる？"), h("a", { class: "btn btn-primary", href: "./gallery/" }, "3Dで見る ", h("span", { class: "btn-arrow" }, "↗"))));

const mm = gsap.matchMedia();
mm.add("(min-width: 861px)", () => {
  const pin = qs(".hscroll-pin");
  const distance = () => track.scrollWidth - (innerWidth - track.getBoundingClientRect().left) + 40;
  const bar = qs(".hscroll-progress b"), cur = qs(".hscroll-current");
  const tween = gsap.to(track, {
    x: () => -distance(), ease: "none",
    scrollTrigger: { trigger: ".hscroll", start: "top top", end: () => "+=" + distance(), pin, scrub: 1, invalidateOnRefresh: true, anticipatePin: 1,
      onUpdate: (st) => { bar.style.transform = `scaleX(${st.progress})`; cur.textContent = String(Math.min(6, Math.floor(st.progress * 6) + 1)).padStart(2, "0"); } }
  });
  // cards fly-in with depth
  qsa(".holo", track).forEach((card) => {
    gsap.fromTo(card, { rotateY: -28, z: -200, opacity: .3 }, { rotateY: 0, z: 0, opacity: 1, ease: "power2.out", scrollTrigger: { trigger: card, containerAnimation: tween, start: "left 100%", end: "left 55%", scrub: true } });
  });
  return () => {};
});

/* ================= STAGE PLAYER ================= */
const list = qs(".player-list");
const stage = qs("#stage");
const S = {
  num: qs(".stage-num", stage), tags: qs(".stage-tags", stage), person: qs(".stage-person", stage), quote: qs(".stage-quote", stage),
  context: qs(".stage-context", stage), beats: qs(".stage-beats", stage), point: qs(".stage-point", stage), detail: qs(".stage-detail", stage),
  save: qs(".stage-save", stage), copy: qs(".stage-copy", stage), imgA: qsa(".stage-img", stage)[0], imgB: qsa(".stage-img", stage)[1], bar: qs(".stage-bar i", stage)
};
let current = 0, front = S.imgA, back = S.imgB, stageAuto = null;
moments.forEach((m, i) => list.append(h("button", { type: "button", class: "player-item", "--c": m.accent, "data-i": i },
  h("span", { class: "pi-num" }, m.number), h("span", { class: "pi-name" }, m.title, h("small", {}, m.short)), h("span", { class: "pi-arrow", "aria-hidden": "true" }, "↗"))));
const items = qsa(".player-item", list);
front.src = img(moments[0].image);

function updateSave() {
  const saved = store.isSaved(moments[current].slug);
  S.save.setAttribute("aria-pressed", String(saved));
  S.save.textContent = saved ? "★ 保存済み" : "☆ 保存";
}
function updateReacts() {
  const r = store.reactions(moments[current].slug);
  qsa("[data-react]", stage).forEach((b) => { qs("b", b).textContent = r[b.dataset.react] || 0; });
}
function showMoment(i, { animate = true } = {}) {
  current = (i + moments.length) % moments.length;
  const m = moments[current];
  stage.style.setProperty("--scene-accent", m.accent);
  S.num.textContent = m.number;
  S.tags.replaceChildren(...m.tags.map((t) => h("span", {}, "#" + t)));
  S.person.textContent = m.speaker;
  S.quote.replaceChildren(...m.lines.flatMap((l, k) => (k ? [h("br"), l] : [l])));
  S.quote.classList.toggle("is-compact", m.lines.join("").length > 10);
  S.context.textContent = m.context;
  S.beats.replaceChildren(...m.beats.map((b, k) => h("li", { class: k === 1 ? "is-key" : "" }, h("b", {}, `0${k + 1} ${b.label}`), b.title)));
  S.point.textContent = "POINT / " + m.point;
  S.detail.href = momentUrl(m);
  items.forEach((b, k) => { b.classList.toggle("is-active", k === current); b.setAttribute("aria-current", k === current ? "true" : "false"); });
  updateSave(); updateReacts();
  // image crossfade with zoom
  back.src = img(m.image);
  if (animate && !reduced) {
    gsap.fromTo(back, { opacity: 0, scale: 1.2 }, { opacity: 1, scale: 1.08, duration: 1.4, ease: "expo.out" });
    gsap.to(front, { opacity: 0, duration: 1 });
    const chars = splitCharsFresh(S.quote);
    gsap.from(chars, { yPercent: 110, opacity: 0, rotate: 8, duration: .9, stagger: .03, ease: "expo.out" });
    gsap.from([S.person, S.context, ...S.beats.children], { opacity: 0, y: 20, duration: .8, stagger: .05, ease: "expo.out", delay: .1 });
  } else { back.style.opacity = 1; front.style.opacity = 0; }
  [front, back] = [back, front];
}
function splitCharsFresh(el) { delete el.dataset.split; el.removeAttribute("aria-label"); return splitChars(el); }
items.forEach((b, k) => b.addEventListener("click", () => { stopStageAuto(); showMoment(k); }));
qs(".stage-prev", stage).addEventListener("click", () => { stopStageAuto(); showMoment(current - 1); });
qs(".stage-next", stage).addEventListener("click", () => { stopStageAuto(); showMoment(current + 1); });
S.save.addEventListener("click", () => {
  const r = store.toggleSaved(moments[current].slug);
  if (r === null) return toast("このブラウザでは保存できませんでした。");
  updateSave(); renderSaved(); renderArchiveSaves();
  toast(r ? "あとで見るに保存しました" : "保存を解除しました");
});
S.copy.addEventListener("click", async () => {
  try { await navigator.clipboard.writeText(new URL(S.detail.getAttribute("href"), location.href).href); toast("リンクをコピーしました"); }
  catch { toast("コピーできませんでした"); }
});
qsa("[data-react]", stage).forEach((b) => b.addEventListener("click", (e) => {
  const r = store.react(moments[current].slug, b.dataset.react);
  qs("b", b).textContent = r[b.dataset.react];
  burst(e.clientX, e.clientY, b.textContent.trim().split(" ")[0]);
}));
function burst(x, y, glyph) {
  if (reduced) return;
  for (let i = 0; i < 10; i++) {
    const el = h("span", { class: "react-burst", style: { left: x + "px", top: y + "px" } }, glyph);
    document.body.append(el);
    const a = Math.random() * Math.PI * 2, d = 60 + Math.random() * 90;
    gsap.to(el, { x: Math.cos(a) * d, y: Math.sin(a) * d - 40, rotate: (Math.random() - .5) * 90, opacity: 0, scale: .6 + Math.random(), duration: 1.1 + Math.random() * .5, ease: "expo.out", onComplete: () => el.remove() });
  }
}
function stopStageAuto() { stageAuto?.kill(); stageAuto = null; gsap.set(S.bar, { scaleX: 0 }); }
function startStageAuto() {
  if (reduced) return;
  stopStageAuto();
  stageAuto = gsap.fromTo(S.bar, { scaleX: 0 }, { scaleX: 1, duration: 7, ease: "none", onComplete: () => { showMoment(current + 1); startStageAuto(); } });
}
ScrollTrigger.create({ trigger: stage, start: "top 70%", end: "bottom 20%", onEnter: startStageAuto, onEnterBack: startStageAuto, onLeave: stopStageAuto, onLeaveBack: stopStageAuto });
stage.addEventListener("pointerenter", () => stageAuto?.pause());
stage.addEventListener("pointerleave", () => stageAuto?.resume());
document.addEventListener("keydown", (e) => {
  if (e.altKey || e.ctrlKey || e.metaKey || ["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement?.tagName)) return;
  const r = stage.getBoundingClientRect();
  if (r.bottom < 0 || r.top > innerHeight) return;
  if (e.key === "ArrowRight") { stopStageAuto(); showMoment(current + 1); }
  if (e.key === "ArrowLeft") { stopStageAuto(); showMoment(current - 1); }
});
showMoment(0, { animate: false });

/* ================= CHAIN MAP ================= */
const chainNodes = qs(".chain-nodes");
const chainOrder = ["omatsuri-otoko", "omatsuri-otokoka", "niisan-akan", "soko-wa-akan", "yokatta-kono-kyori", "bachikoon-strike"];
const chainPos = { "omatsuri-otoko": [110, 130], "omatsuri-otokoka": [340, 330], "niisan-akan": [590, 140], "soko-wa-akan": [830, 340], "yokatta-kono-kyori": [1090, 150], "bachikoon-strike": [760, 470] };
const chainLabels = { "omatsuri-otoko": "大声で呼ぶ", "omatsuri-otokoka": "小声で復唱", "niisan-akan": "割って入る", "soko-wa-akan": "『しばくぞ』", "yokatta-kono-kyori": "距離に安堵", "bachikoon-strike": "『ワッショーイ』から別ルート" };
const curve = (pts) => pts.reduce((d, [x, y], i) => { if (!i) return `M${x} ${y}`; const [px, py] = pts[i - 1]; const mx = (px + x) / 2; return d + ` C ${mx} ${py}, ${mx} ${y}, ${x} ${y}`; }, "");
const mainPts = chainOrder.slice(0, 5).map((s) => chainPos[s]);
const branchPts = [chainPos["niisan-akan"], chainPos["bachikoon-strike"]];
[["chain-a", mainPts], ["chain-bg-a", mainPts], ["chain-b", branchPts], ["chain-bg-b", branchPts]].forEach(([id, pts]) => qs("#" + id).setAttribute("d", curve(pts)));
chainOrder.forEach((slug) => {
  const m = moments.find((x) => x.slug === slug);
  const [x, y] = chainPos[slug];
  chainNodes.append(h("a", { class: "chain-node", href: momentUrl(m), "--c": m.accent, style: { left: (x / 1200 * 100) + "%", top: (y / 520 * 100) + "%" } },
    h("span", { class: "dot", "aria-hidden": "true" }), h("span", { class: "label" }, h("small", {}, `${m.number} / ${chainLabels[slug]}`), m.title)));
});
qsa(".chain-path").forEach((p) => {
  const len = p.getTotalLength();
  p.style.strokeDasharray = len; p.style.strokeDashoffset = reduced ? 0 : len;
  if (!reduced) gsap.to(p, { strokeDashoffset: 0, ease: "none", scrollTrigger: { trigger: ".chain-map", start: "top 75%", end: "bottom 45%", scrub: 1 } });
});
if (!reduced) gsap.from(qsa(".chain-node"), { scale: 0, opacity: 0, duration: .9, stagger: .15, ease: "back.out(2)", scrollTrigger: { trigger: ".chain-map", start: "top 65%" } });

/* ================= TEMPERATURE CHART ================= */
const dots = qs(".temp-dots"), legend = qs(".temp-legend");
moments.forEach((m, i) => {
  const x = Math.min(m.gap / 3, 1) * 88 + 6, y = m.volume * .86 + 4, size = 34 + m.volume * .5;
  const dot = h("a", { class: "temp-dot", href: momentUrl(m), "--c": m.accent, "--s": size + "px", "--d": (i * .6) + "s", style: { left: x + "%", bottom: y + "%" }, "aria-label": `${m.title} 声量${m.volume} 間${m.gap}秒` },
    h("span", { class: "bubble", "aria-hidden": "true" }), h("span", { class: "n", "aria-hidden": "true" }, m.number), h("span", { class: "tip", "aria-hidden": "true" }, m.title));
  dots.append(dot);
  const lg = h("button", { type: "button", "--c": m.accent }, h("i"), h("span", {}, `${m.number} ${m.title}`), h("small", { class: "mono", style: { marginLeft: "auto", color: "var(--muted)" } }, `VOL ${m.volume} / ${m.gap}s`));
  lg.addEventListener("pointerenter", () => dot.classList.add("is-hot"));
  lg.addEventListener("pointerleave", () => dot.classList.remove("is-hot"));
  lg.addEventListener("focus", () => dot.classList.add("is-hot"));
  lg.addEventListener("blur", () => dot.classList.remove("is-hot"));
  lg.addEventListener("click", () => location.assign(momentUrl(m)));
  legend.append(lg);
});
if (!reduced) gsap.from(qsa(".temp-dot"), { bottom: "0%", left: "0%", opacity: 0, duration: 1.6, stagger: .1, ease: "expo.out", scrollTrigger: { trigger: ".temp-chart", start: "top 75%" } });

/* ================= ARCHIVE ================= */
const grid = qs(".archive-grid"), status = qs(".archive-status"), empty = qs(".archive-empty"), input = qs("#scene-search"), tagBox = qs(".archive-tags");
let activeTag = null;
moments.forEach((m) => {
  const save = h("button", { type: "button", class: "arc-save", "aria-pressed": "false", "aria-label": `${m.title}を保存`, "data-slug": m.slug }, "☆");
  const card = h("a", { class: "arc", href: momentUrl(m), "--card-accent": m.accent, "data-slug": m.slug, "data-reveal": "" },
    h("img", { src: img(m.image, true), alt: "", loading: "lazy", decoding: "async" }),
    h("div", { class: "arc-top" }, h("b", {}, m.number), h("span", {}, m.short)),
    h("strong", { class: m.lines.join("").length > 10 ? "is-long" : "" }, ...m.lines.flatMap((l, k) => (k ? [h("br"), l] : [l]))),
    h("div", { class: "arc-tags" }, ...m.tags.map((t) => h("span", {}, "#" + t))),
    h("em", {}, "特設ページを見る ↗"));
  const wrap = h("div", { style: { position: "relative" }, "data-slug": m.slug }, card, save);
  save.addEventListener("click", (e) => { e.preventDefault(); const r = store.toggleSaved(m.slug); if (r === null) return; renderArchiveSaves(); renderSaved(); updateSave(); toast(r ? "保存しました" : "保存を解除しました"); });
  grid.append(wrap);
});
const allTags = [...new Set(moments.flatMap((m) => m.tags))];
tagBox.append(h("button", { type: "button", "aria-pressed": "true", "data-tag": "" }, "すべて"), ...allTags.map((t) => h("button", { type: "button", "aria-pressed": "false", "data-tag": t }, "#" + t)));
tagBox.addEventListener("click", (e) => {
  const b = e.target.closest("button"); if (!b) return;
  activeTag = b.dataset.tag || null;
  qsa("button", tagBox).forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
  filterArchive();
});
function filterArchive() {
  const hits = new Set(search(input.value).filter((m) => !activeTag || m.tags.includes(activeTag)).map((m) => m.slug));
  let n = 0;
  qsa(":scope > div", grid).forEach((w) => { const on = hits.has(w.dataset.slug); w.hidden = !on; if (on) n++; });
  status.textContent = `${n} MOMENT${n === 1 ? "" : "S"}` + (activeTag ? ` / #${activeTag}` : "");
  empty.hidden = n !== 0;
  ScrollTrigger.refresh();
}
input.addEventListener("input", filterArchive);
qs("#random-scene").addEventListener("click", () => {
  const visible = qsa(":scope > div:not([hidden])", grid);
  const pick = (visible.length ? visible : qsa(":scope > div", grid))[Math.floor(Math.random() * (visible.length || 6))];
  const card = qs(".arc", pick);
  gsap.fromTo(card, { scale: .96 }, { scale: 1, duration: .5, ease: "back.out(3)", onComplete: () => location.assign(card.href) });
});
function renderArchiveSaves() { qsa(".arc-save", grid).forEach((b) => { const s = store.isSaved(b.dataset.slug); b.setAttribute("aria-pressed", String(s)); b.textContent = s ? "★" : "☆"; }); }
renderArchiveSaves();

/* ================= SAVED ================= */
const savedList = qs(".saved-list"), savedProgress = qs(".saved-progress");
function renderSaved() {
  const saved = store.saved();
  const seen = store.seen();
  savedProgress.textContent = `SEEN ${seen.filter((s) => moments.some((m) => m.slug === s)).length} / 6  ·  SAVED ${saved.length} / 6`;
  const picks = moments.filter((m) => saved.includes(m.slug));
  if (!picks.length) { savedList.replaceChildren(h("p", { class: "saved-empty" }, "まだ保存したセリフはありません。気になる場面の「☆ 保存」を押してみてください。")); return; }
  savedList.replaceChildren(...picks.map((m) => h("a", { class: "saved-item", href: momentUrl(m), "--card-accent": m.accent }, h("img", { src: img(m.image, true), alt: "", loading: "lazy" }), h("div", {}, h("span", {}, m.number + " / " + m.short), h("strong", {}, m.title)), h("span", { "aria-hidden": "true" }, "↗"))));
}
renderSaved();

/* ================= SILENCE ================= */
(() => {
  const dotsEl = qsa(".silence-dots i"), text = qs(".silence-text"), timer = qs(".silence-timer"), pin = qs(".silence-pin");
  if (reduced) { gsap.set(dotsEl, { opacity: 1, scale: 1 }); gsap.set(text, { opacity: 1 }); return; }
  ScrollTrigger.create({
    trigger: ".silence", start: "top top", end: "bottom bottom", scrub: true,
    onUpdate: (st) => {
      const p = st.progress;
      dotsEl.forEach((d, i) => { const k = Math.min(Math.max((p * 1.4 - i * .1) / .2, 0), 1); d.style.opacity = .12 + k * .88; d.style.transform = `scale(${.6 + k * .5})`; d.style.background = k > .9 ? "var(--acid)" : "var(--paper)"; d.style.boxShadow = k > .9 ? "0 0 20px var(--acid)" : "none"; });
      const tp = Math.min(Math.max((p - .6) / .3, 0), 1);
      text.style.opacity = .08 + tp * .92;
      text.style.transform = `scale(${.94 + tp * .06})`;
      pin.style.setProperty("--glow", (tp * .16).toFixed(3));
      timer.textContent = "00:0" + (p * 3).toFixed(1);
    }
  });
})();

/* ================= WHY cards tilt ================= */
qsa("[data-tilt]").forEach((el) => tilt(el, { max: 8 }));

/* ================= mark seen via store on detail pages; reveals ================= */
initReveals();
magnetic();
store.on((t) => { if (t === "saved") { renderSaved(); renderArchiveSaves(); updateSave(); } });
addEventListener("storage", () => { renderSaved(); renderArchiveSaves(); updateSave(); });
