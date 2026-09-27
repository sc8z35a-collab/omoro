const detailMoments = window.OMORO_MOMENTS;
const detailMoment = detailMoments.find((item) => item.slug === document.body.dataset.slug);
const detailStorageKey = "omoro-saved-v1";
const beatTabs = Array.from(document.querySelectorAll(".beat-tab"));
const beatCounter = document.getElementById("beat-counter");
const beatRole = document.getElementById("beat-role");
const beatTitle = document.getElementById("beat-title");
const beatBody = document.getElementById("beat-body");
const autoButton = document.querySelector(".beat-autoplay");
const saveButton = document.querySelector(".save-button");
const copyButton = document.querySelector(".copy-button");
const feedback = document.querySelector(".action-feedback");
let beatIndex = 0;
let playTimer = null;

function readSaved() {
  try {
    const saved = JSON.parse(localStorage.getItem(detailStorageKey) || "[]");
    return Array.isArray(saved) ? saved : [];
  } catch { return []; }
}

function refreshSaveButton() {
  const saved = readSaved().includes(detailMoment.slug);
  saveButton.setAttribute("aria-pressed", String(saved));
  saveButton.textContent = saved ? "★ 保存済み" : "☆ あとで見る";
}

function stopPlayback() {
  if (playTimer !== null) clearTimeout(playTimer);
  playTimer = null;
  autoButton.setAttribute("aria-pressed", "false");
  autoButton.textContent = "▶ 文字で順に見る";
}

function showBeat(index) {
  beatIndex = index;
  const beat = detailMoment.beats[index];
  beatCounter.textContent = String(index + 1).padStart(2, "0");
  beatRole.textContent = beat.label;
  beatTitle.textContent = beat.title;
  beatBody.textContent = beat.body;
  beatTabs.forEach((tab, tabIndex) => {
    tab.classList.toggle("is-active", tabIndex === index);
    if (tabIndex === index) tab.setAttribute("aria-current", "step");
    else tab.removeAttribute("aria-current");
  });
}

function scheduleNext() {
  if (beatIndex === detailMoment.beats.length - 1) {
    playTimer = setTimeout(stopPlayback, 2400);
    return;
  }
  playTimer = setTimeout(() => {
    showBeat(beatIndex + 1);
    scheduleNext();
  }, 2400);
}

beatTabs.forEach((tab, index) => tab.addEventListener("click", () => {
  stopPlayback();
  showBeat(index);
}));
autoButton.addEventListener("click", () => {
  if (playTimer !== null) { stopPlayback(); return; }
  showBeat(0);
  autoButton.setAttribute("aria-pressed", "true");
  autoButton.textContent = "■ 止める";
  scheduleNext();
});
document.addEventListener("visibilitychange", () => { if (document.hidden) stopPlayback(); });

saveButton.addEventListener("click", () => {
  const saved = readSaved();
  const updated = saved.includes(detailMoment.slug) ? saved.filter((slug) => slug !== detailMoment.slug) : [...saved, detailMoment.slug];
  try {
    localStorage.setItem(detailStorageKey, JSON.stringify(updated));
    refreshSaveButton();
    feedback.textContent = updated.includes(detailMoment.slug) ? "あとで見るに保存しました。" : "保存を解除しました。";
  } catch { feedback.textContent = "このブラウザでは保存できませんでした。"; }
});
copyButton.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(new URL(location.pathname, location.origin).href);
    feedback.textContent = "このページのリンクをコピーしました。";
  } catch { feedback.textContent = "コピーできませんでした。ページのURLを使ってください。"; }
});

refreshSaveButton();
