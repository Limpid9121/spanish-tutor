// 進入點：路由（hash）、資料載入、service worker 註冊。
import { Store, idbBackend } from "./store.js";
import { loadVocab } from "./data.js";
import * as speech from "./speech.js";
import { h } from "./ui.js";
import { startupMessage } from "./errors.js";
import { renderToday } from "./views/today.js";
import { renderVocab, renderWord } from "./views/vocab.js";
import { renderReview } from "./views/review.js";
import { renderSettings } from "./views/settings.js";
import { renderCredits } from "./views/credits.js";
import { renderSieve } from "./views/sieve.js";

const app = document.getElementById("app");
const ctx = {
  store: new Store(idbBackend()),
  applyFontSize(size) { document.documentElement.dataset.size = size; },
};

let cleanup = null;
let navToken = 0;

function parse() {
  const hash = location.hash.replace(/^#\/?/, "");
  const [name, ...rest] = hash.split("/");
  return { name: name || "today", arg: rest.length ? decodeURIComponent(rest.join("/")) : null };
}

async function route() {
  const token = ++navToken;
  if (cleanup) { try { cleanup(); } catch { /* 忽略 */ } cleanup = null; }
  const { name, arg } = parse();
  const root = h("div");
  const tab = { today: "today", review: "today", vocab: "vocab", word: "vocab", settings: "settings", credits: "settings", sieve: "settings" }[name] ?? "today";
  document.querySelectorAll("#tabbar a").forEach((a) => {
    if (a.dataset.tab === tab) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current");
  });
  try {
    let c;
    if (name === "vocab") c = await renderVocab(root, ctx);
    else if (name === "word") c = await renderWord(root, ctx, arg);
    else if (name === "review") c = await renderReview(root, ctx);
    else if (name === "settings") c = await renderSettings(root, ctx);
    else if (name === "credits") c = await renderCredits(root, ctx);
    else if (name === "sieve") c = await renderSieve(root, ctx);
    else c = await renderToday(root, ctx);
    if (token !== navToken) { if (typeof c === "function") c(); return; }
    cleanup = typeof c === "function" ? c : null;
    if (name !== "review" && name !== "sieve") document.body.classList.remove("in-review");
    app.replaceChildren(root);
    window.scrollTo(0, 0);
  } catch (e) {
    console.error(e);
    app.replaceChildren(h("p", { class: "empty" }, `出了點問題：${e.message}`));
  }
}

function syncVoice() {
  const ok = speech.available();
  document.querySelectorAll(".speak").forEach((b) => b.setAttribute("aria-disabled", ok ? "false" : "true"));
}

async function askPersist() {
  try {
    if (await ctx.store.getMeta("persistAsked")) return;
    const granted = (await navigator.storage?.persist?.()) ?? false;
    await ctx.store.setMeta("persistAsked", true);
    await ctx.store.setMeta("persisted", !!granted);
  } catch { /* 沒有 storage API 就算了 */ }
}

async function start() {
  let stage = "content";
  try {
    Object.assign(ctx, await loadVocab());
    stage = "storage"; // 接下來是讀儲存空間（IndexedDB）：出錯要講儲存，不能說成單字資料壞了
    ctx.applyFontSize((await ctx.store.settings()).fontSize);
  } catch (e) {
    console.error(e);
    app.replaceChildren(h("p", { class: "empty" }, startupMessage(stage, e)));
    return;
  }
  window.addEventListener("hashchange", route);
  speech.onChange(syncVoice);
  await route();
  askPersist();
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js").catch((e) => console.warn("service worker 註冊失敗", e));
  }
}

start();
