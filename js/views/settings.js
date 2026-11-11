import { h, toast, TOAST_LONG_MS } from "../ui.js";
import { makeExporter, runImport } from "../backupFlow.js";
import { askBackupSaved } from "./sheet.js";
import * as speech from "../speech.js";
import { daysAgoText } from "../words.js";
import { loadAppVersion } from "../version.js";
import { sieveProgress, sieveStatus } from "../sieve.js";
import { answerModeOf } from "../practice.js";

// 新字來源的四個開關，順序固定（縮寫小詞包跟著「社群」）
const SOURCE_ROWS = [
  ["textbook", "課本詞表", "A1–B1 課本最常出現的字"],
  ["spoken", "口語", "電影字幕裡常聽到的字"],
  ["news", "新聞", "報紙與新聞常見的字（gobierno、guerra…）"],
  ["social", "社群", "日常與情緒用字、網路縮寫（feliz、jaja、xq…）"],
];

export async function renderSettings(root, ctx) {
  const { store } = ctx;
  let settings = await store.settings();
  let lastBackup = await store.getMeta("lastBackup");
  const persisted = (await navigator.storage?.persisted?.().catch(() => false)) ?? false;
  let reportCount = 0;
  try { reportCount = (await store.reports()).length; } catch { /* 讀不到就顯示 0 */ }
  let sieveText = "";
  const refreshSieveText = async () => { // 匯入後也要重算（審核 B5：以前只算一次，匯入後要離開再回來才正確）
    try {
      const p = sieveProgress(ctx.vocab, settings, await store.cards());
      const st = sieveStatus(settings);
      sieveText = st === "skipped" ? "已跳過" : st === null ? "還沒篩" : p.finished ? `已篩完 ${p.total} 個` : `已篩 ${p.done} ／ ${p.total}`;
    } catch { sieveText = ""; /* 讀不到就不顯示進度 */ }
  };
  await refreshSieveText();
  let appVersion = null;
  loadAppVersion().then((v) => { appVersion = v; updateSize(); });

  const save = async (patch) => {
    settings = { ...settings, ...patch }; // 先更新畫面上的值（連點時下一次點擊才會用到最新的）
    if (patch.fontSize) ctx.applyFontSize(settings.fontSize);
    redraw();
    try {
      await store.saveSettings(patch);
    } catch (e) {
      console.error(e);
      toast("設定沒有存到，請稍後再試");
    }
  };

  const stepper = () => h("div", { class: "stepper" },
    h("button", { type: "button", "aria-label": "減少", disabled: settings.newPerDay <= 0, onclick: () => save({ newPerDay: Math.max(0, settings.newPerDay - 1) }) }, "−"),
    h("output", { "aria-live": "polite" }, settings.newPerDay),
    h("button", { type: "button", "aria-label": "增加", disabled: settings.newPerDay >= 50, onclick: () => save({ newPerDay: Math.min(50, settings.newPerDay + 1) }) }, "+"));

  const sizes = [["s", "小"], ["m", "中"], ["l", "大"]];
  const seg = () => h("div", { class: "seg", role: "group", "aria-label": "字級" },
    sizes.map(([v, label]) => h("button", { type: "button", "aria-pressed": settings.fontSize === v ? "true" : "false", onclick: () => save({ fontSize: v }) }, label)));

  // 作答方式（第 1.3 批）：每列兩個選項；選「翻面」就是原本的翻面自評
  const modeSeg = (key, label, options) => h("div", { class: "seg", role: "group", "aria-label": label },
    options.map(([v, text]) => h("button", { type: "button", "aria-pressed": answerModeOf(settings)[key] === v ? "true" : "false", onclick: () => save({ answerMode: { ...answerModeOf(settings), [key]: v } }) }, text)));

  const toggle = () => h("button", { class: "switch", type: "button", role: "switch", "aria-label": "反向卡", "aria-checked": settings.reverse ? "true" : "false", onclick: () => save({ reverse: !settings.reverse }) });
  const sourceSwitch = (key, label) => h("button", {
    class: "switch", type: "button", role: "switch", "aria-label": `新字來源：${label}`, "aria-checked": settings.sources?.[key] === false ? "false" : "true",
    onclick: () => save({ sources: { ...settings.sources, [key]: settings.sources?.[key] === false } }),
  });

  const fileInput = h("input", { type: "file", accept: ".json,application/json", hidden: true, onchange: onImport });

  const runExport = makeExporter({ store, ask: askBackupSaved });
  async function onExport() {
    const r = await runExport();
    if (r.status === "busy") return; // 前一次還沒結束：忽略連點
    if (r.status === "failed") { toast(r.message, TOAST_LONG_MS); return; }
    if (r.status === "cancelled") { toast("已取消，沒有記成已備份"); return; }
    if (r.status === "downloaded-unconfirmed") { toast("沒有記成已備份。存好之後再按一次匯出"); return; }
    lastBackup = r.lastBackup;
    toast(`已匯出 ${r.count} 張卡片的進度`);
    redraw();
  }

  async function onImport() {
    const file = fileInput.files[0];
    fileInput.value = "";
    if (!file) return;
    const r = await runImport({
      store, text: await file.text(),
      confirmFn: (obj) => confirm(`匯入會取代這支手機上目前的所有進度（備份檔有 ${obj.cards.length} 張卡片）。確定嗎？`),
    });
    if (r.status === "declined") return;
    if (r.status !== "ok") { toast(r.message, TOAST_LONG_MS); return; }
    try {
      settings = await store.settings();
      ctx.applyFontSize(settings.fontSize);
      try { reportCount = (await store.reports()).length; } catch { /* 忽略 */ }
      lastBackup = await store.getMeta("lastBackup");
      await refreshSieveText();
    } catch (e) { console.error(e); }
    toast(r.message);
    redraw();
  }

  const sizeInfo = h("div", { class: "screen-info" });
  // safe-area 的實際值：用一個看不見的元素，padding 設成 env(safe-area-inset-*)，再讀算出來的值
  const probe = h("div", { "aria-hidden": "true", style: "position:fixed;left:0;top:0;width:0;height:0;visibility:hidden;padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)" });
  const updateSize = () => {
    const standalone = navigator.standalone === true || matchMedia("(display-mode: standalone)").matches;
    const cs = getComputedStyle(probe);
    const px = (v) => Math.round(parseFloat(v) || 0);
    sizeInfo.replaceChildren(
      h("div", {}, `螢幕 ${screen.width}×${screen.height}　視窗 ${window.innerWidth}×${window.innerHeight}　${Math.round(window.devicePixelRatio * 100) / 100}x`),
      h("div", {}, `安全區　上 ${px(cs.paddingTop)}　右 ${px(cs.paddingRight)}　下 ${px(cs.paddingBottom)}　左 ${px(cs.paddingLeft)}`),
      h("div", {}, `${standalone ? "主畫面模式" : "瀏覽器模式"}　版本 ${appVersion ?? "？"}`),
      standalone ? null : h("div", {}, "請加入主畫面後再看這一頁，數字才準"));
  };
  window.addEventListener("resize", updateSize);

  function voiceRow() {
    return speech.available()
      ? h("div", { class: "row" }, h("div", { class: "label" }, "發音", h("small", {}, `使用 ${speech.voiceInfo()}`)))
      : h("div", { class: "row" }, h("div", { class: "label" }, "發音", h("small", {}, "這台裝置沒有西文聲音，所以喇叭鍵是灰的。到 iPhone「設定 › 輔助使用 › 朗讀內容 › 聲音」下載西文後再回來看看。")));
  }

  function redraw() {
    root.replaceChildren(
      h("h1", { class: "title" }, "設定"),
      h("div", { class: "group" },
        h("div", { class: "row" }, h("div", { class: "label" }, "每天新字"), stepper()),
        h("div", { class: "row" }, h("div", { class: "label" }, "反向卡", h("small", {}, "看中文，想西文")), toggle()),
        h("div", { class: "row" }, h("div", { class: "label" }, "字級"), seg()),
        voiceRow()),
      h("div", { class: "group" },
        h("p", { class: "group-title" }, "作答方式"),
        h("div", { class: "row" }, h("div", { class: "label" }, "看中文的卡", h("small", {}, "要先開上面的反向卡才會出現")), modeSeg("r", "看中文的卡的作答方式", [["type", "打字"], ["flip", "翻面"]])),
        h("div", { class: "row" }, h("div", { class: "label" }, "看西文的卡"), modeSeg("f", "看西文的卡的作答方式", [["choice", "選擇題"], ["flip", "翻面"]])),
        h("p", { class: "note" }, "不管怎麼作答，翻面後都由你按四個鍵評分；打字或選擇題只會標出建議的那一個。")),
      h("div", { class: "group" },
        h("p", { class: "group-title" }, "新字來源"),
        SOURCE_ROWS.map(([key, label, hint]) => h("div", { class: "row" }, h("div", { class: "label" }, label, h("small", {}, hint)), sourceSwitch(key, label))),
        SOURCE_ROWS.every(([key]) => settings.sources?.[key] === false) ? h("p", { class: "note" }, "全部關掉就不會有新字。") : null),
      h("div", { class: "group" },
        h("a", { class: "row", href: "#/sieve" }, h("span", { class: "label" }, "快速篩字", h("small", {}, "把你已經會的字挑出來，不再出現在新字裡")), h("span", { class: "muted small" }, sieveText)),
        h("button", { class: "row", type: "button", onclick: onExport }, h("span", { class: "label" }, "匯出備份"), h("span", { class: "muted small" }, `上次：${daysAgoText(lastBackup)}`)),
        h("button", { class: "row", type: "button", onclick: () => fileInput.click() }, h("span", { class: "label" }, "匯入備份")),
        h("div", { class: "row" }, h("span", { class: "label" }, "回報的卡片", h("small", {}, "卡片翻面後，按例句下方的「回報問題」；會跟著備份一起存")), h("span", { class: "muted small" }, `已回報 ${reportCount} 個`)),
        fileInput,
        h("p", { class: "note" }, persisted ? "進度只存在這支手機，瀏覽器已承諾不自動清除。換手機前記得先匯出。" : "進度只存在這支手機，瀏覽器沒有承諾一直保留。請定期匯出備份。")),
      h("div", { class: "group" },
        h("a", { class: "row", href: "#/credits" }, h("span", { class: "label" }, "出處與授權"), h("span", { class: "muted" }, "›"))),
      sizeInfo, probe);
    updateSize();
  }
  redraw();
  return () => window.removeEventListener("resize", updateSize);
}
