const labMoments = window.OMORO_MOMENTS;
const tabNames = ["reel", "quiz", "card"];
const tabs = tabNames.map((name) => document.getElementById("tab-" + name));
const panels = tabNames.map((name) => document.getElementById(name));

function activateTab(name, focus = false) {
  const active = tabNames.includes(name) ? name : "reel";
  tabs.forEach((tab, index) => {
    const selected = tabNames[index] === active;
    tab.setAttribute("aria-selected", String(selected));
    tab.tabIndex = selected ? 0 : -1;
    panels[index].hidden = !selected;
    if (selected && focus) tab.focus();
  });
  if (active !== "reel") stopReel();
  history.replaceState(null, "", location.pathname + location.search + "#" + active);
}
tabs.forEach((tab, index) => {
  tab.addEventListener("click", () => activateTab(tabNames[index]));
  tab.addEventListener("keydown", (event) => {
    if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
    event.preventDefault();
    const next = (index + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length;
    activateTab(tabNames[next], true);
  });
});
window.addEventListener("hashchange", () => activateTab(location.hash.slice(1)));

// A text-only reel. The six cards are an editorial selection, not a transcript.
const reelStage = document.getElementById("reel-stage");
const reelNumber = document.getElementById("reel-number");
const reelSpeaker = document.getElementById("reel-speaker");
const reelQuote = document.getElementById("reel-quote");
const reelShort = document.getElementById("reel-short");
const reelDetail = document.getElementById("reel-detail");
const reelCount = document.getElementById("reel-count");
const reelDots = document.getElementById("reel-dots");
const reelPlay = document.getElementById("reel-play");
const reelSpeed = document.getElementById("reel-speed");
let reelIndex = 0;
let reelTimer = null;

function showReel(index) {
  reelIndex = (index + labMoments.length) % labMoments.length;
  const moment = labMoments[reelIndex];
  reelStage.style.setProperty("--reel-accent", moment.accent);
  reelNumber.textContent = moment.number;
  reelSpeaker.textContent = moment.speaker;
  reelQuote.replaceChildren();
  moment.lines.forEach((line, lineIndex) => {
    if (lineIndex) reelQuote.append(document.createElement("br"));
    reelQuote.append(document.createTextNode(line));
  });
  reelQuote.classList.toggle("is-long", reelIndex === 5);
  reelShort.textContent = moment.short;
  reelDetail.href = "/moments/" + moment.slug + "/";
  reelCount.textContent = (reelIndex + 1) + " / " + labMoments.length;
  Array.from(reelDots.children).forEach((button, buttonIndex) => {
    button.classList.toggle("is-current", buttonIndex === reelIndex);
    if (buttonIndex === reelIndex) button.setAttribute("aria-current", "true");
    else button.removeAttribute("aria-current");
  });
}

function stopReel() {
  if (reelTimer !== null) clearInterval(reelTimer);
  reelTimer = null;
  reelPlay.setAttribute("aria-pressed", "false");
  reelPlay.textContent = "▶ 自動で送る";
}
function startReel() {
  stopReel();
  reelTimer = setInterval(() => showReel(reelIndex + 1), Number(reelSpeed.value));
  reelPlay.setAttribute("aria-pressed", "true");
  reelPlay.textContent = "■ 一時停止";
}
labMoments.forEach((moment, index) => {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = moment.number;
  button.setAttribute("aria-label", moment.number + " " + moment.title);
  button.addEventListener("click", () => showReel(index));
  reelDots.append(button);
});
document.getElementById("reel-prev").addEventListener("click", () => showReel(reelIndex - 1));
document.getElementById("reel-next").addEventListener("click", () => showReel(reelIndex + 1));
reelPlay.addEventListener("click", () => reelTimer === null ? startReel() : stopReel());
reelSpeed.addEventListener("change", () => { if (reelTimer !== null) startReel(); });
document.addEventListener("visibilitychange", () => { if (document.hidden) stopReel(); });
showReel(0);

// The speaker quiz runs wholly in the browser and keeps no personal record.
const speakers = ["松本等しい", "デコピン浜ちゃん", "宮川大好", "近藤春菜のものまね芸人"];
const quizNumber = document.getElementById("quiz-number");
const quizQuote = document.getElementById("quiz-quote");
const quizOptions = document.getElementById("quiz-options");
const quizFeedback = document.getElementById("quiz-feedback");
const quizNext = document.getElementById("quiz-next");
const quizScore = document.getElementById("quiz-score");
const quizProgress = document.getElementById("quiz-progress");
let quizOrder = [];
let questionIndex = 0;
let score = 0;
let answered = false;
let quizFinished = false;

function shuffle(items) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
function correctSpeaker(moment) { return moment.speaker.split(" → ")[0]; }
function renderQuestion() {
  const moment = quizOrder[questionIndex];
  answered = false;
  quizNumber.textContent = String(questionIndex + 1).padStart(2, "0");
  quizQuote.textContent = moment.title;
  quizFeedback.replaceChildren();
  quizOptions.replaceChildren();
  quizNext.disabled = true;
  quizNext.textContent = questionIndex === quizOrder.length - 1 ? "結果を見る →" : "次の問題 →";
  quizProgress.textContent = Array.from({ length: 6 }, (_, index) => index <= questionIndex ? "●" : "○").join(" ");
  for (const speaker of shuffle(speakers)) {
    const option = document.createElement("button");
    option.type = "button";
    option.textContent = speaker;
    option.addEventListener("click", () => answer(speaker));
    quizOptions.append(option);
  }
}
function answer(selected) {
  if (answered || quizFinished) return;
  answered = true;
  const moment = quizOrder[questionIndex];
  const correct = correctSpeaker(moment);
  if (selected === correct) score++;
  quizScore.textContent = String(score);
  Array.from(quizOptions.children).forEach((button) => {
    button.disabled = true;
    if (button.textContent === correct) button.classList.add("is-correct");
    else if (button.textContent === selected) button.classList.add("is-wrong");
  });
  const result = document.createElement("strong");
  result.textContent = selected === correct ? "正解！" : "正解は「" + correct + "」。";
  const explanation = document.createElement("span");
  explanation.textContent = moment.point;
  quizFeedback.append(result, explanation);
  quizNext.disabled = false;
}
function finishQuiz() {
  quizFinished = true;
  quizNumber.textContent = "06";
  quizQuote.textContent = score + " / 6 正解";
  quizOptions.replaceChildren();
  quizFeedback.replaceChildren();
  const message = document.createElement("p");
  message.textContent = score === 6 ? "全問正解。あの間まで覚えている？" : "もう一回で、もっと覚えてしまうかも。";
  quizFeedback.append(message);
  quizNext.disabled = false;
  quizNext.textContent = "もう一度遊ぶ ↗";
}
function resetQuiz() {
  quizOrder = shuffle(labMoments);
  questionIndex = 0;
  score = 0;
  answered = false;
  quizFinished = false;
  quizScore.textContent = "0";
  renderQuestion();
}
quizNext.addEventListener("click", () => {
  if (quizFinished) { resetQuiz(); return; }
  if (!answered) return;
  if (questionIndex === quizOrder.length - 1) finishQuiz();
  else { questionIndex++; renderQuestion(); }
});
document.getElementById("quiz-restart").addEventListener("click", resetQuiz);
resetQuiz();

// Canvas card maker: no upload, no external image assets, no remote service.
const cardMoment = document.getElementById("card-moment");
const cardNote = document.getElementById("card-note");
const canvas = document.getElementById("quote-canvas");
const cardDimensions = document.getElementById("card-dimensions");
const cardStatus = document.getElementById("card-status");
const themes = {
  night: { background: "#111315", text: "#eceee6", line: "#5b6358" },
  acid: { background: "#d8ff4f", text: "#111315", line: "#515c27" },
  paper: { background: "#e8eae2", text: "#111315", line: "#858c80" }
};
labMoments.forEach((moment) => {
  const option = document.createElement("option");
  option.value = moment.slug;
  option.textContent = moment.number + "  " + moment.title;
  cardMoment.append(option);
});
const requestedSlug = new URLSearchParams(location.search).get("moment");
if (labMoments.some((moment) => moment.slug === requestedSlug)) cardMoment.value = requestedSlug;

function selectedRadio(name) { return document.querySelector('input[name="' + name + '"]:checked').value; }
function drawCard() {
  const moment = labMoments.find((item) => item.slug === cardMoment.value) || labMoments[0];
  const layout = selectedRadio("card-size");
  const colors = themes[selectedRadio("card-theme")];
  const landscape = layout === "landscape";
  const width = landscape ? 1200 : 1080;
  const height = landscape ? 630 : 1080;
  canvas.width = width;
  canvas.height = height;
  cardDimensions.textContent = width + " × " + height;
  canvas.setAttribute("aria-label", moment.title + "の画像カードのプレビュー");
  const ctx = canvas.getContext("2d");
  if (!ctx) { cardStatus.textContent = "このブラウザでは画像を作成できません。"; return; }
  ctx.fillStyle = colors.background;
  ctx.fillRect(0, 0, width, height);
  const margin = landscape ? 75 : 86;
  ctx.fillStyle = selectedRadio("card-theme") === "night" ? moment.accent : colors.text;
  ctx.fillRect(margin, margin, 56, 8);
  ctx.fillStyle = colors.text;
  ctx.textBaseline = "alphabetic";
  ctx.font = '900 54px Arial, sans-serif';
  ctx.fillText("OMORO.", margin, margin + 78);
  ctx.font = '700 23px Arial, sans-serif';
  ctx.textAlign = "right";
  ctx.fillText("THE DAUSO FILE / " + moment.number, width - margin, margin + 72);
  ctx.textAlign = "left";
  ctx.strokeStyle = colors.line;
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(margin, margin + 108); ctx.lineTo(width - margin, margin + 108); ctx.stroke();

  const maxWidth = width - margin * 2;
  let fontSize = landscape ? 115 : 132;
  const family = '"Hiragino Sans", "Yu Gothic", Meiryo, sans-serif';
  do {
    ctx.font = "900 " + fontSize + "px " + family;
    if (Math.max(...moment.lines.map((line) => ctx.measureText(line).width)) <= maxWidth) break;
    fontSize -= 2;
  } while (fontSize > 72);
  const start = landscape ? 270 : 475;
  const lineHeight = fontSize * 1.31;
  moment.lines.forEach((line, index) => ctx.fillText(line, margin, start + lineHeight * index));
  const afterQuote = start + lineHeight * (moment.lines.length - 1);
  ctx.fillStyle = selectedRadio("card-theme") === "night" ? moment.accent : colors.text;
  ctx.font = '800 27px "Yu Gothic", Meiryo, sans-serif';
  ctx.fillText(moment.short, margin, afterQuote + (landscape ? 42 : 80));

  const note = cardNote.value.trim();
  if (note) {
    ctx.fillStyle = colors.text;
    ctx.font = '600 ' + (landscape ? 28 : 32) + 'px "Yu Gothic", Meiryo, sans-serif';
    ctx.fillText(note, margin, height - (landscape ? 120 : 150), maxWidth);
  }
  ctx.strokeStyle = colors.line;
  ctx.beginPath(); ctx.moveTo(margin, height - 92); ctx.lineTo(width - margin, height - 92); ctx.stroke();
  ctx.fillStyle = colors.text;
  ctx.font = '700 22px Arial, sans-serif';
  ctx.fillText("OMORO / NON-OFFICIAL FAN ARCHIVE", margin, height - 51);
  ctx.textAlign = "right";
  ctx.fillText(moment.number + " / 06", width - margin, height - 51);
  ctx.textAlign = "left";
}

cardMoment.addEventListener("change", drawCard);
cardNote.addEventListener("input", drawCard);
document.querySelectorAll('input[name="card-theme"], input[name="card-size"]').forEach((input) => input.addEventListener("change", drawCard));
document.getElementById("card-download").addEventListener("click", () => {
  try {
    drawCard();
    const link = document.createElement("a");
    link.href = canvas.toDataURL("image/png");
    link.download = "omoro-" + cardMoment.value + "-" + selectedRadio("card-size") + ".png";
    link.click();
    cardStatus.textContent = "PNGを保存しました。";
  } catch { cardStatus.textContent = "画像を保存できませんでした。別のブラウザでお試しください。"; }
});
drawCard();
activateTab(location.hash.slice(1));
