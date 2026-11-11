// 啟動失敗時給使用者看的訊息：要講對是哪一段壞了（審核第 5 題：儲存空間出錯不能說成「讀不到單字資料」）。
export function startupMessage(stage, e) {
  const detail = e?.message ?? String(e);
  if (stage === "storage") return `這支手機的儲存空間（存學習進度的地方）打不開：${detail}。請完全關掉 App 再重新開啟；如果一直這樣，進度可能存不起來。`;
  return `讀不到單字資料：${detail}`;
}

// 開機卡住（逾時）時的訊息：index.html 的看門狗也用同一句（tests/messages.test.mjs 檢查兩邊一致）
export const SLOW_START_MESSAGE = "載入比預期久。請完全關掉再重新開啟；如果一直這樣，可能是另一個開著的分頁擋住了儲存空間，請把其他分頁都關掉。";
