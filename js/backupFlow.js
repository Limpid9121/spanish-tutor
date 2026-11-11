// 匯出／匯入的流程（不碰畫面，方便測試；畫面層只負責把結果顯示出來）。
import { buildBackup, parseBackup, restoreBackup } from "./backup.js";
import { exportBackup } from "./exporter.js";

export function backupFilename(d = new Date()) {
  const p = (n) => String(n).padStart(2, "0");
  return `spanish-tutor-backup-${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}.json`;
}

// 錯誤物件可能是 null 或沒有 message（審核 B2），取訊息一律走這裡
export function errMessage(e) {
  return (e && typeof e === "object" && typeof e.message === "string" && e.message) || (typeof e === "string" && e) || "不明原因";
}

// 什麼時候才記「上次備份」：分享成功，或退回下載後他說「有存好」。取消、失敗、他說沒有，都不記。
export function shouldRecordBackup(outcome, confirmedSaved = false) {
  return outcome === "shared" || (outcome === "downloaded" && confirmedSaved === true);
}

// 建立匯出流程。busy 防連點：前一次還沒結束時，再按就直接回 "busy"（審核 B3）。
// deps：store、ask（退回下載時問「有存好嗎？」，回傳 true／false）、exporter（可換成假的）、now
export function makeExporter({ store, ask, exporter = exportBackup, now = () => new Date() }) {
  let busy = false;
  return async function runExport() {
    if (busy) return { status: "busy" };
    busy = true;
    try {
      const obj = await buildBackup(store, now());
      const result = await exporter({ text: JSON.stringify(obj), filename: backupFilename(now()) });
      let saved = false;
      if (result === "downloaded") saved = (await ask()) === true;
      const recorded = shouldRecordBackup(result, saved);
      if (recorded) {
        const at = now().getTime();
        await store.setMeta("lastBackup", at);
        return { status: result === "shared" ? "shared" : "downloaded-saved", count: obj.cards.length, lastBackup: at };
      }
      return { status: result === "cancelled" ? "cancelled" : "downloaded-unconfirmed", count: obj.cards.length };
    } catch (e) {
      return { status: "failed", message: `匯出失敗：${errMessage(e)}` };
    } finally {
      busy = false;
    }
  };
}

// 匯入流程：回傳 { status: "invalid" | "declined" | "failed" | "ok", message?, obj? }
export async function runImport({ store, text, confirmFn }) {
  let obj;
  try { obj = parseBackup(text); } catch (e) { return { status: "invalid", message: errMessage(e) }; }
  if (!(await confirmFn(obj))) return { status: "declined" };
  try {
    await restoreBackup(store, obj); // 一次完成，失敗時舊進度原封不動
  } catch (e) {
    return { status: "failed", message: `匯入失敗，原本的進度沒有動：${errMessage(e)}` };
  }
  return { status: "ok", message: "已匯入備份", obj };
}
