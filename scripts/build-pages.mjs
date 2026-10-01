// Generates site/moments/<slug>/index.html from data/moments.json (Vite then builds them).
import { readFileSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const moments = JSON.parse(readFileSync(resolve(root, "data/moments.json"), "utf8"));
const out = resolve(root, "site/moments");
const esc = (v) => String(v).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const br = (lines) => lines.map(esc).join("<br />");
const link = (m) => `{{base}}moments/${m.slug}/`;

rmSync(out, { recursive: true, force: true });

// Deterministic "voice print": bar heights from volume, a silent stretch whose width is the gap (間).
function wave(m, bars = 72) {
  let seed = [...m.slug].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
  const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  const gapBars = Math.max(2, Math.round((m.gap / 3) * bars * .45));
  const speakAt = Math.round(bars * .38);
  let out = "";
  for (let i = 0; i < bars; i++) {
    const inGap = i >= speakAt - gapBars && i < speakAt;
    const env = Math.sin(Math.PI * Math.min(1, ((i % 24) + 1) / 24));
    const loud = i >= speakAt && i < speakAt + 16 ? m.volume / 100 : .32;
    const hgt = inGap ? 2 : Math.max(3, Math.round((18 + rnd() * 82) * env * (.35 + loud * .9)));
    out += `<i class="${inGap ? "is-gap" : i >= speakAt && i < speakAt + 16 ? "is-key" : ""}" style="--h:${Math.min(100, hgt)}%;--i:${i}"></i>`;
  }
  return { html: out, gapStart: (speakAt - gapBars) / bars, gapEnd: speakAt / bars };
}

moments.forEach((m, i) => {
  const prev = moments[(i - 1 + moments.length) % moments.length];
  const next = moments[(i + 1) % moments.length];
  const long = m.lines.join("").length > 10;
  const w = wave(m);
  const beats = m.beats.map((b, k) => `
          <article class="beat" data-beat="${k}">
            <span class="beat-index mono"><b>0${k + 1}</b><span>BEAT 0${k + 1} / 03 — ${esc(b.label)}</span></span>
            <h3 class="beat-title${k === 1 ? " is-key" : ""}">${esc(b.title)}</h3>
            <p class="beat-body">${esc(b.body)}</p>
          </article>`).join("");
  const insights = m.insights.map((it, k) => `
          <article class="insight" data-reveal data-delay="${k * 0.1}">
            <div class="insight-in" data-tilt>
              <div class="insight-foil" aria-hidden="true"></div>
              <div class="insight-glare" aria-hidden="true"></div>
              <span class="mono insight-label"><b>0${k + 1}</b> / ${esc(it.label)}</span>
              <div class="insight-glyph" aria-hidden="true"><span>${k ? "↘" : "↗"}</span><i>${esc(m.glyph)}</i></div>
              <h3>${esc(it.title)}</h3>
              <p>${esc(it.body)}</p>
              <span class="insight-corner mono" aria-hidden="true">OMORO NOTES — ${m.number}.${k + 1}</span>
            </div>
          </article>`).join("");
  const others = moments.map((o) => `<a class="seq${o.slug === m.slug ? " is-current" : ""}" href="${link(o)}" style="--c:${o.accent}"${o.slug === m.slug ? ' aria-current="page"' : ""}><img src="{{base}}img/${o.image}-sm.webp" alt="" loading="lazy" /><span class="mono">${o.number}</span><strong>${esc(o.title)}</strong></a>`).join("");
  const html = `<!doctype html>
<html lang="ja" class="no-js">
  <head>
    <!--#include head -->
    <title>${esc(m.title)} | OMORO</title>
    <meta name="description" content="OMOROの名場面 ${m.number}。${esc(m.title)} — ${esc(m.lead)}" />
    <meta property="og:title" content="${esc(m.title)} | OMORO" />
    <meta property="og:description" content="${esc(m.lead)}" />
    <script type="module" src="/src/js/pages/detail.js"></script>
  </head>
  <body class="page-detail" data-slug="${m.slug}" style="--accent:${m.accent}">
    <!--#include chrome -->
    <main id="main">
      <section class="d-hero" aria-labelledby="d-title">
        <canvas class="d-canvas" aria-hidden="true" data-cursor="RIPPLE"></canvas>
        <img class="d-hero-img" src="{{base}}img/${m.image}.webp" alt="" fetchpriority="high" />
        <div class="d-hero-shade" aria-hidden="true"></div>
        <div class="d-hero-hint mono" aria-hidden="true"><i></i>DRAG TO STIR THE INK</div>
        <div class="d-scrollcue mono" aria-hidden="true"><span>SCROLL</span><i></i></div>
        <div class="d-hero-ui">
          <nav class="d-crumb mono" aria-label="パンくず"><a href="{{base}}">OMORO</a><span>/</span><a href="{{base}}#archive">MOMENTS</a><span>/</span><strong>${m.number}</strong></nav>
          <div class="d-ghost latin" aria-hidden="true">${m.number}</div>
          <div class="d-hero-main">
            <span class="eyebrow">MOMENT ${m.number} / 06 — ${esc(m.speaker)}</span>
            <h1 id="d-title" class="d-quote${long ? " is-long" : ""}" data-hero-quote>${br(m.lines)}</h1>
            <p class="d-en latin" aria-hidden="true">“${esc(m.en)}”</p>
            <p class="d-lead">${esc(m.lead)}</p>
            <div class="d-actions">
              <a class="btn btn-primary" href="#story">前後を追う <span class="btn-arrow">↓</span></a>
              <button type="button" class="btn btn-ghost d-save" aria-pressed="false">☆ あとで見る</button>
              <button type="button" class="btn btn-ghost d-share">↗ シェア</button>
              <a class="btn btn-ghost" href="{{base}}lab/?moment=${m.slug}#card">カードにする <span class="btn-arrow">↗</span></a>
            </div>
          </div>
          <aside class="d-aside">
            <span class="mono">この場面</span>
            <p>${esc(m.context)}</p>
            <div class="d-meters">
              <div><span class="mono">VOLUME</span><i style="--v:${m.volume}%"></i><b class="mono">${m.volume}</b></div>
              <div><span class="mono">MA / 間</span><i style="--v:${Math.min(100, Math.round(m.gap / 3 * 100))}%"></i><b class="mono">${m.gap}s</b></div>
            </div>
            <div class="d-tags">${m.tags.map((t) => `<span>#${esc(t)}</span>`).join("")}</div>
          </aside>
        </div>
      </section>

      <div class="marquee" data-speed="50" aria-hidden="true"><div class="marquee-track">${Array.from({ length: 4 }, () => `<span class="marquee-item">${esc(m.title)}<i>✳</i></span><span class="marquee-item is-outline">${esc(m.en)}<i>✳</i></span>`).join("")}</div></div>

      <section class="d-beats" id="story" aria-labelledby="beats-heading">
        <div class="d-beats-pin">
          <div class="d-beats-side">
            <span class="eyebrow">01 / THE BEATS</span>
            <h2 id="beats-heading" class="section-title">この一言の、<br />前と後。</h2>
            <div class="d-beat-dots" aria-hidden="true"><i class="is-on"></i><i></i><i></i></div>
            <figure class="d-wave" aria-label="声量 ${m.volume} と間 ${m.gap} 秒のイメージ図" style="--gs:${(w.gapStart * 100).toFixed(2)}%;--ge:${(w.gapEnd * 100).toFixed(2)}%">
              <div class="d-wave-bars" aria-hidden="true">${w.html}</div>
              <span class="d-wave-gap mono" aria-hidden="true">間 ${m.gap}s</span>
              <figcaption class="mono"><span>VOICE PRINT</span><span>VOL ${m.volume}</span></figcaption>
            </figure>
            <p class="mono d-beat-note">スクロールで流れを追えます。映像・音声はありません（波形はイメージ）。</p>
            <div class="d-beats-glyph display" aria-hidden="true">${esc(m.glyph)}</div>
          </div>
          <div class="d-beats-list">${beats}
          </div>
        </div>
      </section>

      <section class="section d-insights" aria-labelledby="point-heading">
        <div class="section-top"><span>02 / THE POINT</span><span>OMORO NOTES</span></div>
        <h2 id="point-heading" class="section-title" data-split>ここが、<br />おもろい。</h2>
        <div class="insight-grid">${insights}
        </div>
      </section>

      <section class="section d-react" aria-labelledby="react-heading">
        <div class="d-react-box" data-reveal>
          <div><span class="eyebrow">03 / YOUR REACTION</span><h2 id="react-heading" class="section-title">どうだった？</h2><p class="section-lead">押した数はこの端末にだけ残ります。</p></div>
          <div class="d-react-btns" role="group" aria-label="反応する">
            <button type="button" data-react="lol"><span aria-hidden="true">🤣</span>笑った<b aria-live="polite">0</b><em class="d-react-ring" aria-hidden="true"></em></button>
            <button type="button" data-react="ma"><span aria-hidden="true">……</span>間が好き<b aria-live="polite">0</b><em class="d-react-ring" aria-hidden="true"></em></button>
            <button type="button" data-react="wow"><span aria-hidden="true">✳</span>天才<b aria-live="polite">0</b><em class="d-react-ring" aria-hidden="true"></em></button>
          </div>
        </div>
      </section>

      <section class="section d-seq" aria-labelledby="seq-heading">
        <div class="section-top"><span>04 / THE FULL SET</span><span>6 SCENES</span></div>
        <h2 id="seq-heading" class="section-title" data-split>他のセリフも追う。</h2>
        <div class="seq-grid">${others}</div>
        <div class="d-neighbors">
          <a href="${link(prev)}" style="--c:${prev.accent}" data-cursor="PREV"><img src="{{base}}img/${prev.image}-sm.webp" alt="" loading="lazy" /><span class="mono">← 前のセリフ / ${prev.number}</span><strong>${esc(prev.title)}</strong><i class="nb-wipe" aria-hidden="true"></i></a>
          <a href="${link(next)}" style="--c:${next.accent}" data-cursor="NEXT"><img src="{{base}}img/${next.image}-sm.webp" alt="" loading="lazy" /><span class="mono">次のセリフ / ${next.number} →</span><strong>${esc(next.title)}</strong><i class="nb-wipe" aria-hidden="true"></i></a>
        </div>
      </section>
    </main>
    <!--#include footer -->
  </body>
</html>
`;
  const dir = resolve(out, m.slug);
  mkdirSync(dir, { recursive: true });
  writeFileSync(resolve(dir, "index.html"), html);
});
console.log(`Built ${moments.length} OMORO detail pages.`);
