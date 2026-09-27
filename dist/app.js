const moments = window.OMORO_MOMENTS;
const storageKey = "omoro-saved-v1";
const buttons = Array.from(document.querySelectorAll(".moment-item"));
const stage = document.getElementById("stage");
const indexEl = document.getElementById("stage-index");
const personEl = document.getElementById("stage-person");
const quoteEl = document.getElementById("stage-quote");
const contextEl = document.getElementById("stage-context");
const tagEl = document.getElementById("stage-tag");
const detailLink = document.getElementById("detail-link");
const saveButton = document.getElementById("stage-save");
const copyButton = document.getElementById("stage-copy");
const feedback = document.getElementById("stage-feedback");
const savedList = document.getElementById("saved-list");
const searchInput = document.getElementById("scene-search");
const searchStatus = document.getElementById("search-status");
const searchEmpty = document.getElementById("search-empty");
const directoryCards = Array.from(document.querySelectorAll(".directory-grid a"));
let current = 0;

function readSaved() {
  try {
    const value = JSON.parse(localStorage.getItem(storageKey) || "[]");
    return Array.isArray(value) ? value.filter((slug) => moments.some((moment) => moment.slug === slug)) : [];
  } catch { return []; }
}

function writeSaved(saved) {
  try { localStorage.setItem(storageKey, JSON.stringify(saved)); return true; }
  catch { feedback.textContent = "このブラウザでは保存できませんでした。"; return false; }
}

function updateSaveButton() {
  const selected = readSaved().includes(moments[current].slug);
  saveButton.setAttribute("aria-pressed", String(selected));
  saveButton.textContent = selected ? "★ 保存済み" : "☆ 保存";
}

function renderSaved() {
  savedList.replaceChildren();
  const saved = readSaved();
  if (!saved.length) {
    const empty = document.createElement("p");
    empty.className = "saved-empty";
    empty.textContent = "まだ保存したセリフはありません。気になる場面の「☆ 保存」を押してみてください。";
    savedList.append(empty);
    return;
  }
  for (const moment of moments.filter((item) => saved.includes(item.slug))) {
    const link = document.createElement("a");
    link.href = "/moments/" + moment.slug + "/";
    link.style.setProperty("--card-accent", moment.accent);
    const number = document.createElement("span");
    number.textContent = moment.number;
    const title = document.createElement("strong");
    title.textContent = moment.title;
    const arrow = document.createElement("span");
    arrow.textContent = "↗";
    link.append(number, title, arrow);
    savedList.append(link);
  }
}

function showMoment(index) {
  current = (index + moments.length) % moments.length;
  const moment = moments[current];
  indexEl.textContent = moment.number;
  personEl.textContent = moment.speaker;
  quoteEl.replaceChildren();
  moment.lines.forEach((line, lineIndex) => {
    if (lineIndex) quoteEl.append(document.createElement("br"));
    quoteEl.append(document.createTextNode(line));
  });
  quoteEl.classList.toggle("is-compact", current === 5);
  contextEl.textContent = moment.context;
  tagEl.textContent = "POINT / " + moment.point;
  detailLink.href = "/moments/" + moment.slug + "/";
  stage.style.setProperty("--scene-accent", moment.accent);
  feedback.textContent = "";
  updateSaveButton();
  buttons.forEach((button, buttonIndex) => {
    const selected = buttonIndex === current;
    button.classList.toggle("is-active", selected);
    if (selected) button.setAttribute("aria-current", "true");
    else button.removeAttribute("aria-current");
  });
  stage.classList.remove("stage-enter");
  void stage.offsetWidth;
  stage.classList.add("stage-enter");
}

buttons.forEach((button, index) => button.addEventListener("click", () => showMoment(index)));
document.getElementById("previous").addEventListener("click", () => showMoment(current - 1));
document.getElementById("next").addEventListener("click", () => showMoment(current + 1));
saveButton.addEventListener("click", () => {
  const saved = readSaved();
  const slug = moments[current].slug;
  const updated = saved.includes(slug) ? saved.filter((item) => item !== slug) : [...saved, slug];
  if (writeSaved(updated)) {
    updateSaveButton();
    renderSaved();
    feedback.textContent = updated.includes(slug) ? "あとで見るに保存しました。" : "保存を解除しました。";
  }
});
copyButton.addEventListener("click", async () => {
  try {
    const url = new URL(detailLink.getAttribute("href"), location.href).href;
    await navigator.clipboard.writeText(url);
    feedback.textContent = "この場面のリンクをコピーしました。";
  } catch { feedback.textContent = "コピーできませんでした。ページのURLを使ってください。"; }
});
document.addEventListener("keydown", (event) => {
  if (event.altKey || event.ctrlKey || event.metaKey || ["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement.tagName)) return;
  if (event.key === "ArrowRight") showMoment(current + 1);
  if (event.key === "ArrowLeft") showMoment(current - 1);
});

searchInput.addEventListener("input", () => {
  const query = searchInput.value.trim().normalize("NFKC").toLocaleLowerCase("ja");
  let visible = 0;
  directoryCards.forEach((card, index) => {
    const moment = moments[index];
    const text = [moment.title, moment.speaker, moment.short, moment.lead, moment.context, moment.point].join(" ").normalize("NFKC").toLocaleLowerCase("ja");
    card.hidden = Boolean(query) && !text.includes(query);
    if (!card.hidden) visible++;
  });
  searchStatus.textContent = visible + "件のセリフ";
  searchEmpty.hidden = visible !== 0;
});
document.getElementById("random-scene").addEventListener("click", () => {
  const visible = directoryCards.filter((card) => !card.hidden);
  const candidates = visible.length ? visible : directoryCards;
  const pick = candidates[Math.floor(Math.random() * candidates.length)];
  location.assign(pick.href);
});

showMoment(0);
renderSaved();
