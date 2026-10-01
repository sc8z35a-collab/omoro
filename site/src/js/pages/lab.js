import "../../css/base.css";
import "../../css/lab.css";
import { initChrome, gsap, toast, magnetic, splitChars, lenis } from "../core/chrome.js";
import { moments, momentUrl, img, speakerOf } from "../core/data.js";
import { store } from "../core/store.js";
import { reduced, coarse, qs, qsa, h } from "../core/env.js";
import { tilt } from "../ui/tilt.js";
import { loadImage, coverDraw, ensureFonts } from "../gl/cardTexture.js";

initChrome();
const typing = () => ["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement?.tagName);

if (!reduced) {
  const t = qs(".lab-title");
  gsap.from(qsa("span, em, b", t), { yPercent: 110, opacity: 0, duration: 1.4, stagger: .1, ease: "expo.out", delay: .2 });
  gsap.to(".lab-hero-img", { yPercent: 15, ease: "none", scrollTrigger: { trigger: ".lab-hero", start: "top top", end: "bottom top", scrub: true } });
}

/* ============ tabs ============ */
const names = ["reel", "quiz", "card", "distance", "ma", "temp"];
const tabs = names.map((n) => qs("#tab-" + n)), panels = names.map((n) => qs("#" + n)), ink = qs(".lab-tabs-ink");
const hooks = {};
function moveInk() { const t = tabs.find((x) => x.getAttribute("aria-selected") === "true"); if (!t) return; ink.style.left = t.offsetLeft + "px"; ink.style.width = t.offsetWidth + "px"; }
let booted = false;
function activate(name, focus = false, scroll = false) {
  const active = names.includes(name) ? name : "reel";
  tabs.forEach((t, i) => { const on = names[i] === active; t.setAttribute("aria-selected", String(on)); t.tabIndex = on ? 0 : -1; panels[i].hidden = !on; if (on && focus) t.focus(); });
  moveInk();
  Object.entries(hooks).forEach(([k, fn]) => fn?.(k === active));
  if (booted && location.hash.slice(1) !== active) history.replaceState(null, "", location.pathname + location.search + "#" + active);
  const panel = qs("#" + active);
  if (!reduced) gsap.from(panel.querySelectorAll(".panel-side > *, .panel-grid > :last-child"), { opacity: 0, y: 30, duration: .8, stagger: .04, ease: "expo.out" });
  if (scroll) scrollToTabs();
  booted = true;
}
function scrollToTabs() {
  const y = qs(".lab-tabs").getBoundingClientRect().top + scrollY - 0;
  lenis ? lenis.scrollTo(y, { duration: 1.2 }) : scrollTo({ top: y, behavior: reduced ? "auto" : "smooth" });
}
tabs.forEach((t, i) => {
  t.addEventListener("click", () => activate(names[i]));
  t.addEventListener("keydown", (e) => { if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return; e.preventDefault(); activate(names[(i + (e.key === "ArrowRight" ? 1 : -1) + names.length) % names.length], true); });
});
addEventListener("resize", moveInk);
addEventListener("hashchange", () => activate(location.hash.slice(1), false, true));
document.fonts?.ready.then(moveInk);

/* ============ 01 reel: 3D flip deck ============ */
const deck = qs("#reel-deck"), reelDots = qs("#reel-dots"), reelPlay = qs("#reel-play"), reelSpeed = qs("#reel-speed");
let reelIndex = 0, reelTimer = null, reelCard = null;
function buildReelCard(m) {
  return h("a", { class: "reel-card", href: momentUrl(m), "--c": m.accent, "aria-label": `${m.number} ${m.title} ${m.speaker}` },
    h("img", { src: img(m.image), alt: "" }),
    h("div", { class: "top" }, h("span", {}, `SCENE ${m.number} / 06`), h("span", {}, m.short)),
    h("p", { class: "q" + (m.lines.join("").length > 10 ? " is-long" : "") }, ...m.lines.flatMap((l, k) => (k ? [h("br"), l] : [l]))),
    h("span", { class: "s" }, m.speaker),
    h("div", { class: "d" }, h("span", {}, "この場面を詳しく ↗"), h("span", {}, `${m.number} / 06`)));
}
function showReel(i, dir = 1) {
  reelIndex = (i + moments.length) % moments.length;
  const m = moments[reelIndex];
  const card = buildReelCard(m);
  deck.append(card);
  const old = reelCard; reelCard = card;
  if (!reduced && old) {
    gsap.fromTo(card, { rotateY: dir * 90, x: dir * 120, z: -200, opacity: 0 }, { rotateY: 0, x: 0, z: 0, opacity: 1, duration: 1, ease: "expo.out" });
    gsap.to(old, { rotateY: -dir * 80, x: -dir * 160, z: -300, opacity: 0, duration: .8, ease: "expo.inOut", onComplete: () => old.remove() });
    gsap.from(splitChars(qs(".q", card)), { yPercent: 100, opacity: 0, duration: .8, stagger: .03, ease: "expo.out", delay: .2 });
  } else old?.remove();
  qsa("button", reelDots).forEach((b, k) => b.setAttribute("aria-current", String(k === reelIndex)));
}
function stopReel() { clearInterval(reelTimer); reelTimer = null; reelPlay.setAttribute("aria-pressed", "false"); reelPlay.textContent = "▶ 自動で送る"; }
function startReel() { stopReel(); reelTimer = setInterval(() => showReel(reelIndex + 1), Number(reelSpeed.value)); reelPlay.setAttribute("aria-pressed", "true"); reelPlay.textContent = "■ 一時停止"; }
moments.forEach((m, i) => reelDots.append(h("button", { type: "button", "--c": m.accent, "aria-label": `${m.number} ${m.title}`, onclick: () => showReel(i, i > reelIndex ? 1 : -1) }, m.number)));
qs("#reel-prev").addEventListener("click", () => showReel(reelIndex - 1, -1));
qs("#reel-next").addEventListener("click", () => showReel(reelIndex + 1, 1));
reelPlay.addEventListener("click", () => (reelTimer ? stopReel() : startReel()));
reelSpeed.addEventListener("change", () => { if (reelTimer) startReel(); });
let sx = null, swiped = false;
deck.addEventListener("pointerdown", (e) => { sx = e.clientX; swiped = false; });
deck.addEventListener("pointerup", (e) => { if (sx == null) return; const dx = e.clientX - sx; sx = null; if (Math.abs(dx) > 40) { swiped = true; showReel(reelIndex + (dx < 0 ? 1 : -1), dx < 0 ? 1 : -1); } });
// BUG #63: a swipe ends with a click on the card link — cancel that navigation (keyboard clicks have detail 0 and pass)
deck.addEventListener("click", (e) => { if (swiped && e.detail !== 0) { e.preventDefault(); e.stopPropagation(); swiped = false; } }, true);
hooks.reel = (on) => { if (!on) stopReel(); };
document.addEventListener("visibilitychange", () => { if (document.hidden) stopReel(); });
addEventListener("keydown", (e) => { if (typing() || panels[0].hidden) return; if (e.key === "ArrowRight") showReel(reelIndex + 1, 1); if (e.key === "ArrowLeft") showReel(reelIndex - 1, -1); });
showReel(0);

/* ============ 02 quiz ============ */
const speakers = ["松本等しい", "デコピン浜ちゃん", "宮川大好", "近藤春菜のものまね芸人"];
const Q = { number: qs("#quiz-number"), quote: qs("#quiz-quote"), options: qs("#quiz-options"), feedback: qs("#quiz-feedback"), next: qs("#quiz-next"), score: qs("#quiz-score"), best: qs("#quiz-best"), progress: qs("#quiz-progress"), timer: qs("#quiz-timer"), timed: qs("#quiz-timed") };
let order = [], qi = 0, score = 0, answered = false, finished = false, results = [], timerTween = null, qStart = 0;
const shuffle = (a) => { const r = [...a]; for (let i = r.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [r[i], r[j]] = [r[j], r[i]]; } return r; };
Q.best.textContent = store.pref("quizBest", 0);
function renderProgress() { Q.progress.replaceChildren(...order.map((_, i) => h("i", { class: results[i] === true ? "ok" : results[i] === false ? "ng" : i === qi ? "now" : "" }))); }
function renderQuestion() {
  const m = order[qi]; answered = false;
  Q.number.textContent = String(qi + 1).padStart(2, "0");
  Q.quote.textContent = m.title;
  delete Q.quote.dataset.split; Q.quote.setAttribute("aria-label", m.title);   // BUG #53 #54
  Q.feedback.replaceChildren();
  Q.next.disabled = true;
  Q.next.textContent = qi === order.length - 1 ? "結果を見る →" : "次の問題 →";
  Q.options.replaceChildren(...shuffle(speakers).map((s, k) => h("button", { type: "button", "data-s": s, onclick: () => answer(s) }, h("span", { class: "k" }, String.fromCharCode(65 + k)), s)));
  renderProgress();
  if (!reduced) { gsap.from(splitChars(Q.quote), { yPercent: 100, opacity: 0, duration: .7, stagger: .03, ease: "expo.out" }); gsap.from(Q.options.children, { y: 20, opacity: 0, duration: .6, stagger: .06, ease: "expo.out" }); }
  timerTween?.kill(); gsap.set(Q.timer, { scaleX: 0 });
  qStart = performance.now();
  if (Q.timed.checked) timerTween = gsap.fromTo(Q.timer, { scaleX: 1 }, { scaleX: 0, duration: 10, ease: "none", onComplete: () => answer(null) });
}
function answer(sel) {
  if (answered || finished) return;
  answered = true;
  const tweenTime = timerTween?.time?.() ?? 0; timerTween?.pause();
  const m = order[qi], correct = speakerOf(m), ok = sel === correct;
  const elapsed = Q.timed.checked ? tweenTime : (performance.now() - qStart) / 1000;   // BUG #56: tween pauses while hidden
  const gain = ok ? (Q.timed.checked ? Math.max(1, Math.round(10 - elapsed)) * 10 : 1) : 0;
  score += gain; results[qi] = ok;
  Q.score.textContent = score;
  qsa("button", Q.options).forEach((b) => { b.disabled = true; if (b.dataset.s === correct) b.classList.add("is-correct"); else if (b.dataset.s === sel) b.classList.add("is-wrong"); });
  Q.feedback.replaceChildren(h("strong", {}, ok ? `正解！${Q.timed.checked ? ` +${gain}` : ""}` : sel ? `正解は「${correct}」。` : `時間切れ。正解は「${correct}」。`), h("span", {}, m.point + " — " + m.lead));
  if (ok && !reduced) confetti(qs(".is-correct", Q.options));
  Q.next.disabled = false; renderProgress(); Q.next.focus({ preventScroll: true });
}
function finish() {
  finished = true;
  const correct = results.filter(Boolean).length;
  Q.quote.textContent = `${correct} / 6 正解`; delete Q.quote.dataset.split; Q.quote.setAttribute("aria-label", Q.quote.textContent);
  Q.options.replaceChildren();
  const prevBest = store.pref("quizBest", 0), isNewBest = score > prevBest;   // BUG #55: a tie is not a new best
  const best = Math.max(score, prevBest);
  store.setPref("quizBest", best); Q.best.textContent = best;
  Q.feedback.replaceChildren(h("strong", {}, correct === 6 ? "全問正解。あの間まで覚えている？" : correct >= 4 ? "かなりの通。" : "もう一回で、もっと覚えてしまうかも。"), h("span", {}, `SCORE ${score}${isNewBest ? " — ベスト更新！" : ""}`));
  if (correct === 6 && !reduced) confetti(Q.quote, 80);
  Q.next.disabled = false; Q.next.textContent = "もう一度遊ぶ ↗";
}
function resetQuiz() { order = shuffle(moments); qi = 0; score = 0; results = []; finished = false; Q.score.textContent = "0"; renderQuestion(); }
Q.next.addEventListener("click", () => { if (finished) return resetQuiz(); if (!answered) return; if (qi === order.length - 1) finish(); else { qi++; renderQuestion(); } });
qs("#quiz-restart").addEventListener("click", resetQuiz);
Q.timed.addEventListener("change", resetQuiz);
addEventListener("keydown", (e) => {
  if (typing() || panels[1].hidden) return;
  const k = e.key.toUpperCase(); const idx = ["A", "B", "C", "D", "1", "2", "3", "4"].indexOf(k);
  if (idx >= 0 && !answered) { qsa("button", Q.options)[idx % 4]?.click(); }
});
hooks.quiz = (on) => { if (!on) timerTween?.pause(); else timerTween?.resume(); };
function confetti(from, n = 36) {
  const r = from.getBoundingClientRect(); const cols = moments.map((m) => m.accent);
  for (let i = 0; i < n; i++) {
    const p = h("i", { class: "confetti-piece", style: { left: r.left + r.width / 2 + "px", top: r.top + r.height / 2 + "px", background: cols[i % cols.length] } });
    document.body.append(p);
    gsap.to(p, { x: (Math.random() - .5) * 600, y: -Math.random() * 400 - 60, rotate: Math.random() * 720, duration: .9, ease: "power3.out" });
    gsap.to(p, { y: "+=700", opacity: 0, duration: 1.6, delay: .8, ease: "power2.in", onComplete: () => p.remove() });
  }
}
resetQuiz();

/* ============ 03 card maker ============ */
const cardMoment = qs("#card-moment"), cardNote = qs("#card-note"), canvas = qs("#quote-canvas"), dims = qs("#card-dimensions"), cardStatus = qs("#card-status");
moments.forEach((m) => cardMoment.append(h("option", { value: m.slug }, `${m.number}  ${m.title}`)));
const req = new URLSearchParams(location.search).get("moment");
if (moments.some((m) => m.slug === req)) cardMoment.value = req;
const radio = (n) => qs(`input[name="${n}"]:checked`).value;
const sizes = { square: [1080, 1080], landscape: [1200, 630], story: [1080, 1920] };
const themes = { photo: { bg: "#0b0c0d", fg: "#eef0e8", line: "rgba(238,240,232,.3)" }, night: { bg: "#0b0c0d", fg: "#eef0e8", line: "#3b403c" }, acid: { bg: "#d8ff4f", fg: "#0b0c0d", line: "#61702a" }, paper: { bg: "#ebede4", fg: "#0b0c0d", line: "#9a9f93" }, holo: { bg: "#0b0c0d", fg: "#0b0c0d", line: "rgba(11,12,13,.3)" } };
let drawToken = 0;
async function drawCard() {
  const token = ++drawToken;
  const m = moments.find((x) => x.slug === cardMoment.value) || moments[0];
  const [W, H] = sizes[radio("card-size")], theme = radio("card-theme"), c = themes[theme];
  await ensureFonts(m.title + cardNote.value);
  const photo = theme === "photo" ? await loadImage(img(m.image)) : null;
  if (token !== drawToken) return;
  canvas.width = W; canvas.height = H; dims.textContent = `${W} × ${H}`;
  canvas.setAttribute("aria-label", `${m.title}の画像カードのプレビュー`);
  const ctx = canvas.getContext("2d");
  const s = Math.min(W, H) / 1080, land = W > H, M = (land ? 70 : 86) * s * (land ? 1.1 : 1);
  ctx.fillStyle = c.bg; ctx.fillRect(0, 0, W, H);
  if (theme === "photo" && photo) {
    ctx.save(); ctx.filter = "brightness(.55) contrast(1.1) saturate(1.1)"; coverDraw(ctx, photo, 0, 0, W, H); ctx.restore();
    ctx.globalCompositeOperation = "soft-light"; ctx.fillStyle = m.accent; ctx.globalAlpha = .45; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1; ctx.globalCompositeOperation = "source-over";
    const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, "rgba(11,12,13,.6)"); g.addColorStop(.4, "rgba(11,12,13,.1)"); g.addColorStop(1, "rgba(11,12,13,.95)"); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  }
  if (theme === "holo") {
    const g = ctx.createLinearGradient(0, 0, W, H);
    ["#d8ff4f", "#b6a2ec", "#ff90b4", "#9fc4ff", "#ffd979"].forEach((col, i, a) => g.addColorStop(i / (a.length - 1), col));
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = .25; for (let k = 0, i = -H; i < W; i += 40 * s, k++) { ctx.fillStyle = k % 2 ? "#fff" : "#000"; ctx.fillRect(i, 0, 8 * s, H * 2); }   // BUG #60 ctx.globalAlpha = 1;
  }
  const accentFill = theme === "night" || theme === "photo" ? m.accent : c.fg;
  ctx.fillStyle = accentFill; ctx.fillRect(M, M, 60 * s, 8 * s);
  ctx.fillStyle = c.fg; ctx.textBaseline = "alphabetic";
  ctx.font = `700 ${54 * s}px "Space Grotesk", Arial, sans-serif`; ctx.fillText("OMORO.", M, M + 78 * s);
  ctx.font = `500 ${22 * s}px "JetBrains Mono", monospace`; ctx.textAlign = "right"; ctx.fillText(`THE DAUSO FILE / ${m.number}`, W - M, M + 72 * s); ctx.textAlign = "left";
  ctx.strokeStyle = c.line; ctx.lineWidth = 2 * s; ctx.beginPath(); ctx.moveTo(M, M + 108 * s); ctx.lineTo(W - M, M + 108 * s); ctx.stroke();
  // ghost number
  ctx.font = `700 ${(land ? 360 : 520) * s}px "Space Grotesk", sans-serif`; ctx.fillStyle = theme === "acid" || theme === "paper" || theme === "holo" ? "rgba(11,12,13,.07)" : "rgba(238,240,232,.06)";
  ctx.textAlign = "right"; ctx.fillText(m.number, W - M * .6, land ? H * .72 : H * .6); ctx.textAlign = "left";
  // quote
  const maxW = W - M * 2; let fs = (land ? 120 : 150) * s;
  const fam = `"Dela Gothic One", "Zen Kaku Gothic New", sans-serif`;
  do { ctx.font = `400 ${fs}px ${fam}`; if (Math.max(...m.lines.map((l) => ctx.measureText(l).width)) <= maxW) break; fs -= 3; } while (fs > 50);
  const lh = fs * 1.14, start = H * (land ? .46 : radio("card-size") === "story" ? .5 : .5);
  ctx.fillStyle = c.fg;
  m.lines.forEach((l, i) => ctx.fillText(l, M, start + lh * i));
  const after = start + lh * (m.lines.length - 1);
  ctx.fillStyle = accentFill; ctx.font = `700 ${30 * s}px "Zen Kaku Gothic New", sans-serif`;
  ctx.fillText(`${m.speaker} ／ ${m.short}`, M, after + (land ? 56 : 84) * s);
  const note = cardNote.value.trim();
  if (note) { ctx.fillStyle = c.fg; ctx.font = `500 ${(land ? 30 : 34) * s}px "Zen Kaku Gothic New", sans-serif`; ctx.fillText(`“${note}”`, M, H - (land ? 120 : 160) * s, maxW); }
  ctx.strokeStyle = c.line; ctx.beginPath(); ctx.moveTo(M, H - 92 * s); ctx.lineTo(W - M, H - 92 * s); ctx.stroke();
  ctx.fillStyle = c.fg; ctx.font = `500 ${20 * s}px "JetBrains Mono", monospace`;
  ctx.fillText("OMORO / NON-OFFICIAL FAN ARCHIVE", M, H - 50 * s);
  ctx.textAlign = "right"; ctx.fillText(`${m.number} / 06`, W - M, H - 50 * s); ctx.textAlign = "left";
}
["change", "input"].forEach((ev) => { cardMoment.addEventListener(ev, drawCard); cardNote.addEventListener(ev, drawCard); });
qsa('input[name="card-theme"], input[name="card-size"]').forEach((i) => i.addEventListener("change", drawCard));
const fileName = () => `omoro-${cardMoment.value}-${radio("card-size")}.png`;
qs("#card-download").addEventListener("click", async () => {
  try { await drawCard(); const a = h("a", { href: canvas.toDataURL("image/png"), download: fileName() }); a.click(); cardStatus.textContent = "PNGを保存しました。"; toast("PNGを保存しました"); }
  catch { cardStatus.textContent = "画像を保存できませんでした。"; }
});
qs("#card-share").addEventListener("click", async () => {
  await drawCard();
  canvas.toBlob(async (blob) => {
    try {
      const file = new File([blob], fileName(), { type: "image/png" });
      if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], title: "OMORO" });
      else { await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]); toast("画像をクリップボードにコピーしました"); }
    } catch (e) { if (e?.name !== "AbortError") toast("共有できませんでした。PNG保存をお使いください"); }
  });
});
tilt(qs(".card-frame"), { max: 6 });
drawCard();

/* ============ 04 distance simulator ============ */
(() => {
  const range = qs("#dist-range"), val = qs("#dist-value"), bar = qs("#dist-bar"), pct = qs("#dist-pct"), verdict = qs("#dist-verdict"), cv = qs("#dist-canvas");
  const ctx = cv.getContext("2d"); let shout = 0, t0 = performance.now(), running = false, raf = 0;
  const reach = 1.1; // arm's reach in metres
  const safety = (d) => Math.max(0, Math.min(1, (d - reach) / 3.2));
  const verdictFor = (d) => d < reach ? "届く。完全にしばかれる距離。" : d < 1.8 ? "ギリギリ。まだ危ない。" : d < 3 ? "……ちょっと安心。" : d < 5.2 ? "良かったこの距離でぇ。" : "遠すぎて、もはや会話じゃない。";
  function update() {
    const d = Number(range.value);
    range.style.setProperty("--p", ((d - .3) / 7.7 * 100) + "%");
    val.textContent = d.toFixed(1) + " m";
    const s = safety(d); bar.style.width = (s * 100) + "%"; pct.textContent = Math.round(s * 100) + "%";
    verdict.textContent = verdictFor(d);
  }
  function figure(x, y, sc, color, label, arm = 0) {
    ctx.save(); ctx.translate(x, y); ctx.scale(sc, sc);
    ctx.fillStyle = color; ctx.strokeStyle = color; ctx.lineWidth = 10; ctx.lineCap = "round";
    ctx.beginPath(); ctx.arc(0, -150, 30, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.moveTo(0, -115); ctx.lineTo(0, -30); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, -30); ctx.lineTo(-24, 40); ctx.moveTo(0, -30); ctx.lineTo(24, 40); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, -95); ctx.lineTo(arm * 60 + 30 * Math.sign(arm || 1), -80 - Math.abs(arm) * 20); ctx.stroke();
    ctx.font = "700 22px 'Zen Kaku Gothic New', sans-serif"; ctx.textAlign = "center"; ctx.fillStyle = "rgba(238,240,232,.85)"; ctx.fillText(label, 0, 80);
    ctx.restore();
  }
  function draw(now) {
    const W = cv.clientWidth, H = cv.clientHeight, dpr = Math.min(devicePixelRatio, 2);
    if (cv.width !== W * dpr) { cv.width = W * dpr; cv.height = H * dpr; }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    const d = Number(range.value), t = (now - t0) / 1000;
    const floorY = H * .78, pxPerM = (W * .8) / 8.3, cx = W / 2;
    const ax = cx - (d * pxPerM) / 2, bx = cx + (d * pxPerM) / 2;
    // floor grid
    ctx.strokeStyle = "rgba(238,240,232,.07)"; ctx.lineWidth = 1;
    for (let m = 0; m <= 8; m++) { const x = cx - 4 * pxPerM + m * pxPerM; ctx.beginPath(); ctx.moveTo(x, floorY - 6); ctx.lineTo(x, floorY + 10); ctx.stroke(); }
    ctx.strokeStyle = "rgba(238,240,232,.2)"; ctx.beginPath(); ctx.moveTo(0, floorY + 40); ctx.lineTo(W, floorY + 40); ctx.stroke();
    // reach zone
    const s = safety(d);
    const grd = ctx.createRadialGradient(ax, floorY - 60, 0, ax, floorY - 60, reach * pxPerM * 1.2);
    grd.addColorStop(0, "rgba(255,144,180,.35)"); grd.addColorStop(1, "rgba(255,144,180,0)");
    ctx.fillStyle = grd; ctx.beginPath(); ctx.arc(ax, floorY - 60, reach * pxPerM * 1.2, 0, Math.PI * 2); ctx.fill();
    // tape measure
    ctx.fillStyle = "#ffd979"; ctx.fillRect(ax, floorY + 34, bx - ax, 12);
    ctx.fillStyle = "#0b0c0d"; ctx.font = "600 11px 'JetBrains Mono', monospace";
    for (let x = ax; x < bx; x += pxPerM / 2) { ctx.fillRect(x, floorY + 34, 1.5, 6); }
    ctx.fillStyle = "#ffd979"; ctx.font = "700 20px 'JetBrains Mono', monospace"; ctx.textAlign = "center"; ctx.fillText(d.toFixed(1) + " m", cx, floorY + 80);
    // shout wave
    if (shout > 0) {
      shout = Math.max(0, shout - .012);
      for (let k = 0; k < 3; k++) { const r = (1 - shout) * pxPerM * 5 + k * 30; ctx.strokeStyle = `rgba(255,144,180,${shout * (1 - k * .3)})`; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(ax + 30, floorY - 150, r, -.6, .6); ctx.stroke(); }
      ctx.fillStyle = `rgba(255,144,180,${Math.min(1, shout * 2)})`; ctx.font = "400 34px 'Dela Gothic One', sans-serif"; ctx.textAlign = "left"; ctx.fillText("しばくぞ", ax - 60, floorY - 230 - (1 - shout) * 20);
    }
    const sc = Math.min(1, H / 520);
    const wob = Math.sin(t * 2) * 2;
    figure(ax, floorY + wob, sc, "#ff90b4", "デコピン浜ちゃん", shout > 0 ? 1.4 : .3);
    const relief = s > .5 ? Math.sin(t * 6) * 3 * s : Math.sin(t * 20) * (1 - s) * 3;
    figure(bx, floorY + relief, sc, "#9fc4ff", "松本等しい", -.2);
    if (s > .5) { ctx.fillStyle = `rgba(159,196,255,${(s - .5) * 2})`; ctx.font = "400 22px 'Dela Gothic One', sans-serif"; ctx.textAlign = "center"; ctx.fillText("ﾎｯ…", bx + 40, floorY - 200 + Math.sin(t * 2) * 4); }
    if (running) raf = requestAnimationFrame(draw);
  }
  range.addEventListener("input", update);
  qs("#dist-shout").addEventListener("click", () => { shout = 1; const d = Number(range.value); toast(d < reach ? "……しばかれました。" : d > 3 && d < 5.2 ? "良かったこの距離でぇ。" : verdictFor(d)); });
  hooks.distance = (on) => { running = on; cancelAnimationFrame(raf); if (on) raf = requestAnimationFrame(draw); };
  update();
})();

/* ============ 05 ma challenge ============ */
(() => {
  const btn = qs("#ma-btn"), state = qs("#ma-state"), line = qs("#ma-line"), time = qs("#ma-time"), result = qs("#ma-result"), prog = qs("#ma-progress"), arc = qs("#ma-arc"), best = qs("#ma-best"), hist = qs("#ma-history");
  const target = 1.8, full = 3.6, C = 2 * Math.PI * 88;
  const tol = .25;
  arc.style.strokeDasharray = `${(tol * 2 / full) * C} ${C}`;
  arc.style.strokeDashoffset = String(-((target - tol) / full) * C);
  prog.style.strokeDasharray = `0 ${C}`;
  let phase = "ready", start = 0, raf = 0, history = store.pref("maHistory", []);
  const renderBest = () => { const b = store.pref("maBest", null); best.textContent = b == null ? "—" : `±${b.toFixed(3)}s`; hist.replaceChildren(...history.slice(-5).reverse().map((r) => h("li", {}, h("span", {}, r.t.toFixed(3) + "s"), h("span", {}, r.label)))); };
  const grade = (diff) => diff < .05 ? ["神の間", "#d8ff4f"] : diff < .15 ? ["いい間", "#9fc4ff"] : diff < .35 ? ["惜しい間", "#ffd979"] : ["間が悪い", "#ff90b4"];
  function loop() {
    const t = (performance.now() - start) / 1000;
    time.textContent = t.toFixed(2) + "s";
    prog.style.strokeDasharray = `${Math.min(t / full, 1) * C} ${C}`;
    if (t > full) { finish(t, true); return; }
    raf = requestAnimationFrame(loop);
  }
  function begin() {
    phase = "run"; start = performance.now(); result.textContent = "";
    state.textContent = "WAIT FOR IT…"; line.textContent = "お祭り男ォ！"; line.style.transform = "scale(1.1)";
    gsap.fromTo(line, { scale: 1.4 }, { scale: 1, duration: .6, ease: "elastic.out(1,.4)" });
    btn.textContent = "ｵﾏﾂﾘｵﾄｺｶ…（今！）";
    raf = requestAnimationFrame(loop);
  }
  function finish(t, timedOut = false) {
    cancelAnimationFrame(raf); phase = "done";
    const diff = Math.abs(t - target), [label, color] = grade(diff);
    line.textContent = "ｵﾏﾂﾘｵﾄｺｶ…"; line.style.fontSize = "1.6rem";
    state.textContent = label; state.style.color = color;
    time.textContent = t.toFixed(3) + "s";
    result.textContent = `${label}！ 目標 ${target}s との差 ${diff.toFixed(3)}s`;
    if (timedOut) {   // BUG #58: not pressing is not an attempt
      state.textContent = "TIME OVER"; result.textContent = "押さなかった…。間を置きすぎ。"; renderBest(); btn.textContent = "▶ もう一回"; return;
    }
    history.push({ t, label }); history = history.slice(-20); store.setPref("maHistory", history);
    const b = store.pref("maBest", null); if (b == null || diff < b) { store.setPref("maBest", diff); toast(b == null ? "初記録！ ベストに登録しました" : "ベスト更新！"); }   // BUG #59
    renderBest();
    btn.textContent = "▶ もう一回";
  }
  function press() {
    if (phase === "run") finish((performance.now() - start) / 1000);
    else { line.style.fontSize = ""; state.style.color = ""; begin(); }
  }
  btn.addEventListener("click", press);
  // BUG #57: Space always plays (prevent the native button click so it does not fire twice)
addEventListener("keydown", (e) => { if (e.code === "Space" && !panels[4].hidden && !typing() && !e.repeat) { e.preventDefault(); press(); } });
btn.addEventListener("keydown", (e) => { if (e.code === "Space") e.preventDefault(); });
  hooks.ma = (on) => { if (!on && phase === "run") { cancelAnimationFrame(raf); phase = "ready"; btn.textContent = "▶ スタート"; state.textContent = "READY"; } };
  qs("#ma-target").textContent = target;
  renderBest();
})();

/* ============ 06 temperature converter ============ */
(() => {
  const input = qs("#temp-input"), loud = qs("#temp-loud"), quiet = qs("#temp-quiet"), presets = qs("#temp-presets");
  const map = { "ア": "ｱ", "イ": "ｲ", "ウ": "ｳ", "エ": "ｴ", "オ": "ｵ", "カ": "ｶ", "キ": "ｷ", "ク": "ｸ", "ケ": "ｹ", "コ": "ｺ", "サ": "ｻ", "シ": "ｼ", "ス": "ｽ", "セ": "ｾ", "ソ": "ｿ", "タ": "ﾀ", "チ": "ﾁ", "ツ": "ﾂ", "テ": "ﾃ", "ト": "ﾄ", "ナ": "ﾅ", "ニ": "ﾆ", "ヌ": "ﾇ", "ネ": "ﾈ", "ノ": "ﾉ", "ハ": "ﾊ", "ヒ": "ﾋ", "フ": "ﾌ", "ヘ": "ﾍ", "ホ": "ﾎ", "マ": "ﾏ", "ミ": "ﾐ", "ム": "ﾑ", "メ": "ﾒ", "モ": "ﾓ", "ヤ": "ﾔ", "ユ": "ﾕ", "ヨ": "ﾖ", "ラ": "ﾗ", "リ": "ﾘ", "ル": "ﾙ", "レ": "ﾚ", "ロ": "ﾛ", "ワ": "ﾜ", "ヲ": "ｦ", "ン": "ﾝ", "ァ": "ｧ", "ィ": "ｨ", "ゥ": "ｩ", "ェ": "ｪ", "ォ": "ｫ", "ャ": "ｬ", "ュ": "ｭ", "ョ": "ｮ", "ッ": "ｯ", "ー": "ｰ", "ガ": "ｶﾞ", "ギ": "ｷﾞ", "グ": "ｸﾞ", "ゲ": "ｹﾞ", "ゴ": "ｺﾞ", "ザ": "ｻﾞ", "ジ": "ｼﾞ", "ズ": "ｽﾞ", "ゼ": "ｾﾞ", "ゾ": "ｿﾞ", "ダ": "ﾀﾞ", "ヂ": "ﾁﾞ", "ヅ": "ﾂﾞ", "デ": "ﾃﾞ", "ド": "ﾄﾞ", "バ": "ﾊﾞ", "ビ": "ﾋﾞ", "ブ": "ﾌﾞ", "ベ": "ﾍﾞ", "ボ": "ﾎﾞ", "パ": "ﾊﾟ", "ピ": "ﾋﾟ", "プ": "ﾌﾟ", "ペ": "ﾍﾟ", "ポ": "ﾎﾟ", "ヴ": "ｳﾞ" };
  // Readings for the kanji used in presets (no dictionary available client-side; other kanji pass through).
  const kanji = { "お祭り男": "おまつりおとこ", "男": "おとこ", "祭": "まつ", "兄": "にい", "距離": "きょり", "良": "よ", "天才": "てんさい", "面白": "おもしろ", "月曜日": "げつようび", "会議": "かいぎ", "締切": "しめきり", "給料日": "きゅうりょうび", "花火": "はなび" };
  const toKata = (s) => s.replace(/[\u3041-\u3096]/g, (c) => String.fromCharCode(c.charCodeAt(0) + 0x60));
  const readings = (s) => Object.keys(kanji).sort((a, b) => b.length - a.length).reduce((acc, k) => acc.split(k).join(kanji[k]), s);
  const toHalf = (s) => Array.from(toKata(readings(s))).map((c) => map[c] || c).join("");
  function render() {
    const raw = input.value.trim() || "お祭り男";
    const base = raw.replace(/[！!。…ォ〜ー]+$/u, "");
    // BUG #61: stretch the last vowel only when it reads as one (ending in o-row kana); otherwise just shout
    const last = toKata(readings(base)).slice(-1);
    const oRow = /[オコソトノホモヨロヲゴゾドボポョォ]/u.test(last);
    loud.textContent = base + (oRow ? "ォ！" : last && /[\u30A0-\u30FF\u3040-\u309F]/u.test(last) ? "ー！" : "！");
    quiet.textContent = toHalf(base) + "ｶ…";
    if (!reduced) { gsap.fromTo(loud, { scale: 1.08 }, { scale: 1, duration: .6, ease: "elastic.out(1,.4)" }); gsap.fromTo(quiet, { opacity: 0, x: 20 }, { opacity: .85, x: 0, duration: 1.2, delay: .5, ease: "expo.out" }); }
  }
  ["お祭り男", "給料日", "月曜日", "締切", "天才", "花火"].forEach((p) => presets.append(h("button", { type: "button", onclick: () => { input.value = p; render(); } }, p)));
  let deb; input.addEventListener("input", () => { clearTimeout(deb); deb = setTimeout(render, 180); });
  qs("#temp-copy").addEventListener("click", async () => { try { await navigator.clipboard.writeText(`${loud.textContent}\n\n${quiet.textContent}`); toast("コピーしました"); } catch { toast("コピーできませんでした"); } });
  render();
})();

activate(location.hash.slice(1) || "reel");
magnetic();
if (!coarse) document.body.classList.add("has-hover");
