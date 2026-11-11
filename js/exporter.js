// 匯出備份：優先用分享表單（可以直接「儲存到檔案」），不支援才退回下載。
// 回傳：
//   "shared"     分享成功（才算已備份）
//   "cancelled"  使用者自己按了取消（不記、不退回下載）
//   "downloaded" 退回下載：沒辦法確認他有沒有存好，呼叫端要問他（backupFlow.js）
// 只有「不支援分享檔案」和「失去點擊手勢（NotAllowedError）」才退回下載；其他錯誤直接丟出去，由畫面顯示失敗提示（審核 A1）。

function defaultDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

export async function exportBackup({ nav = globalThis.navigator, text, filename, download = defaultDownload }) {
  const type = "application/json";
  if (nav?.share) {
    let file = null;
    try { file = new File([text], filename, { type }); } catch { /* 沒有 File 建構式就退回下載 */ }
    if (file && nav.canShare?.({ files: [file] })) { // 一定要 canShare 說可以分享檔案才用；沒有這個函式的舊瀏覽器直接下載
      try {
        await nav.share({ files: [file], title: filename });
        return "shared";
      } catch (e) {
        if (e?.name === "AbortError") return "cancelled"; // 使用者自己按了取消
        if (e?.name !== "NotAllowedError") throw e; // 失去點擊手勢以外的錯誤：是真的失敗，不能假裝有備份
      }
    }
  }
  download(new Blob([text], { type }), filename);
  return "downloaded";
}
