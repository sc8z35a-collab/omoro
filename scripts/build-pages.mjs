import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const moments = JSON.parse(readFileSync(resolve(root, "data/moments.json"), "utf8"));
const dist = resolve(root, "dist");
const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
const lineBreaks = (lines) => lines.map(escapeHtml).join("<br />");
const route = (moment) => `/moments/${moment.slug}/`;
const favicon = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='15' fill='%23111315'/%3E%3Cpath d='M11 15h42v34H11z' fill='none' stroke='%23d8ff4f' stroke-width='4'/%3E%3Cpath d='M17 38h12V25h6v13h12' fill='none' stroke='%23d8ff4f' stroke-width='5' stroke-linecap='square'/%3E%3C/svg%3E";

writeFileSync(resolve(dist, "moments-data.js"), `window.OMORO_MOMENTS = ${JSON.stringify(moments)};\n`);

moments.forEach((moment, index) => {
  const previous = moments[(index - 1 + moments.length) % moments.length];
  const next = moments[(index + 1) % moments.length];
  const beatButtons = moment.beats.map((beat, beatIndex) => `<button type="button" class="beat-tab${beatIndex === 0 ? " is-active" : ""}" data-beat="${beatIndex}" aria-current="${beatIndex === 0 ? "step" : "false"}"><span>0${beatIndex + 1}</span>${escapeHtml(beat.label)}</button>`).join("");
  const insights = moment.insights.map((item, insightIndex) => `<article class="detail-insight"><span class="insight-number">0${insightIndex + 1} / ${escapeHtml(item.label)}</span><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.body)}</p></article>`).join("");
  const sequence = moments.map((item) => `<a class="sequence-item${item.slug === moment.slug ? " is-current" : ""}" href="${route(item)}" ${item.slug === moment.slug ? 'aria-current="page"' : ""}><span>${item.number}</span><strong>${escapeHtml(item.title)}</strong></a>`).join("");
  const html = `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="theme-color" content="#111315" />
  <meta name="description" content="OMOROの名場面 ${escapeHtml(moment.number)}。${escapeHtml(moment.title)} — ${escapeHtml(moment.lead)}" />
  <title>${escapeHtml(moment.title)} | OMORO</title>
  <link rel="icon" type="image/svg+xml" href="${favicon}" />
  <link rel="stylesheet" href="../../styles.css" />
  <link rel="stylesheet" href="../../detail.css" />
  <script defer src="../../moments-data.js"></script>
  <script defer src="../../detail.js"></script>
</head>
<body class="detail-page" data-slug="${escapeHtml(moment.slug)}" style="--scene-accent: ${escapeHtml(moment.accent)}">
  <a class="skip-link" href="#story">本文へ</a>
  <div class="page-shell">
    <header class="site-header detail-header"><a class="brand" href="/" aria-label="OMORO トップへ"><span class="brand-symbol" aria-hidden="true"><span></span><span></span></span><span>OMORO<span class="brand-period">.</span></span></a><div class="header-right"><span class="header-edition">THE DAUSO FILE / ${escapeHtml(moment.number)}</span><a class="header-link" href="/lab/">OMORO LAB <span aria-hidden="true">↗</span></a></div></header>
    <main>
      <section class="detail-hero" aria-labelledby="detail-title">
        <div class="detail-crumb"><a href="/">OMORO</a><span>/</span><a href="/#moments">MOMENTS</a><span>/</span><strong>${escapeHtml(moment.number)}</strong></div>
        <div class="detail-hero-grid"><div class="detail-hero-main"><div class="detail-eyebrow"><span class="detail-dot"></span> MOMENT ${escapeHtml(moment.number)} / 06 <span class="detail-divider">—</span> ${escapeHtml(moment.speaker)}</div><h1 id="detail-title" class="detail-quote${index === 5 ? " detail-quote-long" : ""}">${lineBreaks(moment.lines)}</h1><p class="detail-lead">${escapeHtml(moment.lead)}</p><div class="detail-actions"><a class="primary-action" href="#story">前後を追う <span aria-hidden="true">↓</span></a><button type="button" class="detail-button save-button" aria-pressed="false">☆ あとで見る</button><button type="button" class="detail-button copy-button">↗ リンクをコピー</button><a class="detail-button" href="/lab/?moment=${escapeHtml(moment.slug)}#card">カードにする ↗</a></div><p class="action-feedback" role="status" aria-live="polite"></p></div><div class="detail-hero-aside"><span class="aside-word">OMORO / ${escapeHtml(moment.number)}</span><div class="aside-number" aria-hidden="true">${escapeHtml(moment.number)}</div><p><span>この場面</span>${escapeHtml(moment.context)}</p></div></div>
        <div class="detail-hero-bottom"><span>文字と解説でたどる、あの一瞬。</span><span>SCROLL ↓</span></div>
      </section>

      <section class="beat-section" id="story" aria-labelledby="beat-heading"><div class="detail-section-top"><span>01 / THE BEATS</span><span>3つの場面</span></div><div class="beat-heading"><h2 id="beat-heading">この一言の、<br />前と後。</h2><p>順にタップして、流れを追えます。</p></div><div class="beat-layout"><div class="beat-tabs" role="group" aria-label="場面を選択">${beatButtons}</div><div class="beat-screen" aria-live="polite" aria-atomic="true"><span class="beat-screen-label">BEAT <span id="beat-counter">01</span> / 03</span><div class="beat-screen-content"><span id="beat-role">${escapeHtml(moment.beats[0].label)}</span><h3 id="beat-title">${escapeHtml(moment.beats[0].title)}</h3><p id="beat-body">${escapeHtml(moment.beats[0].body)}</p></div><div class="beat-screen-footer"><button class="beat-autoplay" type="button" aria-pressed="false">▶ 文字で順に見る</button><span>映像・音声はありません</span></div></div></div></section>

      <section class="detail-analysis" aria-labelledby="analysis-heading"><div class="detail-section-top"><span>02 / THE POINT</span><span>OMORO NOTES</span></div><div class="analysis-heading"><span class="analysis-spark" aria-hidden="true">✳</span><h2 id="analysis-heading">ここが、<br />おもろい。</h2></div><div class="insight-grid">${insights}</div></section>

      <section class="sequence-section" aria-labelledby="sequence-heading"><div class="detail-section-top"><span>03 / THE FULL SET</span><span>6 SCENES</span></div><h2 id="sequence-heading">他のセリフも追う。</h2><div class="sequence-grid">${sequence}</div><div class="detail-neighbors"><a href="${route(previous)}"><span>← 前のセリフ</span><strong>${escapeHtml(previous.title)}</strong></a><a href="${route(next)}"><span>次のセリフ →</span><strong>${escapeHtml(next.title)}</strong></a></div></section>
    </main>
    <footer class="detail-footer"><div><a href="/" class="footer-brand">OMORO<span>.</span></a><p>非公式ファンサイト。番組・出演者とは関係ありません。<br />セリフは短い抜粋、前後は要約と解説です。映像・音声は掲載していません。</p></div><div class="detail-source"><span>ABOUT THE EPISODE</span><a href="https://www.tbs.co.jp/suiyobinodowntown/" target="_blank" rel="noopener noreferrer">番組公式サイト ↗</a><a href="https://natalie.mu/owarai/news/202469" target="_blank" rel="noopener noreferrer">2016年の放送記事 ↗</a></div></footer>
  </div>
</body>
</html>
`;
  const directory = resolve(dist, "moments", moment.slug);
  mkdirSync(directory, { recursive: true });
  writeFileSync(resolve(directory, "index.html"), html);
});

console.log(`Built ${moments.length} OMORO detail pages.`);
