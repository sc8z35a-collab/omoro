// Shared site chrome: smooth scroll, cursor, loader, reveals, palette, menu, toasts, page transitions.
import Lenis from "lenis";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { moments, momentUrl, url, search, img } from "./data.js";
import { reduced, coarse, qs, qsa, h, lerp } from "./env.js";

gsap.registerPlugin(ScrollTrigger);
export { gsap, ScrollTrigger };

export let lenis = null;

/* ---------------- toast ---------------- */
export function toast(message) {
  const wrap = qs(".toast-wrap");
  if (!wrap) return;
  const el = h("div", { class: "toast" }, message);
  wrap.append(el);
  setTimeout(() => { el.classList.add("is-out"); setTimeout(() => el.remove(), 450); }, 2400);
}

/* ---------------- smooth scroll ---------------- */
function initScroll() {
  if (reduced) return;
  lenis = new Lenis({ duration: 1.15, easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)), smoothWheel: true, touchMultiplier: 1.4 });
  lenis.on("scroll", ScrollTrigger.update);
  gsap.ticker.add((time) => lenis.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);
  qsa('a[href^="#"]').forEach((a) => a.addEventListener("click", (e) => {
    const id = a.getAttribute("href");
    const target = id.length > 1 ? qs(id) : null;
    if (!target) return;
    e.preventDefault();
    lenis.scrollTo(target, { offset: -70, duration: 1.6 });
  }));
}
export function scrollToTop() { lenis ? lenis.scrollTo(0, { duration: 1.8 }) : scrollTo({ top: 0, behavior: reduced ? "auto" : "smooth" }); }

/* ---------------- header / progress ---------------- */
function initHeader() {
  const header = qs(".site-header");
  const bar = qs(".scroll-progress");
  let last = 0;
  const onScroll = () => {
    const y = scrollY;
    header?.classList.toggle("is-scrolled", y > 30);
    header?.classList.toggle("is-hidden", y > 400 && y > last && !document.body.classList.contains("menu-open"));
    last = y;
    const max = document.documentElement.scrollHeight - innerHeight;
    if (bar) bar.style.transform = `scaleX(${max > 0 ? y / max : 0})`;
  };
  addEventListener("scroll", onScroll, { passive: true });
  onScroll();
  qsa("[data-scroll-top]").forEach((a) => a.addEventListener("click", (e) => { e.preventDefault(); scrollToTop(); }));
}

/* ---------------- cursor ---------------- */
function initCursor() {
  if (coarse || reduced) return;
  const ring = qs(".cursor"), dot = qs(".cursor-dot"), label = qs(".cursor-label");
  if (!ring) return;
  let x = innerWidth / 2, y = innerHeight / 2, rx = x, ry = y;
  addEventListener("pointermove", (e) => { x = e.clientX; y = e.clientY; dot.style.transform = `translate3d(${x}px,${y}px,0)`; }, { passive: true });
  gsap.ticker.add(() => { rx = lerp(rx, x, .18); ry = lerp(ry, y, .18); ring.style.transform = `translate3d(${rx}px,${ry}px,0)`; });
  document.addEventListener("pointerover", (e) => {
    const t = e.target.closest("a, button, [data-cursor], input, select, label, canvas[data-cursor]");
    ring.classList.remove("is-hover", "is-label");
    if (!t) return;
    const text = t.dataset?.cursor;
    if (text) { label.textContent = text; ring.classList.add("is-label"); }
    else ring.classList.add("is-hover");
  });
  addEventListener("pointerdown", () => gsap.to(ring, { scale: .8, duration: .15 }));
  addEventListener("pointerup", () => gsap.to(ring, { scale: 1, duration: .4, ease: "elastic.out(1,.4)" }));
}

/* ---------------- magnetic ---------------- */
export function magnetic(root = document) {
  if (coarse || reduced) return;
  qsa("[data-magnetic], .btn, .icon-btn", root).forEach((el) => {
    if (el.dataset.magBound) return;
    el.dataset.magBound = "1";
    const strength = Number(el.dataset.magnetic || 0.28);
    el.addEventListener("pointermove", (e) => {
      const r = el.getBoundingClientRect();
      gsap.to(el, { x: (e.clientX - r.left - r.width / 2) * strength, y: (e.clientY - r.top - r.height / 2) * strength, duration: .5, ease: "power3.out" });
    });
    el.addEventListener("pointerleave", () => gsap.to(el, { x: 0, y: 0, duration: .8, ease: "elastic.out(1,.35)" }));
  });
}

/* ---------------- text split ---------------- */
export function splitChars(el) {
  if (!el || el.dataset.split) return [];
  el.dataset.split = "1";
  const label = el.textContent.replace(/\s+/g, " ").trim();
  const chars = [];
  const walk = (node) => {
    for (const child of Array.from(node.childNodes)) {
      if (child.nodeType === 3) {
        const frag = document.createDocumentFragment();
        for (const ch of Array.from(child.textContent)) {
          if (ch === "\n") continue;
          const s = h("span", { class: "split-char", "aria-hidden": "true" }, ch === " " ? "\u00a0" : ch);
          chars.push(s);
          frag.append(s);
        }
        child.replaceWith(frag);
      } else if (child.nodeType === 1 && child.tagName !== "BR") walk(child);
    }
  };
  walk(el);
  if (!el.getAttribute("aria-label")) el.setAttribute("aria-label", label);
  return chars;
}

/* ---------------- reveals ---------------- */
export function initReveals(root = document) {
  if (reduced) { qsa("[data-reveal]", root).forEach((el) => { el.style.opacity = 1; el.style.transform = "none"; }); return; }
  qsa("[data-reveal]", root).forEach((el) => {
    if (el.dataset.revealBound) return;
    el.dataset.revealBound = "1";
    const delay = Number(el.dataset.delay || 0);
    gsap.to(el, { opacity: 1, y: 0, duration: 1.2, delay, ease: "expo.out", scrollTrigger: { trigger: el, start: "top 88%" } });
  });
  qsa("[data-split]", root).forEach((el) => {
    if (el.dataset.split === "1") return;
    const mode = el.dataset.split;
    const chars = splitChars(el);
    gsap.set(el, { opacity: 1 });
    gsap.from(chars, { yPercent: 120, rotate: mode === "tilt" ? 12 : 0, opacity: 0, duration: 1.1, stagger: .028, ease: "expo.out", scrollTrigger: { trigger: el, start: "top 86%" } });
  });
  qsa("[data-parallax]", root).forEach((el) => {
    const amount = Number(el.dataset.parallax || 12);
    gsap.fromTo(el, { yPercent: -amount }, { yPercent: amount, ease: "none", scrollTrigger: { trigger: el.parentElement, start: "top bottom", end: "bottom top", scrub: true } });
  });
  qsa("[data-count]", root).forEach((el) => {
    const end = Number(el.dataset.count);
    const obj = { v: 0 };
    gsap.to(obj, { v: end, duration: 1.8, ease: "power3.out", scrollTrigger: { trigger: el, start: "top 90%" }, onUpdate: () => { el.textContent = Math.round(obj.v).toString().padStart(el.dataset.pad ? Number(el.dataset.pad) : 1, "0"); } });
  });
}

/* ---------------- marquee ---------------- */
export function initMarquees(root = document) {
  qsa(".marquee", root).forEach((m) => {
    const track = qs(".marquee-track", m);
    if (!track || track.dataset.bound) return;
    track.dataset.bound = "1";
    track.innerHTML += track.innerHTML;
    const dir = m.dataset.direction === "right" ? 1 : -1;
    let x = 0, speed = Number(m.dataset.speed || 60), boost = 0;
    if (lenis) lenis.on("scroll", ({ velocity }) => { boost = Math.min(Math.abs(velocity) * 12, 600); });
    gsap.ticker.add((_, delta) => {
      if (reduced) return;
      const w = track.scrollWidth / 2;
      x += dir * (speed + boost) * (delta / 1000);
      boost *= .92;
      if (x <= -w) x += w; if (x > 0) x -= w;
      track.style.transform = `translate3d(${x}px,0,0)`;
    });
  });
}

/* ---------------- loader ---------------- */
function runLoader() {
  const loader = qs(".loader");
  const html = document.documentElement;
  const done = () => { html.classList.add("is-loaded"); document.dispatchEvent(new CustomEvent("omoro:ready")); };
  if (!loader || reduced || sessionStorage.getItem("omoro-loaded")) { if (loader) loader.remove(); done(); return; }
  sessionStorage.setItem("omoro-loaded", "1");
  const count = qs(".loader-count", loader);
  const letters = qsa(".loader-word span", loader);
  const tl = gsap.timeline({ onComplete: () => { loader.remove(); } });
  const obj = { v: 0 };
  tl.to(letters, { y: 0, duration: 1, stagger: .07, ease: "expo.out" })
    .to(qs(".loader-bar i", loader), { scaleX: 1, duration: 1.6, ease: "power2.inOut" }, 0.1)
    .to(obj, { v: 100, duration: 1.6, ease: "power2.inOut", onUpdate: () => { count.textContent = String(Math.round(obj.v)).padStart(3, "0"); } }, 0.1)
    .to(letters, { y: "-110%", duration: .7, stagger: .04, ease: "expo.in" }, "+=.15")
    .to(qs(".loader-inner", loader), { opacity: 0, duration: .3 }, "-=.3")
    .add(done, "-=.1")
    .to(qs(".loader-panels", loader).children, { scaleY: 0, duration: .9, stagger: .06, ease: "expo.inOut" }, "-=.2")
    .set(loader, { background: "transparent" }, "<");
}

/* ---------------- page transitions ---------------- */
function initTransitions() {
  const curtain = qs(".curtain");
  if (!curtain || reduced) return;
  const bars = qsa("i", curtain);
  const word = qs(".curtain-word", curtain);
  // enter: if we came from an internal transition, open the curtain
  if (sessionStorage.getItem("omoro-transition")) {
    sessionStorage.removeItem("omoro-transition");
    gsap.set(bars, { scaleY: 1, transformOrigin: "top" });
    gsap.to(bars, { scaleY: 0, duration: .9, stagger: .05, ease: "expo.inOut", delay: .05 });
  }
  document.addEventListener("click", (e) => {
    const a = e.target.closest("a[href]");
    if (!a || e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || a.target === "_blank" || a.hasAttribute("download")) return;
    const href = new URL(a.href, location.href);
    if (href.origin !== location.origin || (href.pathname === location.pathname && href.hash)) return;
    if (href.pathname === location.pathname && href.search === location.search) return;
    e.preventDefault();
    sessionStorage.setItem("omoro-transition", "1");
    gsap.set(bars, { transformOrigin: "bottom" });
    gsap.timeline({ onComplete: () => location.assign(href.href) })
      .to(bars, { scaleY: 1, duration: .6, stagger: .045, ease: "expo.inOut" })
      .to(word, { opacity: 1, duration: .2 }, "-=.25");
  });
  addEventListener("pageshow", (e) => { if (e.persisted) { gsap.set(bars, { scaleY: 0 }); gsap.set(word, { opacity: 0 }); } });
}

/* ---------------- menu ---------------- */
function initMenu() {
  const toggle = qs(".menu-toggle");
  const menu = qs("#menu");
  if (!toggle || !menu) return;
  const set = (open) => {
    document.body.classList.toggle("menu-open", open);
    toggle.setAttribute("aria-expanded", String(open));
    toggle.setAttribute("aria-label", open ? "メニューを閉じる" : "メニューを開く");
    menu.setAttribute("aria-hidden", String(!open));
    if (lenis) open ? lenis.stop() : lenis.start();
    if (open) gsap.from(qsa(".menu-links a", menu), { y: 60, opacity: 0, duration: .9, stagger: .06, ease: "expo.out", delay: .25 });
  };
  toggle.addEventListener("click", () => set(!document.body.classList.contains("menu-open")));
  qsa(".menu-links a", menu).forEach((a) => a.addEventListener("pointerenter", () => {
    qsa(".menu-preview img", menu).forEach((im) => im.classList.toggle("is-on", im.dataset.key === a.dataset.preview));
  }));
  addEventListener("keydown", (e) => { if (e.key === "Escape" && document.body.classList.contains("menu-open")) set(false); });
}

/* ---------------- command palette ---------------- */
const pages = [
  { title: "ホーム", sub: "トップページ", href: url(""), kind: "PAGE", num: "00" },
  { title: "3Dギャラリー", sub: "6つのセリフが浮かぶ空間", href: url("gallery/"), kind: "3D", num: "3D" },
  { title: "OMORO LAB", sub: "クイズ・カード・距離シミュレーター", href: url("lab/"), kind: "LAB", num: "LB" },
  { title: "発言者クイズ", sub: "LAB / 誰のセリフ？", href: url("lab/#quiz"), kind: "LAB", num: "Q" },
  { title: "画像カードを作る", sub: "LAB / PNG カードメーカー", href: url("lab/#card"), kind: "LAB", num: "C" },
  { title: "距離シミュレーター", sub: "LAB / しばかれない距離", href: url("lab/#distance"), kind: "LAB", num: "D" },
  { title: "間（ま）チャレンジ", sub: "LAB / タイミングゲーム", href: url("lab/#ma"), kind: "LAB", num: "M" }
];
export function openPalette() { qs(".palette")?.dispatchEvent(new Event("open")); }
function initPalette() {
  const pal = qs(".palette");
  if (!pal) return;
  const input = qs("input", pal), list = qs(".palette-list", pal);
  let items = [], active = 0, lastFocus = null;
  const render = () => {
    const q = input.value.trim();
    const hitMoments = search(q).map((m) => ({ title: m.title, sub: m.speaker + " / " + m.short, href: momentUrl(m), kind: "MOMENT", num: m.number, accent: m.accent }));
    const hitPages = pages.filter((p) => !q || (p.title + p.sub).toLowerCase().includes(q.toLowerCase()));
    items = [...hitMoments, ...hitPages];
    active = Math.min(active, Math.max(items.length - 1, 0));
    list.replaceChildren(...(items.length ? items.map((it, i) => h("li", {}, h("button", { type: "button", role: "option", "aria-selected": String(i === active), onclick: () => go(i), onpointerenter: () => { active = i; mark(); } },
      h("span", { class: "p-num", style: it.accent ? { color: it.accent } : null }, it.num),
      h("span", { class: "p-title" }, it.title, h("small", {}, it.sub)),
      h("span", { class: "p-kind" }, it.kind)))) : [h("li", { class: "palette-empty" }, "見つかりませんでした。別の言葉で。")]));
  };
  const mark = () => qsa("[role=option]", list).forEach((b, i) => { b.setAttribute("aria-selected", String(i === active)); if (i === active) b.scrollIntoView({ block: "nearest" }); });
  const go = (i) => { const it = items[i]; if (!it) return; close(); location.assign(it.href); };
  const open = () => { lastFocus = document.activeElement; pal.hidden = false; requestAnimationFrame(() => pal.classList.add("is-open")); input.value = ""; active = 0; render(); setTimeout(() => input.focus(), 30); lenis?.stop(); };
  const close = () => { pal.classList.remove("is-open"); setTimeout(() => { pal.hidden = true; }, 300); lenis?.start(); lastFocus?.focus?.(); };
  pal.addEventListener("open", open);
  pal.addEventListener("click", (e) => { if (e.target === pal) close(); });
  input.addEventListener("input", () => { active = 0; render(); });
  input.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown") { e.preventDefault(); active = (active + 1) % Math.max(items.length, 1); mark(); }
    if (e.key === "ArrowUp") { e.preventDefault(); active = (active - 1 + items.length) % Math.max(items.length, 1); mark(); }
    if (e.key === "Enter") { e.preventDefault(); go(active); }
    if (e.key === "Escape") close();
    if (e.key === "Tab") e.preventDefault();
  });
  qsa("[data-palette-open]").forEach((b) => b.addEventListener("click", open));
  addEventListener("keydown", (e) => {
    const typing = ["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement?.tagName);
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); pal.hidden ? open() : close(); }
    else if (e.key === "/" && !typing && pal.hidden) { e.preventDefault(); open(); }
  });
}

/* ---------------- keyboard help ---------------- */
function initKeyboardHelp() {
  let el = null;
  addEventListener("keydown", (e) => {
    const typing = ["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement?.tagName);
    if (typing) return;
    if (e.key === "?" && !el) {
      el = h("div", { class: "kbd-help", role: "dialog", "aria-modal": "true", "aria-label": "ショートカット", onclick: (ev) => { if (ev.target === el) { el.remove(); el = null; } } },
        h("div", { class: "kbd-help-box" }, h("h2", {}, "ショートカット"),
          h("dl", {}, ...[["⌘K / /", "セリフ検索"], ["← →", "場面を切り替え"], ["R", "おまかせで1つ開く"], ["G", "3Dギャラリーへ"], ["L", "LABへ"], ["?", "このヘルプ"], ["ESC", "閉じる"]].flatMap(([k, d]) => [h("dt", {}, h("kbd", {}, k)), h("dd", {}, d)]))));
      document.body.append(el);
    } else if (e.key === "Escape" && el) { el.remove(); el = null; }
    else if (!e.metaKey && !e.ctrlKey && !e.altKey && !el) {
      if (e.key === "r" || e.key === "R") { const m = moments[Math.floor(Math.random() * moments.length)]; location.assign(momentUrl(m)); }
      if (e.key === "g" || e.key === "G") location.assign(url("gallery/"));
      if (e.key === "l" || e.key === "L") location.assign(url("lab/"));
    }
  });
}

/* ---------------- footer giant letters ---------------- */
function initFooter() {
  const letters = qsa(".footer-giant span");
  if (!letters.length || reduced) return;
  gsap.from(letters, { yPercent: 100, opacity: 0, duration: 1.4, stagger: .06, ease: "expo.out", scrollTrigger: { trigger: ".footer-giant", start: "top 95%" } });
}

export function preloadImages(names) { return Promise.all(names.map((n) => new Promise((res) => { const i = new Image(); i.onload = i.onerror = res; i.src = img(n); }))); }

export function initChrome() {
  initScroll();
  initHeader();
  initCursor();
  initMenu();
  initPalette();
  initKeyboardHelp();
  initTransitions();
  initFooter();
  initMarquees();
  magnetic();
  runLoader();
  document.fonts?.ready.then(() => ScrollTrigger.refresh());
  addEventListener("load", () => ScrollTrigger.refresh());
}
