// 回報錯誤：卡片翻面後可以回報「中文怪、例句怪、發音怪、其他」，存在 IndexedDB、跟著備份走。
// 用 tools/list_reports.py <備份檔> 列成表，交給主對話修。
export const REASONS = [
  { key: "zh", label: "中文怪" },
  { key: "example", label: "例句怪" },
  { key: "audio", label: "發音怪" },
  { key: "other", label: "其他" },
];
export const NOTE_MAX = 200;

let seq = 0;

export function makeReport({ word, cardId, reason, note = "", now = new Date() }) {
  if (!word?.id) throw new Error("回報要指定單字");
  if (!REASONS.some((r) => r.key === reason)) throw new Error(`不認得的回報原因：${reason}`);
  return {
    id: `${now.getTime()}-${seq++}-${cardId}`, // 同一毫秒回報兩次也不會互相覆蓋
    wordId: word.id,
    es: word.es,
    cardId,
    reason,
    note: String(note ?? "").trim().slice(0, NOTE_MAX),
    at: now.getTime(),
  };
}
